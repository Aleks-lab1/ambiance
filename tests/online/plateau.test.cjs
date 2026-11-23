// Jeux de plateau en ligne (js/online/plateau.js) avec 3 joueurs simulés.
const { mp } = require('../lib/mp.cjs');
const { shot } = require('../lib/pw-helper.cjs');
const { check, wait: W, run } = require('../lib/check.cjs');
const clean = async (t, name) => { const s = await t.state(); check(!s.log.length && !t.errors.length, `${name} : aucune erreur`, [s.log, t.errors]); };

run(async () => {
  console.log('Bataille navale');
  let t = await mp('/js/online/plateau.js', 'batailleOnline', {});
  await t.at('A').getByRole('button', { name: /Remélanger/ }).click(); await W(100);
  await t.at('A').getByRole('button', { name: /Prêt/ }).click(); await t.at('B').getByRole('button', { name: /Prêt/ }).click(); await W(150);
  const cells = await t.get(() => window.__h.s.fleets[1].flatMap((s) => s.cells));
  for (const i of cells) { await t.at('A').locator('.bn-grid').first().locator('.bn-cell').nth(i).click(); await W(40); }
  await W(200);
  check(/Alice/.test(await t.txt('C')) && (await t.state()).phase === 'over', 'A coule toute la flotte de B et gagne', (await t.state()).phase);
  await shot(t.page, 'mp-bataille');
  await t.at('A').getByRole('button', { name: /suivant|Revanche/ }).click(); await W(150);
  const duo = await t.get(() => window.__h.s.duo);
  check(duo.includes('A') && duo.includes('C'), 'le gagnant reste et affronte C', duo);
  await clean(t, 'Bataille'); await t.browser.close();

  console.log('Memory');
  t = await mp('/js/online/plateau.js', 'memoryOnline', { pairs: 8 });
  const deck = await t.get(() => window.__h.s.deck);
  const j = deck.indexOf(deck[0], 1);
  await t.at('A').locator('.mc').nth(0).click(); await W(60); await t.at('A').locator('.mc').nth(j).click(); await W(150);
  check((await t.get(() => window.__h.s.cur)) === 'A', 'paire trouvée : A rejoue');
  check(await t.at('C').locator('.mc.up.done').count() === 2, 'Memory : la paire reste retournée chez les autres joueurs');
  // Deux cartes encore cachées qui ne vont pas ensemble (la paire de la carte 0 peut être la carte 1).
  const a = deck.findIndex((e, i) => i > 0 && i !== j);
  const k = deck.findIndex((e, i) => i > a && i !== j && e !== deck[a]);
  await t.at('A').locator('.mc').nth(a).click(); await W(60); await t.at('A').locator('.mc').nth(k).click(); await W(200);
  check(await t.at('B').locator('.mc.up.miss').count() === 2, 'Memory : les 2 cartes ratées se retournent chez B (et tremblent)');
  await W(1500);
  check((await t.get(() => window.__h.s.cur)) === 'B', 'raté : au tour de B');
  check(await t.at('B').locator('.mc.up').count() === 2 && !(await t.at('B').locator('.mc.miss').count()), 'Memory : les cartes ratées se recachent, la paire reste visible');
  await shot(t.page, 'mp-memory');
  await clean(t, 'Memory'); await t.browser.close();

  console.log('Yam\'s');
  t = await mp('/js/online/plateau.js', 'yamsOnline', {});
  await t.at('A').getByRole('button', { name: /Lancer/ }).click(); await W(120);
  await t.at('A').locator('.ys-die').nth(0).click(); await W(80);
  const before = await t.get(() => window.__h.s.dice[0]);
  await t.at('A').getByRole('button', { name: /Relancer/ }).click(); await W(120);
  const [dice, , rolls] = await t.get(() => [window.__h.s.dice, window.__h.s.held, window.__h.s.rolls]);
  check(dice[0] === before && rolls === 2, 'dé gardé + 2e lancer', { dice, rolls });
  await t.at('A').locator('.ys-pick').last().click(); await W(150);
  check((await t.get(() => window.__h.s.cur)) === 'B', 'après le score, au tour de B');
  // Fin rapide : on remplit les feuilles et A joue la dernière case.
  await t.get(() => { const H = window.__h; for (const p of ['A', 'B', 'C']) for (const c of ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'brelan', 'carre', 'full', 'petite', 'grande', 'yams']) H.s.sheets[p][c] = H.s.sheets[p][c] ?? 3; H.s.sheets.B.chance = 10; H.s.sheets.C.chance = 12; delete H.s.sheets.A.chance; H.s.cur = 'A'; H.push(); });
  await W(100); await t.at('A').getByRole('button', { name: /Lancer/ }).click(); await W(100); await t.at('A').locator('.ys-pick').first().click(); await W(200);
  check(/over|end/.test((await t.state()).phase), 'fin de partie quand les feuilles sont pleines', (await t.state()).phase);
  await clean(t, 'Yam\'s'); await t.browser.close();
});
