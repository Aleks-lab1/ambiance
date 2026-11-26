// Simulateur multijoueur : n vues (A = hôte, B, C…) d'un module de jeu en ligne, côte à côte dans une
// seule page, branchées directement sur la logique de l'hôte (init / action / tick / view), sans réseau.
//   const t = await mp('/js/online/soiree.js', 'curseurOnline', { rounds: 2 }, 3);
//   await t.at('B').getByRole('button', { name: 'Valider' }).click();
//   t.txt('A') → texte affiché chez A ; t.state() → { phase, log } ; t.page.evaluate(() => window.__h.s) → état
const { open } = require('./pw-helper.cjs');

async function mp(modPath, exportName, settings = {}, n = 3) {
  const { browser, page, errors } = await open('', { viewport: { width: 1200, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  await page.waitForTimeout(400);
  await page.evaluate(async ({ modPath, exportName, settings, n }) => {
    const mod = await import(modPath);
    const G = exportName === 'default' ? mod.default : mod[exportName];
    const { h } = await import('/js/ui.js');
    const ids = ['A', 'B', 'C', 'D', 'E'].slice(0, n);
    const names = { A: 'Alice', B: 'Bob', C: 'Chloé', D: 'David', E: 'Emma' };
    const room = { host: 'A', players: ids.map((pid) => ({ pid, name: names[pid], score: 0, on: true })) };
    const st = { ...G.defaults, ...settings };
    const wrap = h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: '8px', padding: '8px' } });
    document.getElementById('app').replaceChildren(wrap);
    const H = { G, room, s: null, views: {}, log: [] };
    window.__h = H;
    H.s = G.init(room, st, { now: () => Date.now(), relay() {}, sendTo() {}, toastAll() {} });
    const push = () => { for (const pid of ids) H.views[pid].update(room, G.view(room, H.s, pid)); };
    H.push = push;
    for (const pid of ids) {
      const root = h('div', { class: 'screen game-screen', id: 'v-' + pid, style: { padding: '8px', border: '1px solid #fff3' } });
      wrap.append(root);
      const g = {
        me: pid, isHost: pid === 'A', now: () => Date.now(), nameOf: (p) => names[p] || '?', hostBar: () => h('div', { class: 'hostbar' }, 'HOSTBAR'),
        send: (a) => {
          if (a.type === 'lobby:end' || a.type === 'lobby:restart') return;
          let ok = false;
          try { ok = G.action(room, H.s, pid, a, {}); } catch (e) { H.log.push('ERR ' + e.message); }
          if (ok) push();
        },
      };
      g.room = room;
      H.views[pid] = G.mount(root, g);
    }
    setInterval(() => { try { if (G.tick && G.tick(room, H.s, {})) push(); } catch (e) { H.log.push('TICK ' + e.message); } }, 200);
    // Jeux en temps réel (frame, ex. Dans la foule) : la partie avance à chaque image, comme chez l'hôte.
    if (G.frame) {
      let last = performance.now();
      const loop = (ts) => {
        requestAnimationFrame(loop);
        const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000)); last = ts;
        try { if (G.frame(room, H.s, dt, {})) push(); } catch (e) { H.log.push('FRAME ' + e.message); }
      };
      requestAnimationFrame(loop);
    }
    push();
  }, { modPath, exportName, settings, n });
  const txt = async (pid) => (await page.locator('#v-' + pid).innerText()).replace(/\n+/g, ' | ');
  const at = (pid) => page.locator('#v-' + pid);
  const state = () => page.evaluate(() => ({ phase: window.__h.s.phase, log: window.__h.log }));
  const get = (fn) => page.evaluate(fn);
  return { browser, page, errors, txt, at, state, get };
}

module.exports = { mp };
