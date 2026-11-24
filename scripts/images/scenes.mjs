// Composition de l'image de chaque jeu (cases de l'accueil). Lu par scripts/gen-images.mjs.
//
// Repère : 300 × 200 (x vers la droite, y vers le bas), quelle que soit la taille de l'image produite.
// Zones à garder dégagées : nom du jeu en bas à gauche (y > 130), pastilles en haut à gauche, étoile en haut à droite.
// L'élément principal se place vers (206, 90) : la case y ajoute un halo de lumière (css/style.css, .tile-art).
// L'image est transparente : le dégradé de couleurs de la case (et du thème) apparaît derrière.
//
// Éléments (dessinés dans l'ordre, le dernier par-dessus) :
//   e('🎨', x, y, taille, rotation, options)        emoji 3D (Fluent Emoji de Microsoft, dans scripts/images/emoji/)
//   tile('A', x, y, taille, rotation, { c })         lettre en relief, c : 'creme' | 'vert' | 'jaune' | 'gris'
//   card('K', '♥', x, y, taille, rotation)           carte à jouer
//   ball(7, x, y, taille, { c })                     boule de bingo (c : couleur)
//   wheel(x, y, taille, rotation)                    roue des gages
//   word('ROUGE', x, y, taille, rotation, { c })     mot en relief (c : couleur)
//   ring(x, y, taille, { c })                        rond en relief (le « O » du morpion)
//   arcs(x, y, rayon, rotation)                      traits de mouvement autour d'un point
// Options communes : b (flou, pour la profondeur), o (opacité), f (miroir), sh: false (sans ombre).
// Décor automatique : bulles de lumière et étincelles (tirage fixe par jeu).
// Après une modification : node scripts/gen-images.mjs (ou node scripts/gen-images.mjs <id> pour un seul jeu).

const e = (ch, x, y, s, r = 0, o = {}) => ({ k: 'e', ch, x, y, s, r, ...o });
const tile = (t, x, y, s, r = 0, o = {}) => ({ k: 'tile', t, x, y, s, r, ...o });
const card = (rank, suit, x, y, s, r = 0, o = {}) => ({ k: 'card', rank, suit, x, y, s, r, ...o });
const ball = (n, x, y, s, o = {}) => ({ k: 'ball', n, x, y, s, r: 0, ...o });
const wheel = (x, y, s, r = 0, o = {}) => ({ k: 'wheel', x, y, s, r, ...o });
const word = (t, x, y, s, r = 0, o = {}) => ({ k: 'word', t, x, y, s, r, ...o });
const arcs = (x, y, s, r = 0, o = {}) => ({ k: 'arcs', x, y, s, r, ...o });
const ring = (x, y, s, o = {}) => ({ k: 'ring', x, y, s, r: 0, ...o });
// Élément d'arrière-plan, au bord gauche : flou et transparent (effet de profondeur).
const far = (ch, r = 0, x = 14, y = 98, s = 48) => e(ch, x, y, s, r, { b: 2.6, o: 0.6, sh: false });

