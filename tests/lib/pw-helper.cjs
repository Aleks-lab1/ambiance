// Ouvre l'appli dans Chromium (Playwright) en servant les fichiers du dépôt via http://app.test/,
// sans serveur web : chaque requête est interceptée et lue sur le disque. Service worker bloqué.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, '..', 'out'); // captures d'écran (ignoré par git)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const SETTINGS = { drink: true, sound: false, vibrate: false, adult: false };

/** Branche le dépôt sur http://app.test/ (et https://app.test/, utile pour le chiffrement) dans un contexte Playwright. */
async function serveRepo(context) {
  await context.route(/^https?:\/\/app\.test\//, (route) => {
    let p = decodeURIComponent(new URL(route.request().url()).pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: 'nf' });
    route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
}

/** Collecte les erreurs JS de la page dans un tableau. */
function collectErrors(page, errors = []) {
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return errors;
}

/** Ouvre http://app.test/<hash> dans un iPhone simulé. Renvoie { browser, page, errors }. */
async function open(hash = '', opts = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block', ...opts });
  await serveRepo(context);
  const page = await context.newPage();
  const errors = collectErrors(page);
  await page.addInitScript((s) => { try { localStorage.setItem('ambiance:settings', JSON.stringify(s)); } catch {} }, SETTINGS);
  await page.goto('http://app.test/' + hash);
  return { browser, page, errors };
}

/** Capture d'écran dans tests/out/ si SHOTS=1. */
async function shot(page, name) {
  if (!process.env.SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, name + '.png') });
}

module.exports = { open, serveRepo, collectErrors, shot, ROOT, OUT, SETTINGS };
