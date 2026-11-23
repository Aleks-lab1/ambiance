# Tests d'Ambiance

Outils pour vérifier l'appli avant de la publier. Ils ne font pas partie de l'appli : `scripts/gen-sw.mjs`
ignore le dossier `tests/` (il n'est jamais mis en cache par le service worker).

## Installation

- **Node.js 18 ou plus.**
- **Playwright + Chromium.** Dans l'environnement cloud de Claude Code, ils sont déjà installés
  (`require('playwright')` marche partout) : ne pas réinstaller Playwright. Ailleurs :
  `npm install -g playwright && npx playwright install chromium`.
- **mqtt-packet** (pour le faux serveur relais) :

```bash
cd tests && npm install
```

Pas de serveur web à lancer : les tests interceptent les requêtes vers `http://app.test/` et servent
directement les fichiers du dépôt.

## Lancer les tests

```bash
cd tests && node run-all.cjs
```

```bash
cd tests && node run-all.cjs online
```

Un seul fichier : `node online/soiree.test.cjs`. Avec `SHOTS=1`, certains tests enregistrent des
captures d'écran dans `tests/out/` (ignoré par git). Chaque fichier affiche ✓ / ✗ par vérification
et sort avec le code 1 en cas d'échec.

## Contenu

| Fichier | Ce qu'il vérifie |
|---|---|
| `unit/dico.test.mjs` | Dictionnaire du Bon Mot (sans navigateur) : mots courants, accents, prénoms, argot/verlan, tirage de lettres, enchaînement. |
| `unit/plateau-core.test.mjs` | Bataille navale (flottes, tirs, IA), Memory, scores du Yam's. |
| `unit/contenu.test.mjs` | Contenu de tous les autres jeux (cartes, mots, défis… plus de 7 700 éléments) : format, rien de vide, pas de doublon. |
| `unit/race-core.test.mjs` | Jeux de rapidité : contenu (600+ questions de Quiz, 200+ estimations, Vrai ou faux, Émojis, Anagrammes : formats, pas de doublon), pas de question répétée d'une partie à l'autre, mode sans limite. |
| `online/soiree.test.cjs` | Qui a écrit ça ?, Le Curseur, Dans sa tête, Dans l'ordre !, Qui suis-je ?, Chifoumi, à 3 joueurs simulés. Classements faits par de **vrais glisser-déposer**, envoi automatique à la fin du temps, cartes qui glissent à leur place à la correction. |
| `online/plateau.test.cjs` | Bataille navale (le gagnant reste), Memory (cartes 3D : la paire reste retournée, les cartes ratées se recachent), Yam's en ligne. |
| `online/tour.test.cjs` | Paranoïa, Pour ou contre, Deux vérités un mensonge. |
| `online/mots.test.cjs` | Petit bac, Mot mystère, Morpion (traits au feutre, ligne gagnante), 4 en ligne (main, jeton tombé en bas de la colonne chez les autres, jetons qui tombent du plateau à la manche suivante). |
| `online/memoire.test.cjs` | En ligne : 30 parties de suite sans retrouver la même première carte (Je n'ai jamais, Tu préfères, Et si, 3 en 5 s, Débats, Paranoïa, Unisson, Punchlines, Curseur), Chapeau et Qui suis-je sans doublon, mémoire partagée avec la version locale. |
| `online/race.test.cjs` | Quiz en mode ∞ (13 questions sans répétition, « Terminer » réservé à l'hôte), À vue de nez en 5 questions. |
| `online/cartes.test.cjs` | Et si, Confidences, Cap ou pas cap, Action ou vérité, Le Roi, Plus ou moins, Le Bus. |
| `online/hasard.test.cjs` | La Bouteille, La roue des gages, Qui commence ?, Boîte à outils. |
| `online/oral.test.cjs` | Sur le front, Ni oui ni non, Histoire folle, Le Pendu, La Séquence, Le Chapeau (4 joueurs). |
| `local/jeux-locaux.test.cjs` | Jeux sur un seul téléphone (iPhone simulé) : Quiz (réponse en touchant, mode ∞), Dans l'ordre (glisser), 4 en ligne contre le téléphone, Morpion, Chifoumi (« Chi… Fou… Mi ! »), dés qui roulent, carte qui se retourne, bandeau « en ligne » sur **les 61 jeux**, plus de badge ni de filtre « En ligne », filtre « Nouveaux », accueil (image de chaque jeu affichée, cases rectangulaires sans description, nom en bas à gauche, favoris illustrés). |
| `local/sequence.test.cjs` | La Séquence : un seul « Je suis prêt », puis compte à rebours. |
| `local/sw.test.cjs` | Service worker, avec un **vrai petit serveur web sur localhost** (le service worker exige https ou localhost) : tout est en cache à l'installation, les images des jeux dans un cache à part **non retéléchargé** lors d'une mise à jour, accueil complet **hors ligne**. |
| `unit/images.test.mjs` | Images des jeux : une composition (`scripts/images/scenes.mjs`) et une image `img/jeux/<id>.webp` (WebP transparent 540 × 360) par jeu, emojis sources présents, poids total raisonnable. |
| `relay/lobby-relay.test.cjs` | 3 téléphones, PeerJS bloqué, **faux relais MQTT** : vrai salon, lancement de 2 jeux (le 2e par double appui sur le jeu). `DOWN=shiftr` simule la panne du 1er serveur. |
| `relay/relay-real.manual.cjs` | **Manuel**, avec Internet : les vrais serveurs relais publics. Pas lancé par `run-all`. |

## Outils réutilisables (`lib/`)

- `pw-helper.cjs` : `open(hash)` ouvre l'appli dans un iPhone simulé → `{ browser, page, errors }` ;
  `serveRepo(context)`, `collectErrors(page)`, `shot(page, nom)`.
- `mp.cjs` : **simulateur multijoueur**. `mp('/js/online/soiree.js', 'curseurOnline', réglages, n)` affiche
  n joueurs (A = hôte, B, C…) côte à côte, branchés directement sur `init / action / tick / view / mount`
  du module, sans réseau. `t.at('B')` = zone du joueur B, `t.txt('A')` = son texte,
  `t.get(() => window.__h.s)` = état de l'hôte, `t.state().log` = erreurs levées par le module.
- `mock-relay.cjs` : faux serveur MQTT 3.1.1 (via `routeWebSocket`) qui intercepte toutes les adresses de
  `CONFIG.relayBrokers` + blocage de PeerJS. `relayWorld()` → `{ browser, phone(), broker, errors }`.
- `check.cjs` : `check(condition, message, détail)`, `wait(ms)`, `run(async () => …)`.
- `sort.cjs` : listes à classer en glissant (`js/sortable.js`) : `sortByDrag(page, zone, ordreVoulu)`, `dragTo(page, zone, de, vers)`,
  `shownOrder(zone)`, avec de vrais glisser-déposer à la souris.

Pour tester un nouveau jeu en ligne, copier un bloc de `online/soiree.test.cjs` et l'adapter.
