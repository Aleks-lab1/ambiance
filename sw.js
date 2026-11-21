// Service worker d'Ambiance — fichier généré par scripts/gen-sw.mjs, ne pas modifier à la main.
const VERSION = '672ac8c1c1';
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
  "./js/bingo-core.js",
  "./js/bonmot-core.js",
  "./js/canvas.js",
  "./js/common.js",
  "./js/config.js",
  "./js/data/action.js",
  "./js/data/anagrammes.js",
  "./js/data/bingo.js",
  "./js/data/cap.js",
  "./js/data/chansons.js",
  "./js/data/chapeau.js",
  "./js/data/cinq.js",
  "./js/data/classement.js",
  "./js/data/confidences.js",
  "./js/data/curseur.js",
  "./js/data/debats.js",
  "./js/data/dessin.js",
  "./js/data/deuxverites.js",
  "./js/data/dico.js",
  "./js/data/disle.js",
  "./js/data/dix.js",
  "./js/data/emojis.js",
  "./js/data/estimations.js",
  "./js/data/etsi.js",
  "./js/data/front.js",
  "./js/data/gages.js",
  "./js/data/histoire.js",
  "./js/data/imposteur.js",
  "./js/data/jamais.js",
  "./js/data/levels.js",
  "./js/data/mime.js",
  "./js/data/mots.js",
  "./js/data/motsinterdits.js",
  "./js/data/nioui.js",
  "./js/data/opinions.js",
  "./js/data/ordre.js",
  "./js/data/paranoia.js",
  "./js/data/patate.js",
  "./js/data/petitbac.js",
  "./js/data/punchlines.js",
  "./js/data/qui.js",
  "./js/data/quiaecrit.js",
  "./js/data/quiz.js",
  "./js/data/telephone.js",
  "./js/data/tupreferes.js",
  "./js/data/unisson.js",
  "./js/data/vraifaux.js",
  "./js/favorites.js",
  "./js/games/action.js",
  "./js/games/bingo.js",
  "./js/games/bonmot.js",
  "./js/games/bouteille.js",
  "./js/games/cartes.js",
  "./js/games/chapeau.js",
  "./js/games/cinq.js",
  "./js/games/couleurs.js",
  "./js/games/debats.js",
  "./js/games/dessin.js",
  "./js/games/doigt.js",
  "./js/games/duel.js",
  "./js/games/enligne.js",
  "./js/games/front.js",
  "./js/games/histoire.js",
  "./js/games/imposteur.js",
  "./js/games/index.js",
  "./js/games/loup.js",
  "./js/games/morpion.js",
  "./js/games/motmystere.js",
  "./js/games/nioui.js",
  "./js/games/outils.js",
  "./js/games/paquet.js",
  "./js/games/paranoia.js",
  "./js/games/patate.js",
  "./js/games/pendu.js",
  "./js/games/petitbac.js",
  "./js/games/plateau.js",
  "./js/games/race.js",
  "./js/games/roi.js",
  "./js/games/roue.js",
  "./js/games/sequence.js",
  "./js/games/soiree.js",
  "./js/games/teamwords.js",
  "./js/online/bingo.js",
  "./js/online/bonmot.js",
  "./js/online/cartes.js",
  "./js/online/dessin.js",
  "./js/online/equipes.js",
  "./js/online/games.js",
  "./js/online/hasard.js",
  "./js/online/imposteur.js",
  "./js/online/kit.js",
  "./js/online/live.js",
  "./js/online/menteur.js",
  "./js/online/mots.js",
  "./js/online/oral.js",
  "./js/online/paquet.js",
  "./js/online/plateau.js",
  "./js/online/race.js",
  "./js/online/relay.js",
  "./js/online/room.js",
  "./js/online/soiree.js",
  "./js/online/telephone.js",
  "./js/online/tour.js",
  "./js/online/unisson.js",
  "./js/online/vote.js",
  "./js/online/write.js",
  "./js/plateau-core.js",
  "./js/players.js",
  "./js/race-core.js",
  "./js/sfx.js",
  "./js/store.js",
  "./js/themes.js",
  "./js/turn.js",
  "./js/ui.js",
  "./manifest.webmanifest",
  "./vendor/peerjs.min.js",
  "./vendor/qrcode.js"
];

self.addEventListener('install', (event) => {
  // cache: 'reload' : on télécharge les fichiers neufs, sans passer par le cache HTTP du navigateur
  // (sinon la nouvelle version pouvait embarquer d'anciens fichiers). Puis on s'active tout de suite.
  event.waitUntil(caches.open(CACHE)
    .then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
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
