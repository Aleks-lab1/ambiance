# 🎉 Ambiance — jeux de soirée (PWA)

Une application web installable (PWA) avec **21 jeux de soirée** en français, dont 5 jouables **en ligne, chacun sur son téléphone**.
Aucun framework, aucune étape de build : ce sont des fichiers statiques à héberger n'importe où.

## Les jeux

| | Jeu | Mode | Niveaux |
|---|---|---|---|
| 🎨 | **Je dessine, tu devines** | 🌐 En ligne (chat de réponses, points, indices) + un seul écran | Facile / Moyen / Difficile |
| 🕵️ | **L'Imposteur** | 🌐 En ligne + téléphone qu'on se passe | Mode « Sans mot » |
| 🤔 | **Tu préfères** | Cartes + 🌐 vote en ligne | Tranquille, Délire, Épicé, Hot, Hot++ |
| 🙊 | **Je n'ai jamais** | Cartes | Tranquille, Soirée, Épicé, Hot, Hot++ |
| 💯 | **C'est un 10 mais…** | Cartes + 🌐 notes en ligne (moyenne) | Classique, Absurde, Hot, Hot++ |
| 👉 | **Qui de nous…** | Cartes (3-2-1 pointez !) + 🌐 vote secret en ligne | Tranquille, Épicé, Hot, Hot++ |
| 🎯 | **Action ou vérité** | Tour par tour avec les prénoms | Tranquille, Fun, Hot, Hot++ |
| 🤫 | **Paranoïa** | Question secrète + pile ou face | Tranquille, Épicé, Hot, Hot++ |
| 🎤 | **Pour ou contre** | Débats absurdes chronométrés + vote | |
| 🚫 | **Mots interdits** | Équipes, chrono, correction | |
| 🤸 | **Mime express** | Équipes, chrono | |
| 🎩 | **Le Chapeau** | 3 manches : décrire, un mot, mimer | Noms perso possibles |
| 🤳 | **Sur le front** | Inclinaison du téléphone (gyroscope) | 12 catégories |
| 💣 | **Patate chaude** | Bombe à retardement aléatoire | Catégories, syllabes, lettres |
| ⏱️ | **3 en 5 secondes** | Défi chronométré + scores | |
| 🔤 | **Petit bac** | Lettre + catégories + chrono | |
| 👑 | **Le Roi** | Jeu de cartes, une règle par carte | |
| 🐺 | **Loup-garou** | Distribution des rôles + script du meneur | Voyante, Docteur, Chasseur |
| 🎡 | **La roue des gages** | Roue animée (joker, double, tous…) | Tranquille, Ridicule, Hot, Hot++ |
| ☝️ | **Qui commence ?** | Multi-touch : chacun pose un doigt | 1 gagnant, 2 équipes, ordre |
| 🧰 | **Boîte à outils** | Dés, pile ou face, équipes, chrono, compteur de points | |

**En plus :**
- 👥 Liste de joueurs partagée par tous les jeux (prénoms utilisés dans les cartes, tours, équipes).
- 🍻 / 🧃 **Mode avec ou sans alcool** : les pénalités sont des gorgées ou des points de gage.
- 🔞 Contenu 18+ verrouillé derrière une confirmation d'âge, et niveau 😈 **Hot++** (très explicite) derrière une seconde confirmation.
- ✍️ **Cartes personnalisées** pour Tu préfères, Je n'ai jamais, C'est un 10 mais…, Qui de nous et Le Chapeau.
- 🔁 Les cartes déjà vues ne reviennent pas d'une soirée à l'autre (réinitialisable dans les réglages).
- 📴 Fonctionne **hors ligne** une fois chargé (sauf le mode en ligne, évidemment).
- 🔊 Sons synthétisés, 📳 vibrations, écran maintenu allumé pendant les parties.

## Lancer en local

```bash
cd ambiance
python3 -m http.server 8080
```

Puis ouvrir <http://localhost:8080>. (Un serveur est nécessaire : les modules JavaScript ne se chargent pas en `file://`.)

Pour tester sur ton téléphone sur le même Wi-Fi, il faut du **HTTPS** pour le service worker, le gyroscope et l'installation : le plus simple est de déployer (voir ci-dessous).

## Déployer (gratuit)

