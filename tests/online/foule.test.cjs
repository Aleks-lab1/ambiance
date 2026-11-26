// Dans la foule (TV Mode seulement, js/online/foule.js + js/foule-core.js + js/foule-art.js) :
// 1. la logique de la place (passants, fontaines, poussées) ;
// 2. une vraie partie sur l'écran télé simulé (tests/lib/tv-sim.cjs) : compte à rebours, manette, fontaines,
//    joueur poussé (éliminé), passant poussé (il se relève), victoire, révélation, manche suivante, podium ;
// 3. la manette des téléphones (tests/lib/mp.cjs) : joystick au doigt, clavier, bouton « Pousser », éliminé, fin.
// Avec SHOTS=1 : captures dans tests/out/.
const { tvSim } = require('../lib/tv-sim.cjs');
const { mp } = require('../lib/mp.cjs');
const { check, run } = require('../lib/check.cjs');

const W = (ms) => new Promise((r) => setTimeout(r, ms));

run(async () => {
  const t = await tvSim();

  // ---------- 1. Logique de la place ----------
  const core = await t.get(async () => {
    const C = await import('/js/foule-core.js');
    const out = {};
    const inF = (c, mx = 1) => C.FOUNTAINS.some((f) => ((c.x - f.x) / (92 * mx)) ** 2 + ((c.y - f.y) / (48 * mx)) ** 2 < 1);
    const w = C.makeWorld(36);
    out.n = w.chars.length;
    out.spawnOk = w.chars.every((c) => !inF(c) && c.m === 'up');
    // 30 s de promenade : les passants bougent, restent sur la place, hors des fontaines, jamais plus vite que les joueurs.
    const start = w.chars.map((c) => [c.x, c.y]);
    let maxV = 0, pushes = 0, happy = 0;
    for (let k = 0; k < 1800; k++) {
      const before = w.chars.map((c) => c.push);
      C.step(w, 1 / 60);
      w.chars.forEach((c, i) => { maxV = Math.max(maxV, Math.hypot(c.vx, c.vy)); if (c.push !== before[i]) pushes++; if (w.t - c.happy < 0.02) happy++; });
    }
    out.moved = w.chars.filter((c, i) => Math.hypot(c.x - start[i][0], c.y - start[i][1]) > 40).length;
    out.inside = w.chars.filter((c) => inF(c, 0.97)).length;
    out.outZone = w.chars.filter((c) => c.x < C.ZONE.x0 - 11 || c.x > C.ZONE.x1 + 11 || c.y < C.ZONE.y0 - 11 || c.y > C.ZONE.y1 + 11).length;
    out.maxV = maxV; out.pushes = pushes; out.happy = happy;
    // Un joueur (manette vers la droite) avance à la vitesse des passants.
    const w2 = C.makeWorld(2);
    Object.assign(w2.chars[0], { x: 300, y: 780 }); Object.assign(w2.chars[1], { x: 1300, y: 300 });
    for (let k = 0; k < 60; k++) C.step(w2, 1 / 60, { 0: 0, 1: -1 });
    out.walk = Math.round(w2.chars[0].x - 300);
    out.still = Math.round(Math.hypot(w2.chars[1].x - 1300, w2.chars[1].y - 300));
    // Pousser : le voisin tombe, puis se relève (passant).
    Object.assign(w2.chars[1], { x: 350, y: 780, vx: 0, vy: 0 }); w2.chars[0].x = 300; w2.chars[0].f = 1;
    out.target = C.tryPush(w2, 0);
    out.busy = C.tryPush(w2, 0);
    for (let k = 0; k < 15; k++) C.step(w2, 1 / 60, { 0: -1, 1: -1 });
    out.fell = w2.chars[1].m;
    for (let k = 0; k < 200; k++) C.step(w2, 1 / 60, { 0: -1, 1: -1 });
    out.up = w2.chars[1].m;
    Object.assign(w2.chars[1], { x: 900, y: 300 });
    for (let k = 0; k < 40; k++) C.step(w2, 1 / 60, { 0: -1, 1: -1 });
    out.air = C.tryPush(w2, 0);
    // Toucher une fontaine.
    out.touch = C.touching({ x: C.FOUNTAINS[2].x, y: C.FOUNTAINS[2].y + 52 });
    out.noTouch = C.touching({ x: C.FOUNTAINS[2].x, y: C.FOUNTAINS[2].y + 75 });
    return out;
  });
  check(core.n === 36 && core.spawnOk, '36 bonshommes debout, aucun dans une fontaine', core);
  check(core.moved > 20 && !core.inside && !core.outZone, `les passants se promènent (${core.moved}/36) sans sortir de la place ni entrer dans les fontaines`, core);
  check(core.maxV <= 52 * 1.01 && core.pushes === 0, 'les passants marchent à la vitesse des joueurs et ne poussent jamais', core);
  check(core.happy > 5, 'les passants vont aussi toucher les fontaines (ils ont l\'air contents)', core.happy);
  check(core.walk > 35 && core.walk < 52 && core.still < 2, `manette vers la droite : le bonhomme avance (${core.walk} en 1 s), l'autre reste immobile`, core);
  check(core.target === 1 && core.busy === -2 && core.fell === 'down' && core.up === 'up', 'pousser : le voisin tombe, puis se relève', core);
  check(core.air === -1 && core.touch === 2 && core.noTouch === -1, 'poussée dans le vide, fontaine touchée seulement contre son bord', core);

  // ---------- 2. Une partie sur l'écran télé ----------
  await t.load('/js/online/foule.js', 'fouleOnline', { rounds: 2, time: 90 }, 4);
  const S = (fn, arg) => t.get(fn, arg);
  // Place des joueurs (et des passants, par leur numéro) ; les autres bonhommes sont écartés pour que la scène soit nette.
  const place = (...spots) => S((spots) => {
    const s = window.__tv.s;
    const idx = spots.map(([p]) => (typeof p === 'number' ? p : s.who[p]));
    s.world.chars.forEach((o, j) => {
      if (!idx.includes(j) && o.m === 'up' && spots.some(([, x, y]) => Math.hypot(o.x - x, (o.y - y) * 1.6) < 170)) { o.x = 1350; o.y = 230 + (j * 17) % 560; }
    });
    spots.forEach(([p, x, y], k) => {
      Object.assign(s.world.chars[idx[k]], { x, y, vx: 0, vy: 0, kx: 0, ky: 0, ai: 0, w: 9 });
      if (typeof p !== 'number') s.input[p] = { d: -1, at: s.world.t };
    });
  }, spots);
  const see = async (step, re) => {
    const txt = await t.txt();
    check(re.test(txt), `télé (${step}) : ${re}`, txt.slice(0, 200));
    check(await t.fits(), `télé (${step}) : tout tient dans l'écran`);
    await t.shot('foule-' + step.replace(/\W+/g, '-'));
  };
  await W(600);
  const frozen1 = await S(() => window.__tv.s.world.chars.map((c) => c.x + ',' + c.y).join());
  await see('compte à rebours', /Manche 1 \/ 2.*[123]/);
  await W(700);
  const frozen2 = await S(() => window.__tv.s.world.chars.map((c) => c.x + ',' + c.y).join());
  check(frozen1 === frozen2 && (await t.state()).phase === 'ready', 'compte à rebours : personne ne bouge');
  const painted = await S(() => {
    const cv = document.querySelector('.foule-cv');
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let pink = 0; for (let i = 0; i < d.length; i += 16) if (d[i + 3] && Math.abs(d[i] - d[i + 1]) > 60) pink++;
    return { w: cv.width, h: cv.height, colored: pink };
  });
  check(painted.w > 600 && painted.colored > 500, 'la place et la foule sont dessinées', painted);
  for (let k = 0; k < 40 && (await t.state()).phase !== 'play'; k++) await W(150);
  await see('partez', /Partez/);
  check(/1:2\d|1:30/.test(await t.txt()), 'le chrono de la manche démarre');

  // La manette de Bob : vers la droite.
  await place(['B', 300, 790]);
  await t.act('B', { type: 'mv', d: 0 });
  await W(1000);
  const bx = await S(() => window.__tv.s.world.chars[window.__tv.s.who.B].x);
  check(bx > 330, 'la manette de Bob fait avancer son bonhomme', bx);
  await t.act('B', { type: 'mv', d: -1 });

  // Bob touche sa première fontaine.
  const f1 = await S(() => { const s = window.__tv.s; return s.order.B[0]; });
  const F = await S(async () => (await import('/js/foule-core.js')).FOUNTAINS.map((f) => ({ x: f.x, y: f.y, name: f.name })));
  await place(['B', F[f1].x, F[f1].y + 52]);
  await W(400);
  const vb = await S(() => window.__tv.G.view(window.__tv.room, window.__tv.s, 'B'));
  check(vb.me.done === 1 && /Fontaine .* touchée/.test(vb.msg.text), `Bob touche sa 1re fontaine (${F[f1].name}) : son téléphone le sait`, vb);
  check(!/touchée/.test(await t.txt()), 'la télé ne dit pas qui a touché une fontaine');

  // Chloé pousse David : il est éliminé, +1 pour Chloé.
  await place(['C', 640, 800], ['D', 690, 800]);
  await t.act('C', { type: 'push' });
  await W(500);
  const r1 = await S(() => { const T = window.__tv; return { m: T.s.world.chars[T.s.who.D].m, out: T.s.out.D, score: T.room.players.find((p) => p.pid === 'C').score, vd: T.G.view(T.room, T.s, 'D'), vc: T.G.view(T.room, T.s, 'C') }; });
  check(r1.m === 'out' && r1.out === 'C' && r1.score === 1, 'Chloé pousse David : il est éliminé, +1 pour Chloé', r1);
  check(r1.vd.me.outBy === 'Chloé' && /Chloé t'a fait tomber/.test(r1.vd.msg.text) && /Tu as fait tomber David/.test(r1.vc.msg.text), 'les téléphones de David et Chloé le disent', [r1.vd.msg, r1.vc.msg]);
  await see('éliminé', /David est éliminé/);

  // Alice pousse un passant : il tombe puis se relève ; Alice est prévenue (et doit attendre plus longtemps).
  const bot = await S(() => { const s = window.__tv.s, mine = new Set(Object.values(s.who)); return s.world.chars.findIndex((c, i) => !mine.has(i) && c.m === 'up'); });
  await place(['A', 980, 800], [bot, 1030, 800]);
  await t.act('A', { type: 'push' });
  await W(400);
  const r2 = await S(([b]) => { const T = window.__tv; return { m: T.s.world.chars[b].m, va: T.G.view(T.room, T.s, 'A') }; }, [bot]);
  check(r2.m === 'down' && /c'était un passant/.test(r2.va.msg.text) && r2.va.me.cd.dur > 4, 'Alice pousse un passant : il tombe, Alice est prévenue (recharge plus longue)', r2);
  await see('passant', /Un passant est tombé/);
  await W(3200);
  check(await S(([b]) => window.__tv.s.world.chars[b].m, [bot]) === 'up', 'le passant se relève');
  check(!(await t.act('A', { type: 'push' })), 'Alice ne peut pas repousser tout de suite');

  // Bob touche ses 4 fontaines : il gagne la manche, la télé révèle qui était qui.
  for (let k = 1; k < 4; k++) {
    const f = await S(([k]) => window.__tv.s.order.B[k], [k]);
    await place(['B', F[f].x, F[f].y + 52]);
    await W(350);
  }
  const r3 = await S(() => { const T = window.__tv; return { phase: T.s.phase, score: T.room.players.find((p) => p.pid === 'B').score, rev: T.G.tv(T.room, T.s).reveal }; });
  check(r3.phase === 'reveal' && r3.score === 3 && r3.rev.length === 4 && r3.rev.find((x) => x.name === 'David').out, 'Bob touche ses 4 fontaines : +3, la télé révèle les 4 joueurs', r3);
  await W(300);
  await see('révélation', /Bob a touché ses 4 fontaines/);

  // Manche 2 (nouvelle place, autre couleur).
  for (let k = 0; k < 60 && (await t.state()).phase === 'reveal'; k++) await W(150);
  const r4 = await S(() => ({ round: window.__tv.s.round, phase: window.__tv.s.phase, n: Object.keys(window.__tv.s.who).length }));
  check(r4.round === 2 && r4.phase === 'ready' && r4.n === 4, 'manche 2 : les 4 joueurs sont de retour (David aussi)', r4);
  await see('manche 2', /Manche 2 \/ 2/);
  for (let k = 0; k < 40 && (await t.state()).phase !== 'play'; k++) await W(150);

  // Dernier debout : Alice fait tomber Bob et Chloé, David quitte la partie.
  await place(['A', 400, 800], ['B', 450, 800]);
  await t.act('A', { type: 'push' }); await W(2700);
  await place(['A', 900, 800], ['C', 950, 800]);
  await t.act('A', { type: 'push' }); await W(500);
  await S(() => { const T = window.__tv; T.room.players.find((p) => p.pid === 'D').on = false; T.G.onLeave(T.room, T.s, 'D'); T.push(); });
  const r5 = await S(() => { const T = window.__tv; return { phase: T.s.phase, how: T.s.winner && T.s.winner.how, a: T.room.players.find((p) => p.pid === 'A').score }; });
  check(r5.phase === 'reveal' && r5.how === 'last' && r5.a === 2 + 2, 'Alice, dernière debout, gagne la manche (+2, en plus de ses 2 joueurs poussés)', r5);
  await see('dernier debout', /Alice est le dernier debout/);
  for (let k = 0; k < 60 && (await t.state()).phase !== 'end'; k++) await W(150);
  await W(500);
  await see('podium', /Fin de la partie/);
  const { log } = await t.state();
  check(!log.length, 'aucune erreur du jeu (télé)', log);
  check(!t.errors.length, 'aucune erreur JS (télé)', t.errors);
  await t.browser.close();

  // ---------- 3. La manette des téléphones ----------
  const m = await mp('/js/online/foule.js', 'fouleOnline', { rounds: 1, time: 90 }, 3);
  const M = (fn, arg) => m.get(fn, arg);
  await m.page.waitForTimeout(400);
  check(/Manche 1 \/ 1/.test(await m.txt('A')) && await m.at('A').locator('.fp-goal').count() === 4, 'téléphone : manche, 4 fontaines à toucher dans l\'ordre');
  check(/Dès que ça part, bouge pour te trouver/.test(await m.txt('B')), 'téléphone : « bouge pour te trouver » pendant le compte à rebours');
  for (let k = 0; k < 40 && (await m.state()).phase !== 'play'; k++) await W(150);
  const nextName = await M(async () => { const F = (await import('/js/foule-core.js')).FOUNTAINS; return F[window.__h.s.order.A[0]].name; });
  check(new RegExp('Va toucher la fontaine ' + nextName).test(await m.txt('A')), `téléphone : « Va toucher la fontaine ${nextName} »`);
  // Joystick : on glisse le doigt (souris) depuis le centre de la zone.
  const box = await m.at('A').locator('.fp-stick').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await m.page.mouse.move(cx, cy); await m.page.mouse.down();
  await m.page.mouse.move(cx + 60, cy + 2, { steps: 4 }); await W(100);
  const d1 = await M(() => window.__h.s.input.A && window.__h.s.input.A.d);
  await m.page.mouse.move(cx + 2, cy + 60, { steps: 4 }); await W(100);
  const d2 = await M(() => window.__h.s.input.A.d);
  await m.page.mouse.move(cx - 50, cy - 50, { steps: 4 }); await W(100);
  const d3 = await M(() => window.__h.s.input.A.d);
  await m.page.mouse.up(); await W(100);
  const d4 = await M(() => window.__h.s.input.A.d);
  check(d1 === 0 && d2 === 4 && d3 === 10 && d4 === -1, 'joystick : droite, bas, haut-gauche, puis lâché = immobile', [d1, d2, d3, d4]);
  await m.page.keyboard.down('ArrowLeft'); await W(100);
  const k1 = await M(() => window.__h.s.input.A.d);
  await m.page.keyboard.up('ArrowLeft'); await W(100);
  check(k1 === 8 && await M(() => window.__h.s.input.A.d) === -1, 'clavier : flèche gauche = vers la gauche');
  // Bob pousse Chloé avec le bouton.
  await M(() => {
    const s = window.__h.s, b = s.world.chars[s.who.B], c = s.world.chars[s.who.C];
    s.world.chars.forEach((o) => { if (o !== b && o !== c && Math.hypot(o.x - 700, o.y - 800) < 220) { o.x = 1350; o.y = 300; } });
    Object.assign(b, { x: 650, y: 800, vx: 0, vy: 0, f: 1 }); Object.assign(c, { x: 700, y: 800, vx: 0, vy: 0 });
  });
  await m.at('B').locator('.fp-push').dispatchEvent('pointerdown');
  await W(600);
  check(await m.at('B').locator('.fp-push.cool').count() === 1, 'bouton « Pousser » : il se recharge après la poussée');
  check(/Tu as fait tomber Chloé/.test(await m.txt('B')), 'Bob : « Tu as fait tomber Chloé ! +1 »', await m.txt('B'));
  check(/Tu es tombé ! Bob t'a poussé/.test(await m.txt('C')) && !(await m.at('C').locator('.fp-ctrl:not(.hidden)').count()), 'Chloé : éliminée, plus de manette', await m.txt('C'));
  // Dernier debout ? Non : il reste Alice et Bob. Fin de la manche par le temps.
  await M(() => { window.__h.s.until = window.__h.s.world.t; });
  await W(500);
  check(/Temps écoulé/.test(await m.txt('A')), 'temps écoulé : annoncé sur les téléphones', await m.txt('A'));
  for (let k = 0; k < 60 && (await m.state()).phase !== 'end'; k++) await W(150);
  await W(300);
  check(/Fin de la partie/.test(await m.txt('A')) && /HOSTBAR/.test(await m.txt('A')), 'fin : classement et boutons du chef');
  const st = await m.state();
  check(!st.log.length, 'aucune erreur du jeu (téléphones)', st.log);
  check(!m.errors.length, 'aucune erreur JS (téléphones)', m.errors);
  await m.browser.close();
});
