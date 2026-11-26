// Composition de l'image de chaque jeu (cases des jeux). Lu par scripts/gen-images.mjs.
//
// Style « autocollant » : chaque élément est une forme colorée (dégradé), entourée d'un épais liseré blanc et
// posée avec une ombre douce. L'image est transparente : le dégradé de la case (couleurs du jeu ou du thème),
// sa trame de points et sa lumière sont faits en CSS. Choisir des couleurs qui ressortent sur la case.
// Repère : 300 × 200 (x vers la droite, y vers le bas), quelle que soit la taille de l'image produite.
// Zones à garder dégagées : nom du jeu en bas à gauche (y > 130), pastilles en haut à gauche, étoile en haut à droite.
// L'élément principal se place vers (206, 90), en grand ; un ou deux éléments plus petits autour.
//
// Éléments (dessinés dans l'ordre, le dernier par-dessus), options { c: couleur, o: opacité, f: miroir } :
//   i('dice', x, y, taille, rotation, options)      silhouette de game-icons.net (scripts/images/icons/<nom>.svg)
//   tile('A', x, y, taille, rotation, { c, ink })   tuile de lettre (couleur de la tuile, couleur de la lettre)
//   card('K', '♥', x, y, taille, rotation)          carte à jouer
//   ball(7, x, y, taille, { c })                    boule de bingo
//   word('VRAI', x, y, taille, rotation, { c })     mot en grosses lettres (police Fredoka)
//   ring(x, y, taille), wheel(…), gallows(…), pads(…), arrow(…), arcs(…)   formes dessinées
//   blob(x, y, taille, { pose, mood, f })          bonhomme de Dans la foule (js/foule-art.js) : pose stand / walk / push / down
// Après une modification : node scripts/gen-images.mjs (ou node scripts/gen-images.mjs <id> pour un seul jeu).

const i = (n, x, y, s, r = 0, o = {}) => ({ k: 'i', n, x, y, s, r, ...o });
const tile = (t, x, y, s, r = 0, o = {}) => ({ k: 'tile', t, x, y, s, r, ...o });
const card = (rank, suit, x, y, s, r = 0, o = {}) => ({ k: 'card', rank, suit, x, y, s, r, ...o });
const ball = (t, x, y, s, o = {}) => ({ k: 'ball', t, x, y, s, r: 0, ...o });
const word = (t, x, y, s, r = 0, o = {}) => ({ k: 'word', t, x, y, s, r, ...o });
const shape = (k) => (x, y, s, r = 0, o = {}) => ({ k, x, y, s, r, ...o });
const blob = (x, y, s, o = {}) => ({ k: 'blob', x, y, s, r: 0, ...o });
const ring = shape('ring'), wheel = shape('wheel'), gallows = shape('gallows'), pads = shape('pads'), arrow = shape('arrow'), arcs = shape('arcs');

// Couleurs.
const Y = '#ffd23f', O = '#ff9f1c', R = '#ff4d5e', P = '#ff6fa5', V = '#8a5cf6', B = '#3a86ff', C = '#4cc9f0', G = '#2ec27e',
  W = '#ffffff', CR = '#fff1d6', K = '#3b3358', S = '#cfd8e6', BR = '#b07a45', RED = '#e0283f';
// Élément principal (M), petit élément à gauche en haut (L) et à droite en bas (R).
const M = (n, c, r = -6, o = {}) => i(n, 206, 90, 124, r, { c, ...o });
const L = (n, c, r = -12, o = {}) => i(n, 110, 66, 58, r, { c, ...o });
const Rt = (n, c, r = 12, o = {}) => i(n, 272, 146, 52, r, { c, ...o });

