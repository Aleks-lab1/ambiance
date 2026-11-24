// Partie coupée puis reprise, par le faux relais (PeerJS bloqué), en https (chiffrement disponible) :
//  1. 3 téléphones, Quiz en cours ; un curieux qui écoute le relais ne voit aucun message en clair.
//  2. L'hôte ferme l'appli (page fermée) : les joueurs sont prévenus et attendent.
//  3. Il la rouvre : bandeau « Ta partie … n'est pas finie » → Reprendre : même code, même question,
//     mêmes scores, les joueurs reviennent tout seuls.
//  4. Chloé ferme l'appli et revient par le bandeau « Tu étais dans la partie » : même place, mêmes points.
//  5. Bob revient depuis un autre navigateur (autre mémoire, comme Safari → appli installée) avec le même
//     prénom : il retrouve sa place (pas de « Bob 2 »).
const { relayWorld } = require('../lib/mock-relay.cjs');
const { check, run } = require('../lib/check.cjs');

const URL = 'https://app.test/';
const W = (p, ms) => p.waitForTimeout(ms);
const hostState = (p) => p.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('ambiance:host-save') || 'null');
  const gs = s && s.game && s.game.gs;
  return s && {
    code: s.code, at: s.at, players: s.room.players.map((x) => ({ name: x.name, score: x.score, on: x.on })), game: s.room.game && s.room.game.type,
    i: gs && gs.i, phase: gs && gs.phase, q: gs && gs.list[gs.i] && gs.list[gs.i].pub.q, good: gs && gs.list[gs.i] && gs.list[gs.i].ans.i,
    left: gs && gs.deadline - s.at,
  };
});

async function waitText(page, re, timeout = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (re.test(await page.locator('body').innerText().catch(() => ''))) return true;
    await W(page, 300);
  }
  return false;
}

