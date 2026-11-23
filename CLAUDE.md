# Ambiance : mémo pour Claude

## Le projet
**Ambiance** est une appli web installable (PWA) de jeux de soirée en français : 61 jeux, **tous jouables en
ligne** (chacun sur son téléphone) et aussi sur un seul téléphone. Elle est écrite en JavaScript simple (modules ES), **sans compilation ni dépendance
npm**. Il suffit d'ouvrir `index.html`. Elle est publiée sur **GitHub Pages depuis la branche `gh-pages`**.
Le nom reste « Ambiance » : ne pas renommer l'appli.

## Organisation
| Dossier | Rôle |
|---|---|
| `index.html`, `manifest.webmanifest`, `sw.js` | Page unique, manifeste PWA, service worker (**généré**, ne pas modifier à la main) |
| `js/` | Cœur : `app.js` (accueil, routes `#/…`, réglages), `ui.js` (helper DOM `h()`, `topbar`, `shuffle`…), `common.js` (`onlineBanner`, dés…), `themes.js`, `config.js` (PeerJS, relais), `store.js`, `players.js`, `sfx.js` |
| `js/*-core.js` | Logique sans interface, partagée entre jeu local et en ligne : `bonmot-core.js`, `plateau-core.js`, `race-core.js`, `bingo-core.js` |
| `js/games/` | Jeux sur un seul téléphone + **catalogue `js/games/index.js`** (les 61 jeux) |
| `js/online/` | Jeu en ligne : `room.js` (salon, hôte, connexions), `relay.js` (relais MQTT), `games.js` (**catalogue en ligne**), `kit.js` (outils communs), un fichier par famille de jeux (`soiree.js`, `plateau.js`, `tour.js`, `mots.js`, `live.js`, `equipes.js`, `vote.js`, `cartes.js` (Et si, Confidences, Cap, Action ou vérité), `paquet.js` (Roi, Plus ou moins, Bus), `hasard.js` (Bouteille, Roue, Qui commence, Outils), `oral.js` (Sur le front, Ni oui ni non, Histoire folle)…) |
| `js/data/` | Contenu des jeux (questions, mots, défis…) : `ordre.js`, `quiaecrit.js`, `curseur.js`… et le dictionnaire généré `mots.js` |
| `scripts/` | `gen-sw.mjs` (service worker), `gen-mots.mjs` (dictionnaire), `argot.txt` (argot/verlan ajoutés à la main) |
| `css/style.css` | Toute la feuille de style |
| `tests/` | Outils de test, hors appli (voir plus bas et `tests/README.md`) |

## Règles obligatoires après chaque modification
1. **`node scripts/gen-sw.mjs`** : régénère `sw.js` (liste des fichiers + version). Sans ça, les téléphones gardent l'ancienne version.
2. Si un jeu est ajouté ou retiré, **mettre à jour le nombre de jeux** dans `README.md`, `index.html` (meta description) et
   `manifest.webmanifest` (description). `js/app.js` utilise `GAMES.length`. Vérifier avec `grep -n "61"` (ancien nombre).
3. **Tester** (`cd tests && node run-all.cjs`), puis **publier sur les trois branches** : `main`, `gh-pages` et la branche de travail
   de la session (`claude/…`). Les trois pointent sur le même commit, par exemple : `git push origin HEAD:main HEAD:gh-pages HEAD:<branche-de-travail>`.

## Tous les jeux se jouent en ligne
- **Chaque jeu doit exister aussi en ligne** : plus de badge « En ligne », plus de tag `'online'` ni de filtre « En ligne » (tous les jeux le sont).
  Le test `local/jeux-locaux.test.cjs` vérifie qu'il y a autant de jeux en ligne que de jeux et que chaque écran propose « Créer une partie ».
- Quand tous les joueurs ne peuvent pas participer (Et si…, La Bouteille, Le Roi…), **le joueur dont c'est le tour (ou l'hôte) agit et les autres
  regardent** en direct sur leur téléphone. Ne jamais afficher les boutons d'action aux spectateurs.
