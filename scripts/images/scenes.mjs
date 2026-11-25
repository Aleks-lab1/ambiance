// Composition de l'image de chaque jeu (cases des jeux). Lu par scripts/gen-images.mjs.
//
// Style « boîte de jeu » : des silhouettes blanches avec une ombre franche. L'image est transparente :
// le dégradé de la case (couleurs du jeu ou du thème), sa trame de points et sa lumière sont faits en CSS.
// Repère : 300 × 200 (x vers la droite, y vers le bas), quelle que soit la taille de l'image produite.
// Zones à garder dégagées : nom du jeu en bas à gauche (y > 130), pastilles en haut à gauche, étoile en haut à droite.
// L'élément principal se place vers (206, 90), en grand ; un ou deux éléments plus petits et un peu
// transparents autour donnent de la profondeur.
//
// Éléments (dessinés dans l'ordre, le dernier par-dessus) :
//   i('dice', x, y, taille, rotation, options)      silhouette de game-icons.net (scripts/images/icons/<nom>.svg)
//   tile('A', x, y, taille, rotation)               tuile de lettre (lettre découpée)
//   card('K', '♥', x, y, taille, rotation)          carte à jouer (valeur découpée)
//   ball(7, x, y, taille)                           boule de bingo (numéro découpé)
//   word('VRAI', x, y, taille, rotation)            mot en grosses lettres (police Fredoka)
//   ring(x, y, taille), wheel(…), gallows(…), pads(…), arrow(…), arcs(…)   formes dessinées
// Options : o (opacité, 1 par défaut), f (miroir).
// Après une modification : node scripts/gen-images.mjs (ou node scripts/gen-images.mjs <id> pour un seul jeu).

const i = (n, x, y, s, r = 0, o = {}) => ({ k: 'i', n, x, y, s, r, ...o });
const tile = (t, x, y, s, r = 0, o = {}) => ({ k: 'tile', t, x, y, s, r, ...o });
const card = (rank, suit, x, y, s, r = 0, o = {}) => ({ k: 'card', rank, suit, x, y, s, r, ...o });
const ball = (t, x, y, s, o = {}) => ({ k: 'ball', t, x, y, s, r: 0, ...o });
const word = (t, x, y, s, r = 0, o = {}) => ({ k: 'word', t, x, y, s, r, ...o });
const shape = (k) => (x, y, s, r = 0, o = {}) => ({ k, x, y, s, r, ...o });
const ring = shape('ring'), wheel = shape('wheel'), gallows = shape('gallows'), pads = shape('pads'), arrow = shape('arrow'), arcs = shape('arcs');
// Petits éléments d'accompagnement : à gauche (en haut) et à droite (en bas), un peu transparents.
const L = (n, r = -12, o = {}) => i(n, 112, 66, 58, r, { o: 0.62, ...o });
const R = (n, r = 12, o = {}) => i(n, 270, 146, 50, r, { o: 0.78, ...o });
const M = (n, r = -6, o = {}) => i(n, 206, 90, 132, r, o); // élément principal

