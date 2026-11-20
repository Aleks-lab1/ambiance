// Jeux d'ambiance en ligne (js/online/soiree.js) avec 3 joueurs simulés.
const { mp } = require('../lib/mp.cjs');
const { shot } = require('../lib/pw-helper.cjs');
const { check, wait: W, run } = require('../lib/check.cjs');
const P = ['A', 'B', 'C'];
const clean = async (t, name) => { const s = await t.state(); check(!s.log.length && !t.errors.length, `${name} : aucune erreur`, [s.log, t.errors]); };

run(async () => {
  console.log('Qui a écrit ça ?');
  let t = await mp('/js/online/soiree.js', 'quiaecritOnline', { rounds: 1 });
  for (const [p, txt] of [['A', 'Un raton laveur'], ['B', 'La Lune'], ['C', 'Mon chat']]) { await t.at(p).locator('textarea').fill(txt); await t.at(p).getByRole('button', { name: 'Envoyer' }).click(); await W(100); }
  check((await t.state()).phase === 'guess', 'phase devinette après 3 réponses');
  const author = await t.get(() => window.__h.s.list[0].pid);
  for (const p of P.filter((x) => x !== author)) await t.at(p).locator('.vote-grid button').first().click();
  await W(200);
  check(/Alice|Bob|Chloé/.test(await t.txt('A')), 'révélation de l\'auteur');
  await clean(t, 'Qui a écrit ça'); await t.browser.close();

  console.log('Le Curseur');
  t = await mp('/js/online/soiree.js', 'curseurOnline', { rounds: 2 });
  const giver = await t.get(() => window.__h.s.giver);
  await t.at(giver).locator('.chat-form input').fill('Soupe'); await t.at(giver).locator('.chat-form button').click(); await W(150);
  for (const p of P.filter((x) => x !== giver)) { await t.at(p).locator('.scale-range').fill('70'); await t.at(p).getByRole('button', { name: /Poser/ }).click(); await W(100); }
  await W(200);
  check((await t.state()).phase === 'reveal', 'révélation après les 2 curseurs');
  await shot(t.page, 'mp-curseur'); await clean(t, 'Curseur'); await t.browser.close();

  console.log('Dans sa tête');
  t = await mp('/js/online/soiree.js', 'danssateteOnline', { rounds: 2 });
  for (const p of P) { for (let i = 0; i < 5; i++) await t.at(p).locator('.rank-item').nth(i).click(); await t.at(p).getByRole('button', { name: /Valider/ }).click(); await W(100); }
  await W(200);
  check((await t.state()).phase === 'reveal', 'révélation après les 3 classements');
  await clean(t, 'Dans sa tête'); await t.browser.close();

  console.log('Dans l\'ordre !');
  t = await mp('/js/online/soiree.js', 'ordreOnline', { rounds: 1 });
  const sol = await t.get(() => window.__h.s.sol);
  for (const k of sol) await t.at('A').locator('.rank-item').nth(k).click();
  await t.at('A').getByRole('button', { name: 'Valider' }).click();
  for (const p of ['B', 'C']) { for (let i = 0; i < 4; i++) await t.at(p).locator('.rank-item').nth(i).click(); await t.at(p).getByRole('button', { name: 'Valider' }).click(); }
  await W(300);
  const scoreA = await t.get(() => window.__h.room.players.find((p) => p.pid === 'A').score);
  check(scoreA >= 6, 'ordre parfait = au moins 4 + 2 points', scoreA);
  await clean(t, 'Dans l\'ordre'); await t.browser.close();

  console.log('Qui suis-je ?');
  t = await mp('/js/online/soiree.js', 'quisuisjeOnline', {});
  const who = await t.get(() => window.__h.s.who);
  check(!(await t.txt('A')).includes(who.A) && (await t.txt('B')).includes(who.A), 'A ne voit pas son personnage, B le voit');
  await t.at('A').locator('.chat-form input').fill(who.A.toLowerCase()); await t.at('A').locator('.chat-form button').click(); await W(150);
  await t.at('B').getByRole('button', { name: /abandonne/ }).click(); await W(100);
  await t.at('C').locator('.chat-form input').fill(who.C); await t.at('C').locator('.chat-form button').click(); await W(200);
  check(/end|over/.test((await t.state()).phase), 'fin de partie quand tout le monde a fini', (await t.state()).phase);
  await clean(t, 'Qui suis-je'); await t.browser.close();

  console.log('Chifoumi');
  t = await mp('/js/online/soiree.js', 'chifoumiOnline', { rounds: 5 });
  await t.at('A').locator('.chi-btn').nth(0).click(); await t.at('B').locator('.chi-btn').nth(2).click(); await t.at('C').locator('.chi-btn').nth(1).click(); await W(300);
  check((await t.state()).phase === 'reveal', 'révélation après 3 choix');
  await clean(t, 'Chifoumi'); await t.browser.close();
});
