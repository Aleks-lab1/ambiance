// Écran télé de bout en bout, par le faux relais en https (messages chiffrés) : 3 téléphones + 1 télé (1280 × 720).
//  - la télé rejoint par #/tv/CODE : grand code + QR, les joueurs apparaissent ; elle n'est pas comptée comme joueur ;
//  - Le Quiz : même question que sur les téléphones, 4 grandes réponses, puis qui a répondu quoi ;
//  - Punchlines : rien de lisible pendant l'écriture, toutes les réponses au moment du vote, les auteurs à la fin ;
//  - Je dessine : le dessin arrive à la télé, le mot reste caché ;
//  - L'Imposteur (sans écran spécial) : écran commun, aucun mot secret.
const { relayWorld } = require('../lib/mock-relay.cjs');
const { check, run } = require('../lib/check.cjs');

const URL = 'https://app.test/';
const W = (p, ms) => p.waitForTimeout(ms);
const txt = (p) => p.locator('body').innerText();

run(async () => {
  const { browser, phone, errors } = await relayWorld();
  const host = await phone(), bob = await phone(), chloe = await phone();
  const tv = await phone({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  await host.goto(URL); await W(host, 500);
  await host.locator('.mode-card', { hasText: 'Online' }).click(); await W(host, 400);
  await host.getByPlaceholder('Ton prénom').fill('Alice');
  await host.getByRole('button', { name: 'Créer le salon' }).click();
  await host.waitForSelector('.room-code', { timeout: 30000 });
  const code = (await host.locator('.room-code').innerText()).trim();

  // ---- La télé se branche avec le code ----
  await tv.goto(URL); await W(tv, 400);
  await tv.locator('.mode-card', { hasText: 'TV Mode' }).click(); await W(tv, 400);
  await tv.locator('.panel', { hasText: 'Afficher un salon déjà créé' }).locator('input').fill(code);
  await tv.getByRole('button', { name: 'Afficher', exact: true }).click();
  await tv.waitForSelector('.tv-bigcode', { timeout: 30000 });
  check((await tv.locator('.tv-bigcode').innerText()).trim() === code && await tv.locator('.tv-bigqr svg').count() === 1, `télé : grand code ${code} et QR code pour rejoindre`);
  check(/#\/tv\//.test(tv.url()), 'télé : adresse #/tv/CODE (à recharger si besoin)', tv.url());
  for (const [p, n] of [[bob, 'Bob'], [chloe, 'Chloé']]) {
    await p.goto(URL + '#/join/' + code);
    await p.getByPlaceholder('Ton prénom').fill(n);
    await p.getByRole('button', { name: 'Rejoindre le salon' }).click();
  }
  await tv.waitForFunction(() => /Chloé/.test(document.querySelector('.tv-bubbles')?.innerText || ''), null, { timeout: 45000 });
  check(true, 'télé : Bob et Chloé apparaissent dans le salon');
  await W(host, 500);
  check(/1 écran télé branché/.test(await host.locator('.tv-hint').innerText()), 'hôte : « 📺 1 écran télé branché »');
  check((await host.locator('.topbar .pill').innerText()).trim() === '3' && await host.locator('.topbar .pill svg.ic').count() === 1 && (await host.locator('.lobby-players .lp').count()) === 3, 'la télé n\'est pas comptée comme joueur (3 joueurs)');

  const launch = async (name) => {
    if (!(await host.locator('.game-pick').count())) {
      await host.locator('.icon-btn[aria-label="Menu de la partie"]').click(); await W(host, 250);
      await host.locator('.modal .btn', { hasText: /Retour au salon/ }).click(); await W(host, 600);
    }
    await host.locator('.game-pick button', { hasText: name }).first().click(); await W(host, 200);
    await host.locator('.game-pick button', { hasText: name }).first().click(); await W(host, 1200);
  };

  // ---- Le Quiz ----
  await launch('Le Quiz');
  await tv.waitForSelector('.tv-opt', { timeout: 15000 });
  const tvQ = (await tv.locator('.tv-card .q').innerText()).trim();
  check(tvQ.length > 10 && (await txt(bob)).includes(tvQ.split(' ').slice(0, 4).join(' ')), 'Quiz : la télé affiche la même question que les téléphones', tvQ);
  check(await tv.locator('.tv-opt').count() === 4 && await tv.locator('.tv-timer:not(.hidden)').count() === 1, 'Quiz : 4 grandes réponses et le compte à rebours');
  for (const [p, k] of [[host, 0], [bob, 1]]) { await p.locator('.quiz-opt').nth(k).click(); await W(p, 300); }
  await W(tv, 600);
  check(await tv.locator('.tv-chip.done').count() === 2, 'Quiz : la télé montre qui a déjà répondu (2/3)');
  await chloe.locator('.quiz-opt').nth(2).click();
  await tv.waitForSelector('.tv-opt.good', { timeout: 8000 });
  const who = await tv.locator('.tv-opt .who').allInnerTexts();
  check(who.join('|').includes('Alice') && who.join('|').includes('Bob') && who.join('|').includes('Chloé'), 'Quiz : la bonne réponse s\'allume, avec qui a choisi quoi', who);

  // ---- Punchlines ----
  await launch('Punchlines');
  await tv.waitForSelector('.tv-card', { timeout: 10000 });
  for (const [p, t] of [[host, 'Un raton laveur'], [bob, 'Une loutre en slip']]) { await p.locator('textarea').fill(t); await p.getByRole('button', { name: /Envoyer/ }).click(); await W(p, 300); }
  await W(tv, 800);
  const during = await txt(tv);
  check(!/raton|loutre/.test(during) && /2\/3 ont écrit/.test(during), 'Punchlines : pendant l\'écriture, la télé montre « 2/3 ont écrit » mais aucune réponse');
  await chloe.locator('textarea').fill('Un koala fatigué'); await chloe.getByRole('button', { name: /Envoyer/ }).click();
  await tv.waitForSelector('.tv-option', { timeout: 8000 }); await W(tv, 500);
  const opts = await tv.locator('.tv-option').allInnerTexts();
  check(opts.length === 3 && /raton/.test(opts.join()) && /koala/.test(opts.join()) && !/Alice|Bob|Chloé/.test(opts.join()), 'Punchlines : au vote, les 3 réponses en grand, sans les auteurs', opts);
  for (const p of [host, bob, chloe]) { await p.locator('.plist-sel button:not([disabled])').first().click(); await W(p, 250); }
  await tv.waitForSelector('.tv-option .by', { timeout: 8000 });
  check(/(Alice|Bob|Chloé)/.test((await tv.locator('.tv-option .by').allInnerTexts()).join()), 'Punchlines : révélation des auteurs et des votes');

  // ---- Je dessine, tu devines ----
  await launch('Je dessine');
  let drawer = null;
  for (let k = 0; k < 20 && !drawer; k++) { for (const p of [host, bob, chloe]) if (await p.locator('.choices button').count()) drawer = p; if (!drawer) await W(host, 300); }
  await drawer.locator('.choices button').first().click(); await W(drawer, 700);
  const word = (await drawer.locator('.word-banner').innerText()).replace('✏️', '').trim();
  const box = await drawer.locator('canvas.board').boundingBox();
  await drawer.mouse.move(box.x + 40, box.y + 40); await drawer.mouse.down();
  for (let i = 0; i < 20; i++) await drawer.mouse.move(box.x + 40 + i * 12, box.y + 40 + Math.sin(i / 3) * 60);
  await drawer.mouse.up();
  await W(tv, 1500);
  const ink = await tv.evaluate(() => { const c = document.querySelector('.tv canvas.board'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 200) n++; return n; });
  check(ink > 500, `Je dessine : le dessin arrive à la télé (${ink} points)`);
  check(word.length > 2 && !(await txt(tv)).toLowerCase().includes(word.toLowerCase()) && await tv.locator('.tv-word .word-mask').count() === 1, `Je dessine : le mot (« ${word} ») reste caché à la télé`);

  // ---- L'Imposteur : écran commun, aucun mot secret ----
  await launch('L\'Imposteur');
  await W(tv, 800);
  const gs = await host.evaluate(() => JSON.parse(localStorage.getItem('ambiance:host-save')).game.gs);
  const secrets = [...new Set(JSON.stringify(gs.words || gs.pair || gs).match(/[A-Za-zÀ-ÿ' -]{3,}/g) || [])].filter((w) => !/^(st|round|roles|words|pair|order|votes|result|phase|imp|civ)$/.test(w));
  const tvText = await txt(tv);
  check(/À vous de jouer sur vos téléphones/.test(tvText), 'L\'Imposteur : écran commun « À vous de jouer sur vos téléphones »');
  check(secrets.length > 0 && !secrets.some((w) => tvText.includes(w)), 'L\'Imposteur : aucun mot secret à la télé', secrets);

  // ---- L'hôte ferme la partie : la télé est prévenue ----
  await host.locator('.icon-btn[aria-label="Menu de la partie"]').click(); await W(host, 250);
  await host.locator('.modal .btn', { hasText: 'Quitter' }).click(); await W(host, 250);
  await host.locator('.modal .btn', { hasText: 'Quitter' }).click();
  await tv.waitForFunction(() => /L'hôte a fermé la partie/.test(document.body.innerText), null, { timeout: 8000 }).then(() => check(true, 'la télé est prévenue quand l\'hôte ferme la partie'), () => check(false, 'la télé est prévenue quand l\'hôte ferme la partie'));
  const real = errors.filter((e) => !/PeerJS|ERR_FAILED|peer/.test(e));
  check(!real.length, 'aucune erreur JS', real);
  await browser.close();
});
