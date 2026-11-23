// Service worker (mode hors ligne), avec un vrai petit serveur web sur localhost (le service worker exige
// https ou localhost) : tout est mis en cache à l'installation, les images des jeux dans un cache à part qui
// n'est pas retéléchargé lors d'une mise à jour de l'appli, et l'accueil s'affiche avec ses images hors ligne.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { check, wait: W, run } = require('../lib/check.cjs');
const { ROOT, SETTINGS } = require('../lib/pw-helper.cjs');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };

run(async () => {
  const hits = [];
  let swPatch = null; // simule une nouvelle version de l'appli (sw.js modifié)
  let online = true;
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!online) { res.destroy(); return; }
    hits.push(p);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
    let body = fs.readFileSync(f);
    if (p === '/sw.js' && swPatch) body = Buffer.from(swPatch(body.toString()));
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://localhost:${server.address().port}/`;

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((s) => { try { if (!localStorage.getItem('ambiance:settings')) localStorage.setItem('ambiance:settings', JSON.stringify(s)); } catch {} }, SETTINGS);
  // Attend qu'une condition (évaluée dans la page, éventuellement async) soit vraie.
  const until = async (fn, ms = 60000) => {
    for (const t0 = Date.now(); Date.now() - t0 < ms; await W(200)) if (await page.evaluate(fn).catch(() => false)) return true;
    return false;
  };
  await page.goto(base);
  check(await until(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated'), 'service worker installé et actif');

  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const IMAGES = JSON.parse(sw.match(/const IMAGES = (\[[\s\S]*?\]);/)[1]);
  const nImages = IMAGES.length;
  const nTiles = IMAGES.filter((u) => u.startsWith('./img/jeux/')).length; // images des cases (+ img/ui/ : main du 4 en ligne…)
  const nAssets = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1]).length;
  const caches1 = await page.evaluate(async () => Object.fromEntries(await Promise.all((await caches.keys()).map(async (k) => [k, (await (await caches.open(k)).keys()).length]))));
  const imgCache = Object.keys(caches1).find((k) => k.startsWith('ambiance-img-'));
  const mainCache = Object.keys(caches1).find((k) => k.startsWith('ambiance-') && k !== imgCache);
  check(imgCache && caches1[imgCache] === nImages, `images des jeux en cache (${caches1[imgCache]}/${nImages})`, caches1);
  check(mainCache && caches1[mainCache] >= nAssets, `fichiers de l'appli en cache (${caches1[mainCache]}/${nAssets})`, caches1);

  // Nouvelle version de l'appli (le code change, pas les images) : les images ne sont pas retéléchargées.
  hits.length = 0;
  swPatch = (t) => t.replace(/const VERSION = '([0-9a-f]+)'/, "const VERSION = 'test0update'");
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await until(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return (await caches.keys()).includes('ambiance-test0update') && reg && !reg.installing && !reg.waiting && reg.active?.state === 'activated';
  });
  await W(1500); // rechargement automatique de l'accueil après la mise à jour
  await page.waitForSelector('.tile');
  const caches2 = await page.evaluate(async () => (await caches.keys()).sort());
  check(caches2.includes('ambiance-test0update') && caches2.includes(imgCache) && !caches2.includes(mainCache), 'mise à jour : nouveau cache, ancien supprimé, cache d\'images gardé', caches2);
  const imgHits = hits.filter((p) => p.startsWith('/img/'));
  check(hits.includes('/js/app.js') && imgHits.length === 0, `mise à jour : fichiers retéléchargés sauf les images (${hits.length} fichiers, ${imgHits.length} image)`, imgHits.slice(0, 5));

  // Hors ligne : l'accueil s'affiche avec toutes ses images.
  online = false;
  await page.reload();
  await page.waitForSelector('.tile');
  for (let y = 0; y < 12000; y += 700) { await page.evaluate((v) => window.scrollTo(0, v), y); await W(40); }
  await W(500);
  const img = await page.evaluate(() => { const l = [...document.querySelectorAll('img.tile-art')]; return { n: l.length, ok: l.filter((i) => i.complete && i.naturalWidth > 0).length, emo: document.querySelectorAll('.tile-emo').length }; });
  check(img.n >= nTiles && img.ok === img.n && !img.emo, `hors ligne : ${img.ok}/${img.n} images affichées`, img);
  const hand = await page.evaluate(() => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i.naturalWidth > 0); i.onerror = () => ok(false); i.src = 'img/ui/main.webp'; }));
  check(hand, 'hors ligne : image de la main (4 en ligne) disponible');
  check(!errors.length, 'aucune erreur JS', errors);
  await browser.close();
  server.close();
});
