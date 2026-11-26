# Ambiance : mémo pour Claude

## Le projet
**Ambiance** est une appli web installable (PWA) de jeux de soirée en français : 62 jeux, **tous jouables en
ligne** (chacun sur son téléphone) et aussi sur un seul téléphone. Elle est écrite en JavaScript simple (modules ES), **sans compilation ni dépendance
npm**. Il suffit d'ouvrir `index.html`. Elle est publiée sur **GitHub Pages depuis la branche `gh-pages`**.
Le nom reste « Ambiance » : ne pas renommer l'appli.

## Organisation
| Dossier | Rôle |
|---|---|
| `index.html`, `manifest.webmanifest`, `sw.js` | Page unique, manifeste PWA, service worker (**généré**, ne pas modifier à la main) |
| `js/` | Cœur : `app.js` (accueil 3 modes, écran Local `#/local`, routes `#/…`, réglages), `modes-art.js` (cases des 3 modes de l'accueil : illustration, icône), `finder.js` (accueil : nombre de joueurs, recherche, au hasard, joués récemment), `ui.js` (helper DOM `h()`, `topbar`, `shuffle`…), `common.js` (`onlineBanner`, dés…), `themes.js`, `config.js` (PeerJS, relais), `store.js`, `players.js`, `sfx.js` |
| `js/*-core.js` | Logique sans interface, partagée entre jeu local et en ligne : `bonmot-core.js`, `plateau-core.js`, `race-core.js`, `bingo-core.js`, `foule-core.js` (Dans la foule : place, passants, poussées, fontaines) |
| `js/foule-art.js` | Dans la foule : dessin animé des bonshommes (formes `SHAPE_D` / `EYE_D`), de la place et des fontaines (`createScene`, `drawGuy`, `drawAvatar`) |
| `js/icons.js`, `js/icons-data.js` | **Icônes de l'interface à la place des emojis** (voir « Icônes, pas d'emojis ») ; `icons-data.js` est **généré** par `scripts/gen-icons.mjs` |
| `js/sortable.js`, `js/morpion-vue.js` | Composants animés partagés local + en ligne : liste à classer en glissant (`sortList`), plateaux du Morpion et du 4 en ligne (`tttView`, `c4View`) |
| `js/games/` | Jeux sur un seul téléphone + **catalogue `js/games/index.js`** (les 62 jeux) |
| `js/online/` | Jeu en ligne : `room.js` (salon, hôte, connexions), `save.js` (partie enregistrée chez l'hôte, place du joueur), `tv.js` (écran télé), `relay.js` (relais MQTT chiffré), `games.js` (**catalogue en ligne**), `kit.js` (outils communs), un fichier par famille de jeux (`soiree.js`, `plateau.js`, `tour.js`, `mots.js`, `live.js`, `equipes.js`, `vote.js`, `cartes.js` (Et si, Confidences, Cap, Action ou vérité), `paquet.js` (Roi, Plus ou moins, Bus), `hasard.js` (Bouteille, Roue, Qui commence, Outils), `oral.js` (Sur le front, Ni oui ni non, Histoire folle), `foule.js` (Dans la foule, TV Mode seulement)…) |
| `js/data/` | Contenu des jeux (questions, mots, défis…) : `ordre.js`, `quiaecrit.js`, `curseur.js`… et le dictionnaire généré `mots.js` |
| `img/jeux/` | Image de chaque jeu pour l'accueil (`<id>.webp`), **générée** par `scripts/gen-images.mjs` : ne pas modifier à la main |
| `img/ui/` | Images de l'interface : `main.webp` (main du 4 en ligne, emoji Fluent 3D 🫳 `1faf3`, recadré, compressé par Pillow), `mode-<id>.webp` (illustrations des 3 cases de l'accueil, découpées dans la maquette par `node scripts/gen-images.mjs modes`) |
| `fonts/` | Police **Fredoka** (600, 700, licence OFL dans `OFL.txt`) pour les titres des cases de l'accueil |
| `scripts/` | `gen-sw.mjs` (service worker), `gen-mots.mjs` (dictionnaire), `argot.txt` (argot/verlan ajoutés à la main), `gen-images.mjs` (images des jeux, compositions dans `images/scenes.mjs`, silhouettes game-icons.net dans `images/icons/` + `CREDITS.md`), `gen-icons.mjs` + `icons-map.mjs` (icônes de l'interface : table emoji → icône) |
| `css/style.css` | Toute la feuille de style |
| `tests/` | Outils de test, hors appli (voir plus bas et `tests/README.md`) |

## Règles obligatoires après chaque modification
1. **`node scripts/gen-sw.mjs`** : régénère `sw.js` (liste des fichiers + version). Sans ça, les téléphones gardent l'ancienne version.
2. Si un jeu est ajouté ou retiré, **mettre à jour le nombre de jeux** dans `README.md`, `index.html` (meta description) et
   `manifest.webmanifest` (description). `js/app.js` utilise `GAMES.length`. Vérifier avec `grep -n "62"` (ancien nombre).
   Un jeu ajouté a besoin de **son image** (voir « Accueil : images des jeux »).
3. **Tester** (`cd tests && node run-all.cjs`), puis **publier sur les trois branches** : `main`, `gh-pages` et la branche de travail
   de la session (`claude/…`). Les trois pointent sur le même commit, par exemple : `git push origin HEAD:main HEAD:gh-pages HEAD:<branche-de-travail>`.

## Tous les jeux se jouent en ligne
- **Chaque jeu doit exister aussi en ligne** : plus de badge « En ligne », plus de tag `'online'` ni de filtre « En ligne » (tous les jeux le sont).
  Le test `local/jeux-locaux.test.cjs` vérifie qu'il y a autant de jeux en ligne que de jeux et que chaque écran propose « Créer une partie ».
- **Exception : les jeux réservés au TV Mode** (`tvOnly`, voir plus bas), comme Dans la foule : ils sont en ligne, mais seulement
  dans un salon créé par la télé. Ils comptent quand même parmi les jeux en ligne (`ONLINE_GAMES`).
- Quand tous les joueurs ne peuvent pas participer (Et si…, La Bouteille, Le Roi…), **le joueur dont c'est le tour (ou l'hôte) agit et les autres
  regardent** en direct sur leur téléphone. Ne jamais afficher les boutons d'action aux spectateurs.