- Jeux à choix (Quiz, Vrai ou faux…) : **on touche directement la réponse**, pas de bouton « Révéler la réponse ». La bonne réponse s'affiche
  en vert (en rouge si raté) et le point est compté au joueur dont c'est le tour.

## Jeux de rapidité (Quiz, À vue de nez, Vrai ou faux, Émojis, Anagrammes, Calcul)
- `js/race-core.js` : `questionSource(mode, données, réglages)` → `next()` tire les questions **sans répétition d'une partie à l'autre**
  (déjà vues mémorisées dans le téléphone, clé `seen:race:<mode>` via `makeDeck` de `store.js`, effacées par « Revoir toutes les cartes »).
  Quand tout a été vu, on recommence un tour complet. En ligne, c'est le téléphone de l'hôte qui mémorise.
- Réglage `count` : 0 = **∞ sans limite** (questions tirées au fur et à mesure, bouton « 🏁 Terminer la partie »).
- Contenu dans `js/data/quiz.js`, `estimations.js`, `vraifaux.js`, `emojis.js`, `anagrammes.js` (« Lot 2 » = ajouts de novembre 2026).
  Après un ajout, `unit/race-core.test.mjs` vérifie le format et l'absence de doublons. Anagrammes : éviter les mots qui forment un autre
  mot courant (« voilier/olivier », « serpent/présent ») : le script de vérification compare avec `COMMUNS` de `js/data/mots.js`.

## Contenu des jeux (`js/data/`)
- Les ajouts de novembre 2026 sont marqués `// Lot 2` dans chaque fichier. `unit/contenu.test.mjs` vérifie le format de tout le contenu et
  l'absence de doublons dans chaque paquet (comparaison sans accents, « œ » = « oe ») : le lancer après chaque ajout.
