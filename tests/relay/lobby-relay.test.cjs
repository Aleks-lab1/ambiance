// De bout en bout : 3 téléphones, PeerJS bloqué → connexion par le faux relais MQTT, vrai salon,
// lancement de « Qui a écrit ça ? » puis retour au salon et « Bataille navale » (double appui sur le jeu).
// DOWN=shiftr node relay/lobby-relay.test.cjs : simule la panne du 1er serveur relais.
const { relayWorld } = require('../lib/mock-relay.cjs');
const { check, run } = require('../lib/check.cjs');

run(async () => {
  const { browser, phone, broker, errors } = await relayWorld({ down: process.env.DOWN });
  const host = await phone(), c1 = await phone(), c2 = await phone();
  await host.goto('http://app.test/#/quiaecrit'); await host.waitForTimeout(800);
  await host.locator('.online-banner .btn', { hasText: 'Créer une partie' }).click();
  await host.getByPlaceholder('Ton prénom').fill('Alice');
  await host.getByRole('button', { name: 'Créer la partie' }).click();
  await host.waitForSelector('.room-code', { timeout: 30000 });
  const code = (await host.locator('.room-code').innerText()).trim();
  check(/^[A-Z0-9]{4,}$/.test(code), 'code de partie affiché', code);
  for (const [p, n] of [[c1, 'Bob'], [c2, 'Chloé']]) {
    await p.goto('http://app.test/#/join/' + code);
    await p.getByPlaceholder('Ton prénom').fill(n);
    await p.getByRole('button', { name: 'Rejoindre', exact: true }).click();
  }
  await host.waitForFunction(() => /Bob/.test(document.body.innerText) && /Chloé/.test(document.body.innerText), null, { timeout: 45000 });
  check(true, 'Bob et Chloé ont rejoint par le relais');
  const picks = await host.locator('.game-pick button').count();
  console.log('  (jeux proposés dans le salon : ' + picks + ')');
  check(picks >= 40, 'le salon propose les jeux en ligne', picks);
  await host.getByRole('button', { name: /Lancer Qui a écrit/ }).click();
  await c1.waitForSelector('textarea', { timeout: 15000 });
  for (const [p, t] of [[host, 'Un raton'], [c1, 'Une loutre'], [c2, 'Un koala']]) { await p.locator('textarea').fill(t); await p.getByRole('button', { name: 'Envoyer' }).click(); }
  await c1.waitForSelector('.tel-text', { timeout: 10000 });
  check(true, 'Qui a écrit ça : les réponses circulent');
  await host.locator('.icon-btn[aria-label="Menu de la partie"]').click(); await host.waitForTimeout(250);
  await host.locator('.modal .btn', { hasText: /Retour au salon/ }).click(); await host.waitForTimeout(500);
  // Double appui sur un jeu : il se lance sans passer par le bouton « Lancer ».
  await host.locator('.game-pick button', { hasText: 'Bataille navale' }).click(); await host.waitForTimeout(300);
  check(/Touche encore pour lancer/.test(await host.locator('.game-pick button.on').innerText()), '1er appui : le jeu est choisi, « touche encore pour lancer »');
  await host.locator('.game-pick button', { hasText: 'Bataille navale' }).click();
  await c1.waitForSelector('.bn-grid', { timeout: 15000 });
  check(true, '2e appui : Bataille navale lancée chez les joueurs');
  check(broker.stats.published > 0, 'des messages sont passés par le relais', broker.stats.published);
  const real = errors.filter((e) => !/PeerJS|ERR_FAILED/.test(e)); // PeerJS est bloqué exprès
  check(!real.length, 'aucune erreur JS (hors PeerJS bloqué exprès)', real);
  await browser.close();
});