- Jeux à choix (Quiz, Vrai ou faux…) : **on touche directement la réponse**, pas de bouton « Révéler la réponse ». La bonne réponse s'affiche
  en vert (en rouge si raté) et le point est compté au joueur dont c'est le tour.

## Jeux de rapidité (Quiz, À vue de nez, Vrai ou faux, Émojis, Anagrammes, Calcul)
- `js/race-core.js` : `questionSource(mode, données, réglages)` → `next()` tire les questions **sans répétition d'une partie à l'autre**
  (déjà vues mémorisées dans le téléphone, clé `seen:race:<mode>` via `makeDeck` de `store.js`, effacées par « Revoir toutes les cartes »).
  Quand tout a été vu, on recommence un tour complet. En ligne, c'est le téléphone de l'hôte qui mémorise.
- Réglage `count` : 0 = **∞ sans limite** (questions tirées au fur et à mesure, bouton « 🏁 Terminer la partie »).
- **Quiz : choix du thème avant de lancer** : une seule case parmi « 🔀 Tout mélanger » et les 9 thèmes, avec leur nombre de questions
  (`themeGrid` de `js/common.js` ; `quizThemes`, `themeChoice`, `themesOf` de `race-core.js` ; réglage `themes` : `[]` = tout, `[id]` = un thème).
  Sur un téléphone : en haut de l'écran du Quiz. En ligne : `choose(st, set)` du module (fenêtre « Quel thème ? » chez le chef quand il
  lance, toucher un thème = lancer) ; `launch()` de `room.js` l'appelle pour tout jeu qui a `choose` (pas depuis la fenêtre ⚙️ des réglages).
- Contenu dans `js/data/quiz.js`, `estimations.js`, `vraifaux.js`, `emojis.js`, `anagrammes.js` (« Lot 2 » = ajouts de novembre 2026).
  Quiz : environ 200 questions par thème (« Lot 3 », fin novembre 2026, 1 835 au total). En ajouter : vérifier qu'une question proche
  n'existe pas déjà dans un autre thème (même bonne réponse, mêmes mots), réponses courtes (≤ 48 caractères), faits stables (pas de
  record ou de champion du moment).
  Après un ajout, `unit/race-core.test.mjs` vérifie le format et l'absence de doublons. Anagrammes : éviter les mots qui forment un autre
  mot courant (« voilier/olivier », « serpent/présent ») : le script de vérification compare avec `COMMUNS` de `js/data/mots.js`.

## Contenu des jeux (`js/data/`)
- Les ajouts de novembre 2026 sont marqués `// Lot 2` dans chaque fichier. `unit/contenu.test.mjs` vérifie le format de tout le contenu et
  l'absence de doublons dans chaque paquet (comparaison sans accents, « œ » = « oe ») : le lancer après chaque ajout.
