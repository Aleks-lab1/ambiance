// Génère sw.js avec la liste de tous les fichiers de l'appli et un numéro de version
// calculé à partir de leur contenu. À relancer après chaque modification :
//   node scripts/gen-sw.mjs
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['scripts', 'sw.js', 'README.md', '.git', 'node_modules', 'tests', '.github', '.nojekyll', 'netlify.toml', 'vercel.json']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    if (SKIP.has(name) || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(root);
const hash = createHash('sha256');
for (const f of files) { hash.update(relative(root, f)); hash.update(readFileSync(f)); }
const version = hash.digest('hex').slice(0, 10);
const assets = ['./', ...files.map((f) => './' + relative(root, f).split('\\').join('/'))];

const sw = `// Service worker d'Ambiance — fichier généré par scripts/gen-sw.mjs, ne pas modifier à la main.
const VERSION = '${version}';
const CACHE = 'ambiance-' + VERSION;
const ASSETS = ${JSON.stringify(assets, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ambiance-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(caches.match('./index.html').then((r) => r || fetch(req)));
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => cached || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});
`;
writeFileSync(join(root, 'sw.js'), sw);
console.log(`sw.js généré : version ${version}, ${assets.length} fichiers en cache.`);