run(async () => {
  const { browser, phone, broker, errors } = await relayWorld();
  const host = await phone(), bob = await phone(), chloe = await phone();
  await host.goto(URL + '#/online'); await W(host, 600);
  await host.getByPlaceholder('Ton prénom').fill('Alice');
  await host.getByRole('button', { name: 'Créer le salon' }).click();
  await host.waitForSelector('.room-code', { timeout: 30000 });
  const code = (await host.locator('.room-code').innerText()).trim();
  for (const [p, n] of [[bob, 'Bob'], [chloe, 'Chloé']]) {
    await p.goto(URL + '#/join/' + code);
    await p.getByPlaceholder('Ton prénom').fill(n);
    await p.getByRole('button', { name: 'Rejoindre le salon' }).click();
  }
  await host.waitForFunction(() => /Bob/.test(document.body.innerText) && /Chloé/.test(document.body.innerText), null, { timeout: 45000 });
  check(true, `Bob et Chloé ont rejoint la partie ${code} par le relais`);

  // ---- 1. Chiffrement : rien de lisible ne passe par le relais ----
  const leaks = broker.stats.payloads.filter((t) => /Bob|Chlo|Alice|"state"|"hello"|"players"/.test(t));
  const enc = broker.stats.payloads.filter((t) => /"t":"e"/.test(t)).length;
  check(enc > 3 && !leaks.length, `relais : ${enc} messages chiffrés, aucun prénom ni état lisible`, leaks.slice(0, 2));

  // ---- L'hôte passe un instant dans une autre appli : les joueurs sont prévenus, puis tout repart ----
  const setVis = (p, v) => p.evaluate((v) => { Object.defineProperty(document, 'visibilityState', { value: v, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }, v);
  await setVis(host, 'hidden');
  check(await waitText(bob, /Alice a quitté l'appli un instant/, 8000), 'l\'hôte sort de l\'appli : « Alice a quitté l\'appli un instant… » chez Bob');
  await setVis(host, 'visible');
  await W(bob, 1500);
  check(!(await bob.locator('.conn-banner.live').count()), 'l\'hôte revient : le message disparaît');

  // ---- Quiz : 1re question, Alice et Bob trouvent, Chloé se trompe ; puis la 2e question commence ----
  await host.locator('.game-pick button', { hasText: 'Le Quiz' }).click(); await W(host, 200);
  await host.locator('.game-pick button', { hasText: 'Le Quiz' }).click();
  await bob.waitForSelector('.quiz-opt', { timeout: 15000 });
  await W(host, 1200);
  const s1 = await hostState(host);
  check(s1 && s1.game === 'race-quiz' && s1.i === 0, 'Quiz lancé, partie enregistrée dans le téléphone de l\'hôte', s1);
  for (const [p, k] of [[host, s1.good], [bob, s1.good], [chloe, (s1.good + 1) % 4]]) { await p.locator('.quiz-opt').nth(k).click(); await W(p, 300); }
  let before = null;
  for (let i = 0; i < 40; i++) { await W(host, 500); before = await hostState(host); if (before.i === 1 && before.phase === 'q') break; }
  await W(host, 1000);
  before = await hostState(host);
  const sc = Object.fromEntries(before.players.map((p) => [p.name, p.score]));
  check(before.i === 1 && sc.Alice > 0 && sc.Bob > 0 && sc.Chloé === 0, '2e question, Alice et Bob ont des points, pas Chloé', sc);
  const bobText1 = await bob.locator('body').innerText();

  // ---- 2. L'hôte ferme l'appli ----
  const hctx = host.context();
  await host.close();
  check(await waitText(bob, /Alice a quitté l'appli|Connexion à l'hôte perdue/, 25000), 'Bob est prévenu que l\'hôte est parti (et attend)');
  check(!/Partie terminée/.test(await bob.locator('body').innerText()), 'la partie n\'est pas fermée chez Bob');
  await W(bob, 6000); // l'hôte reste absent un moment : son minuteur ne doit pas en pâtir

  // ---- 3. Il rouvre l'appli : bandeau « Reprendre » ----
  const host2 = await hctx.newPage();
  host2.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await host2.goto(URL); await W(host2, 800);
  const banner = await host2.locator('.resume-card').innerText().catch(() => '');
  check(new RegExp(`Ta partie ${code}`).test(banner) && /Le Quiz/.test(banner) && /3 joueurs/.test(banner), 'accueil : « Ta partie … n\'est pas finie » (Quiz, 3 joueurs)', banner);
  await host2.locator('.resume-card button', { hasText: 'Reprendre' }).click();
  await host2.waitForSelector('.screen.game-screen', { timeout: 10000 });
  const t0 = Date.now();
  const back = await (async () => {
    while (Date.now() - t0 < 60000) {
      const st = await hostState(host2);
      if (st && st.players.filter((p) => p.on).length === 3) {
        // Les joueurs reviennent pendant le délai de grâce : on vérifie qu'ils sont vraiment reconnectés.
        const banners = await Promise.all([bob, chloe].map((p) => p.locator('.conn-banner.live').count()));
        if (!banners[0] && !banners[1]) return true;
      }
      await W(host2, 500);
    }
    return false;
  })();
  check(back, `Bob et Chloé sont revenus tout seuls (${Math.round((Date.now() - t0) / 1000)} s)`);
  const after = await hostState(host2);
  check(after.code === code && after.game === 'race-quiz', 'même code, toujours le Quiz', after);
  check(JSON.stringify(after.players.map((p) => [p.name, p.score])) === JSON.stringify(before.players.map((p) => [p.name, p.score])), 'mêmes joueurs, mêmes scores', { before: before.players, after: after.players });
  check(after.i === 1 && after.q === before.q, 'la partie reprend sur la même question (la 2e)', [before.q, after.q]);
  // Sans décalage, le minuteur aurait perdu toute la durée de l'absence (plus de 10 s).
  const lost = Math.round((before.left - after.left) / 1000);
  check(after.phase === 'q' && lost < 6, `minuteur mis en pause pendant l'absence (${lost} s perdues pour ${Math.round((after.at - before.at) / 1000)} s d'absence)`);
  const bobText2 = await bob.locator('body').innerText();
  const qWord = String(before.q || '').split(' ').slice(0, 4).join(' ');
  check(qWord && bobText1.includes(qWord) && bobText2.includes(qWord), 'Bob voit toujours la même question', qWord);

  // ---- 4. Chloé ferme l'appli et revient par le bandeau ----
  const cctx = chloe.context();
  await chloe.close();
  await W(host2, 500);
  const chloe2 = await cctx.newPage();
  await chloe2.goto(URL); await W(chloe2, 800);
  const cb = await chloe2.locator('.resume-card').innerText().catch(() => '');
  check(new RegExp(`partie ${code}`).test(cb), 'accueil de Chloé : « Tu étais dans la partie … »', cb);
  await chloe2.locator('.resume-card button', { hasText: 'Revenir' }).click();
  await W(chloe2, 4000);
  let st = await hostState(host2);
  const names = st.players.map((p) => p.name);
  check(names.length === 3 && !names.some((n) => /2$/.test(n)), 'Chloé a retrouvé sa place (pas de « Chloé 2 »)', names);

  // ---- 5. Bob revient depuis un autre navigateur, même prénom ----
  await bob.close();
  await W(host2, 300);
  // Le départ de Bob est vu au plus tard au bout de 16 s (pas de message de départ quand la page est fermée).
  for (let i = 0; i < 50; i++) { st = await hostState(host2); if (st.players.find((p) => p.name === 'Bob' && !p.on)) break; await W(host2, 500); }
  const bob2 = await phone();
  await bob2.goto(URL + '#/join/' + code);
  await bob2.getByPlaceholder('Ton prénom').fill('Bob');
  await bob2.getByRole('button', { name: 'Rejoindre le salon' }).click();
  await W(bob2, 5000);
  st = await hostState(host2);
  check(st.players.length === 3 && st.players.find((p) => p.name === 'Bob').on, 'Bob (autre navigateur, même prénom) a retrouvé sa place', st.players);

  // ---- L'hôte quitte pour de bon : plus rien à reprendre ----
  await host2.locator('.icon-btn[aria-label="Menu de la partie"]').click(); await W(host2, 250);
  await host2.locator('.modal .btn', { hasText: 'Quitter' }).click(); await W(host2, 250);
  await host2.locator('.modal .btn', { hasText: 'Quitter' }).click(); await W(host2, 800);
  check(!(await hostState(host2)), 'l\'hôte a quitté : la sauvegarde est effacée');
  check(await waitText(bob2, /L'hôte a fermé la partie/, 8000), 'les joueurs sont prévenus que la partie est fermée');

  const real = errors.filter((e) => !/PeerJS|ERR_FAILED|peer/.test(e));
  check(!real.length, 'aucune erreur JS', real);
  await browser.close();
});
