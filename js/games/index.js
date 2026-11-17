// Catalogue des jeux. Chaque module est chargé à la demande.

export const FILTERS = [
  { id: 'all', label: '✨ Tous' },
  { id: 'online', label: '🌐 En ligne' },
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
    tags: ['online', 'equipes'], players: '2-16', badges: ['En ligne'],
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
    tags: ['online', 'bluff'], players: '3-16', badges: ['En ligne'],
    rules: [
      'Chaque joueur reçoit un mot secret. Tous ont le même… sauf l\'imposteur, qui a un mot proche (ou aucun mot en mode « Sans mot »). <b>L\'imposteur ne sait pas qu\'il est l\'imposteur !</b>',
      'Chacun à son tour dit <b>un seul mot</b> en rapport avec son mot secret, sans être trop évident pour ne pas aider l\'imposteur. On peut faire plusieurs tours.',
      'Ensuite, tout le monde vote pour éliminer celui qu\'il soupçonne. Si l\'imposteur est démasqué, les autres gagnent. Sinon, c\'est lui qui gagne !',
    ],
    load: () => import('./imposteur.js'),
  },
  {
    id: 'tupreferes', name: 'Tu préfères', emoji: '🤔', colors: ['#7c5cff', '#2ec5ff'],
    desc: 'Des dilemmes impossibles, du plus sage au plus hot.',
    tags: ['cartes', 'online', 'hot'], players: '2+', badges: ['En ligne', '4 niveaux'],
    rules: [
      'Lis le dilemme à voix haute. Chacun choisit son camp et doit se justifier !',
      'Variante : la minorité ' + 'boit (ou prend un gage).',
      '<b>En ligne :</b> chacun vote sur son téléphone et les résultats s\'affichent avec les noms.',
    ],
    load: () => import('./cartes.js').then((m) => m.tupreferes),
  },
  {
    id: 'jamais', name: "Je n'ai jamais", emoji: '🙊', colors: ['#ff4d8d', '#ff9a5a'],
    desc: 'Ceux qui l\'ont déjà fait se dénoncent. 4 niveaux d\'intensité.',
    tags: ['cartes', 'hot'], players: '3+', badges: ['4 niveaux'],
    rules: [
      'Une phrase « Je n\'ai jamais… » s\'affiche. Tous ceux qui l\'ont <b>déjà fait</b> boivent une gorgée (ou marquent un point en mode sans alcool).',
      'Le plus drôle : raconter l\'histoire derrière ! Personne n\'est obligé de répondre aux questions qui le mettent mal à l\'aise.',
    ],
    load: () => import('./cartes.js').then((m) => m.jamais),
  },
  {
    id: 'dix', name: "C'est un 10 mais…", emoji: '💯', colors: ['#ff3d6e', '#ffc93c'],
    desc: 'La personne parfaite… avec un énorme défaut. Tu lui mets combien ?',
    tags: ['cartes', 'online', 'hot'], players: '2+', badges: ['En ligne'],
    rules: [
      'Imagine la personne parfaite, un 10/10. Mais elle a un défaut… Chacun annonce la nouvelle note qu\'il lui donne, et défend son choix !',
      '<b>En ligne :</b> chacun note sur son téléphone, l\'appli calcule la moyenne et montre qui est le plus indulgent.',
    ],
    load: () => import('./cartes.js').then((m) => m.dix),
  },
  {
    id: 'qui', name: 'Qui de nous…', emoji: '👉', colors: ['#00b39b', '#5a6cff'],
    desc: 'Le plus susceptible de… À 3, tout le monde pointe quelqu\'un !',
    tags: ['cartes', 'online', 'hot'], players: '3+', badges: ['En ligne'],
    rules: [
      'Lis la question à voix haute. À « 3 », tout le monde pointe du doigt la personne qui correspond le mieux.',
      'Celui qui est le plus désigné boit (ou prend un gage) autant de fois qu\'il a été pointé.',
      '<b>En ligne :</b> le vote se fait sur les téléphones, de façon anonyme jusqu\'aux résultats.',
    ],
    load: () => import('./cartes.js').then((m) => m.qui),
  },
  {
    id: 'action', name: 'Action ou vérité', emoji: '🎯', colors: ['#e94057', '#8a2387'],
    desc: 'Le classique, avec des centaines de défis et questions.',
    tags: ['cartes', 'hot'], players: '2+', badges: ['3 niveaux'],
    rules: [
      'À tour de rôle, chaque joueur choisit <b>Action</b> ou <b>Vérité</b>. Une carte est tirée : il faut réaliser le défi ou répondre honnêtement.',
      'Si tu refuses, tu prends une pénalité. L\'appli fait tourner les joueurs automatiquement.',
    ],
    load: () => import('./action.js'),
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
    ],
    load: () => import('./chapeau.js'),
  },
  {
    id: 'front', name: 'Sur le front', emoji: '🤳', colors: ['#fc4a1a', '#f7b733'],
    desc: 'Téléphone sur le front, les autres te font deviner le mot.',
    tags: ['rapide', 'equipes'], players: '2+',
    rules: [
      'Choisis une catégorie et place le téléphone <b>sur ton front, écran vers les autres</b> (en mode paysage).',
      'Les autres te font deviner le mot affiché. <b>Penche le téléphone vers le bas</b> si tu as trouvé, <b>vers le haut</b> pour passer. Tu peux aussi toucher la moitié droite (trouvé) ou gauche (passer) de l\'écran.',
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
    id: 'roi', name: 'Le Roi', emoji: '👑', colors: ['#c79a2a', '#7a1f3d'],
    desc: 'Le jeu de cartes de soirée : chaque carte, une règle.',
    tags: ['cartes', 'hot'], players: '3+',
    rules: [
      'Chacun pioche une carte à tour de rôle. Chaque valeur correspond à une règle (affichée à l\'écran).',
      'Quand un Roi est tiré, le joueur verse un peu de sa boisson dans le verre du milieu. Celui qui tire le <b>4e Roi</b> le boit (ou fait un gros gage en mode sans alcool) !',
    ],
    load: () => import('./roi.js'),
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
    rules: ['Fais tourner la roue : elle désigne un gage (et un joueur si la liste est remplie). Pas le droit de refuser… ou alors double peine !'],
    load: () => import('./roue.js'),
  },
  {
    id: 'doigt', name: 'Qui commence ?', emoji: '☝️', colors: ['#8e2de2', '#4a00e0'],
    desc: 'Chacun pose un doigt sur l\'écran, le hasard choisit.',
    tags: ['outils'], players: '2-10',
    rules: ['Tout le monde pose un doigt sur l\'écran. Après quelques secondes, un doigt est choisi au hasard. Mode équipes : les doigts sont répartis en 2 équipes.'],
    load: () => import('./doigt.js'),
  },
  {
    id: 'outils', name: 'Boîte à outils', emoji: '🧰', colors: ['#434343', '#5f6fa8'],
    desc: 'Dés, pile ou face, équipes au hasard, chrono, compteur de points.',
    tags: ['outils'], players: '1+',
    rules: ['Tous les petits outils utiles pendant une soirée jeux.'],
    load: () => import('./outils.js'),
  },
];

export function gameById(id) { return GAMES.find((g) => g.id === id); }
