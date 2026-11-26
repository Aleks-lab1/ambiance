// Génère sw.js avec la liste de tous les fichiers de l'appli et un numéro de version
// calculé à partir de leur contenu. À relancer après chaque modification :
//   node scripts/gen-sw.mjs
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['scripts', 'sw.js', 'README.md', 'CLAUDE.md', '.git', 'node_modules', 'tests', '.github', '.nojekyll', 'netlify.toml', 'vercel.json', 'CNAME']);

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
const rel = (f) => './' + relative(root, f).split('\\').join('/');
const digest = (list) => {
  const hash = createHash('sha256');
  for (const f of list) { hash.update(relative(root, f)); hash.update(readFileSync(f)); }
  return hash.digest('hex').slice(0, 10);
};
// Les images (img/) ont leur propre cache, gardé d'une version à l'autre tant qu'elles ne changent pas.
const isImage = (f) => rel(f).startsWith('./img/');
const version = digest(files);
const imgVersion = digest(files.filter(isImage));
const assets = ['./', ...files.filter((f) => !isImage(f)).map(rel)];
const images = files.filter(isImage).map(rel);

const sw = `// Service worker d'Ambiance — fichier généré par scripts/gen-sw.mjs, ne pas modifier à la main.
const VERSION = '${version}';
const CACHE = 'ambiance-' + VERSION;
// Images des jeux : cache à part, qui ne change que si une image change (pas retéléchargées à chaque mise à jour).
const IMG_CACHE = 'ambiance-img-${imgVersion}';
const ASSETS = ${JSON.stringify(assets, null, 2)};
const IMAGES = ${JSON.stringify(images, null, 2)};

self.addEventListener('install', (event) => {
  // cache: 'reload' : on télécharge les fichiers neufs, sans passer par le cache HTTP du navigateur
  // (sinon la nouvelle version pouvait embarquer d'anciens fichiers). Puis on s'active tout de suite.
  const fresh = (u) => new Request(u, { cache: 'reload' });
  event.waitUntil(Promise.all([
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map(fresh))),
    caches.open(IMG_CACHE).then(async (cache) => {
      const have = new Set((await cache.keys()).map((r) => r.url));
      await cache.addAll(IMAGES.filter((u) => !have.has(new URL(u, self.location.href).href)).map(fresh));
    }),
  ]).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ambiance-') && k !== CACHE && k !== IMG_CACHE).map((k) => caches.delete(k))))
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
    // Page : le réseau d'abord (version à jour), le cache si hors ligne.
    event.respondWith(fetch(req, { cache: 'no-cache' }).catch(() => caches.match('./index.html')));
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
console.log(`sw.js généré : version ${version}, ${assets.length} fichiers + ${images.length} images (cache ${imgVersion}).`);
