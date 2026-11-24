// Service worker d'Ambiance — fichier généré par scripts/gen-sw.mjs, ne pas modifier à la main.
const VERSION = '32c9dca647';
const CACHE = 'ambiance-' + VERSION;
// Images des jeux : cache à part, qui ne change que si une image change (pas retéléchargées à chaque mise à jour).
const IMG_CACHE = 'ambiance-img-4ed0f6ac42';
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
  "./js/finder.js",
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
  "./js/morpion-vue.js",
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
  "./js/online/save.js",
  "./js/online/soiree.js",
  "./js/online/telephone.js",
  "./js/online/tour.js",
  "./js/online/tv.js",
  "./js/online/unisson.js",
  "./js/online/vote.js",
  "./js/online/write.js",
  "./js/plateau-core.js",
  "./js/players.js",
  "./js/race-core.js",
  "./js/sfx.js",
  "./js/sortable.js",
  "./js/store.js",
  "./js/themes.js",
  "./js/turn.js",
  "./js/ui.js",
  "./manifest.webmanifest",
  "./vendor/peerjs.min.js",
  "./vendor/qrcode.js"
];
const IMAGES = [
  "./img/jeux/action.webp",
  "./img/jeux/anagrammes.webp",
  "./img/jeux/bataille.webp",
  "./img/jeux/bingo.webp",
  "./img/jeux/bonmot.webp",
  "./img/jeux/bouteille.webp",
  "./img/jeux/bus.webp",
  "./img/jeux/calcul.webp",
  "./img/jeux/cap.webp",
  "./img/jeux/chapeau.webp",
  "./img/jeux/chifoumi.webp",
  "./img/jeux/cinq.webp",
  "./img/jeux/confidences.webp",
  "./img/jeux/couleurs.webp",
  "./img/jeux/curseur.webp",
  "./img/jeux/danssatete.webp",
  "./img/jeux/debats.webp",
  "./img/jeux/dessin.webp",
  "./img/jeux/deuxverites.webp",
  "./img/jeux/dico.webp",
  "./img/jeux/disle.webp",
  "./img/jeux/dix.webp",
  "./img/jeux/doigt.webp",
  "./img/jeux/duel.webp",
  "./img/jeux/emojis.webp",
  "./img/jeux/estimations.webp",
  "./img/jeux/etsi.webp",
  "./img/jeux/fredonne.webp",
  "./img/jeux/front.webp",
  "./img/jeux/histoire.webp",
  "./img/jeux/imposteur.webp",
  "./img/jeux/jamais.webp",
  "./img/jeux/loup.webp",
  "./img/jeux/memory.webp",
  "./img/jeux/menteur.webp",
  "./img/jeux/mime.webp",
  "./img/jeux/morpion.webp",
  "./img/jeux/motmystere.webp",
  "./img/jeux/motsinterdits.webp",
  "./img/jeux/nioui.webp",
  "./img/jeux/opinions.webp",
  "./img/jeux/ordre.webp",
  "./img/jeux/outils.webp",
  "./img/jeux/paranoia.webp",
  "./img/jeux/patate.webp",
  "./img/jeux/pendu.webp",
  "./img/jeux/petitbac.webp",
  "./img/jeux/plusmoins.webp",
  "./img/jeux/punchlines.webp",
  "./img/jeux/qui.webp",
  "./img/jeux/quiaecrit.webp",
  "./img/jeux/quisuisje.webp",
  "./img/jeux/quiz.webp",
  "./img/jeux/roi.webp",
  "./img/jeux/roue.webp",
  "./img/jeux/sequence.webp",
  "./img/jeux/telephone.webp",
  "./img/jeux/tupreferes.webp",
  "./img/jeux/unisson.webp",
  "./img/jeux/vraifaux.webp",
  "./img/jeux/yams.webp",
  "./img/ui/main.webp",
  "./img/ui/mode-local.webp",
  "./img/ui/mode-online.webp",
  "./img/ui/mode-tv.webp"
];

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