export const SCENES = {
  dessin: [L('paint-brush', -30), M('palette', -8), R('pencil', 20)],
  imposteur: [L('magnifying-glass', -14), M('spy', 0), R('domino-mask', 10)],
  quiaecrit: [L('papers', -10), M('quill-ink', 6), R('magnifying-glass', 10)],
  curseur: [L('snowflake-1', -10), M('thermometer-hot', 12), R('fire', 8)],
  danssatete: [L('thought-bubble', -8), M('brain', -6), R('podium', 0)],
  ordre: [L('calendar', -12), M('hourglass', 10), R('sundial', 8)],
  quisuisje: [L('queen-crown', -14), M('think', 0), R('drama-masks', 10)],
  chifoumi: [i('fist', 98, 84, 76, -16), i('open-palm', 196, 78, 96, -8), i('scissors', 270, 136, 70, 18, { o: 0.85 })],
  bataille: [L('crosshair', 0), M('battleship', -4), R('big-wave', 0)],
  memory: [L('jigsaw-piece', -14), M('card-pick', -6), R('brain', 10)],
  yams: [i('perspective-dice-six-faces-five', 104, 84, 72, -18, { o: 0.75 }), M('rolling-dices', 6), R('trophy-cup', 10)],
  quiz: [L('open-book', -10), M('light-bulb', 10), R('trophy-cup', 8)],
  punchlines: [L('shouting', -10), M('old-microphone', -8), R('chat-bubble', 8)],
  telephone: [L('pencil', -30), M('rotary-phone', -8), R('vortex', 0)],
  dico: [L('liar', -8), M('open-book', -6), R('quill', 22)],
  menteur: [L('liar', -10), M('rolling-dice-cup', -10), R('dice-six-faces-three', -14)],
  emojis: [L('popcorn', -8), M('clapperboard', -8), R('think', 8)],
  anagrammes: [tile('T', 94, 86, 54, -16, { o: 0.8 }), tile('O', 152, 64, 60, 8), tile('S', 210, 98, 62, -6), tile('M', 266, 76, 54, 14, { o: 0.85 })],
  estimations: [L('nose-side', -6), M('scales', 0), R('measure-tape', 10)],
  bingo: [ball(7, 104, 76, 62, { o: 0.75 }), ball(42, 196, 84, 92), ball(18, 268, 142, 56, { o: 0.85 }), i('check-mark', 152, 34, 40, -10, { o: 0.8 })],
  vraifaux: [word('VRAI', 130, 62, 42, -10, { o: 0.9 }), word('FAUX', 210, 112, 46, 6), i('check-mark', 236, 42, 40, 10, { o: 0.75 }), i('cross-mark', 278, 152, 36, 0, { o: 0.75 })],
  calcul: [word('7+5', 104, 64, 36, -10, { o: 0.8 }), M('abacus', -6), R('power-lightning', 12)],
  unisson: [L('banana', -24), M('shaking-hands', 0), R('meeple-group', 0)],
  tupreferes: [L('hamburger', -10), M('scales', 0), R('pizza-slice', 14)],
  jamais: [L('lips', -8), M('open-palm', -20), R('martini', 10)],
  dix: [L('broken-heart', -12), word('10', 210, 92, 118, -6), R('crowned-heart', 10)],
  qui: [L('two-shadows', 0), M('pointing', 0), R('think', 10)],
  opinions: [L('thumb-down', -10), M('megaphone', -10), R('thumb-up', 10)],
  etsi: [L('rocket', -20), M('vortex', 0), R('unicorn', 0)],
  confidences: [L('candle-flame', 0), M('love-letter', -8), R('conversation', 6)],
  deuxverites: [L('check-mark', -10), M('liar', 0), R('cross-mark', 0)],
  action: [L('archery-target', -8), M('card-joker', 10), R('fire', 8)],
  cap: [L('fire', -8), M('muscle-up', 0), R('chili-pepper', 20)],
  paranoia: [L('all-seeing-eye', -6), M('mute', 0), R('coinflip', 10)],
  bouteille: [L('lips', -12), arcs(206, 92, 128, 0, { o: 0.7 }), M('wine-bottle', -40), R('champagne-cork', 14)],
  debats: [L('thumb-up', -12), M('public-speaker', 0), R('thumb-down', 12)],
  motsinterdits: [L('chat-bubble', -8), M('stop-sign', 8), R('zipper', 10)],
  mime: [L('drama-masks', -10), M('acrobatic', 0), R('stopwatch', 10)],
  chapeau: [L('scroll-unfurled', -16), M('magic-hat', -6), R('rabbit', 6)],
  fredonne: [L('headphones', -10), M('musical-notes', 0), R('pocket-radio', 8)],
  disle: [L('shouting', -10), M('drama-masks', 6), R('chat-bubble', 10)],
  front: [L('thought-bubble', -8), M('smartphone', -12), R('think', 10)],
  patate: [L('fire', -8), M('sparky-bomb', -8), R('potato', 20)],
  cinq: [word('3', 104, 70, 64, -12, { o: 0.75 }), M('stopwatch', 8), R('power-lightning', 12)],
  petitbac: [L('pencil', -30), tile('B', 204, 88, 104, -8), R('checklist', 8)],
  bonmot: [L('chat-bubble', -8), tile('D', 172, 88, 82, -8), tile('E', 248, 98, 82, 8)],
  pendu: [tile('A', 104, 72, 54, -10, { o: 0.75 }), gallows(206, 92, 128, 0), R('pencil', 20)],
  motmystere: [tile('M', 96, 84, 56, -6, { o: 0.8 }), tile('O', 156, 74, 60, 4), tile('T', 218, 90, 64, -4, { o: 0.9 }), tile('S', 272, 130, 54, 10, { o: 0.8 })],
  nioui: [L('cross-mark', -10), M('silenced', 0), R('stop-sign', 10)],
  histoire: [L('castle', -6), M('spell-book', -4), R('dragon-head', 8)],
  duel: [L('stopwatch', -10), M('click', -6), R('lightning-trio', 10)],
  morpion: [word('X', 112, 70, 74, -12, { o: 0.85 }), ring(206, 92, 86), R('tic-tac-toe', 10)],
  sequence: [L('brain', -8), pads(206, 90, 112, -8), R('sound-waves', 0)],
  couleurs: [word('VERT', 116, 66, 34, -10, { o: 0.8 }), word('ROUGE', 206, 98, 48, -6), R('eyeball', 10)],
  roi: [card('K', '♥', 104, 84, 74, -14, { o: 0.8 }), M('queen-crown', 8), card('A', '♠', 270, 140, 58, 14, { o: 0.9 })],
  plusmoins: [card('7', '♦', 160, 92, 110, -8), arrow(240, 66, 44, 0, { o: 0.9 }), arrow(248, 136, 44, 180, { o: 0.75 })],
  bus: [card('Q', '♣', 104, 72, 62, -14, { o: 0.75 }), M('bus', -4), card('3', '♥', 270, 142, 50, 12, { o: 0.85 })],
  loup: [L('moon', 0), M('wolf-howl', 0), R('pine-tree', 0)],
  roue: [L('fire', -10), wheel(206, 90, 124, 18), R('perspective-dice-six-faces-random', 15)],
  doigt: [L('meeple-group', 0), M('finger-print', -8), R('queen-crown', 12)],
  outils: [L('perspective-dice-six-faces-random', -15), M('swiss-army-knife', -10), R('coinflip', 10)],
};

// Les 3 cases de l'accueil : illustrations découpées dans la maquette de l'utilisateur
// (scripts/images/maquette-accueil.webp, 1024 × 1536) → node scripts/gen-images.mjs modes → img/ui/mode-<id>.webp.
// box : zone découpée (x0, y0, x1, y1) ; erase : bouts de lettres de la maquette à effacer dans cette zone.
export const MODE_CROPS = {
  local: { box: [400, 27, 1001, 493], erase: [] },
  online: { box: [400, 524, 1001, 996], erase: [[398, 686, 438, 764]] },
  tv: { box: [400, 1028, 1001, 1491], erase: [[398, 1170, 480, 1268], [398, 1300, 432, 1338], [398, 1370, 448, 1452]] },
};
