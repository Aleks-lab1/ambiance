// Jeux « chacun son tour » en ligne (js/online/tour.js) avec 3 joueurs simulés.
const { mp } = require('../lib/mp.cjs');
const { check, wait: W, run } = require('../lib/check.cjs');
const clean = async (t, name) => { const s = await t.state(); check(!s.log.length && !t.errors.length, `${name} : aucune erreur`, [s.log, t.errors]); };
const P = ['A', 'B', 'C'];

run(async () => {
  console.log('Paranoïa');
  let t = await mp('/js/online/tour.js', 'paranoiaOnline');
  const asker = await t.get(() => window.__h.s.asker);
  await t.at(asker).locator('.vote-grid button').first().click(); await W(3000);
  await t.at('A').getByRole('button', { name: /Joueur suivant/ }).click(); await W(200);
  check((await t.get(() => window.__h.s.asker)) !== asker, 'le tour passe au joueur suivant');
  await clean(t, 'Paranoïa'); await t.browser.close();

  console.log('Pour ou contre');
  t = await mp('/js/online/tour.js', 'debatsOnline', { time: 30 });
  const pour = await t.get(() => window.__h.s.pour);
  await t.at(pour).getByRole('button', { name: /J'ai fini/ }).click(); await W(200);
  const contre = await t.get(() => window.__h.s.contre);
  await t.at(contre).getByRole('button', { name: /J'ai fini/ }).click(); await W(200);
  const judge = P.find((x) => x !== pour && x !== contre);
  await t.at(judge).locator('.answer-btns .btn').first().click(); await W(300);
  check((await t.state()).phase === 'result', 'le juge désigne le gagnant', (await t.state()).phase);
  await clean(t, 'Pour ou contre'); await t.browser.close();

  console.log('Deux vérités, un mensonge');
  t = await mp('/js/online/tour.js', 'deuxOnline');
  const tel = await t.get(() => window.__h.s.teller);
  const tas = t.at(tel).locator('textarea');
  await tas.nth(0).fill('J\'ai vu un ours'); await tas.nth(1).fill('Je parle japonais'); await tas.nth(2).fill('J\'ai sauté en parachute');
  await t.at(tel).locator('.seg button').nth(1).click();
  await t.at(tel).getByRole('button', { name: 'Envoyer' }).click(); await W(300);
  for (const x of P.filter((x) => x !== tel)) await t.at(x).locator('.reveal-opt').first().click();
  await W(300);
  check((await t.state()).phase === 'result', 'résultat après les votes', (await t.state()).phase);
  await clean(t, 'Deux vérités'); await t.browser.close();
});