export const SCENES = {
  // Tous pareils (c'est le jeu) : un bonhomme en pousse un autre, les autres flânent derrière.
  foule: [blob(118, 70, 58, { pose: 'walk' }), blob(158, 54, 44, { pose: 'stand', look: 0.6 }), blob(180, 108, 112, { pose: 'push' }), blob(246, 128, 84, { pose: 'down', fall: 0.42 })],
  dessin: [L('paint-brush', B, -30), M('palette', BR, -8), Rt('pencil', Y, 20)],
  imposteur: [L('magnifying-glass', C, -14), M('spy', Y, 0), Rt('domino-mask', P, 10)],
  quiaecrit: [L('papers', B, -10), M('quill-ink', C, 6), Rt('magnifying-glass', Y, 10)],
  curseur: [L('snowflake-1', C, -10), M('thermometer-hot', R, 12), Rt('fire', Y, 8)],
  danssatete: [L('thought-bubble', W, -8), M('brain', P, -6), Rt('podium', Y, 0)],
  ordre: [L('calendar', R, -12), M('hourglass', O, 10), Rt('scroll-unfurled', Y, 8)],
  quisuisje: [L('drama-masks', V, -14), M('uncertainty', B, 8), Rt('queen-crown', Y, 10)],
  chifoumi: [i('fist', 100, 84, 74, -16, { c: Y }), i('open-palm', 198, 78, 96, -8, { c: CR }), i('scissors', 272, 138, 66, 18, { c: B })],
  bataille: [L('crosshair', R, 0), M('battleship', O, -4), Rt('big-wave', B, 0)],
  memory: [L('jigsaw-piece', Y, -14), M('card-pick', Y, -6), Rt('brain', P, 10)],
  yams: [i('perspective-dice-six-faces-five', 104, 84, 70, -18, { c: B }), M('rolling-dices', R, 6), Rt('trophy-cup', Y, 10)],
  quiz: [L('open-book', O, -10), M('light-bulb', Y, 10), Rt('trophy-cup', O, 8)],
  punchlines: [L('chat-bubble', W, -10), M('old-microphone', S, -8), Rt('laurel-crown', Y, 0)],
  telephone: [L('pencil', Y, -30), M('rotary-phone', R, -8), Rt('vortex', P, 0)],
  dico: [L('quill', C, -20), M('open-book', O, -6), Rt('uncertainty', Y, 12)],
  menteur: [L('domino-mask', P, -14), M('perspective-dice-six-faces-random', R, 10), Rt('dice-six-faces-three', B, -14)],
  emojis: [L('popcorn', R, -8), M('clapperboard', K, -8), Rt('film-spool', B, 10)],
  anagrammes: [tile('T', 94, 86, 54, -16), tile('O', 152, 64, 60, 8, { c: Y }), tile('S', 210, 98, 62, -6), tile('M', 266, 76, 54, 14, { c: C })],
  estimations: [L('pencil-ruler', B, -10), M('scales', V, 0), Rt('measure-tape', R, 10)],
  bingo: [ball(7, 104, 76, 62, { c: R }), ball(42, 196, 84, 92, { c: B }), ball(18, 268, 142, 56, { c: Y }), i('check-mark', 152, 32, 40, -10, { c: G })],
  vraifaux: [word('VRAI', 128, 62, 42, -10, { c: G }), word('FAUX', 210, 112, 46, 6, { c: R }), i('check-mark', 238, 40, 40, 10, { c: G }), i('cross-mark', 280, 156, 34, 0, { c: R })],
  calcul: [word('7+5', 104, 64, 36, -10, { c: Y }), M('abacus', O, -6), Rt('power-lightning', Y, 12)],
  unisson: [L('chat-bubble', W, -10), M('shaking-hands', Y, 0), Rt('linked-rings', P, 10)],
  tupreferes: [L('hamburger', O, -10), M('direction-signs', BR, 0), Rt('pizza-slice', Y, 14)],
  jamais: [L('hand', CR, -14), M('glass-celebration', Y, 0), Rt('lips', RED, 8)],
  dix: [L('broken-heart', RED, -12), word('10', 208, 92, 112, -6, { c: V }), Rt('crowned-heart', Y, 10)],
  qui: [L('pointing', CR, -6), M('meeple-group', O, 0), Rt('uncertainty', Y, 10)],
  opinions: [L('thumb-down', B, -10), M('megaphone', Y, -10), Rt('thumb-up', G, 10)],
  etsi: [L('rocket', R, -20), M('vortex', Y, 0), Rt('unicorn', P, 0)],
  confidences: [L('candle-flame', Y, 0), M('love-letter', P, -8), Rt('conversation', C, 6)],
  deuxverites: [i('check-mark', 120, 72, 66, -10, { c: G }), i('check-mark', 196, 92, 90, 4, { c: G }), i('cross-mark', 260, 116, 64, 8, { c: R })],
  action: [L('archery-target', R, -8), M('card-joker', B, 10), Rt('fire', Y, 8)],
  cap: [L('fire', Y, -8), M('biceps', CR, -8), Rt('chili-pepper', G, 20)],
  paranoia: [L('two-coins', Y, -10), M('all-seeing-eye', C, 0), Rt('chat-bubble', W, 10)],
  bouteille: [L('lips', RED, -12), arcs(206, 92, 128, 0, { o: 0.8 }), M('wine-bottle', '#1f8a5a', -40), Rt('champagne-cork', BR, 14)],
  debats: [L('thumb-up', G, -12), M('public-speaker', Y, 0), Rt('thumb-down', B, 12)],
  motsinterdits: [L('chat-bubble', W, -8), M('stop-sign', RED, 8), Rt('zipper', Y, 10)],
  mime: [L('stopwatch', C, -10), M('drama-masks', Y, 0), Rt('hand', CR, 10)],
  chapeau: [L('scroll-unfurled', Y, -16), M('magic-hat', K, -6), Rt('rabbit', W, 6)],
  fredonne: [L('headphones', C, -10), M('musical-notes', Y, 0), Rt('pocket-radio', O, 8)],
  disle: [L('chat-bubble', W, -8), M('theater-curtains', RED, 0), Rt('megaphone', Y, 10)],
  front: [L('thought-bubble', W, -8), M('vibrating-smartphone', K, -10), Rt('stopwatch', B, 10)],
  patate: [L('fire', Y, -8), M('sparky-bomb', K, -8), Rt('potato', '#c98b4e', 20)],
  cinq: [word('3', 104, 70, 64, -12, { c: Y }), M('stopwatch', O, 8), Rt('power-lightning', Y, 12)],
  petitbac: [L('pencil', Y, -30), tile('B', 204, 88, 100, -8), Rt('checklist', B, 8)],
  bonmot: [L('chat-bubble', W, -8), tile('D', 172, 88, 82, -8), tile('E', 248, 98, 82, 8, { c: Y })],
  pendu: [tile('A', 104, 72, 54, -10), gallows(206, 92, 124, 0), Rt('pencil', Y, 20)],
  motmystere: [tile('M', 96, 84, 56, -6, { c: G, ink: W }), tile('O', 156, 74, 60, 4, { c: Y }), tile('T', 218, 90, 64, -4, { c: '#9aa3b5', ink: W }), tile('S', 272, 130, 54, 10, { c: G, ink: W })],
  nioui: [word('OUI', 124, 66, 40, -10, { c: G }), word('NON', 214, 110, 48, 6, { c: B }), i('cross-mark', 270, 52, 58, 0, { c: RED })],
  histoire: [L('castle', S, -6), M('spell-book', O, -4), Rt('dragon-head', G, 8)],
  duel: [i('revolver', 108, 88, 92, -10, { c: S }), i('power-lightning', 190, 60, 62, 8, { c: O }), i('revolver', 264, 112, 92, 10, { c: S, f: true })],
  morpion: [word('X', 112, 70, 74, -12, { c: R }), ring(206, 92, 86, 0, { c: Y }), Rt('tic-tac-toe', K, 10)],
  sequence: [L('brain', P, -8), pads(206, 90, 112, -8), Rt('sound-waves', W, 0)],
  couleurs: [word('VERT', 116, 66, 36, -10, { c: R }), word('ROUGE', 206, 100, 48, -6, { c: G }), Rt('eyeball', B, 10)],
  roi: [card('K', '♥', 104, 84, 74, -14), M('queen-crown', Y, 8), card('A', '♠', 270, 140, 58, 14)],
  plusmoins: [card('7', '♦', 160, 92, 110, -8), arrow(242, 64, 44, 0, { c: G }), arrow(250, 136, 44, 180, { c: Y })],
  bus: [card('Q', '♣', 104, 72, 62, -14), M('bus', Y, -4), card('3', '♥', 270, 142, 50, 12)],
  loup: [L('moon', Y, 0), M('werewolf', S, 0), Rt('pine-tree', G, 0)],
  roue: [L('fire', Y, -10), wheel(206, 90, 124, 18), Rt('perspective-dice-six-faces-random', B, 15)],
  doigt: [L('meeple-group', O, 0), M('finger-print', C, -8), Rt('queen-crown', Y, 12)],
  outils: [L('perspective-dice-six-faces-random', B, -15), M('swiss-army-knife', RED, -10), Rt('coinflip', Y, 10)],
};

// Les 3 cases de l'accueil : illustrations découpées dans la maquette de l'utilisateur
// (scripts/images/maquette-accueil.webp, 1024 × 1536) → node scripts/gen-images.mjs modes → img/ui/mode-<id>.webp.
// box : zone découpée (x0, y0, x1, y1) ; erase : bouts de lettres de la maquette à effacer dans cette zone.
export const MODE_CROPS = {
  local: { box: [400, 27, 1001, 493], erase: [] },
  online: { box: [400, 524, 1001, 996], erase: [[398, 686, 438, 764]] },
  tv: { box: [400, 1028, 1001, 1491], erase: [[398, 1170, 480, 1268], [398, 1300, 432, 1338], [398, 1370, 448, 1452]] },
};