- Mots interdits : 1 mot + 5 interdits. Imposteur : paires de mots **proches** (pas de doublon dans un sens ou dans l'autre).
  Dico bluff : uniquement des mots **rares** (sinon pas de bluff possible). Dans l'ordre : `[événement, année]`, année négative = av. J.-C.
- Hot / Hot++ : réservé aux adultes (confirmation 18+), toujours consentant ; garder « chacun peut refuser ».

## Salon en ligne
- L'hôte touche un jeu une fois pour le choisir (réglages affichés), **une 2e fois pour le lancer** (`lobbyArmed` dans `room.js`).
  Le bouton « ▶ Lancer » reste disponible.

## Ajouter un jeu en ligne
Créer un objet dans un fichier de `js/online/`, puis l'ajouter à `ONLINE_GAMES` dans `js/online/games.js`.
```js
export const monJeuOnline = {
  id: 'monjeu', name: 'Mon jeu', short: 'Phrase courte pour le salon', emoji: '🎯', minPlayers: 2,
  defaults: { rounds: 5 },
  settingsForm: (st, set) => /* éléments h() ; set({ rounds: 7 }) */,
  init(room, st, api) { return { gid: uid(), st, phase: 'play', round: 1 }; },  // état de l'hôte
  action(room, s, pid, a, api) { /* a = ce qu'un joueur a envoyé ; true = renvoyer la vue à tous */ },
  tick(room, s, api) { /* toutes les 250 ms chez l'hôte (minuteurs) ; true = renvoyer */ },
  onJoin(room, s, pid, api) {}, onLeave(room, s, pid, api) {},   // facultatifs
  view(room, s, pid) { /* ce que voit CE joueur : ne jamais y mettre les secrets des autres */ },
  mount(root, g) { return { update(room, view) {}, destroy() {} }; },
};
```
- **L'hôte fait autorité** : `init`, `action`, `tick` ne tournent que chez l'hôte. Les autres reçoivent `view(...)` et l'affichent dans `update`.
- `api` = `{ now, relay, sendTo, toastAll }`. Les scores sont dans `room.players[].score` (`addScore`).
- Objet `g` passé à `mount` : `me` (pid du joueur), `isHost`, `send(action)`, `now()`, `nameOf(pid)`, `hostBar()` (boutons de l'hôte en fin de partie),
  `hotseat` (vrai quand on se passe un seul téléphone : afficher le prénom au lieu de « Toi »).
- `js/online/kit.js` : `activePids`, `playerOf`, `addScore`, `isOn`, `nextOn` (joueur suivant connecté), `card`, `endScreen` (classement final),
  `timerPill` (minuteur), `actBtn`, `waitHost`, **`drawNew(s, clé, éléments)`** : pioche une carte sans répétition d'une partie à l'autre
  (mémoire dans le téléphone de l'hôte). Toujours l'utiliser pour tirer du contenu en ligne, avec la même clé et la même forme d'éléments
  que la version locale (`makeDeck`) quand c'est possible : la mémoire est alors partagée (ex. `'jamais:soft'`, `'front:animaux'`, `'cinq'`).
- `js/online/soiree.js` exporte aussi `rankList` (liste à classer en touchant), `scaleEl` + `cursorPoints` (échelle du Curseur), `CHI` / `beats`.
- Fin de partie : `phase: 'end'` + `endScreen(room, g)`. Ajouter le jeu dans `tests/online/` (simulateur `mp.cjs`).

## Ajouter un jeu sur un seul téléphone
- Ajouter une entrée dans `GAMES` de `js/games/index.js` : `id`, `name`, `emoji`, `colors`, `desc`, `tags` (`'cartes'`, `'equipes'`, `'rapide'`…),
  `players`, `badges`, `rules`, `load: () => import('./fichier.js').then((m) => m.monjeu)`. Le module exporte `{ start(ctx) }`
  (`ctx.root`, `ctx.meta`, `ctx.open(...)`).
- **Badge « Nouveau »** (`new: true` + `'Nouveau'` dans `badges`) : **uniquement sur le dernier lot ajouté**. Il faut l'enlever du lot précédent.
- Mettre `onlineBanner(ctx, 'idEnLigne')` (`js/common.js`) sur l'écran de réglages (bandeau « 🌐 En ligne (recommandé) »). Jeux de cartes
  (`cardGame` dans `js/games/cartes.js`) : `online: 'idEnLigne'` (+ `onlineLabel` pour le texte du bouton). Ajouter une règle « <b>En ligne :</b> … ».
  S'il n'existe **qu'en ligne** : `load: () => import('./enligne.js').then((m) => m.launcher('idEnLigne'))`.
- Mode « on se passe le téléphone » : `hotseat(ctx, moduleEnLigne, réglages, onExit)` dans `js/games/plateau.js` fait tourner un module en ligne
  localement, `g.me` = joueur dont c'est le tour, `g.hotseat = true` (exemples : Memory, Yam's).

## Jeu en ligne : connexions
- `js/online/room.js` : l'hôte crée une partie avec un code. Les joueurs rejoignent via `#/join/CODE`.
- On tente d'abord **PeerJS (WebRTC direct)** pendant `CONFIG.directTimeout` (8 s), puis **relais MQTT public** en secours
  (`js/online/relay.js` : petit client MQTT 3.1.1 sur WebSocket, `RelayHub` / `relayConnect` imitent une connexion PeerJS).
  Si PeerJS est injoignable, on passe directement par le relais. Indispensable quand les joueurs ne sont pas sur le même Wi-Fi.
- Serveurs dans `CONFIG.relayBrokers` (`js/config.js`) : shiftr.io (port 443) d'abord, puis emqx, hivemq, mosquitto.

## Dictionnaire du Bon Mot
- `js/data/mots.js` est **généré** par `node scripts/gen-mots.mjs …` (mode d'emploi en tête du script). Ne pas le modifier à la main.
- Sources : an-array-of-french-words (MIT), FrequencyWords fr_50k + fr_full ≥ 3 occurrences (CC BY-SA 4.0), prénoms data.gouv.fr
  (Licence Ouverte, via @socialgouv/match-entities, Apache-2.0), `scripts/argot.txt`.
- **Un mot manque (argot, verlan, mot récent) → l'ajouter dans `scripts/argot.txt`** puis régénérer.
- `js/bonmot-core.js` : `makeDico()` → `{ size, has, playable, withPrefix, candidates, draw, examples, chainLetters, randomStart }`, `loadDico()`.
  Les mots sont comparés sans accents ni majuscules (`normWord`).

## Thèmes
- `js/themes.js` : `THEMES`, `applyTheme`, `setTheme`, `themeSwatch` (réglages), `gameColors(id, couleursOrigine)`, à utiliser pour toute
  case ou écran de jeu (le thème « Ambiance » garde les couleurs d'origine).
- Variables CSS : `--page-bg` (fond), `--g1` / `--g2` (dégradé principal), `--ob1..3` (case « Jouer en ligne »).
- Animations : `#theme-fx` (particules), classes `fx-…`, `html[data-anim]`. Les particules doivent couvrir tout l'écran, pas seulement le haut.

## Pièges déjà rencontrés
- **Une parenthèse manquante dans `css/style.css`** (ex. `var(--font, …` non fermé) casse **toute** la feuille de style. Relire chaque `var(…)`.
- **`makeDico()` doit toujours renvoyer `has`** (sinon Mot mystère et le Bon Mot plantent). Le test `unit/dico.test.mjs` le vérifie.
- **Grammaire avec « Toi »** : ne jamais écrire `${nom} a…` quand le nom peut être « Toi » (« Toi a désigné », « Toi prend »). Écrire « Tu as… » ou adapter la phrase.
  Même chose pour « 1 passes » (pluriel), « Flotte de Alice » (→ « d'Alice »), « Le classement de Toi » (→ « Ton classement »).
- En mode téléphone partagé, afficher le prénom et non « Toi » (`g.hotseat`).
- `#theme-fx span { top: 0 }` écrasait les animations (particules bloquées en haut) : attention à la spécificité CSS.
- Filtres sur des mots normalisés (sans accents) : écrire les regex sans accents (`ee`, pas `ée`).
- Ne pas supprimer des clés d'un objet pendant qu'on le parcourt (bug du Petit bac).
- Chez l'hôte, `g.send()` met l'écran à jour **tout de suite** (sans réseau) : modifier le texte affiché **avant** `g.send()`, sinon il écrase
  l'écran suivant (bug de La Séquence).
- Animations partagées (bouteille, roue) : garder les mêmes éléments d'un `update` à l'autre, sinon la rotation CSS repart de zéro.
- Oublier `gen-sw.mjs` = les utilisateurs ne voient pas la mise à jour.
- Environnement cloud : ne pas réinstaller Playwright (Chromium est préinstallé). Ne pas exécuter de code téléchargé : extraire avec grep/sed.

## Tests (`tests/`, détails dans `tests/README.md`)
- Installation : `cd tests && npm install` (mqtt-packet). Playwright/Chromium sont déjà là dans l'environnement cloud.
- Tout lancer : `cd tests && node run-all.cjs` (ou `node run-all.cjs online|local|unit|relay`).
- `tests/lib/pw-helper.cjs` : ouvre l'appli dans un iPhone simulé, en servant le dépôt sur `http://app.test/` (pas de serveur web).
- `tests/lib/mp.cjs` : simulateur multijoueur, n joueurs côte à côte branchés sur la logique de l'hôte. C'est l'outil pour tester un jeu en ligne.
- `tests/lib/mock-relay.cjs` : faux serveur relais MQTT + PeerJS bloqué. `relay/lobby-relay.test.cjs` fait une vraie partie par le salon.
- `tests/relay/relay-real.manual.cjs` : manuel, avec les vrais serveurs relais (Internet, utilise `HTTPS_PROXY` si présent).
- `tests/` est exclu du service worker (`SKIP` dans `scripts/gen-sw.mjs`).

## Préférences de l'utilisateur
- Répondre **en français**, simplement, sans jargon.
- Jeux de mots : **tous les mots français acceptés** (prénoms, argot, verlan, mots récents des jeunes, anglicismes courants).
- **Tester avant de publier**, et dire honnêtement ce qui a été testé ou non.
- Ne jamais mettre d'informations personnelles dans le dépôt.

## Mise à jour de ce fichier
Quand tu changes l'architecture, ajoutes un dossier, une règle de publication, un outil de test ou un piège important,
**mets à jour ce CLAUDE.md dans le même commit**.
