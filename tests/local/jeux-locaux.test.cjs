// Jeux sur un seul téléphone, dans un iPhone simulé : Quiz (réponse en touchant), Curseur, Dans l'ordre, Chifoumi,
// Bataille, Memory, Yam's, le bandeau « en ligne » sur tous les jeux et le filtre « Nouveaux ».
const { open, shot } = require('../lib/pw-helper.cjs');
const { check, wait: W, run } = require('../lib/check.cjs');
const { dragTo, shownOrder } = require('../lib/sort.cjs');

run(async () => {
  const { browser, page, errors } = await open('');
  await page.evaluate(() => localStorage.setItem('ambiance:players', JSON.stringify(['Alice', 'Bob'])));
  const go = async (id) => { await page.goto('http://app.test/#/' + id); await W(700); };
  const big = () => page.locator('.btn-big').last();
  const scr = async () => (await page.locator('.screen').innerText()).replace(/\n+/g, ' | ');

  await go('quiz'); await big().click(); await W(300);
  check(!(await page.getByRole('button', { name: /Révéler/ }).count()), 'Quiz : plus de bouton « Révéler la réponse »');
  check(await page.locator('button.quiz-opt').count() === 4 && /Au tour de Alice/.test(await scr()), 'Quiz : 4 réponses à toucher, au tour d\'Alice');
  await page.locator('button.quiz-opt').first().click(); await W(200);
  check(await page.locator('.quiz-opt.good').count() === 1 && /Bien joué|Raté/.test(await scr()), 'Quiz : la bonne réponse s\'affiche, point compté', await scr());
  await page.getByRole('button', { name: /Question suivante/ }).click(); await W(200);
  check(/Au tour de Bob/.test(await scr()), 'Quiz : au tour de Bob');
  await shot(page, 'local-quiz');

  // Quiz sans limite : le compteur affiche ∞ et « Terminer la partie » mène au classement.
  await page.evaluate(() => localStorage.setItem('ambiance:race:quiz', JSON.stringify({ count: 0 })));
  await go('quiz'); await big().click(); await W(300);
  check(/1 · ∞/.test(await scr()), 'Quiz ∞ : compteur sans limite', await scr());
  for (let k = 0; k < 3; k++) { await page.locator('button.quiz-opt').first().click(); await W(100); await page.getByRole('button', { name: /Question suivante/ }).click(); await W(150); }
  check(/4 · ∞/.test(await scr()), 'Quiz ∞ : la partie continue après 3 questions');
  await page.getByRole('button', { name: /Terminer la partie/ }).click(); await W(200);
  check(/Fin de la partie/.test(await scr()), 'Quiz ∞ : « Terminer » affiche le classement');

  await go('curseur'); await big().click(); await W(200); await page.getByRole('button', { name: /Voir la cible/ }).click(); await W(150);
  await page.getByRole('button', { name: /cacher/ }).click(); await W(150); await page.locator('.scale-range').fill('40'); await page.getByRole('button', { name: /Révéler/ }).click(); await W(200);
  check(/Tour suivant|Fin/.test(await scr()), 'Curseur : révélation puis tour suivant', await scr()); await shot(page, 'local-curseur');

  await go('ordre'); await big().click(); await W(200);
  const o1 = await shownOrder(page);
  await dragTo(page, page, 3, 0);
  const o2 = await shownOrder(page);
  check(o2.length === 4 && o2[0] === o1[3] && o2[1] === o1[0], 'Dans l\'ordre : la dernière carte glissée tout en haut', [o1, o2]);
  check((await page.locator('.sort-item .rk').allInnerTexts()).join('') === '1234', 'Dans l\'ordre : numéros à jour après le glissement');
  await page.getByRole('button', { name: /Vérifier/ }).click(); await W(1600);
  check(/\d{3,4}/.test(await scr()) && await page.locator('.sort-item.good, .sort-item.bad').count() === 4, 'Dans l\'ordre : correction en couleurs, années affichées');
  await shot(page, 'local-ordre');

  // 4 en ligne contre le téléphone : la main lâche le jeton, le téléphone répond.
  await page.evaluate(() => localStorage.setItem('ambiance:morpion', JSON.stringify({ game: 'quatre', vs: 'ia', level: 'normal' })));
  await go('morpion'); await big().click(); await W(400);
  check(await page.locator('.c4-hand img').count() === 1 && /4 en ligne/.test(await scr()), '4 en ligne : plateau avec la main (et le bon nom)');
  await page.locator('.c4-col').nth(3).click(); await W(2600);
  check(await page.locator('.c4-discs .c4-disc.p0').count() === 1 && await page.locator('.c4-discs .c4-disc.p1').count() === 1, '4 en ligne : mon jeton puis celui du téléphone', await page.locator('.c4-discs .c4-disc').count());
  await shot(page, 'local-quatre');
  await page.evaluate(() => localStorage.setItem('ambiance:morpion', JSON.stringify({ game: 'morpion', vs: 'deux', level: 'normal' })));
  await go('morpion'); await big().click(); await W(500);
  for (const i of [0, 3, 1, 4, 2]) { await page.locator('.ttt-c').nth(i).click(); await W(450); }
  check(/Alice gagne/.test(await scr()) && await page.locator('.ttt-line path').count() === 1, 'Morpion à deux : Alice gagne, ligne barrée', await scr());
  await page.getByRole('button', { name: /Revanche/ }).click(); await W(600);
  check(!(await page.locator('.ttt-c .mk').count()) && /Bob de jouer/.test(await scr()), 'Morpion : revanche sur une grille propre, Bob commence', await scr());

  await go('chifoumi'); await big().click(); await W(200);
  check(await page.locator('.chi-btn').count() === 3, 'Chifoumi : 3 boutons');
  await page.locator('.chi-btn').first().click(); await W(400);
  check(/Chi|Fou|Mi/.test(await page.locator('.chi-word').innerText()) && !(await page.locator('.chi-arena.done').count()), 'Chifoumi : « Chi… Fou… Mi ! » avant le résultat');
  await W(1000);
  check(await page.locator('.chi-arena.done').count() === 1 && /Gagné|Perdu|Égalité/.test(await scr()), 'Chifoumi : les deux choix révélés, puis le résultat');

  await go('outils'); await page.getByRole('button', { name: /🎲 Lancer/ }).click(); await W(150);
  check(await page.locator('.dice-row .die.tumble').count() > 0, 'Outils : les dés roulent');
  await W(900);
  const dice = await page.$$eval('.dice-row .die', (els) => els.map((e) => [Number(e.dataset.v), e.querySelectorAll('i.on').length]));
  check(dice.length && dice.every(([v, n]) => v === n), 'Outils : chaque dé retombe sur sa valeur', dice);

  await go('plusmoins'); await big().click(); await W(300);
  await page.getByRole('button', { name: /Plus/ }).click(); await W(100);
  check(await page.locator('.pc-table .flip3 .f3-back').count() === 1 && await page.locator('.pc-table .flip3 .f3-front').count() === 1, 'Plus ou moins : la carte tirée se retourne (dos puis face)');

  await go('bataille'); await big().click(); await W(200); await page.getByRole('button', { name: /Remélanger/ }).click(); await page.getByRole('button', { name: /attaque/ }).click(); await W(200);
  const free = page.locator('.bn-grid').first().locator('.bn-cell:not([disabled])');
  check(await free.count() === 64, 'Bataille : 64 cases à viser');
  await free.first().click(); await W(1200);

  await go('memory'); await big().click(); await W(300);
  check(await page.locator('.mc').count() > 0 && /Alice|Bob/.test(await scr()), 'Memory : cartes + prénom du joueur (on se passe le téléphone)');
  check(!/\bToi\b/.test(await scr()), 'Memory : pas de « Toi » en mode téléphone partagé');

  await go('yams'); await big().click(); await W(300);
  await page.getByRole('button', { name: /Lancer/ }).click(); await W(150); await page.locator('.ys-pick').nth(5).click(); await W(150);
  check(/Bob/.test(await scr()), 'Yam\'s : au tour de Bob');

  for (const id of ['quiaecrit', 'danssatete', 'quisuisje']) { await go(id); check(/en ligne/i.test(await scr()), `${id} : propose le jeu en ligne`); }
  // Tous les jeux se jouent en ligne : chaque écran de réglages propose de créer une partie.
  const ids = await page.evaluate(async () => (await import('/js/games/index.js')).GAMES.map((g) => g.id));
  const games = await page.evaluate(async () => (await import('/js/online/games.js')).ONLINE_GAMES.length);
  check(games === ids.length, `autant de jeux en ligne que de jeux (${games}/${ids.length})`);
  const missing = [];
  for (const id of ids) {
    await go(id);
    const ok = (await page.getByRole('button', { name: /Créer une partie|Jouer en ligne/ }).count()) > 0;
    if (!ok) missing.push(id);
  }
  check(!missing.length, 'chaque jeu propose le mode en ligne', missing);

  await go('');
  check(!(await page.locator('.chip', { hasText: /En ligne/ }).count()), 'plus de filtre « En ligne »');
  check(!(await page.locator('.tile .badge', { hasText: /En ligne/ }).count()), 'plus de badge « En ligne » sur les jeux');

  // Accueil : chaque case montre l'image du jeu et son nom (en bas à gauche), sans la description.
  const tiles = await page.locator('.tile').count();
  check(tiles === ids.length && !(await page.locator('.tile .desc').count()), `accueil : ${tiles} cases, sans description`);
  for (let y = 0; y < 15000; y += 700) { await page.evaluate((v) => window.scrollTo(0, v), y); await W(30); }
  await W(400);
  const art = await page.evaluate(() => {
    const l = [...document.querySelectorAll('.tile img.tile-art')];
    return { n: l.length, ok: l.filter((i) => i.complete && i.naturalWidth > 0).length, emo: document.querySelectorAll('.tile .tile-emo').length };
  });
  check(art.n === tiles && art.ok === tiles && !art.emo, `accueil : l'image de chaque jeu s'affiche (${art.ok}/${tiles})`, art);
  const box = await page.locator('.tile').first().boundingBox();
  const name = await page.locator('.tile .name').first().boundingBox();
  check(box.width / box.height > 1.4, `accueil : cases rectangulaires (${Math.round(box.width)} × ${Math.round(box.height)})`);
  check(name.x - box.x < 20 && box.y + box.height - (name.y + name.height) < 20, 'accueil : nom du jeu en bas à gauche de la case');
  await page.evaluate(() => localStorage.setItem('ambiance:favs', JSON.stringify(['quiz', 'roi'])));
  await go(''); await page.reload(); await W(500);
  check(await page.locator('.mini-tile img.tile-art').count() === 2, 'favoris : les mini-cases ont aussi leur image');

  await go(''); await page.locator('button', { hasText: /Nouveaux/ }).first().click(); await W(300);
  const n = await page.locator('.tile').count();
  check(n > 0 && n <= 12, 'filtre Nouveaux : uniquement le dernier lot', n);
  check(!errors.length, 'aucune erreur JS', errors);
  await browser.close();
});
