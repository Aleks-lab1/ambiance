// Service worker d'Ambiance — fichier généré par scripts/gen-sw.mjs, ne pas modifier à la main.
const VERSION = '7ae7a3fc5b';
const CACHE = 'ambiance-' + VERSION;
const ASSETS = [
  "./",
  "./css/style.css",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/icon.svg",
  "./index.html",
  "./js/app.js",
  "./js/canvas.js",
  "./js/common.js",
  "./js/config.js",
  "./js/data/action.js",
  "./js/data/chapeau.js",
  "./js/data/cinq.js",
  "./js/data/debats.js",
  "./js/data/dessin.js",
  "./js/data/dix.js",
  "./js/data/front.js",
  "./js/data/gages.js",
  "./js/data/imposteur.js",
  "./js/data/jamais.js",
  "./js/data/levels.js",
  "./js/data/mime.js",
  "./js/data/motsinterdits.js",
  "./js/data/paranoia.js",
  "./js/data/patate.js",
  "./js/data/petitbac.js",
  "./js/data/qui.js",
  "./js/data/tupreferes.js",
  "./js/games/action.js",
  "./js/games/cartes.js",
  "./js/games/chapeau.js",
  "./js/games/cinq.js",
  "./js/games/debats.js",
  "./js/games/dessin.js",
  "./js/games/doigt.js",
  "./js/games/front.js",
  "./js/games/imposteur.js",
  "./js/games/index.js",
  "./js/games/loup.js",
  "./js/games/outils.js",
  "./js/games/paranoia.js",
  "./js/games/patate.js",
  "./js/games/petitbac.js",
  "./js/games/roi.js",
  "./js/games/roue.js",
  "./js/games/teamwords.js",
  "./js/online/dessin.js",
  "./js/online/games.js",
  "./js/online/imposteur.js",
  "./js/online/room.js",
  "./js/online/vote.js",
  "./js/players.js",
  "./js/sfx.js",
  "./js/store.js",
  "./js/turn.js",
  "./js/ui.js",
  "./manifest.webmanifest",
  "./vendor/peerjs.min.js",
  "./vendor/qrcode.js"
];

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
