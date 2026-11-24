// Test MANUEL avec les VRAIS serveurs relais publics (CONFIG.relayBrokers) : hôte + joueur, WebRTC en UDP
// coupé pour forcer le relais, puis une manche du Bon Mot. Demande Internet ; non lancé par run-all.
//   node relay/relay-real.manual.cjs          (https : messages chiffrés)
//   PLAIN=1 node relay/relay-real.manual.cjs  (http : sans chiffrement, comme une ancienne version)
// Derrière un proxy (environnement cloud), la variable HTTPS_PROXY est utilisée automatiquement.
const { chromium, devices } = require('playwright');
const { serveRepo, collectErrors, SETTINGS } = require('../lib/pw-helper.cjs');
const { check, run } = require('../lib/check.cjs');

const APP = process.env.PLAIN ? 'http://app.test/' : 'https://app.test/';

run(async () => {
  const launch = { args: ['--force-webrtc-ip-handling-policy=disable_non_proxied_udp', '--webrtc-ip-handling-policy=disable_non_proxied_udp'] };
  if (process.env.HTTPS_PROXY) launch.proxy = { server: process.env.HTTPS_PROXY };
  const browser = await chromium.launch(launch);
  const errors = [];
  const frames = []; // ce qui part vers les serveurs relais publics
  const phone = async () => {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block', ignoreHTTPSErrors: true });
    await serveRepo(ctx);
    const page = await ctx.newPage();
    collectErrors(page, errors);
    page.on('websocket', (w) => { console.log('  websocket :', w.url().slice(0, 60)); w.on('framesent', (f) => { if (!/peerjs/.test(w.url())) frames.push(String(f.payload)); }); });
    await page.addInitScript((s) => { try { localStorage.setItem('ambiance:settings', JSON.stringify(s)); } catch {} }, SETTINGS);
    return page;
  };
  const host = await phone(), cli = await phone();
  await host.goto(APP + '#/online');
  await host.getByPlaceholder('Ton prénom').fill('Alice');
  await host.getByRole('button', { name: 'Créer la partie' }).click();
  await host.waitForSelector('.room-code', { timeout: 30000 });
  const code = (await host.locator('.room-code').innerText()).trim();
  await host.waitForTimeout(800);
  const t1 = Date.now();
  await cli.goto(APP + '#/join/' + code);
  await cli.getByPlaceholder('Ton prénom').fill('Bob');
  await cli.getByRole('button', { name: 'Rejoindre', exact: true }).click();
  await host.waitForFunction(() => /Bob/.test(document.body.innerText), null, { timeout: 45000 });
  check(true, `Bob a rejoint en ${Date.now() - t1} ms`);
  await host.locator('.game-pick button', { hasText: 'Le Bon Mot' }).click(); await host.waitForTimeout(300);
  await host.getByRole('button', { name: /Lancer Le Bon Mot/ }).click();
  await cli.waitForSelector('.bm-card', { timeout: 20000 });
  await host.waitForFunction(() => document.querySelector('.bm-tiles'), null, { timeout: 20000 });
  // Celui dont c'est le tour a un champ de saisie actif.
  const canType = (pg) => pg.evaluate(() => { const i = document.querySelector('.bm-input'); return !!i && !i.disabled && i.offsetParent !== null; });
  await host.waitForFunction(() => document.querySelector('.bm-tiles'), null, { timeout: 20000 });
  const hostTurn = await canType(host);
  const actor = hostTurn ? host : cli, watcher = hostTurn ? cli : host;
  await actor.locator('.bm-input').fill('zzqq'); await actor.locator('.bm-input').press('Enter'); await actor.waitForTimeout(800);
  const msg = await watcher.locator('.bm-card').innerText();
  check(/zzqq|-3|commence|connais/i.test(msg), 'l\'autre téléphone voit le mot refusé', msg);
  const sealed = frames.filter((f) => /"t":"e"/.test(f)).length;
  const clear = frames.filter((f) => /Alice|Bob|zzqq|"state"/.test(f));
  if (process.env.PLAIN) check(sealed === 0, 'http : messages en clair (pas de chiffrement sans https)', sealed);
  else check(sealed > 3 && !clear.length, `relais réel : ${sealed} messages chiffrés, aucun prénom ni mot lisible`, clear.slice(0, 2));
  await browser.close();
});