- Mots interdits : 1 mot + 5 interdits. Imposteur : paires de mots **proches** (pas de doublon dans un sens ou dans l'autre).
  Dico bluff : uniquement des mots **rares** (sinon pas de bluff possible). Dans l'ordre : `[événement, année]`, année négative = av. J.-C.
- Hot / Hot++ : réservé aux adultes (confirmation 18+), toujours consentant ; garder « chacun peut refuser ».

## Accueil : 3 modes (Local, Online, TV Mode)
- L'accueil (`renderHome`, `js/app.js`) : logo + ⚙️, bandeau de reprise, puis **3 grandes cases empilées de haut en bas**
  (`.mode-card`), **reproduites d'après la maquette de l'utilisateur** (`scripts/images/maquette-accueil.webp`, faite avec ChatGPT) :
  - l'illustration de droite est **découpée dans la maquette** (`MODE_CROPS` de `scenes.mjs` : zone + bouts de lettres à effacer)
    par `node scripts/gen-images.mjs modes` → `img/ui/mode-<id>.webp`, fondue vers la gauche (masque) et qui « respire » doucement ;
  - le reste est refait en HTML/CSS (`js/modes-art.js`, styles « Cases des modes ») : fond assorti (rayons orange, bleu, violet),
    icône au trait (téléphone, globe, télé), titre **Fredoka** blanc cerné (`--ink` de la case), sous-titre en 2 lignes, bouton foncé
    « … › », étincelles, reflet qui balaie la case, petite profondeur à la souris (`parallax`). Couleurs fixes (pas de thème).
  - Tailles en **`cqh`** relatives à `.mode-in` (couche intérieure `container-type: size` : un `<button>` ne peut pas être ce repère).
  Accès aux modes :
  - **Local** → `#/local` (`renderLocal`, `LOCAL_META`) : les jeux à un seul téléphone = `LOCAL_GAMES` (`GAMES` sans les 8 jeux
    `onlineOnly: true` : Qui a écrit ça, Dans sa tête, Qui suis-je, Punchlines, Téléphone dessiné, Dico bluff, Menteur, et Dans la foule
    qui est en plus `tvOnly`).
  - **Online** → `#/online` : prénom, puis « Créer le salon » / « Rejoindre le salon » (code).
  - **TV Mode** → `#/tv` : « ▶ Lancer la télé » (la télé crée le salon), « Je suis un joueur » (code), « Afficher un salon déjà créé ».
- Les écrans `local` et `online` sont des « menus » pour `openScreen` (pas de « joué récemment », pas d'étoile favori).

## Salon en ligne : le chef lance, les autres votent
- Tout le monde voit les jeux en ligne illustrés (`.game-pick` > `.pick-tile`, image du jeu du catalogue via `localIdOf` de
  `js/online/games.js`, catégories du jeu local). **Le chef** (`room.host`) touche un jeu pour le choisir, une 2e fois pour le
  lancer (barre du bas : ⚙️ réglages dans une fenêtre, « ▶ Lancer … »). **Les autres votent** (`lobby:vote`, toucher encore = retirer) :
  `room.votes` { pid: jeu }, badge « 🗳️ n » sur les cases, bande « 🗳️ Demandés », votes effacés au lancement. Jeux qui demandent
  plus de joueurs que de connectés : case pâlie « 👥 n+ ».
- `g.isHost` (dans `mount` des jeux) = **est le chef** (`room.host === me.pid`), pas « cet appareil fait tourner la partie ».

## Accueil : trouver le bon jeu dans « Local » (`js/finder.js`)
- Dans l'écran Local : recherche, catégories, **« 👥 On est »** (2…8, 10+ : jeux dont `players` contient ce
  nombre, choix gardé 6 h), puis « N jeux » + **🎲 Au hasard** (modale où les jeux défilent puis s'arrêtent, évite les 3 derniers joués).
- Recherche : chaque mot tapé = début d'un mot du nom, de la description ou des catégories. Sans accent, les accents sont ignorés ;
  **avec un accent, il compte** (« dés » ne doit pas trouver tous les jeux contenant « des »). Taper bascule sur « Tous ».
- **Joués récemment** (`recent`, 8 max, enregistré par `openScreen`) : ligne de mini-cases sous les favoris, sans répéter les favoris.
- En haut de l'accueil, bandeau de reprise (voir « Partie coupée »). Le champ `players` de chaque jeu doit rester lisible
  (`2-16`, `3+`, `2`) : `unit/accueil.test.mjs` le vérifie.

## Accueil : images des jeux (style « autocollant »)
- L'utilisateur **n'aime pas les emojis** (« ça fait trop IA ») : plus d'emojis 3D sur les cases, ni dans l'interface. Il veut
  des dessins **colorés et stylés** (les silhouettes toutes blanches étaient trop fades, certaines « ridicules » : éviter les
  visages et les dessins qu'on ne reconnaît pas en petit).
- Chaque case (`.tile`, `renderGrid` dans `js/app.js`) : l'image `img/jeux/<id>.webp` (fond transparent, 540 × 360) = des
  **autocollants** : chaque dessin est coloré (dégradé clair → couleur), entouré d'un **épais liseré blanc** et posé avec une ombre
  douce, sur le dégradé du jeu (`gameColors`, donc le thème). En CSS : lumière douce en haut à droite, **trame de points** qui
  s'efface vers la gauche et liseré clair (`::before`), voile sombre en bas, **nom incrusté en bas à gauche**. **Pas de description.**
  Case 3:2, pastilles en haut à gauche, étoile en haut à droite. Mêmes styles pour les favoris (`.mini-tile`) et le salon (`.pick-tile`).
- Composition de chaque image dans `scripts/images/scenes.mjs` (repère 300 × 200, élément principal `M(nom, couleur)` vers (206, 90)
  en grand, un petit élément `L(…)` à gauche et `Rt(…)` à droite ; garder dégagés le bas à gauche et les coins du haut) : silhouettes
  de **game-icons.net** (CC BY 3.0, copiées dans `scripts/images/icons/<nom>.svg`, crédits dans `CREDITS.md`, dans les réglages et
  le README), tuiles de lettres, cartes à jouer, boules de bingo, mots en Fredoka, roue colorée, potence, touches de la Séquence.
  **Couleurs** (constantes en tête de `scenes.mjs`) : choisir une couleur qui ressort sur la case, et **jamais blanc pour un dessin
  qui a des détails** (dés, carte, livre…) : ses trous sont remplis de blanc par le liseré, les détails disparaîtraient. Puis
  `node scripts/gen-images.mjs <id>` : dessin dans Chromium (Playwright), compression WebP par Pillow (~20 Ko par image).
- Élément `blob(x, y, taille, { pose, mood, f })` : un bonhomme de Dans la foule (dessin de `js/foule-art.js`, chargé dans la page par
  `gen-images.mjs`), poses `stand`, `walk`, `push`, `down`.
- Silhouette pas encore copiée : récupérer le paquet `@iconify-json/game-icons` (commande en tête de `gen-images.mjs`) et relancer
  avec `ICONS_JSON=…` : le dessin manquant est copié dans `scripts/images/icons/`.
- **Regarder le résultat** (capture d'écran de l'écran Local) avant de publier. `unit/images.test.mjs` vérifie une image par jeu.
- Service worker : `img/` a son propre cache (`IMG_CACHE`, versionné sur les images seulement), les images ne sont donc pas
  retéléchargées à chaque mise à jour de l'appli. Testé par `local/sw.test.cjs`.

## Icônes, pas d'emojis (`js/icons.js`)
- Le code garde ses emojis dans les textes (« 🎯 Au tour de Bob », `emoji: '🎲'` des jeux, niveaux, thèmes…), mais **à l'affichage
  ils deviennent des icônes SVG** (Phosphor Icons « fill », MIT ; quelques silhouettes game-icons.net, noms `gi:…`) de la taille et
  de la couleur du texte (`.ic`, 1.15em). C'est fait automatiquement par `h()`, `append()`, `replaceChildren()`, `prepend()`
  (`js/ui.js`), le HTML des règles (`html:` → `iconify`) et **`setText(el, texte)`** : **ne jamais écrire `el.textContent = '…🎯…'`**
  (l'emoji resterait), utiliser `setText`. Comparer un texte déjà affiché avec `textContent` ne marche plus s'il a des emojis :
  garder la dernière valeur dans une variable (exemple : `tvSay`).
- Table emoji → icône : `scripts/icons-map.mjs` (« nom#couleur » pour une icône colorée : équipes 🔴🔵, médailles). Un emoji absent de
  la table reste un emoji : l'y ajouter, puis `node scripts/gen-icons.mjs` (paquets à récupérer : commande en tête du script) →
  `js/icons-data.js`. `icon('nom')` crée une icône directement.
- **Emojis qui font partie du jeu = gardés** : conteneurs `KEEP` de `js/icons.js` (`.keep-emo`, `.emoji-big` des Émojis mystères,
  `.mc-front` du Memory, mains du Chifoumi…). Pour du contenu fait d'emojis, mettre la classe `keep-emo`.
- Tests : le texte d'un bouton n'a plus d'emoji (`getByRole('button', { name: 'Lancer la télé' })`, pas `'▶ Lancer la télé'`), ni
  `innerText` (« 3 » et non « 👤 3 »).

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
  // Facultatif, jeux en temps réel : frame(room, s, dt, api) à chaque image chez l'hôte (true = renvoyer, sur un événement
  // seulement) ; tvOnly: true = jeu réservé au TV Mode (voir « Jeux réservés au TV Mode »).
  onJoin(room, s, pid, api) {}, onLeave(room, s, pid, api) {},   // facultatifs
  view(room, s, pid) { /* ce que voit CE joueur : ne jamais y mettre les secrets des autres */ },
  mount(root, g) { return { update(room, view) {}, destroy() {} }; },
  // Facultatif : écran télé spécial (voir « Mode télé »). Sinon la télé montre l'écran commun.
  tv(room, s) { return this.view(room, s, TV_PID); },   // vue d'un spectateur (TV_PID de kit.js) : aucun secret
  tvMount(root, g) { return { update(room, tvView) {}, destroy() {} }; },
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
- `js/online/soiree.js` exporte aussi `ORDRE_EDGES` (étiquettes de Dans l'ordre !), `scaleEl` + `scaleRange` + `cursorPoints` (échelle du Curseur,
  le curseur se glisse directement sur l'échelle), `CHI` / `beats` / `chiArena` (poings « Chi… Fou… Mi ! » puis les deux choix).
- Fin de partie : `phase: 'end'` + `endScreen(room, g)`. Ajouter le jeu dans `tests/online/` (simulateur `mp.cjs`).

## Ajouter un jeu sur un seul téléphone
- Ajouter une entrée dans `GAMES` de `js/games/index.js` : `id`, `name`, `emoji`, `colors`, `desc`, `tags` (`'cartes'`, `'equipes'`, `'rapide'`…),
  `players`, `badges`, `rules`, `load: () => import('./fichier.js').then((m) => m.monjeu)`. Le module exporte `{ start(ctx) }`
  (`ctx.root`, `ctx.meta`, `ctx.open(...)`).
- **Badge « Nouveau »** (`new: true` + `'Nouveau'` dans `badges`) : **uniquement sur le dernier lot ajouté**. Il faut l'enlever du lot précédent.
  Dernier lot : Dans la foule (jeu TV Mode, absent de Local) : le filtre « Nouveaux » de Local n'est alors pas proposé (aucun jeu local nouveau).
- Mettre `onlineBanner(ctx, 'idEnLigne')` (`js/common.js`) sur l'écran de réglages (bandeau « 🌐 En ligne (recommandé) »). Jeux de cartes
  (`cardGame` dans `js/games/cartes.js`) : `online: 'idEnLigne'` (+ `onlineLabel` pour le texte du bouton). Ajouter une règle « <b>En ligne :</b> … ».
  S'il n'existe **qu'en ligne** : `load: () => import('./enligne.js').then((m) => m.launcher('idEnLigne'))`.
- **Image de la case** : composition dans `scripts/images/scenes.mjs`, puis `node scripts/gen-images.mjs <id>`.
- Mode « on se passe le téléphone » : `hotseat(ctx, moduleEnLigne, réglages, onExit)` dans `js/games/plateau.js` fait tourner un module en ligne
  localement, `g.me` = joueur dont c'est le tour, `g.hotseat = true` (exemples : Memory, Yam's).

## Jeux réservés au TV Mode (`tvOnly`) et jeux en temps réel (`frame`)
- Un jeu **`tvOnly: true`** (module en ligne et entrée du catalogue, avec `onlineOnly: true`) ne se joue que dans un salon créé par la
  télé (`room.tvHost`) : la télé fait tourner la partie et l'affiche, les téléphones servent de **manettes**. Salon : la case n'apparaît
  que dans le salon du TV Mode, en premier, avec le badge « 📺 Spécial télé » ; `startGame` refuse de le lancer ailleurs (message au chef).
  Sa fiche (`launcher(id, { tv: true })` de `js/games/enligne.js`) dit « Se joue en TV Mode » : « ▶ Lancer la télé » / « Je suis un joueur ».
  Pas de version sur un seul téléphone (exception à « chaque jeu existe aussi en local »).
- **Temps réel** : un module avec **`frame(room, s, dt, api)`** est appelé à chaque image chez l'hôte (`Host.startFrames`, boucle
  `requestAnimationFrame`, démarrée par `tick` ; en pause quand la page est cachée). `frame` renvoie `true` **seulement sur un événement**
  (phase, poussée, fontaine…), jamais à chaque image : la vue n'est pas renvoyée en continu. Les entrées de manette (`{ type: 'mv', d }`)
  renvoient `false`. Le temps du jeu est celui du monde (`s.world.t`, secondes, avance avec `dt`) : pas de date, la reprise marche sans
  `shiftTimes`. La télé (même page que l'hôte en TV Mode) reçoit la vue **sans copie** : `tv()` donne `s.world` lui-même, que l'écran
  redessine à chaque image (`createScene` de `js/foule-art.js`) sans attendre de nouvelle vue.
- **Dans la foule** (`js/online/foule.js`, `js/foule-core.js`, `js/foule-art.js`) : une place (repère 1600 × 900) avec 4 fontaines et
  une foule de bonshommes tous pareils (`crowdSize(n)`, 20 à 36) ; chaque joueur en pilote un en secret (`s.who` : pid → numéro, jamais
  dans les bonshommes eux-mêmes). Les passants marchent à la **même vitesse** (`SPEED`), vont toucher les fontaines, ont les mêmes
  expressions… et **ne poussent jamais** (pousser démasque). But : toucher ses 4 fontaines dans l'ordre du téléphone (+3), faire tomber un
  joueur (+1, éliminé de la manche), dernier debout (+2), temps écoulé (+1 au plus avancé s'il est seul). Révélation des noms à chaque fin
  de manche, une couleur par manche. Manette : joystick qui se place sous le doigt (16 directions, redite chaque seconde ; sans nouvelles
  depuis 2,6 s le bonhomme s'arrête), bouton « Pousser » qui se recharge, clavier (flèches/ZQSD, Espace).
- Les bonshommes viennent des dessins fournis par l'utilisateur (faits avec Gemini) : tête, corps, bras, jambe, yeux (ouverts, contents,
  en colère, sonnés) dans `SHAPE_D` / `EYE_D`. Ne pas les redessiner : animer les morceaux (ressorts = effet gélatine). Style voulu :
  bonshommes mous et dodus « genre Gang Beasts », **sans copier** les personnages de ce jeu.

## Animations « comme en vrai » (fluidité)
L'utilisateur tient à ce que les jeux soient **fluides et satisfaisants** : on manipule directement (glisser plutôt que taper des numéros),
et ce qui bouge en vrai bouge à l'écran (jeton qui tombe, carte qui se retourne, dé qui roule). Outils existants, à réutiliser :
- **Classer en glissant** : `sortList(textes, { order, top, bottom, labels, locked, onChange })` (`js/sortable.js`) → `{ el, order(), lock(),
  check(solution) (vert/rouge), settle(solution, étiquettes) (les cartes glissent à leur vraie place), destroy() }`. Doigt, souris et flèches
  du clavier. Dans l'ordre !, Dans sa tête. Tests : `tests/lib/sort.cjs` (`sortByDrag`, `dragTo` : vrais glisser-déposer à la souris).
- **4 en ligne** (nom générique : ne pas reprendre le nom commercial d'un jeu existant) : `c4View({ onPick })` → `setTurn(joueur, peutJouer)`,
  `drop(case, joueur)` (promesse : la main se place, enfonce le jeton, il tombe derrière la façade et rebondit), `win`, `clear` (les jetons
  tombent par le bas), `nope`. **Morpion** : `tttView` (grille et symboles tracés au feutre, ligne gagnante barrée).
- **Cartes** : `flip3(face, dos)` / `revealCard(carte, classes)` (`js/games/paquet.js`) : la carte tirée arrive face cachée et se retourne en 3D.
  Memory : `memBoard` (`js/online/plateau.js`), cartes 3D gardées d'une mise à jour à l'autre.
- **Dés** : `tumble(dé)` (`js/common.js`, dé créé par `dieFace`) : il tourne, ses faces défilent, il retombe sur sa valeur.
- **Roue, bouteille** : `spinTicks(élément, nbCases, { pointer, ms, onTick })` : un tic à chaque case qui passe vraiment (angle lu à chaque image).
- **Bataille navale** : `bnGrid(..., { fx: { i, res } })` anime le dernier tir (gerbe d'eau, explosion, bateau coulé).
- Divers : `.reveal-in` (carte secrète qu'on retourne : rôle, mot), `stamp` du Bingo, `drawing(n, true)` du Pendu (trait qui se trace),
  sons `sfx.clack`, `card`, `rattle`, `splash`, `scribble`.
- **Règle d'or en ligne** : `update` est appelé à chaque changement (un autre joueur qui valide…). Un élément animé ou qu'on manipule
  (liste, plateau, cartes) doit **rester le même** d'un `update` à l'autre : ne remplacer que les textes autour, et n'animer que ce qui est
  nouveau (comparer avec l'état affiché, ex. `shown` du 4 en ligne, `lastKey`). Sinon l'animation repart ou le glissement en cours est coupé.

## Mode télé (`js/online/tv.js`)
- Un ordinateur ou une télé affiche la partie en grand, les téléphones servent de manettes. Deux façons :
  - **TV Mode** (`#/tv` → « ▶ Lancer la télé ») : **la télé fait tourner la partie** (`new Host(…, { tvHost: true })`, `this.self = null` :
    elle n'est pas un joueur, `room.players` est vide au départ, `room.tvHost`). Les téléphones scannent le QR code (`#/join/CODE`).
    **Le premier arrivé est le chef** (`room.host`, `ensureLeader`) ; s'il se déconnecte, ou n'est plus connecté depuis 15 s
    (`leaderGone`, par ex. après le rechargement de la télé), le suivant prend la relève (« 👑 Chloé est le chef »). La télé affiche
    `viewForTv()` en local (`deliver`), les traits de dessin seulement si `tvRelay`. Reprise : la sauvegarde garde `tvHost`.
  - **Afficher un salon déjà créé** (TV Mode → code, ou `#/tv/CODE`) : un téléphone a créé le salon (Online), la télé s'y branche.
- Dans `Host`, ne pas confondre `this.self` (joueur de l'appareil, `null` pour la télé) et `room.host` (le chef).
- La télé se connecte comme un joueur (`Client`, `hello` avec `tv: true`) mais l'hôte la range à part (`Host.tvs`) : **elle n'est
  pas un joueur** (ni dans `room.players`, ni dans les scores), ses actions sont ignorées. Elle reçoit `viewForTv()` :
  - jeu avec écran télé : `mod.tv(room, s)` = **`view(room, s, TV_PID)`** (un spectateur qui ne connaît aucun secret) ;
  - autres jeux : seulement `{ ended }` → écran commun (« 📱 À vous de jouer sur vos téléphones ! », podium à la fin).
  **Ne jamais envoyer à la télé la vue d'un vrai joueur**, ni `settings`. `online/tele-secrets.test.cjs` vérifie, pour les 62 jeux,
  que la télé ne reçoit aucun texte visible seulement par certains joueurs.
- Traits de dessin (`api.relay`) et `onSync` : envoyés à la télé **seulement si le module a `tvRelay: true`** (Je dessine). Le
  Téléphone dessiné relaie des dessins privés : il ne doit pas l'avoir.
- **Écrans spéciaux : 56 jeux sur 62**, pensés pour un écran paysage (tout tient dans l'écran, rien ne défile) : jeux de rapidité
  (`makeRace`), Je dessine, Qui a écrit ça ?, Punchlines, Dico bluff, Loup-garou, les 5 votes (question, puis barres qui
  s'allongent), Et si / Confidences / Cap / Action ou vérité (à qui le tour, la carte en grand), Bouteille et Roue (elles
  tournent en grand, `spinTicks`), Qui commence ?, Boîte à outils, Le Roi / Plus ou moins / Le Bus (cartes qui se retournent),
  Memory, Yam's, Bataille navale (les tirs seulement, bateaux cachés), Morpion & 4 en ligne, Pendu, Mot mystère (couleurs
  seulement, aucune lettre), Petit bac, Paranoïa, Pour ou contre, 3 en 5 s, Deux vérités, Curseur, Dans sa tête, Dans l'ordre,
  Chifoumi, les 5 jeux par équipes (scores des équipes, jamais le mot), Unisson, Bon Mot (la saisie en direct), Bingo,
  Sur le front, Ni oui ni non, Histoire folle, Patate chaude, La Séquence, Dans la foule (la place en temps réel, TV Mode seulement). **Sans écran spécial** (écran commun) : Réflexes,
  Couleurs pièges, L'Imposteur, Menteur, Téléphone dessiné, Qui suis-je (le jeu se passe sur les téléphones ou tout y est secret).
- Outils dans `kit.js` : `tvTimer(g)` (compte à rebours), `tvEnd(room)` (podium), `tvWho()` (pastilles « ✓ a répondu », gardées
  d'une mise à jour à l'autre), `tvTurn(emoji, prénom, phrase)` (« à qui le tour »), `tvSplit(gauche, droite)` (deux colonnes :
  le jeu à gauche, les textes à droite), `tvBars(lignes, total)` (barres de résultats animées), `tvSay()` (grande phrase d'état
  qui saute quand elle change), **`tvStage(root, ...éléments)`** (pour un jeu qui a une fin : `end(room, fini)` affiche le podium
  et remet les éléments si la partie recommence avec le même jeu : ne jamais faire `root.replaceChildren` dans `tvMount`).
  Styles « Écrans télé des jeux » de `css/style.css` (classes `.tv-…`, tailles en `em`).
- Morpion & 4 en ligne : la télé monte **l'écran du téléphone en spectateur** (`this.mount(…, { ...g, me: TV_PID, isHost: false })`)
  avec une mise en page télé (`.tv-morpion`) : même animation des coups, sans la recopier.
- La télé est vue **par tout le monde** : dans `view(room, s, pid)`, `TV_PID` n'est ni dans une équipe ni « celui qui devine »
  (jeux par équipes : rôle `'tv'`, Sur le front : pas de mot). Une vue qui montre quelque chose « à tous sauf X » doit exclure `TV_PID`.
- Même règle d'or qu'au téléphone : ne pas recréer ce qui est animé à chaque `update` (comparer une clé d'étape).
- Mise en page : `body.tv-mode`, tailles en `em` sur `.tv` (`font-size` en `vw`) ; en dessous de 820 px ou en portrait, tout passe en
  colonne. Classement à droite (points gagnés animés), code + QR en haut à droite, bouton ⛶ plein écran, messages en bas.

## Partie coupée, partie reprise (`js/online/save.js`)
- L'hôte enregistre la partie dans son téléphone (`host-save` : salle, joueurs, scores, état du jeu) à chaque envoi (au plus 1 fois/s),
  toutes les 4 s pendant un jeu, et tout de suite quand l'appli passe en arrière-plan (`visibilitychange`, `pagehide`).
  Quitter volontairement (← confirmé) efface la sauvegarde (`destroy()`) ; une fermeture involontaire la garde 3 h.
- Reprise (bandeau de l'accueil ou écran « Jouer en ligne ») : même code (adresse PeerJS réessayée en fond, relais tout de suite),
  `pack`/`unpack` (Set et Map compris), **`shiftTimes`** décale toutes les dates de la durée de la coupure (minuteurs en pause).
  Les joueurs ont `CONFIG.rejoinGrace` (45 s) pour revenir avant d'être comptés comme partis.
- **L'état d'un jeu doit rester des données** (objets, tableaux, Set, Map, nombres, textes) : pas de fonction, de `Date` ni d'objet
  de classe (sinon la partie reprend au salon). Ce qui vit hors de l'état (dictionnaire, pioche `questionSource` dans une WeakMap)
  se recrée dans un crochet **`restore(room, s, api)`** du module (exemples : `race.js`, `bonmot.js`, Mot mystère, Pendu).
  Le dictionnaire peut être encore en chargement juste après la reprise : protéger chaque `dico.…` (`if (!dico)`).
  `online/reprise-jeux.test.cjs` recharge chacun des 62 jeux et compare la vue de chaque joueur.
- Côté joueur : attente de l'hôte jusqu'à `CONFIG.hostWait` (5 min) ; après 2 échecs en direct, il passe au relais (un hôte
  qui reprend n'a parfois que le relais). L'hôte prévient en partant (`{ t: 'away', gone }` → « Alice a quitté l'appli un instant… »).
- Place du joueur (`seat` : code + pid) : il revient avec le même identifiant (bandeau « Revenir dans la partie »). L'hôte rend
  aussi sa place à un nouveau venu qui porte **le même prénom qu'un joueur déconnecté** (autre navigateur) : `welcome` contient
  alors l'ancien pid et le joueur l'adopte.

## Jeu en ligne : connexions
- `js/online/room.js` : l'hôte crée une partie avec un code. Les joueurs rejoignent via `#/join/CODE`.
- On tente d'abord **PeerJS (WebRTC direct)** pendant `CONFIG.directTimeout` (8 s), puis **relais MQTT public** en secours
  (`js/online/relay.js` : petit client MQTT 3.1.1 sur WebSocket, `RelayHub` / `relayConnect` imitent une connexion PeerJS).
  Si PeerJS est injoignable, on passe directement par le relais. Indispensable quand les joueurs ne sont pas sur le même Wi-Fi.
- Serveurs dans `CONFIG.relayBrokers` (`js/config.js`) : shiftr.io (port 443) d'abord, puis emqx, hivemq, mosquitto.
- **Relais chiffré** : le joueur envoie `open` avec sa clé publique ECDH (`k`), l'hôte répond `ok` avec la sienne, puis tout passe en
  `{ t: 'e', i, d }` (AES-GCM, clé dérivée par HKDF, sel = code + identifiant de connexion). Chiffrer/déchiffrer est asynchrone :
  `cipher()` garde l'ordre des messages, et la fermeture passe après les messages en attente (`later`). Sans `crypto.subtle`
  (page en http) ou face à une ancienne version : en clair, comme avant. Le joueur répète `open` toutes les 2 s tant qu'il n'a pas
  de réponse ; même demande (même `c`, même `k`) = même connexion et même réponse, éventuellement sur un autre serveur.

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
- **`el.textContent = '🎯 …'` affiche l'emoji** (l'utilisateur n'en veut pas) : utiliser `setText(el, …)` de `js/ui.js`.
- **Une parenthèse manquante dans `css/style.css`** (ex. `var(--font, …` non fermé) casse **toute** la feuille de style. Relire chaque `var(…)`.
- **`makeDico()` doit toujours renvoyer `has`** (sinon Mot mystère et le Bon Mot plantent). Le test `unit/dico.test.mjs` le vérifie.
- **Grammaire avec « Toi »** : ne jamais écrire `${nom} a…` quand le nom peut être « Toi » (« Toi a désigné », « Toi prend »). Écrire « Tu as… » ou adapter la phrase.
  Même chose pour « 1 passes » (pluriel), « Flotte de Alice » (→ « d'Alice »), « Le classement de Toi » (→ « Ton classement »).
- En mode téléphone partagé, afficher le prénom et non « Toi » (`g.hotseat`).
- `#theme-fx span { top: 0 }` écrasait les animations (particules bloquées en haut) : attention à la spécificité CSS.
- Filtres sur des mots normalisés (sans accents) : écrire les regex sans accents (`ee`, pas `ée`).
- Ne pas supprimer des clés d'un objet pendant qu'on le parcourt (bug du Petit bac).
- Jeu en temps réel : renvoyer la vue à chaque image saturerait le réseau (et le relais). `frame` ne renvoie `true` que sur un événement ;
  ce qui bouge en continu (positions) n'est lu que par la télé, dans `s.world`, sans passer par le réseau.
- Dans la foule : rien ne doit trahir un joueur (vitesse, expressions, sons de la télé quand il touche une fontaine). Tout ce que font les
  joueurs, les passants le font aussi, sauf pousser.
- Chez l'hôte, `g.send()` met l'écran à jour **tout de suite** (sans réseau) : modifier le texte affiché **avant** `g.send()`, sinon il écrase
  l'écran suivant (bug de La Séquence).
- Animations partagées (bouteille, roue) : garder les mêmes éléments d'un `update` à l'autre, sinon la rotation CSS repart de zéro.
- Chez l'hôte, la vue (`view(...)`) **partage les tableaux de l'état** (ex. `board`) : les copier (`slice`) avant de s'en servir plus tard
  (animation en file d'attente), sinon on anime un coup… avec le plateau du coup suivant.
- Liste à glisser en ligne : ne jamais la recréer pendant une question (le doigt « tenu » serait perdu). Elle est dans son propre conteneur.
- Trait qui se trace en CSS : `pathLength="1"` sur des `<path>` uniquement (cercle → path en deux arcs) et l'animation `draw` (pointillés
  seulement pendant l'animation, `backwards` s'il y a un délai) : à la fin le trait redevient plein, même si `pathLength` n'est pas géré.
- Carte 3D (`flip3`) : ses deux faces sont dans la même case de grille, centrées (`justify-self: center`), sinon la rotation décale la carte.
- Oublier `gen-sw.mjs` = les utilisateurs ne voient pas la mise à jour.
- Environnement cloud : ne pas réinstaller Playwright (Chromium est préinstallé). Ne pas exécuter de code téléchargé : extraire avec grep/sed.
- Playwright : `page.waitForFunction(async () => …)` n'attend pas la promesse (toujours « vraie ») : boucler sur `page.evaluate`.
- Le service worker ne s'installe pas sur `http://app.test/` (il faut https ou localhost) : `local/sw.test.cjs` lance un vrai serveur.
- `crypto.subtle` n'existe pas en http : le relais y reste en clair. Tester le chiffrement sur `https://app.test/`.
- Relais simulé : le faux serveur partage les abonnements entre toutes les adresses de `relayBrokers`, donc l'hôte reçoit chaque
  message 4 fois (une par serveur). Le code doit le supporter (même demande = même connexion).
- Après une reprise, un module qui garde quelque chose hors de l'état (WeakMap, variable du module) plante au premier coup s'il
  n'a pas de `restore`.
- Unités `cqh` : un `<button>` n'est pas un repère de taille valable (tout vaut 0), et le fond d'un repère lui-même ne peut pas
  utiliser ses propres `cqh` (il prend celui du parent) : positions des dégradés en `%`.
- Écran télé : `tv()` est appelé comme méthode (`this.mod.tv(...)`), `this.view` y désigne bien le module. Le mot masqué de
  Je dessine (« _ _ _ ») est public (tous les devineurs le voient) : le test des secrets l'ignore.

## Tests (`tests/`, détails dans `tests/README.md`)
- Installation : `cd tests && npm install` (mqtt-packet). Playwright/Chromium sont déjà là dans l'environnement cloud.
- Tout lancer : `cd tests && node run-all.cjs` (ou `node run-all.cjs online|local|unit|relay`).
- `tests/lib/pw-helper.cjs` : ouvre l'appli dans un iPhone simulé, en servant le dépôt sur `http://app.test/` (pas de serveur web).
- `tests/lib/mp.cjs` : simulateur multijoueur, n joueurs côte à côte branchés sur la logique de l'hôte. C'est l'outil pour tester un jeu en ligne.
  `mp.cjs` et `tv-sim.cjs` appellent aussi `frame()` à chaque image (jeux en temps réel).
- `tests/online/foule.test.cjs` : Dans la foule (logique de la place, partie complète sur la télé simulée, manette des téléphones :
  joystick à la souris, clavier, bouton « Pousser »). `relay/tvmode.test.cjs` lance aussi Dans la foule par le réseau (joystick → télé).
- `tests/lib/tv-sim.cjs` : **écran télé simulé** (1280 × 720) branché sur la logique de l'hôte (`load(module, export, réglages, n)`,
  `act(joueur, action)`, `txt()`, `fits()` = rien ne dépasse de l'écran). `online/tele-jeux.test.cjs` joue chaque écran télé
  (sauf les 11 premiers) et vérifie l'affichage ; `SHOTS=1` enregistre une capture par étape dans `tests/out/`. Pour un nouvel
  écran télé : l'ajouter à ce test, et ajouter une étape dans `online/tele-secrets.test.cjs` s'il y a un secret (les secrets en
  nombres, comme la cible du Curseur, ne sont pas vus par la comparaison de textes : les vérifier à la main).
- `tests/lib/mock-relay.cjs` : faux serveur relais MQTT + PeerJS bloqué (`broker.stats.payloads` = ce qu'un curieux verrait).
  `relay/lobby-relay.test.cjs` fait une vraie partie par le salon ; `relay/reprise.test.cjs` coupe l'hôte en plein Quiz et reprend
  (en **https://app.test/**, nécessaire pour `crypto.subtle` : `serveRepo` sert les deux). `phone(options)` crée aussi un écran
  télé (`{ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false }`) : `relay/tele.test.cjs` (télé branchée sur
  un salon Online) et `relay/tvmode.test.cjs` (la télé crée le salon, chef, votes, rechargement de la télé, relève du chef).
- `tests/relay/relay-real.manual.cjs` : manuel, avec les vrais serveurs relais (Internet, utilise `HTTPS_PROXY` si présent).
- `tests/local/sw.test.cjs` : service worker et mode hors ligne, avec un vrai serveur web sur localhost.
- `tests/unit/images.test.mjs` : une image (et une composition) par jeu.
- `tests/lib/sort.cjs` : glisser-déposer à la souris dans une liste `sortList` (`sortByDrag(page, zone, ordreVoulu)`).
- `tests/` est exclu du service worker (`SKIP` dans `scripts/gen-sw.mjs`).

## Préférences de l'utilisateur
- Répondre **en français**, simplement, sans jargon.
- Appli **claire et lumineuse** : l'utilisateur trouvait l'appli trop sombre. Ombres légères (`--shadow`, cases), voile du bas des cases discret,
  pas de fonds plus foncés.
- Jeux de mots : **tous les mots français acceptés** (prénoms, argot, verlan, mots récents des jeunes, anglicismes courants).
- **Tester avant de publier**, et dire honnêtement ce qui a été testé ou non.
- Ne jamais mettre d'informations personnelles dans le dépôt.

## Mise à jour de ce fichier
Quand tu changes l'architecture, ajoutes un dossier, une règle de publication, un outil de test ou un piège important,
**mets à jour ce CLAUDE.md dans le même commit**.