Le dossier est un site statique : il suffit de l'héberger tel quel.

- **Netlify Drop** : glisser-déposer le dossier `ambiance` sur <https://app.netlify.com/drop>.
- **GitHub Pages** : pousser le dossier dans un dépôt, puis *Settings → Pages → Deploy from branch*.
- **Vercel / Cloudflare Pages** : importer le dépôt, sans commande de build, dossier de sortie = racine.

Ensuite, sur le téléphone : ouvrir l'URL puis « Ajouter à l'écran d'accueil » (Android le propose directement dans l'appli).

## ⚠️ Après chaque modification

Régénérer le service worker pour que les téléphones récupèrent la nouvelle version :

```bash
node scripts/gen-sw.mjs
```

Le script liste tous les fichiers et calcule un numéro de version. Les utilisateurs voient alors « Nouvelle version disponible → Mettre à jour ».

## Comment marche le mode en ligne

- Connexion **pair-à-pair** (WebRTC) via [PeerJS](https://peerjs.com). Le serveur public gratuit `0.peerjs.com` sert seulement à mettre les téléphones en relation, puis les données passent directement entre eux.
- L'**hôte** (celui qui crée la partie) fait tourner le jeu : il garde l'état complet et envoie à chaque joueur uniquement ce qu'il a le droit de voir (le mot à dessiner n'est envoyé qu'au dessinateur, chaque joueur ne reçoit que son mot à L'Imposteur…).
- Code à 4 lettres + QR code + lien de partage. Reconnexion automatique si un joueur perd le réseau ou recharge la page (le dessin en cours est restauré).
- L'hôte doit garder l'appli ouverte. Idéalement, tout le monde est sur le même Wi-Fi.

### Fiabilité en 4G/5G

Sans serveur TURN, certaines connexions entre réseaux mobiles peuvent échouer (NAT stricts). Pour une fiabilité maximale, ajoute un serveur TURN dans `js/config.js` (par ex. un compte gratuit Metered, Twilio ou ton propre `coturn`).

Tu peux aussi héberger ton propre serveur de mise en relation PeerJS :

```bash
npx peer --port 9000
```

puis renseigner `peerHost` / `peerPort` dans `js/config.js` (ou tester avec `?peerhost=localhost&peerport=9000&peersecure=0` dans l'URL).

## Ajouter du contenu

Tout le contenu est dans `js/data/` (un fichier par jeu, simples listes JavaScript) :

- `tupreferes.js`, `jamais.js`, `dix.js`, `qui.js`, `paranoia.js`, `action.js`, `gages.js` : cartes par niveau
- `dessin.js` : mots à dessiner (facile / moyen / difficile)
- `motsinterdits.js`, `mime.js`, `chapeau.js`, `front.js`, `imposteur.js`, `patate.js`, `petitbac.js`, `cinq.js`, `debats.js`

Les niveaux d'intensité sont définis dans `js/data/levels.js`.

## Structure

```
index.html, manifest.webmanifest, sw.js (généré)
css/style.css
js/app.js            accueil, navigation, réglages, installation
js/games/index.js    catalogue des jeux
js/games/*.js        un module par jeu (chargé à la demande)
js/online/room.js    salon en ligne, hôte, clients, reconnexion
js/online/*.js       jeux en ligne (dessin, imposteur, votes)
js/canvas.js         planche à dessin synchronisable
js/turn.js           moteur des jeux en équipes
js/data/*.js         tout le contenu
vendor/              PeerJS 1.5.4 et qrcode-generator 1.4.4 (licences MIT)
```

## Ajouter un jeu

1. Créer `js/games/monjeu.js` qui exporte `start(ctx)` (dessine dans `ctx.root`, renvoie éventuellement une fonction de nettoyage).
2. L'ajouter dans `js/games/index.js` (nom, emoji, couleurs, catégories, règles).
3. `node scripts/gen-sw.mjs`.

Pour un jeu en ligne : créer un module dans `js/online/` (sur le modèle de `vote.js`) avec `init`, `action`, `tick`, `view` (côté hôte) et `mount` (côté écran), puis l'ajouter à `js/online/games.js`.

---

À consommer avec modération 🍹 — et le mode sans alcool marche très bien aussi.
