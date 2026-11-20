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
| `online/soiree.test.cjs` | Qui a écrit ça ?, Le Curseur, Dans sa tête, Dans l'ordre !, Qui suis-je ?, Chifoumi, à 3 joueurs simulés. |
| `online/plateau.test.cjs` | Bataille navale (le gagnant reste), Memory, Yam's en ligne. |
| `online/tour.test.cjs` | Paranoïa, Pour ou contre, Deux vérités un mensonge. |
| `online/mots.test.cjs` | Petit bac, Mot mystère, Morpion. |
| `local/jeux-locaux.test.cjs` | Jeux sur un seul téléphone (iPhone simulé), bandeau « en ligne », filtre « Nouveaux ». |
| `local/sequence.test.cjs` | La Séquence : un seul « Je suis prêt », puis compte à rebours. |
| `relay/lobby-relay.test.cjs` | 3 téléphones, PeerJS bloqué, **faux relais MQTT** : vrai salon, lancement de 2 jeux. `DOWN=shiftr` simule la panne du 1er serveur. |
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

Pour tester un nouveau jeu en ligne, copier un bloc de `online/soiree.test.cjs` et l'adapter.
