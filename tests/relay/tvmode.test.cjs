// TV Mode de bout en bout (faux relais, https) : la télé (1280 × 720) crée le salon elle-même, 3 téléphones
// la rejoignent avec le lien du QR code. Le premier arrivé est le chef 👑 : il choisit et lance les jeux, les
// autres votent (votes affichés chez tous et à la télé). Le chef part : le suivant prend la relève. La page de
// la télé est rechargée en pleine partie : elle reprend, les joueurs reviennent. La télé ferme : tout le monde
// est prévenu.
const { relayWorld } = require('../lib/mock-relay.cjs');
const { check, run } = require('../lib/check.cjs');

const URL = 'https://app.test/';
const W = (p, ms) => p.waitForTimeout(ms);
const txt = (p) => p.locator('body').innerText();
async function until(page, fn, ms = 30000) {
  for (const t0 = Date.now(); Date.now() - t0 < ms; await W(page, 300)) if (await fn()) return true;
  return false;
}

run(async () => {
  const { browser, phone, errors } = await relayWorld();
  const tv = await phone({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  const bob = await phone(), chloe = await phone(), david = await phone();

  // ---- La télé : accueil → TV Mode → Lancer la télé ----
  await tv.goto(URL); await W(tv, 500);
  await tv.locator('.mode-card', { hasText: 'TV Mode' }).click(); await W(tv, 400);
  check(/#\/tv$/.test(tv.url()) && await tv.getByRole('button', { name: '▶ Lancer la télé' }).count() === 1, 'TV Mode : écran de départ avec « ▶ Lancer la télé »');
  await tv.getByRole('button', { name: '▶ Lancer la télé' }).click();
  await tv.waitForSelector('.tv-bigcode', { timeout: 30000 });
  const code = (await tv.locator('.tv-bigcode').innerText()).trim();
  check(/^[A-Z]{4}$/.test(code) && await tv.locator('.tv-bigqr svg').count() === 1, `télé : salon ${code} créé, grand QR code`);
  check(/premier joueur arrivé sera le chef/.test(await txt(tv)), 'télé : « le premier joueur arrivé sera le chef »');

  // ---- Les téléphones scannent le QR code (lien #/join/CODE) ----
  for (const [p, n] of [[bob, 'Bob'], [chloe, 'Chloé'], [david, 'David']]) {
    await p.goto(URL + '#/join/' + code);
    await p.getByPlaceholder('Ton prénom').fill(n);
    await p.getByRole('button', { name: 'Rejoindre le salon' }).click();
    await p.waitForSelector('.game-pick', { timeout: 40000 });
  }
  check(await until(tv, async () => /David/.test(await tv.locator('.tv-bubbles').innerText())), 'télé : les 3 joueurs apparaissent');
  check(/👑 Bob choisit le jeu/.test(await txt(tv)), 'télé : Bob, premier arrivé, est le chef 👑');
  check(/Choisis le jeu/i.test(await txt(bob)) && /Vote pour ton jeu/i.test(await txt(chloe)), 'Bob choisit le jeu, Chloé et David votent');
  check(!(await bob.locator('.room-code').count()), 'les téléphones n\'affichent pas le code (il est sur la télé)');

  // ---- Votes ----
  await chloe.locator('.pick-tile', { hasText: 'Le Quiz' }).click();
  await david.locator('.pick-tile', { hasText: 'Le Quiz' }).click();
  await W(bob, 800);
  check((await bob.locator('.pick-tile', { hasText: 'Le Quiz' }).locator('.vote-badge').innerText()).includes('2'), 'chez le chef : « 🗳️ 2 » sur Le Quiz');
  check(/Le Quiz/.test(await tv.locator('.tv-votes').innerText()) && /2/.test(await tv.locator('.tv-vote').first().innerText()), 'télé : les votes s\'affichent (Le Quiz : 2)');
  await david.locator('.pick-tile', { hasText: 'Le Quiz' }).click(); await W(bob, 600);
  check((await bob.locator('.pick-tile', { hasText: 'Le Quiz' }).locator('.vote-badge').innerText()).includes('1'), 'toucher encore = retirer son vote');
  check(/Ton vote : .*Le Quiz/.test(await chloe.locator('.lobby-bar').innerText()), 'Chloé voit son vote en bas de l\'écran');

  // ---- Le chef lance (double appui) ----
  await bob.locator('.pick-tile', { hasText: 'Le Quiz' }).click(); await W(bob, 200);
  check(/Touche encore pour lancer/.test(await bob.locator('.pick-tile.on').innerText()), 'chef : 1er appui = jeu choisi');
  await bob.locator('.pick-tile', { hasText: 'Le Quiz' }).click();
  await chloe.waitForSelector('.quiz-opt', { timeout: 15000 });
  await tv.waitForSelector('.tv-opt', { timeout: 15000 });
  check(true, 'Le Quiz lancé : sur les téléphones et en grand sur la télé');
  check(await bob.getByRole('button', { name: /Révéler maintenant/ }).count() === 1 && !(await chloe.getByRole('button', { name: /Révéler maintenant/ }).count()), 'seul le chef a les boutons de l\'hôte');

  // ---- La page de la télé est rechargée en pleine partie : elle reprend ----
  const tctx = tv.context();
  await tv.close();
  const tv2 = await tctx.newPage();
  tv2.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await tv2.goto(URL); await W(tv2, 600);
  check(/n'est pas finie/.test(await tv2.locator('.resume-card').innerText().catch(() => '')), 'télé rechargée : « Ta partie … n\'est pas finie » sur l\'accueil');
  await tv2.locator('.resume-card button', { hasText: 'Reprendre' }).click();
  await tv2.waitForSelector('.tv-opt', { timeout: 20000 });
  check(true, 'télé : la partie reprend sur le Quiz');
  check(await until(tv2, async () => !(await chloe.locator('.conn-banner.live').count()) && !(await bob.locator('.conn-banner.live').count()), 45000), 'les joueurs sont revenus tout seuls');

  // ---- Le chef s'en va : Chloé prend la relève ----
  await bob.close();
  // Départ vu par la télé au bout de ~16 s (page fermée sans prévenir), puis le chef passe au suivant.
  const chef = () => tv2.evaluate(() => { const s = JSON.parse(localStorage.getItem('ambiance:host-save')); return s.room.players.find((p) => p.pid === s.room.host)?.name; });
  check(await until(chloe, async () => (await chef()) === 'Chloé' && await chloe.getByRole('button', { name: /Révéler maintenant|Question suivante|Voir le classement/ }).count() > 0, 45000), 'Bob parti : Chloé devient le chef 👑 (et a les boutons de l\'hôte)', await chef());

  // ---- La télé ferme le salon ----
  await tv2.locator('.tv-head button[aria-label="Fermer la télé"]').click(); await W(tv2, 300);
  await tv2.locator('.modal .btn', { hasText: 'Quitter' }).click();
  check(await until(chloe, async () => /L'hôte a fermé la partie/.test(await txt(chloe)), 10000), 'télé fermée : les joueurs sont prévenus');
  const real = errors.filter((e) => !/PeerJS|ERR_FAILED|peer/.test(e));
  check(!real.length, 'aucune erreur JS', real);
  await browser.close();
});
