// Écran télé simulé : l'écran télé (1280 × 720) d'un jeu en ligne, branché directement sur la logique de
// l'hôte (init / action / tick / tv), sans réseau ni téléphones. Comme en TV Mode, la télé reçoit la vue
// telle quelle (sans copie) : un écran qui garde un tableau de la vue doit le copier lui-même.
//   const t = await tvSim();
//   await t.load('/js/online/vote.js', 'voteTP', {}, 4);   // jeu, réglages, nombre de joueurs (A = chef, B, C…)
//   await t.act('B', { type: 'vote', v: 0 });              // action envoyée par le joueur B
//   await t.txt() → texte de l'écran ; await t.fits() → tout tient dans l'écran ; await t.shot('vote') si SHOTS=1
//   await t.get(() => window.__tv.s) → état de l'hôte ; (await t.state()).log → erreurs levées par le module
// Jeux en temps réel (module.frame, ex. Dans la foule) : frame() est appelé à chaque image.
const path = require('path');
const fs = require('fs');
const { open } = require('./pw-helper.cjs');

async function tvSim({ width = 1280, height = 720 } = {}) {
  const { browser, page, errors } = await open('', { viewport: { width, height }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  await page.waitForTimeout(400);
  const load = (modPath, exportName, settings = {}, n = 4) => page.evaluate(async ({ modPath, exportName, settings, n }) => {
    const old = window.__tv;
    if (old) { clearInterval(old.iv); try { old.ui.destroy(); } catch { /* */ } }
    const mod = await import(modPath);
    const G = exportName === 'default' ? mod.default : mod[exportName];
    const { createTvUi } = await import('/js/online/tv.js');
    const ids = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, n);
    const names = { A: 'Alice', B: 'Bob', C: 'Chloé', D: 'David', E: 'Emma', F: 'Farid' };
    const room = { host: 'A', code: 'ABCD', tvHost: true, players: ids.map((pid) => ({ pid, name: names[pid], score: 0, on: true })) };
    const api = { now: () => Date.now(), relay() {}, sendTo() {}, toastAll() {} };
    const H = { G, room, s: null, log: [] };
    window.__tv = H;
    H.s = G.init(room, { ...G.defaults, ...settings }, api);
    H.ui = createTvUi(document.getElementById('app'), { now: () => Date.now(), joinUrl: (c) => location.origin + '/#/join/' + c, qr: () => {} });
    H.push = () => {
      let v;
      try { v = G.tv ? G.tv(room, H.s) : { ended: H.s.phase === 'end' || H.s.over === true }; } catch (e) { H.log.push('TV ' + e.message); return; }
      try {
        H.ui.render({ tv: true, code: room.code, host: room.host, pick: null, tvs: 0, tvHost: true, votes: {},
          players: room.players.map((p) => ({ pid: p.pid, name: p.name, score: p.score, on: p.on })),
          game: { type: G.id, special: !!G.tv, v } });
      } catch (e) { H.log.push('RENDER ' + e.message); console.error(e); }
    };
    H.act = (pid, a) => { let ok = false; try { ok = G.action(room, H.s, pid, a, api); } catch (e) { H.log.push('ERR ' + e.message); } if (ok) H.push(); return ok; };
    H.iv = setInterval(() => { try { if (G.tick && G.tick(room, H.s, api)) H.push(); } catch (e) { H.log.push('TICK ' + e.message); } }, 200);
    // Jeux en temps réel (frame) : la partie avance à chaque image, comme chez l'hôte (Host.startFrames).
    if (G.frame) {
      let last = performance.now();
      const loop = (ts) => {
        if (window.__tv !== H) return;
        requestAnimationFrame(loop);
        const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000)); last = ts;
        try { if (G.frame(room, H.s, dt, api)) H.push(); } catch (e) { H.log.push('FRAME ' + e.message); }
      };
      requestAnimationFrame(loop);
    }
    H.push();
  }, { modPath, exportName, settings, n });
  const act = (pid, a) => page.evaluate(([p, x]) => window.__tv.act(p, x), [pid, a]);
  const txt = async () => (await page.locator('.tv-stage').innerText()).replace(/\s+/g, ' ');
  const get = (fn, arg) => page.evaluate(fn, arg);
  const state = () => page.evaluate(() => ({ phase: window.__tv.s.phase, log: window.__tv.log }));
  // Rien ne dépasse de l'écran : la scène de la télé ne déborde pas (elle est coupée, .tv est en overflow: hidden).
  const fits = () => page.evaluate(() => { const st = document.querySelector('.tv-stage'); return st.scrollHeight <= st.clientHeight + 4 && st.scrollWidth <= st.clientWidth + 4; });
  const shot = async (name) => {
    if (!process.env.SHOTS) return;
    const dir = path.join(__dirname, '..', 'out');
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, 'tv-' + name + '.png') });
  };
  return { browser, page, errors, load, act, txt, get, state, fits, shot };
}

module.exports = { tvSim };
