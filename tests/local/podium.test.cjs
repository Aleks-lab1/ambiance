// Podium de fin de partie (js/podium.js) : déroulé du spectacle (3e, 2e, roulement, gagnant dévoilé), confettis,
// podium refait par une mise à jour (le spectacle continue sans repartir ni rejouer les sons), sortie de l'écran
// (sons coupés, confettis retirés), égalités, « toi », tableau des scores en direct, animations réduites.
const { open } = require('../lib/pw-helper.cjs');
const { check, run, wait } = require('../lib/check.cjs');

const PLAYERS = [{ name: 'Alice', score: 12 }, { name: 'Bob', score: 9 }, { name: 'Chloé', score: 7 }, { name: 'David', score: 4 }, { name: 'Emma', score: 2 }];

run(async () => {
  const { browser, page, errors } = await open('');
  await page.waitForTimeout(500);
  // Les sons sont remplacés par un compteur (on vérifie qu'ils partent une seule fois, et qu'on les coupe).
  await page.evaluate(async () => {
    const { sfx } = await import('/js/sfx.js');
    window.__party = []; window.__stopped = 0;
    sfx.party = (plan) => { window.__party.push(plan); return () => { window.__stopped++; }; };
    const { podium } = await import('/js/common.js');
    const { h } = await import('/js/ui.js');
    window.show = (list, opts) => { document.querySelector('#app').replaceChildren(h('div', { class: 'screen' }, podium(list, opts))); };
  });
  const state = () => page.evaluate(() => {
    const st = [...document.querySelectorAll('.podium .st')].map((e) => ({ name: e.querySelector('.nm').textContent, cls: e.className, score: e.querySelector('.pod-score').textContent }));
    const show = document.querySelector('.podium-show');
    return {
      st, revealed: show.classList.contains('revealed'), ribbon: (show.querySelector('.pod-ribbon') || {}).textContent,
      rows: [...document.querySelectorAll('.pod-rest .score-row')].map((r) => ({ t: r.textContent, on: r.classList.contains('on') })),
      canvases: document.querySelectorAll('canvas.confetti').length, party: window.__party.length, stopped: window.__stopped,
    };
  });
  const byName = (s, n) => s.st.find((x) => x.name.startsWith(n));

  // 1. Déroulé du spectacle
  await page.evaluate((l) => window.show(l), PLAYERS);
  let s = await state();
  check(s.st.map((x) => x.name).join(',') === 'Bob,Alice,Chloé', 'ordre des marches : 2e, 1er, 3e', s.st);
  check(!s.st.some((x) => x.cls.includes('up')), 'au départ, aucune marche n\'est sortie');
  check(s.party === 1, 'la fête sonore part une fois', s.party);
  const plan = await page.evaluate(() => window.__plan = window.__party[0]);
  check(plan.rises.length === 2 && plan.rises[0].rank === 3 && plan.roll && plan.reveal > plan.roll.at, 'sons : 3e puis 2e, roulement, puis le gagnant', plan);
  await wait(800);
  s = await state();
  check(byName(s, 'Chloé').cls.includes('up') && !byName(s, 'Bob').cls.includes('up'), 'la 3e marche sort en premier', s.st);
  await wait(1400);
  s = await state();
  const win = byName(s, 'Alice');
  check(byName(s, 'Bob').cls.includes('up') && win.cls.includes('up') && !win.cls.includes('shown'), 'puis la 2e, et la marche du gagnant monte (encore cachée)', s.st);
  check(win.score === '?', 'score du gagnant caché pendant le roulement', win);
  check(!s.revealed && s.canvases > 0, 'pas encore dévoilé, petites gerbes de confettis', s);
  // Mise à jour pendant le spectacle : le podium est refait (même scores) → il continue, sans rejouer.
  await page.evaluate((l) => window.show(l), PLAYERS);
  s = await state();
  check(s.party === 1, 'podium refait : les sons ne repartent pas', s.party);
  check(byName(s, 'Chloé').cls.includes('still') && byName(s, 'Alice').cls.includes('up'), 'podium refait : ce qui est passé reste à sa place, sans animation', s.st);
  await wait(1800);
  s = await state();
  check(s.revealed && byName(s, 'Alice').cls.includes('shown'), 'le gagnant est dévoilé', s);
  check(s.ribbon === 'Bravo Alice !', 'ruban « Bravo Alice ! »', s.ribbon);
  check(s.canvases === 1, 'un seul calque de confettis', s.canvases);
  await wait(1600);
  s = await state();
  check(s.st.map((x) => x.score).join(',') === '9,12,7', 'scores affichés à la fin', s.st);
  check(s.rows.length === 2 && s.rows.every((r) => r.on) && /^4\.David4$/.test(s.rows[0].t), 'le reste du classement arrive', s.rows);
  // Quitter l'écran : sons coupés, confettis retirés.
  await page.evaluate(() => document.querySelector('#app').replaceChildren());
  await wait(1200);
  s = await page.evaluate(() => ({ stopped: window.__stopped, canvases: document.querySelectorAll('canvas.confetti').length }));
  check(s.stopped === 1 && s.canvases === 0, 'quitter l\'écran coupe les sons et retire les confettis', s);

  // 2. Égalité, « toi », podium à un seul joueur, liste vide
  await page.evaluate(() => window.show([{ name: 'Léa', score: 5 }, { name: 'Max', score: 5, me: true }, { name: 'Zoé', score: 2 }]));
  s = await state();
  check(s.ribbon === 'Égalité : Léa et toi !', 'égalité : « Égalité : Léa et toi ! »', s.ribbon);
  check(s.party === 2 && s.st.filter((x) => x.cls.includes('win')).length === 2, 'égalité : deux gagnants, nouvelle fête', s);
  check(byName(s, 'Max').name === 'Max (toi)' && byName(s, 'Max').cls.includes('me'), '« (toi) » sur sa marche', s.st);
  await page.evaluate(() => window.show([{ name: 'Sam', score: 3, me: true }]));
  s = await state();
  check(s.st.length === 1 && s.ribbon === 'Bravo, tu as gagné !', 'seul joueur : « Bravo, tu as gagné ! »', s);
  await page.evaluate(() => window.show([]));
  check(await page.locator('.podium-show').count() === 1, 'liste vide : pas de plantage');

  // 3. Tableau des scores en direct (compteur de points) : tout de suite à sa place, ni sons ni confettis.
  await wait(600);
  const before = (await state()).party;
  await page.evaluate((l) => window.show(l, { live: true }), PLAYERS);
  s = await state();
  check(s.party === before && s.st.every((x) => x.cls.includes('up') && x.cls.includes('shown')) && s.st.map((x) => x.score).join(',') === '9,12,7', 'direct : tout affiché, sans fête', s);
  check(s.ribbon === undefined, 'direct : pas de ruban');

  // 4. Animations réduites : tout de suite à sa place, pas de confettis, la fanfare quand même.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.show([{ name: 'Ana', score: 1 }, { name: 'Tom', score: 4 }]));
  s = await state();
  check(s.revealed && s.st.every((x) => x.cls.includes('shown')) && s.party === before + 1, 'animations réduites : tout dévoilé, sons joués', s);
  await wait(500);
  check((await state()).canvases === 0, 'animations réduites : pas de confettis');

  check(!errors.length, 'aucune erreur JS', errors);
  await browser.close();
});