export const SCENES = {
  dessin: [far('🖍️', 24), e('🖌️', 108, 74, 74, -6), e('🎨', 206, 86, 120, -10), e('✏️', 270, 142, 54, 12)],
  imposteur: [far('👀'), e('❓', 104, 66, 58, -14), e('🕵️', 206, 90, 128), e('😈', 270, 142, 48, 10)],
  quiaecrit: [far('💬', -8), e('✍️', 108, 80, 72, -8), e('📝', 208, 88, 114, 8), e('❓', 272, 142, 46, 14)],
  curseur: [far('💧'), e('❄️', 104, 66, 58, -10), e('🌡️', 206, 90, 118, 32), e('🔥', 270, 140, 56, 8)],
  danssatete: [far('🥇', -10), e('💭', 106, 60, 62), e('🧠', 206, 90, 122, -6), e('🍕', 270, 142, 50, 16)],
  ordre: [far('🚢'), e('⏳', 106, 72, 68, -12), e('📅', 208, 90, 112, 8), e('🏛️', 270, 140, 50)],
  quisuisje: [far('👑', -10), e('🤔', 104, 72, 64, -10), e('🎭', 206, 88, 122, -6), e('❓', 272, 140, 50, 14)],
  chifoumi: [e('✊', 98, 84, 72, -18), e('✋', 190, 78, 94, -4), e('✌️', 268, 132, 72, 14)],
  bataille: [far('🎯'), e('💥', 108, 60, 66), e('🚢', 206, 96, 128, -6), e('🌊', 268, 152, 58)],
  memory: [far('🧩', -12), e('🎴', 112, 80, 84, -14), e('🎴', 200, 84, 104, 9), e('✨', 270, 140, 44)],
  yams: [far('🏆'), e('🎲', 104, 86, 72, -20), e('🎲', 196, 72, 92, 12), e('🎲', 266, 138, 66, 34)],
  quiz: [far('📚'), e('❓', 104, 70, 64, -14), e('💡', 206, 84, 120, 10), e('🏆', 270, 144, 50, 8)],
  punchlines: [far('💬'), e('😂', 104, 68, 64, -12), e('🎤', 204, 90, 120, -4), e('✍️', 270, 142, 50)],
  telephone: [far('🌀'), e('✏️', 106, 62, 62, -28), e('☎️', 206, 94, 118, -8), e('🖼️', 270, 142, 54, 10)],
  dico: [far('🔤'), e('🤥', 104, 70, 62, -10), e('📖', 206, 92, 120, -6), e('🪶', 270, 138, 54, 22)],
  menteur: [far('🥤'), e('🤥', 106, 72, 68, -10), e('🎲', 210, 90, 100, 15), e('🎲', 270, 144, 54, -20)],
  emojis: [far('🧩'), e('🍿', 106, 76, 68, -6), e('🎬', 206, 90, 114, -8), e('🤔', 272, 142, 48, 10)],
  anagrammes: [far('🔀'), tile('T', 94, 86, 54, -16), tile('O', 152, 64, 60, 8), tile('S', 210, 98, 62, -6), tile('M', 266, 76, 54, 14)],
  estimations: [far('⚖️'), e('👃', 102, 72, 66), e('📏', 208, 88, 112, -28), e('🤔', 272, 142, 48, 10)],
  bingo: [far('🎉'), ball(7, 104, 76, 62, { c: '#ff4d6d' }), ball(42, 196, 84, 88, { c: '#3e8bff' }), ball(18, 266, 140, 56, { c: '#ffc21a' }), e('✅', 150, 34, 40, -10)],
  vraifaux: [far('❓'), word('VRAI', 122, 62, 40, -10, { c: '#22c55e' }), word('FAUX', 206, 110, 40, 6, { c: '#ff3b4f' }), e('🤔', 268, 142, 46, 10)],
  calcul: [far('⏱️'), word('7+5', 104, 64, 34, -10, { c: '#ffb81a' }), e('🧮', 208, 92, 118, -6), e('⚡', 270, 140, 50, 12)],
  unisson: [far('💬'), e('🍌', 104, 70, 66, -20), e('🤝', 206, 92, 116), e('🍌', 270, 142, 50, 22)],
  tupreferes: [far('🍔'), e('🤔', 104, 74, 64, -8), e('⚖️', 208, 88, 120), e('🍕', 270, 142, 48, 15)],
  jamais: [far('✋'), e('🙈', 104, 72, 64, -10), e('🙊', 206, 90, 120, 6), e('🤭', 270, 142, 50, 10)],
  dix: [far('💔'), e('😍', 104, 70, 64, -10), e('💯', 206, 88, 116, -8), e('🚩', 270, 142, 52, 12)],
  qui: [e('👉', 92, 86, 70), e('😳', 190, 80, 98), e('👈', 272, 122, 66)],
  opinions: [far('👎'), e('🍍', 104, 68, 64, -15), e('📢', 206, 90, 116, -10), e('🍕', 270, 142, 50, 15)],
  etsi: [far('💭'), e('🚀', 104, 66, 60, -20), e('🌀', 204, 88, 112), e('🦄', 266, 134, 60)],
  confidences: [far('💖'), e('💬', 104, 66, 60, -6), e('💌', 206, 92, 114, -8), e('🕯️', 270, 140, 52)],
  deuxverites: [far('✅'), e('✅', 104, 70, 56, -10), e('🤥', 206, 90, 118), e('❌', 270, 142, 48, 12)],
  action: [far('🤭'), e('🔥', 104, 72, 62, -10), e('🎯', 206, 88, 118), e('😈', 270, 142, 50, 10)],
  cap: [far('🔥'), e('😱', 104, 70, 64, -10), e('💪', 206, 92, 118, -6), e('🌶️', 270, 140, 52, 20)],
  paranoia: [far('👀'), e('👂', 104, 72, 58, -10), e('🤫', 206, 90, 118), e('🪙', 270, 140, 52, 15)],
  bouteille: [far('🌀'), e('💋', 104, 64, 56, -12), arcs(206, 92, 70), e('🍾', 206, 92, 128, -40), e('😘', 272, 142, 50, 10)],
  debats: [far('⚖️'), e('👍', 104, 68, 60, -12), e('🎤', 206, 92, 116, -16), e('👎', 270, 142, 50, 12)],
  motsinterdits: [far('🔇'), e('🤐', 104, 70, 62, -10), e('🚫', 206, 88, 114), e('💬', 270, 142, 50, 10)],
  mime: [far('🎭'), e('🤐', 104, 66, 58, -10), e('🤸', 206, 92, 120), e('⏱️', 270, 142, 50, 10)],
  chapeau: [far('🐇'), e('📜', 106, 64, 58, -18), e('🎩', 206, 100, 120, -8), e('🪄', 246, 62, 48, 20)],
  fredonne: [far('📻'), e('🎵', 104, 62, 56, -14), e('😗', 206, 92, 114), e('🎶', 270, 140, 54, 6)],
  disle: [far('🤖'), e('😡', 104, 66, 56, -10), e('🎭', 206, 88, 118, 6), e('😭', 270, 142, 50, 10)],
  front: [far('❓'), e('❓', 104, 76, 56, -14), e('🤔', 210, 106, 98), e('📱', 210, 36, 62, -8)],
  patate: [far('⏱️'), e('🔥', 106, 74, 62, -8), e('🥔', 206, 92, 114, -15), e('💣', 270, 140, 54, 12)],
  cinq: [far('5️⃣'), e('3️⃣', 104, 70, 60, -12), e('⏱️', 206, 90, 118, 8), e('⚡', 270, 140, 52, 12)],
  petitbac: [far('⏱️'), e('✏️', 104, 72, 66, -30), tile('B', 200, 86, 96, -8), e('📋', 270, 138, 54, 8)],
  bonmot: [far('⚡'), e('💬', 102, 66, 56, -8), tile('D', 168, 88, 80, -8), tile('E', 244, 96, 80, 8)],
  pendu: [far('❓'), tile('A', 104, 72, 54, -10), e('🪢', 206, 90, 114), e('✏️', 270, 140, 48, 20)],
  motmystere: [far('🔍'), tile('M', 96, 84, 56, -6, { c: 'vert' }), tile('O', 156, 74, 60, 4, { c: 'jaune' }), tile('T', 218, 90, 64, -4, { c: 'gris' }), tile('S', 272, 130, 54, 10, { c: 'vert' })],
  nioui: [far('❗'), e('🚫', 104, 68, 56, -10), e('🙅', 206, 92, 120), e('🤐', 270, 142, 48, 10)],
  histoire: [far('🧙'), e('📚', 104, 80, 64, -6), e('🐉', 206, 86, 118), e('🏰', 270, 142, 52)],
  duel: [e('🥊', 100, 96, 86, -12), e('⚡', 184, 70, 72, 8), e('🥊', 266, 116, 86, 12, { f: true })],
  morpion: [far('🟡'), word('X', 112, 70, 70, -12, { c: '#ff4d6d' }), ring(206, 92, 76, { c: '#2f7bff' }), e('🔴', 270, 140, 46)],
  sequence: [far('🧠'), e('🔴', 100, 86, 58), e('🟢', 160, 62, 62), e('🔵', 224, 82, 66), e('🟡', 270, 136, 56)],
  couleurs: [far('🌈'), word('VERT', 112, 66, 34, -10, { c: '#ff4d6d' }), word('ROUGE', 204, 98, 46, -6, { c: '#2f7bff' }), e('🤯', 270, 146, 50, 10)],
  roi: [far('🍺'), card('K', '♥', 104, 84, 74, -14), e('👑', 206, 80, 116, 8), card('A', '♠', 270, 140, 56, 14)],
  plusmoins: [far('🃏'), card('7', '♦', 156, 92, 100, -8), e('⬆️', 238, 70, 50), e('⬇️', 244, 134, 50)],
  bus: [far('🚏'), card('Q', '♣', 104, 72, 62, -14), e('🚌', 206, 92, 118, -4), card('3', '♥', 270, 142, 50, 12)],
  loup: [far('🌲', 0, 22, 92, 60), e('🌕', 106, 56, 62), e('🐺', 206, 94, 122), e('🌲', 270, 142, 56)],
  roue: [far('✨'), e('😈', 104, 68, 58, -10), wheel(206, 90, 120, 18), e('🎲', 270, 144, 48, 15)],
  doigt: [far('✨'), e('☝️', 112, 72, 70, -10), e('📱', 206, 96, 116, 8), e('👆', 270, 140, 52, 12)],
  outils: [far('⏱️'), e('🎲', 104, 66, 54, -15), e('🧰', 206, 94, 118), e('🪙', 268, 140, 48, 15)],
};

// Les 3 grandes cases de l'accueil (node scripts/gen-images.mjs modes → img/ui/mode-<id>.webp).
// Le texte de la case est à gauche : garder l'illustration à droite (x > 90).
export const MODE_SCENES = {
  'mode-local': [e('🎉', 184, 46, 44, -16), e('📱', 234, 100, 118, -12), e('👆', 286, 160, 44, 10), e('🍿', 186, 160, 40, 6)],
  'mode-online': [e('📱', 186, 122, 52, -18), e('🌐', 238, 88, 110), e('📱', 288, 146, 48, 16), e('🤝', 284, 34, 36, 8)],
  'mode-tv': [e('📺', 236, 88, 116), e('📱', 184, 152, 46, -16), e('🎮', 288, 154, 44, 14), e('🍿', 290, 34, 34, 10)],
};
