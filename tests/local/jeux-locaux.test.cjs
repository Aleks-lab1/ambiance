// Jeux sur un seul téléphone, dans un iPhone simulé : Curseur, Dans l'ordre, Chifoumi, Bataille, Memory, Yam's,
// les jeux uniquement en ligne (bandeau) et le filtre « Nouveaux ».
const { open, shot } = require('../lib/pw-helper.cjs');
const { check, wait: W, run } = require('../lib/check.cjs');

run(async () => {
  const { browser, page, errors } = await open('');
  await page.evaluate(() => localStorage.setItem('ambiance:players', JSON.stringify(['Alice', 'Bob'])));
  const go = async (id) => { await page.goto('http://app.test/#/' + id); await W(700); };
  const big = () => page.locator('.btn-big').last();
  const scr = async () => (await page.locator('.screen').innerText()).replace(/\n+/g, ' | ');

  await go('curseur'); await big().click(); await W(200); await page.getByRole('button', { name: /Voir la cible/ }).click(); await W(150);
  await page.getByRole('button', { name: /cacher/ }).click(); await W(150); await page.locator('.scale-range').fill('40'); await page.getByRole('button', { name: /Révéler/ }).click(); await W(200);
  check(/Tour suivant|Fin/.test(await scr()), 'Curseur : révélation puis tour suivant', await scr()); await shot(page, 'local-curseur');

  await go('ordre'); await big().click(); await W(200);
  for (let i = 0; i < 4; i++) await page.locator('.rank-item').nth(i).click();
  await page.getByRole('button', { name: /Vérifier/ }).click(); await W(200);
  check(/\d{3,4}/.test(await scr()), 'Dans l\'ordre : années affichées');

  await go('chifoumi'); await big().click(); await W(200);
  check(await page.locator('.chi-btn').count() === 3, 'Chifoumi : 3 boutons');
  await page.locator('.chi-btn').first().click(); await W(200);

  await go('bataille'); await big().click(); await W(200); await page.getByRole('button', { name: /Remélanger/ }).click(); await page.getByRole('button', { name: /attaque/ }).click(); await W(200);
  const free = page.locator('.bn-grid').first().locator('.bn-cell:not([disabled])');
  check(await free.count() === 64, 'Bataille : 64 cases à viser');
  await free.first().click(); await W(1200);

  await go('memory'); await big().click(); await W(300);
  check(await page.locator('.mem-card').count() > 0 && /Alice|Bob/.test(await scr()), 'Memory : cartes + prénom du joueur (on se passe le téléphone)');
  check(!/\bToi\b/.test(await scr()), 'Memory : pas de « Toi » en mode téléphone partagé');

  await go('yams'); await big().click(); await W(300);
  await page.getByRole('button', { name: /Lancer/ }).click(); await W(150); await page.locator('.ys-pick').nth(5).click(); await W(150);
  check(/Bob/.test(await scr()), 'Yam\'s : au tour de Bob');

  for (const id of ['quiaecrit', 'danssatete', 'quisuisje']) { await go(id); check(/en ligne/i.test(await scr()), `${id} : propose le jeu en ligne`); }

  await go(''); await page.locator('button', { hasText: /Nouveaux/ }).first().click(); await W(300);
  const n = await page.locator('.tile').count();
  check(n > 0 && n <= 12, 'filtre Nouveaux : uniquement le dernier lot', n);
  check(!errors.length, 'aucune erreur JS', errors);
  await browser.close();
});
