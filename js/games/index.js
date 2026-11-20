// Catalogue des jeux. Chaque module est chargé à la demande.

export const FILTERS = [
  { id: 'all', label: '✨ Tous' },
  { id: 'fav', label: '⭐ Favoris' },
  { id: 'new', label: '🆕 Nouveaux' },
  { id: 'cartes', label: '🃏 Questions' },
  { id: 'equipes', label: '👥 Équipes' },
  { id: 'rapide', label: '⚡ Rapides' },
  { id: 'bluff', label: '🕵️ Bluff' },
  { id: 'hot', label: '🌶️ Épicé' },
  { id: 'outils', label: '🧰 Outils' },
];

export const GAMES = [
  {
    id: 'dessin', name: 'Je dessine, tu devines', emoji: '🎨', colors: ['#ff6b6b', '#f7a531'],
    desc: 'Un joueur dessine, les autres devinent. En ligne ou sur un seul écran.',
    tags: ['equipes'], players: '2-16',
    rules: [
      '<b>En ligne :</b> chacun rejoint la partie sur son téléphone. À tour de rôle, un joueur choisit un mot parmi 3 et le dessine. Les autres tapent leurs propositions : plus tu trouves vite, plus tu gagnes de points. Le dessinateur gagne des points pour chaque joueur qui trouve.',
      'Des lettres se dévoilent au fil du temps pour aider. Le joueur avec le plus de points à la fin des manches gagne.',
      '<b>Sur un seul écran :</b> le dessinateur découvre le mot en secret puis dessine sur le téléphone pendant que les autres crient leurs réponses. Touche le nom de celui qui a trouvé pour lui donner un point.',
    ],
    load: () => import('./dessin.js'),
  },
  {
    id: 'imposteur', name: "L'Imposteur", emoji: '🕵️', colors: ['#3a3f8f', '#9b3fd6'],
    desc: 'Tout le monde a le même mot… sauf un. Démasquez-le !',
    tags: ['bluff'], players: '3-16',
    rules: [
      'Chaque joueur reçoit un mot secret. Tous ont le même… sauf l\'imposteur, qui a un mot proche (ou aucun mot en mode « Sans mot »). <b>L\'imposteur ne sait pas qu\'il est l\'imposteur !</b>',
      'Chacun à son tour dit <b>un seul mot</b> en rapport avec son mot secret, sans être trop évident pour ne pas aider l\'imposteur. On peut faire plusieurs tours.',
      'Ensuite, tout le monde vote pour éliminer celui qu\'il soupçonne. Si l\'imposteur est démasqué, les autres gagnent. Sinon, c\'est lui qui gagne !',
    ],
    load: () => import('./imposteur.js'),
  },
  {
    id: 'quiaecrit', name: 'Qui a écrit ça ?', emoji: '🕵️‍♀️', colors: ['#8e2de2', '#4a00e0'], new: true,
    desc: 'Chacun répond en secret à une question perso… puis devinez qui a écrit quoi !',
    tags: ['bluff', 'hot'], players: '3-16', badges: ['Nouveau'],
    rules: [
      'Une question perso s\'affiche (« Ton plus gros mensonge à tes parents »). Chacun écrit sa réponse en secret sur son téléphone.',
      'Les réponses sont ensuite révélées une par une, anonymement : votez pour celui ou celle qui l\'a écrite ! +1 si tu trouves, et l\'auteur gagne +1 par joueur piégé.',
    ],
    load: () => import('./enligne.js').then((m) => m.launcher('quiaecrit')),
  },
  {
    id: 'curseur', name: 'Le Curseur', emoji: '🎚️', colors: ['#ff6a00', '#ee0979'], new: true,
    desc: 'Froid ↔ Chaud : un indice, et tout le monde place le curseur au bon endroit.',
    tags: ['equipes'], players: '2-16', badges: ['Nouveau'],
    rules: [
      'Une échelle entre deux opposés s\'affiche (Froid ↔ Chaud, Nul ↔ Génial…). Un joueur voit en secret une cible sur l\'échelle et donne un indice (« soupe », « Brad Pitt »…).',
      'Les autres placent le curseur là où ils pensent que se trouve la cible. Plus on est proche, plus on marque (jusqu\'à 4 points). En ligne, chacun place son propre curseur.',
    ],
    load: () => import('./soiree.js').then((m) => m.curseur),
  },
  {
    id: 'danssatete', name: 'Dans sa tête', emoji: '🧠', colors: ['#c94b4b', '#4b134f'], new: true,
    desc: 'Les meilleures pizzas, les pires corvées… Devine le classement d\'un ami.',
    tags: [], players: '3-16', badges: ['Nouveau'],
    rules: [
      'Un thème et 5 éléments s\'affichent (« Les pires corvées »). Le joueur désigné les classe selon SES goûts, en secret.',
      'Les autres essaient de deviner son classement : +1 par élément à la bonne place. Le joueur désigné gagne 1 point par ami qui en a trouvé au moins 3.',
    ],
    load: () => import('./enligne.js').then((m) => m.launcher('danssatete')),
  },
  {
    id: 'ordre', name: 'Dans l\'ordre !', emoji: '📅', colors: ['#2193b0', '#6dd5ed'], new: true,
    desc: 'Pyramides, iPhone, Titanic… Remets 4 événements dans l\'ordre chronologique.',
    tags: ['rapide'], players: '1-16', badges: ['Nouveau'],
    rules: [
      'Quatre événements s\'affichent (« Naufrage du Titanic », « Sortie du premier iPhone »…). Classe-les du plus ancien au plus récent.',
      'En ligne : +1 par événement bien placé, +2 si tout est juste, et +1 pour le plus rapide sans faute. Sur un seul téléphone, le groupe classe ensemble puis on vérifie les dates.',
    ],
    load: () => import('./soiree.js').then((m) => m.ordre),
  },
  {
    id: 'quisuisje', name: 'Qui suis-je ?', emoji: '🎭', colors: ['#f7971e', '#ffd200'], new: true,
    desc: 'Tout le monde voit ton personnage sur son téléphone… sauf toi !',
    tags: ['rapide'], players: '3-16', badges: ['Nouveau'],
    rules: [
      'Chaque joueur reçoit une identité secrète (célébrité, personnage, animal…) que tous les autres voient sur leur téléphone, mais pas lui !',
      'À tour de rôle, pose une question fermée à voix haute (« Suis-je une femme ? »), les autres répondent oui ou non. Quand tu crois savoir, tape ta réponse : les premiers à trouver marquent le plus.',
    ],
    load: () => import('./enligne.js').then((m) => m.launcher('quisuisje')),
  },
  {
    id: 'chifoumi', name: 'Chifoumi', emoji: '✂️', colors: ['#56ab2f', '#a8e063'], new: true,
    desc: 'Pierre, feuille, ciseaux… chacun contre tous, en même temps !',
    tags: ['rapide'], players: '1-16', badges: ['Nouveau'],
    rules: [
      'En ligne : à chaque manche, tout le monde choisit en secret pierre, feuille ou ciseaux. Tu marques 1 point par joueur que tu bats. Pas de choix à temps ? Le hasard choisit pour toi !',
      'Seul : affronte le téléphone, premier à 3 points.',
    ],
    load: () => import('./soiree.js').then((m) => m.chifoumi),
  },
  {
    id: 'bataille', name: 'Bataille navale', emoji: '🚢', colors: ['#0d4d8c', '#2ec5ff'], new: true,
    desc: 'Coule la flotte adverse ! En ligne, le gagnant reste et affronte le suivant.',
    tags: [], players: '1-16', badges: ['Nouveau'],
    rules: [
      'Chacun a 5 bateaux sur une grille de 8 × 8 (placés au hasard, tu peux les remélanger). À ton tour, tire sur une case de l\'adversaire : à l\'eau, touché ou coulé ! Touché = tu rejoues.',
      'Le premier qui coule toute la flotte adverse gagne. En ligne, les autres attendent leur tour et regardent la bataille. Seul, affronte le téléphone.',
    ],
    load: () => import('./plateau.js').then((m) => m.bataille),
  },
  {
    id: 'memory', name: 'Memory', emoji: '🧩', colors: ['#fc466b', '#3f5efb'], new: true,
    desc: 'Retourne les cartes deux par deux et trouve les paires.',
    tags: [], players: '1-16', badges: ['Nouveau'],
    rules: ['Les cartes sont face cachée. À ton tour, retournes-en deux : si c\'est une paire, tu marques un point et tu rejoues. Sinon, elles se retournent et c\'est au suivant. Le plus de paires gagne !'],
    load: () => import('./plateau.js').then((m) => m.memory),
  },
  {
    id: 'yams', name: 'Yam\'s', emoji: '🎲', colors: ['#7a1f3d', '#c79a2a'], new: true,
    desc: '5 dés, 3 lancers, 13 combinaisons : brelan, full, suites, Yam\'s !',
    tags: [], players: '1-16', badges: ['Nouveau'],
    rules: [
      'À ton tour, lance les 5 dés jusqu\'à 3 fois en gardant ceux que tu veux, puis inscris ton score dans une case encore libre (même 0 si rien ne va).',
      'Haut de la feuille : total des 1, des 2… des 6 (bonus de 35 si tu atteins 63). Bas : brelan, carré, full (25), petite suite (30), grande suite (40), Yam\'s (50) et chance. Le plus gros total gagne.',
    ],
    load: () => import('./plateau.js').then((m) => m.yams),
  },
  {
    id: 'quiz', name: 'Le Quiz', emoji: '🧠', colors: ['#5f2c82', '#49a09d'],
    desc: '170 questions dans 9 thèmes. Le plus rapide marque le plus de points.',
    tags: ['rapide'], players: '2-16', rules: [
      '<b>En ligne :</b> la question s\'affiche sur tous les téléphones avec 4 réponses. Plus tu réponds vite (et juste), plus tu gagnes de points. Choisis les thèmes : culture G, géo, histoire, sciences, cinéma, musique, sport, gastronomie, insolite.',
      '<b>Sur un seul téléphone :</b> chacun son tour, le joueur désigné touche directement sa réponse. La bonne réponse s\'affiche en vert (en rouge si c\'est raté) et le point est compté automatiquement.',
    ],
    load: () => import('./race.js').then((m) => m.quiz),
  },
  {
    id: 'punchlines', name: 'Punchlines', emoji: '✍️', colors: ['#ff0844', '#ffb199'],
    desc: 'Complète la phrase de la façon la plus drôle. Votes anonymes !',
    tags: ['hot'], players: '3-16', rules: [
      'Une phrase à trous s\'affiche, par exemple « Le pire cadeau pour un premier rendez-vous : ___ ». Chacun écrit sa réponse la plus drôle sur son téléphone.',
      'Les réponses sont affichées anonymement et tout le monde vote pour sa préférée (pas la sienne !). Chaque vote reçu rapporte 100 points.',
      'Trois niveaux : Fun, Trash (18+) et Hot++.',
    ],
    load: () => import('./enligne.js').then((m) => m.launcher('write-punch')),
  },
  {
    id: 'telephone', name: 'Téléphone dessiné', emoji: '📞', colors: ['#00b09b', '#96c93d'],
    desc: 'Écris, dessine, devine… et regarde le message se déformer.',
    tags: [], players: '3-12', rules: [
      'Chacun écrit une phrase. Elle passe au joueur suivant qui doit la <b>dessiner</b>. Le suivant voit seulement le dessin et écrit ce qu\'il croit voir. Le suivant le redessine… et ainsi de suite.',
      'À la fin, on révèle chaque chaîne étape par étape : fous rires garantis quand « un chat qui fait du ski » devient « une banane au volant ».',
    ],
    load: () => import('./enligne.js').then((m) => m.launcher('telephone')),
  },
  {
    id: 'dico', name: 'Dico bluff', emoji: '📖', colors: ['#3d2c8d', '#c3aed6'],
    desc: 'Invente une fausse définition pour un mot rare et piège les autres.',
    tags: ['bluff'], players: '3-16', rules: [
      'Un mot rare s\'affiche (« callipyge », « billevesée »…). Chacun invente une définition crédible sur son téléphone.',
      'Toutes les définitions, plus la vraie, sont mélangées. Vote pour celle que tu crois vraie : +200 points si tu trouves, et +100 points pour chaque joueur piégé par ta fausse définition.',
    ],
    load: () => import('./enligne.js').then((m) => m.launcher('write-dico')),
  },
  {
    id: 'menteur', name: 'Menteur !', emoji: '🎲', colors: ['#870000', '#190a05'],
    desc: 'Dés secrets sur ton téléphone, enchères et bluff. Ose dire « Menteur ! »',
    tags: ['bluff'], players: '2-10', rules: [
      'Chacun voit ses dés en secret sur son téléphone. À tour de rôle, on annonce combien de dés d\'une valeur il y a <b>en tout sur la table</b> (ex. « cinq 4 »). Chaque annonce doit être plus haute que la précédente.',
      'Si tu penses que le joueur précédent exagère, dis « Menteur ! ». On révèle tous les dés : si l\'annonce est fausse, il perd un dé, sinon c\'est toi. Les 1 sont des jokers (désactivable). Le dernier à avoir des dés gagne.',
    ],
    load: () => import('./enligne.js').then((m) => m.launcher('menteur')),
  },
  {
    id: 'emojis', name: 'Émojis mystères', emoji: '🧩', colors: ['#f7971e', '#ffd200'],
    desc: 'Films, séries et expressions cachés derrière des émojis.',
    tags: ['rapide'], players: '2-16', rules: [
      '<b>En ligne :</b> une suite d\'émojis s\'affiche (🦁👑…). Tape ta réponse : le premier qui trouve gagne un bonus. Les fautes de frappe et les accents sont tolérés.',
      '<b>Sur un seul téléphone :</b> montre les émojis, le premier qui crie la bonne réponse gagne le point.',
    ],
    load: () => import('./race.js').then((m) => m.emojis),
  },
  {
    id: 'anagrammes', name: 'Anagrammes', emoji: '🔀', colors: ['#1d976c', '#3fd47f'],
    desc: 'Les lettres sont mélangées : retrouve le mot le plus vite possible.',
    tags: ['rapide'], players: '2-16', rules: [
      '<b>En ligne :</b> les lettres d\'un mot sont mélangées. Tape le mot dès que tu l\'as trouvé : plus tu es rapide, plus tu marques. Un indice (la première lettre) apparaît à mi-temps.',
      '<b>Sur un seul téléphone :</b> le premier qui trouve le mot à voix haute gagne le point.',
    ],
    load: () => import('./race.js').then((m) => m.anagrammes),
  },
  {
    id: 'estimations', name: 'À vue de nez', emoji: '📏', colors: ['#e65c00', '#f9d423'],
    desc: 'Hauteur de la tour Eiffel, os du corps… Le plus proche gagne.',
    tags: ['rapide'], players: '2-16', rules: [
      '<b>En ligne :</b> chacun propose un nombre. Le plus proche de la vraie réponse gagne 300 points (+200 s\'il tombe pile), le deuxième 150, le troisième 75.',
      '<b>Sur un seul téléphone :</b> chacun annonce son estimation à voix haute, puis on révèle. Le plus proche gagne le point.',
    ],
    load: () => import('./race.js').then((m) => m.estimations),
  },
  {
    id: 'bingo', name: 'Bingo de soirée', emoji: '🎱', colors: ['#fc466b', '#3f5efb'],
    desc: 'Coche les situations de la soirée : « quelqu\'un parle de son ex »…',
    tags: [], players: '1-16', rules: [
      'Chacun reçoit une grille de 25 situations qui risquent d\'arriver pendant la soirée (« quelqu\'un renverse son verre », « on parle de son ex »…). Coche-les quand elles arrivent pour de vrai !',
      'Une ligne, une colonne ou une diagonale complète = BINGO ! <b>En ligne</b>, tout le monde est prévenu et voit les cases cochées pour vérifier.',
    ],
    load: () => import('./bingo.js'),
  },
  {
    id: 'vraifaux', name: 'Vrai ou faux', emoji: '✅', colors: ['#11998e', '#e94057'],
    desc: 'Info ou intox ? 100 affirmations étonnantes, le plus rapide gagne.',
    tags: ['rapide'], players: '2-16',
    rules: [
      '<b>En ligne :</b> une affirmation s\'affiche (« Les pieuvres ont trois cœurs »). Vrai ou faux ? Plus tu réponds vite et juste, plus tu gagnes de points. L\'explication s\'affiche ensuite.',
      '<b>Sur un seul téléphone :</b> chacun son tour, le joueur désigné touche « Vrai » ou « Faux ». La bonne réponse s\'affiche en vert (en rouge si c\'est raté) avec son explication, et le point est compté automatiquement.',
    ],
    load: () => import('./race.js').then((m) => m.vraifaux),
  },
  {
    id: 'calcul', name: 'Calcul express', emoji: '🧮', colors: ['#4568dc', '#00c9a7'],
    desc: 'Calcul mental chronométré : 3 niveaux, du « 7 + 5 » au « 17² ».',
    tags: ['rapide'], players: '2-16',
    rules: [
      '<b>En ligne :</b> un calcul s\'affiche sur tous les téléphones. Tape le résultat le plus vite possible : le plus rapide marque le plus de points, avec un bonus pour le premier.',
      '<b>Sur un seul téléphone :</b> le premier qui crie le bon résultat gagne le point. Trois niveaux : facile, moyen, difficile.',
    ],
    load: () => import('./race.js').then((m) => m.calcul),
  },
  {
    id: 'unisson', name: 'À l\'unisson', emoji: '🤝', colors: ['#00b09b', '#96c93d'],
    desc: '« Un fruit jaune » : tout le monde doit répondre la même chose !',
    tags: ['cartes'], players: '3-16',
    rules: [
      'Un thème s\'affiche (« Un fruit jaune », « Un prénom de chien »…). À 3, tout le monde dit sa réponse en même temps : le but est de penser comme la majorité ! Ceux qui ont dit la même chose que la majorité marquent un point, les moutons noirs prennent une pénalité.',
      '<b>En ligne :</b> chacun écrit sa réponse en secret sur son téléphone, puis tout est révélé : tu marques un point par joueur qui a écrit la même chose que toi (pluriels et petites fautes tolérés).',
    ],
    load: () => import('./cartes.js').then((m) => m.unisson),
  },
  {
    id: 'tupreferes', name: 'Tu préfères', emoji: '🤔', colors: ['#7c5cff', '#2ec5ff'],
    desc: 'Des dilemmes impossibles, du plus sage au plus hot.',
    tags: ['cartes', 'hot'], players: '2+', badges: ['5 niveaux'],
    rules: [
      'Lis le dilemme à voix haute. Chacun choisit son camp et doit se justifier !',
      'Variante : la minorité ' + 'boit (ou prend un gage).',
      '<b>En ligne :</b> chacun vote sur son téléphone et les résultats s\'affichent avec les noms.',
    ],
    load: () => import('./cartes.js').then((m) => m.tupreferes),
  },
  {
    id: 'jamais', name: "Je n'ai jamais", emoji: '🙊', colors: ['#ff4d8d', '#ff9a5a'],
    desc: 'Ceux qui l\'ont déjà fait se dénoncent. 5 niveaux, jusqu\'au Hot++.',
    tags: ['cartes', 'hot'], players: '3+', badges: ['5 niveaux'],
    rules: [
      'Une phrase « Je n\'ai jamais… » s\'affiche. Tous ceux qui l\'ont <b>déjà fait</b> boivent une gorgée (ou marquent un point en mode sans alcool).',
      'Le plus drôle : raconter l\'histoire derrière ! Personne n\'est obligé de répondre aux questions qui le mettent mal à l\'aise.',
    ],
    load: () => import('./cartes.js').then((m) => m.jamais),
  },
  {
    id: 'dix', name: "C'est un 10 mais…", emoji: '💯', colors: ['#ff3d6e', '#ffc93c'],
    desc: 'La personne parfaite… avec un énorme défaut. Tu lui mets combien ?',
    tags: ['cartes', 'hot'], players: '2+',
    rules: [
      'Imagine la personne parfaite, un 10/10. Mais elle a un défaut… Chacun annonce la nouvelle note qu\'il lui donne, et défend son choix !',
      '<b>En ligne :</b> chacun note sur son téléphone, l\'appli calcule la moyenne et montre qui est le plus indulgent.',
    ],
    load: () => import('./cartes.js').then((m) => m.dix),
  },
  {
    id: 'qui', name: 'Qui de nous…', emoji: '👉', colors: ['#00b39b', '#5a6cff'],
    desc: 'Le plus susceptible de… À 3, tout le monde pointe quelqu\'un !',
    tags: ['cartes', 'hot'], players: '3+',
    rules: [
      'Lis la question à voix haute. À « 3 », tout le monde pointe du doigt la personne qui correspond le mieux.',
      'Celui qui est le plus désigné boit (ou prend un gage) autant de fois qu\'il a été pointé.',
      '<b>En ligne :</b> le vote se fait sur les téléphones, de façon anonyme jusqu\'aux résultats.',
    ],
    load: () => import('./cartes.js').then((m) => m.qui),
  },
  {
    id: 'opinions', name: 'Opinions impopulaires', emoji: '🗣️', colors: ['#ee0979', '#ff6a00'],
    desc: 'D\'accord ou pas d\'accord ? La minorité doit se justifier.',
    tags: ['cartes', 'hot'], players: '3+', rules: [
      'Une opinion qui divise s\'affiche (« Les chaussettes dans les sandales, c\'est stylé »). À 3, chacun lève le pouce (d\'accord) ou le baisse (pas d\'accord).',
      'La minorité doit défendre son avis… puis prend une pénalité. <b>En ligne :</b> le vote se fait sur les téléphones avec les noms.',
    ],
    load: () => import('./cartes.js').then((m) => m.opinions),
  },
  {
    id: 'etsi', name: 'Et si… ?', emoji: '🌀', colors: ['#4568dc', '#b06ab3'],
    desc: 'Des situations folles : qu\'est-ce que tu ferais ?',
    tags: ['cartes', 'hot'], players: '2+', rules: ['Une situation imaginaire s\'affiche (« Et si tu te réveillais dans le corps de la personne à ta gauche ? »). Chacun raconte ce qu\'il ferait. La réponse la plus folle gagne !', '<b>En ligne :</b> la carte s\'affiche sur tous les téléphones. Le joueur désigné (ou l\'hôte) passe à la carte suivante.'],
    load: () => import('./cartes.js').then((m) => m.etsi),
  },
  {
    id: 'confidences', name: 'Confidences', emoji: '💬', colors: ['#c94b4b', '#4b134f'],
    desc: 'Des questions pour vraiment se connaître : drôles, profondes, amoureuses…',
    tags: ['cartes', 'hot'], players: '2+', rules: ['Le joueur désigné répond à la question, honnêtement. Les autres peuvent ensuite donner leur propre réponse. Parfait pour une fin de soirée ou en couple.', '<b>En ligne :</b> la question s\'affiche sur tous les téléphones. Le joueur désigné (ou l\'hôte) passe à la carte suivante.'],
    load: () => import('./cartes.js').then((m) => m.confidences),
  },
  {
    id: 'deuxverites', name: 'Deux vérités, un mensonge', emoji: '🤥', colors: ['#283c86', '#45a247'],
    desc: 'Raconte trois anecdotes dont une fausse. Démasquez le mensonge !',
    tags: ['cartes', 'bluff', 'hot'], players: '3+', rules: ['Le joueur désigné raconte trois anecdotes sur le thème de la carte : deux vraies et une inventée. Les autres votent pour le mensonge. Ceux qui se trompent prennent une pénalité ; si personne ne trouve, c\'est le conteur qui gagne.'],
    load: () => import('./cartes.js').then((m) => m.deuxverites),
  },
  {
    id: 'action', name: 'Action ou vérité', emoji: '🎯', colors: ['#e94057', '#8a2387'],
    desc: 'Le classique, avec des centaines de défis et questions.',
    tags: ['cartes', 'hot'], players: '2+', badges: ['4 niveaux'],
    rules: [
      'À tour de rôle, chaque joueur choisit <b>Action</b> ou <b>Vérité</b>. Une carte est tirée : il faut réaliser le défi ou répondre honnêtement.',
      'Si tu refuses, tu prends une pénalité. L\'appli fait tourner les joueurs automatiquement.',
      '<b>En ligne :</b> le joueur désigné choisit Action ou Vérité sur son téléphone et la carte s\'affiche chez tout le monde. Défi relevé : +1 point.',
    ],
    load: () => import('./action.js'),
  },
  {
    id: 'cap', name: 'Cap ou pas cap ?', emoji: '💪', colors: ['#f12711', '#f5af19'],
    desc: 'Des défis de plus en plus fous. Pas cap ? Pénalité !',
    tags: ['cartes', 'hot'], players: '2+', badges: ['3 niveaux'],
    rules: ['Le joueur désigné lit le défi : « Cap de… ? ». S\'il le relève, bravo ! S\'il n\'est pas cap, il prend une pénalité. Trois niveaux : Tranquille, Délire (téléphone et réseaux sociaux) et Hot. Chacun peut toujours refuser un défi.', '<b>En ligne :</b> le défi s\'affiche sur tous les téléphones. Le joueur désigné touche « Cap ! » ou « Pas cap » : défi relevé = +1 point.'],
    load: () => import('./cartes.js').then((m) => m.cap),
  },
  {
    id: 'paranoia', name: 'Paranoïa', emoji: '🤫', colors: ['#2b2d6e', '#d6336c'],
    desc: 'Une question chuchotée, un nom prononcé… et un pile ou face.',
    tags: ['cartes', 'hot', 'bluff'], players: '3+',
    rules: [
      'Le téléphone passe de main en main. Le joueur lit une question <b>en secret</b> (ex. « Qui ici est le plus jaloux ? ») et répond à voix haute en donnant <b>le nom</b> d\'un joueur.',
      'Puis on lance la pièce : si c\'est <b>révélé</b>, la question est montrée à tout le monde. Sinon, le mystère reste entier… 😈',
    ],
    load: () => import('./paranoia.js'),
  },
  {
    id: 'bouteille', name: 'La Bouteille', emoji: '🍾', colors: ['#1d976c', '#f7b733'],
    desc: 'Fais tourner la bouteille : elle désigne quelqu\'un… et un défi à deux.',
    tags: ['hot', 'rapide'], players: '2+', rules: [
      'Les prénoms des joueurs sont placés en cercle. Celui dont c\'est le tour fait tourner la bouteille : elle désigne un autre joueur, et un défi à faire à deux s\'affiche (« Alice fait un compliment à Bob », « …un bisou dans le cou » au niveau Hot).',
      'Refuser coûte une pénalité. C\'est ensuite la personne désignée qui fait tourner la bouteille.',
      '<b>En ligne :</b> la bouteille tourne sur tous les téléphones en même temps. C\'est le joueur dont c\'est le tour (ou l\'hôte) qui la lance.',
    ],
    load: () => import('./bouteille.js'),
  },
  {
    id: 'debats', name: 'Pour ou contre', emoji: '🎤', colors: ['#f857a6', '#ff5858'],
    desc: 'Deux joueurs, un sujet absurde, 45 secondes pour convaincre.',
    tags: ['cartes', 'rapide'], players: '3+',
    rules: [
      'Deux joueurs sont tirés au sort : l\'un défend <b>Pour</b>, l\'autre <b>Contre</b>, même s\'il n\'est pas d\'accord !',
      'Chacun a 45 secondes pour argumenter. Les autres votent ensuite pour le plus convaincant. Le perdant prend une pénalité.',
    ],
    load: () => import('./debats.js'),
  },
  {
    id: 'motsinterdits', name: 'Mots interdits', emoji: '🚫', colors: ['#ff512f', '#dd2476'],
    desc: 'Fais deviner un mot sans dire les mots interdits.',
    tags: ['equipes'], players: '4+',
    rules: [
      'Par équipes. Un joueur fait deviner un maximum de mots à son équipe avant la fin du temps, <b>sans prononcer</b> le mot ni les 5 mots interdits (ni des mots de la même famille).',
      '<b>Trouvé</b> : +1 point. <b>Passer</b> : 0 point. <b>Interdit !</b> (l\'équipe adverse surveille) : −1 point.',
    ],
    load: () => import('./teamwords.js').then((m) => m.motsinterdits),
  },
  {
    id: 'mime', name: 'Mime express', emoji: '🤸', colors: ['#11998e', '#38ef7d'],
    desc: 'Mime un max de mots en 60 secondes. Interdit de parler !',
    tags: ['equipes', 'rapide'], players: '4+',
    rules: [
      'Par équipes. Le mimeur regarde le mot sur le téléphone et le fait deviner à son équipe <b>sans parler ni faire de bruit</b>.',
      'Trouvé : +1 point. Tu peux passer un mot trop dur. L\'équipe avec le plus de points à la fin gagne.',
    ],
    load: () => import('./teamwords.js').then((m) => m.mime),
  },
  {
    id: 'chapeau', name: 'Le Chapeau', emoji: '🎩', colors: ['#614385', '#516395'],
    desc: '3 manches avec les mêmes noms : décrire, un seul mot, puis mimer.',
    tags: ['equipes'], players: '4+',
    rules: [
      'Un paquet de personnalités et personnages est tiré. Les équipes jouent chacune leur tour pendant 30 secondes.',
      '<b>Manche 1</b> : décris le personnage avec autant de mots que tu veux. <b>Manche 2</b> : un seul mot ! <b>Manche 3</b> : uniquement en mimant.',
      'Ce sont les mêmes cartes à chaque manche : retenez bien ce qui a été dit avant ! Une manche se termine quand le paquet est vide.',
      '<b>En ligne :</b> les noms s\'affichent sur le téléphone de celui qui fait deviner, et l\'équipe adverse les voit pour suivre.',
    ],
    load: () => import('./chapeau.js'),
  },
  {
    id: 'fredonne', name: 'Fredonne !', emoji: '🎵', colors: ['#da22ff', '#9733ee'],
    desc: 'Fais deviner des chansons en les fredonnant, sans paroles.',
    tags: ['equipes', 'rapide'], players: '4+', rules: ['Par équipes. Le joueur fredonne (« lalala », « mmm ») la chanson affichée, <b>sans prononcer les paroles</b>. Son équipe doit trouver le titre ou l\'artiste. Trouvé : +1 point.'],
    load: () => import('./teamwords.js').then((m) => m.fredonne),
  },
  {
    id: 'disle', name: 'Dis-le comme…', emoji: '🎭', colors: ['#f953c6', '#b91d73'],
    desc: 'Dis une phrase banale avec une émotion ou un personnage secret.',
    tags: ['equipes', 'rapide'], players: '4+', rules: ['Par équipes. Le joueur doit dire la phrase affichée (« Passe-moi le sel ») à la manière indiquée en secret (« comme un pirate », « en pleine rupture »…). Son équipe doit deviner la manière. Trouvé : +1 point.'],
    load: () => import('./teamwords.js').then((m) => m.disle),
  },
  {
    id: 'front', name: 'Sur le front', emoji: '🤳', colors: ['#fc4a1a', '#f7b733'],
    desc: 'Téléphone sur le front, les autres te font deviner le mot.',
    tags: ['rapide', 'equipes'], players: '2+',
    rules: [
      'Choisis une catégorie et place le téléphone <b>sur ton front, écran vers les autres</b> (en mode paysage).',
      'Les autres te font deviner le mot affiché. <b>Penche le téléphone vers le bas</b> si tu as trouvé, <b>vers le haut</b> pour passer. Tu peux aussi toucher la moitié droite (trouvé) ou gauche (passer) de l\'écran.',
      '<b>En ligne :</b> le mot s\'affiche sur le téléphone de tous les autres… sauf le tien ! Ils te le font deviner et valident quand tu as trouvé : +1 point par mot.',
    ],
    load: () => import('./front.js'),
  },
  {
    id: 'patate', name: 'Patate chaude', emoji: '💣', colors: ['#ee0979', '#ff6a00'],
    desc: 'Réponds et passe le téléphone avant que ça explose !',
    tags: ['rapide'], players: '3+',
    rules: [
      'Un thème s\'affiche (ex. « Une marque de voiture » ou « un mot contenant OU »). Le joueur qui tient le téléphone donne une réponse et le passe à son voisin.',
      'Interdit de répéter une réponse déjà donnée. La bombe explose après un temps aléatoire : celui qui la tient a perdu !',
    ],
    load: () => import('./patate.js'),
  },
  {
    id: 'cinq', name: '3 en 5 secondes', emoji: '⏱️', colors: ['#00c6ff', '#0072ff'],
    desc: 'Cite 3 choses en 5 secondes. Plus dur qu\'il n\'y paraît !',
    tags: ['rapide'], players: '2+',
    rules: [
      'Une consigne apparaît, par exemple « 3 marques de céréales ». Le joueur a <b>5 secondes</b> pour citer 3 réponses.',
      'Les autres jugent : réussi ou raté ? Le joueur qui rate prend une pénalité.',
    ],
    load: () => import('./cinq.js'),
  },
  {
    id: 'petitbac', name: 'Petit bac', emoji: '🔤', colors: ['#56ab2f', '#a8e063'],
    desc: 'Une lettre, des catégories, un chrono. Papier et stylo !',
    tags: ['rapide'], players: '2+',
    rules: [
      'Une lettre et des catégories sont tirées au sort. Chacun écrit sur papier un mot par catégorie commençant par cette lettre.',
      'Le premier qui a fini crie « STOP » (ou le chrono s\'arrête). 2 points pour une réponse unique, 1 point si quelqu\'un a la même.',
    ],
    load: () => import('./petitbac.js'),
  },
  {
    id: 'bonmot', name: 'Le Bon Mot', emoji: '🔠', colors: ['#4776e6', '#8e54e9'],
    desc: 'Des lettres au hasard (« DE »…) : tape vite un mot qui va avec. Ou enchaîne les mots !',
    tags: ['rapide'], players: '1+',
    rules: [
      '<b>En ligne :</b> chacun joue sur son téléphone, à tour de rôle ; tout le monde voit en direct le mot que tape le joueur. Sinon, on se passe un seul téléphone.',
      '<b>Lettres imposées :</b> l\'appli tire des lettres au hasard, par exemple « DE ». Par défaut, on commence avec 1 lettre, puis une de plus tous les 2 tours (jusqu\'à 3) : plus la partie avance, plus c\'est dur ! Le joueur doit vite taper un mot qui commence par ces lettres (« dernier ») — ou qui les contient, selon le réglage.',
      '<b>Mots en chaîne :</b> chaque mot doit commencer par la dernière lettre du mot précédent (« dernier » → « rose » → « escargot »…). Le premier joueur choisit la lettre de départ. Variante : reprendre les 2 ou 3 dernières lettres.',
      'Les mots sont vérifiés dans un dictionnaire de plus de 500 000 mots : prénoms, argot, verlan et mots des jeunes compris (accents facultatifs, pas de mot déjà joué). Mot trouvé : +1 point, puis compte à rebours de 3 secondes pour passer le téléphone. Chaque mauvais mot (inconnu, déjà joué, mauvaises lettres) coûte 3 secondes de chrono. Temps écoulé : pénalité !',
      '<b>Chaque joueur a 3 vies ❤️❤️❤️.</b> Quand le temps est écoulé, on perd une vie ; à zéro, on est éliminé. Le dernier joueur en vie gagne la partie.',
    ],
    load: () => import('./bonmot.js'),
  },
  {
    id: 'pendu', name: 'Le Pendu', emoji: '🪢', colors: ['#614385', '#516395'],
    desc: 'Le classique : trouve le mot lettre par lettre avant d\'être pendu.',
    tags: ['equipes'], players: '1+', rules: [
      'Un mot est caché : propose des lettres. Chaque erreur ajoute un morceau au dessin ; au bout de 7 erreurs, c\'est perdu !',
      'Le mot est tiré au hasard (court, moyen ou long), ou choisi en secret par un joueur. Avec une liste de joueurs, chacun propose une lettre à son tour : celui qui se trompe passe la main.',
      '<b>En ligne :</b> chacun propose une lettre sur son téléphone, à son tour. Bonne lettre : +1 et tu rejoues. Mot trouvé : +2.',
    ],
    load: () => import('./pendu.js'),
  },
  {
    id: 'motmystere', name: 'Le Mot mystère', emoji: '🟩', colors: ['#1d976c', '#f0b429'],
    desc: 'Trouve le mot en 6 essais grâce aux lettres bien ou mal placées.',
    tags: ['rapide'], players: '1+',
    rules: [
      'Propose un mot de 5, 6 ou 7 lettres. Chaque lettre devient <b>verte</b> si elle est bien placée, <b>jaune</b> si elle est dans le mot mais ailleurs, <b>grise</b> si elle n\'y est pas. Tu as 6 essais.',
      'À plusieurs, chacun propose un mot à son tour : celui qui trouve distribue des gorgées. Si personne ne trouve, tout le monde boit !',
    ],
    load: () => import('./motmystere.js'),
  },
  {
    id: 'nioui', name: 'Ni oui ni non', emoji: '🙅', colors: ['#ff416c', '#ff4b2b'],
    desc: 'Réponds aux questions pièges sans jamais dire « oui » ni « non ».',
    tags: ['rapide'], players: '2+', rules: ['Un joueur pose les questions pièges affichées, très vite. Celui qui répond doit tenir 60 secondes sans dire « oui », « non », « ouais », « nan »… ni hocher la tête ! S\'il craque, il prend une pénalité.', '<b>En ligne :</b> les questions s\'affichent sur le téléphone de celui qui interroge, et tous les autres ont un buzzer « Oui ou non entendu ! ». Tenir jusqu\'au bout : +1 point.'],
    load: () => import('./nioui.js'),
  },
  {
    id: 'histoire', name: 'Histoire folle', emoji: '📚', colors: ['#8360c3', '#2ebf91'],
    desc: 'Inventez une histoire à tour de rôle en casant des mots imposés.',
    tags: ['rapide'], players: '3+', rules: ['L\'histoire commence par une phrase. À tour de rôle, chaque joueur a 30 secondes pour la continuer en plaçant le mot imposé qui s\'affiche. Mot non placé ou blanc : pénalité !', '<b>En ligne :</b> le mot imposé et le chrono s\'affichent sur tous les téléphones. Le conteur (ou l\'hôte) valide si le mot est bien placé : +1 point.'],
    load: () => import('./histoire.js'),
  },
  {
    id: 'duel', name: 'Duel de réflexes', emoji: '⚡', colors: ['#f7ff00', '#db36a4'],
    desc: 'Deux joueurs face à face sur le même téléphone. Le plus rapide gagne.',
    tags: ['rapide'], players: '2', rules: ['Posez le téléphone à plat entre vous deux, chacun de son côté. <b>Réflexe :</b> touchez votre moitié dès que l\'écran devient vert (trop tôt = point perdu). <b>Mitraillette :</b> tapez le plus de fois possible en 5 secondes. Premier à 3 points !'],
    load: () => import('./duel.js'),
  },
  {
    id: 'morpion', name: 'Morpion & 4 à la suite', emoji: '⭕', colors: ['#2193b0', '#6dd5ed'],
    desc: 'Les grands classiques à deux, ou contre le téléphone.',
    tags: ['rapide'], players: '1-2',
    rules: [
      '<b>Morpion :</b> aligne 3 symboles (ligne, colonne ou diagonale) avant l\'autre. <b>4 à la suite :</b> fais tomber tes jetons dans les colonnes et aligne-en 4.',
      'À deux sur le même téléphone, ou contre le téléphone (facile ou coriace). Le perdant prend une pénalité, et on alterne qui commence.',
    ],
    load: () => import('./morpion.js'),
  },
  {
    id: 'sequence', name: 'La Séquence', emoji: '🔴', colors: ['#00c9ff', '#92fe9d'],
    desc: 'Retiens la suite de couleurs. Elle s\'allonge à chaque tour…',
    tags: ['rapide'], players: '1+', rules: [
      'Le téléphone joue une suite de couleurs et de sons. Le joueur doit la reproduire. Réussi : on passe le téléphone au suivant et la suite s\'allonge d\'une couleur. Celui qui se trompe prend une pénalité et la suite repart de zéro.',
      'On touche « Je suis prêt » une seule fois au début : ensuite, un compte à rebours de 3 secondes laisse le temps de passer le téléphone avant chaque nouvelle suite.',
      '<b>En ligne :</b> tout le monde voit la même suite et la reproduit sur son téléphone, en même temps. Une erreur et tu es éliminé : le dernier en lice gagne !',
    ],
    load: () => import('./sequence.js'),
  },
  {
    id: 'couleurs', name: 'Couleurs pièges', emoji: '🌈', colors: ['#ff3b4f', '#2f7bff'],
    desc: 'Le mot « ROUGE » écrit en bleu : touche le bleu ! Ton cerveau va souffrir.',
    tags: ['rapide'], players: '1+',
    rules: [
      'Un nom de couleur s\'affiche, écrit dans une autre couleur. Touche la couleur de l\'<b>encre</b>, pas celle du mot ! Bonne réponse : +1 (+2 avec une série de 5). Erreur : −1 et un petit blocage.',
      'Chaque joueur fait une manche chronométrée à son tour. Le plus petit score prend une pénalité. Mode Piège : 6 couleurs et des boutons trompeurs.',
    ],
    load: () => import('./couleurs.js'),
  },
  {
    id: 'roi', name: 'Le Roi', emoji: '👑', colors: ['#c79a2a', '#7a1f3d'],
    desc: 'Le jeu de cartes de soirée : chaque carte, une règle.',
    tags: ['cartes', 'hot'], players: '3+',
    rules: [
      'Chacun pioche une carte à tour de rôle. Chaque valeur correspond à une règle (affichée à l\'écran).',
      'Quand un Roi est tiré, le joueur verse un peu de sa boisson dans le verre du milieu. Celui qui tire le <b>4e Roi</b> le boit (ou fait un gros gage en mode sans alcool) !',
      '<b>En ligne :</b> chacun pioche la carte sur son téléphone, à son tour, et tout le monde voit la règle.',
    ],
    load: () => import('./roi.js'),
  },
  {
    id: 'plusmoins', name: 'Plus ou moins', emoji: '🃏', colors: ['#cb2d3e', '#ef473a'],
    desc: 'La prochaine carte sera-t-elle plus haute ou plus basse ?',
    tags: ['rapide'], players: '1+', rules: [
      'Une carte est retournée. Devine si la suivante sera plus haute ou plus basse (l\'As est la plus forte, une égalité compte comme perdu).',
      'Chaque bonne réponse allonge ta série. Si tu te trompes, tu prends autant de pénalités que ta série + 1 ! Après 3 bonnes réponses, tu peux passer la main au joueur suivant.',
      '<b>En ligne :</b> le joueur dont c\'est le tour choisit sur son téléphone, les autres regardent. Dès 3 bonnes réponses, encaisse ta série pour marquer autant de points !',
    ],
    load: () => import('./paquet.js').then((m) => m.plusmoins),
  },
  {
    id: 'bus', name: 'Le Bus', emoji: '🚌', colors: ['#f7971e', '#e94057'],
    desc: '4 cartes, 4 questions : rate une seule fois et tu remontes dans le bus.',
    tags: ['rapide'], players: '1+', rules: [
      'Pour descendre du bus, il faut deviner 4 cartes d\'affilée : 1. rouge ou noir ? 2. plus ou moins que la 1re ? 3. entre les deux premières ou à l\'extérieur ? 4. quelle couleur (cœur, carreau, trèfle, pique) ?',
      'Une erreur et tu prends une pénalité (une par étape atteinte), puis tu recommandes depuis le début. Celui qui descend du bus distribue des gorgées !',
      '<b>En ligne :</b> chacun monte dans le bus à son tour et répond sur son téléphone. Moins d\'essais = plus de points.',
    ],
    load: () => import('./paquet.js').then((m) => m.bus),
  },
  {
    id: 'loup', name: 'Loup-garou', emoji: '🐺', colors: ['#232526', '#7b2ff7'],
    desc: 'Distribution des rôles et assistant du meneur de jeu.',
    tags: ['bluff'], players: '6-20',
    rules: [
      'Un <b>meneur</b> ne joue pas : il distribue les rôles avec le téléphone puis guide la partie grâce au script.',
      'La nuit, les loups-garous désignent une victime. Le jour, le village débat et vote pour éliminer un suspect.',
      'Le village gagne s\'il élimine tous les loups. Les loups gagnent s\'ils sont aussi nombreux que les villageois.',
    ],
    load: () => import('./loup.js'),
  },
  {
    id: 'roue', name: 'La roue des gages', emoji: '🎡', colors: ['#f12711', '#f5af19'],
    desc: 'Fais tourner la roue et subis ton destin.',
    tags: ['rapide', 'hot'], players: '1+',
    rules: ['Fais tourner la roue : elle désigne un gage (et un joueur si la liste est remplie). Pas le droit de refuser… ou alors double peine !', '<b>En ligne :</b> chacun son tour fait tourner la roue, et elle tourne sur tous les téléphones en même temps.'],
    load: () => import('./roue.js'),
  },
  {
    id: 'doigt', name: 'Qui commence ?', emoji: '☝️', colors: ['#8e2de2', '#4a00e0'],
    desc: 'Chacun pose un doigt sur l\'écran, le hasard choisit.',
    tags: ['outils'], players: '2-10',
    rules: ['Tout le monde pose un doigt sur l\'écran. Après quelques secondes, un doigt est choisi au hasard. Mode équipes : les doigts sont répartis en 2 équipes.', '<b>En ligne :</b> chacun garde le doigt sur son propre téléphone. Quand tout le monde est prêt, le hasard choisit !'],
    load: () => import('./doigt.js'),
  },
  {
    id: 'outils', name: 'Boîte à outils', emoji: '🧰', colors: ['#434343', '#5f6fa8'],
    desc: 'Dés, pile ou face, équipes au hasard, chrono, compteur de points.',
    tags: ['outils'], players: '1+',
    rules: ['Tous les petits outils utiles pendant une soirée jeux.', '<b>En ligne :</b> l\'hôte choisit l\'outil et tout le monde voit le résultat : dés, pièce, équipes, chrono et compteur de points partagés.'],
    load: () => import('./outils.js'),
  },
];

export function gameById(id) { return GAMES.find((g) => g.id === id); }
