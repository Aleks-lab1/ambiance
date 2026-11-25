// Scènes animées des 3 grandes cases de l'accueil (Local, Online, TV Mode) : elles remplissent toute la case.
// Couches HTML/CSS + emojis 3D Fluent (img/ui/fx/, copiés par `node scripts/gen-images.mjs fx`) + un peu de SVG.
// Tailles en cqh (1 % de la hauteur de la case) : la scène garde ses proportions quelle que soit la largeur,
// l'élément principal reste ancré à droite, le texte en bas à gauche. Styles : css/style.css (« Scènes des modes »).
import { h } from './ui.js';

const code = (ch) => [...ch].map((c) => c.codePointAt(0).toString(16)).filter((c) => c !== 'fe0f').join('-');
/** Emoji 3D (image) : classe(s) + style (position, taille, délai…). */
const fx = (ch, cls, style) => h('img', { class: 'fx ' + cls, src: `img/ui/fx/${code(ch)}.webp`, alt: '', draggable: 'false', decoding: 'async', style });
/** Téléphone dessiné en CSS (écran personnalisable). */
const phone = (cls, ...screen) => h('div', { class: 'ms-phone ' + cls }, h('div', { class: 'scr' }, ...screen), h('i', { class: 'notch' }));

// Petites choses qui tombent ou scintillent, réparties de façon fixe (même dessin à chaque ouverture).
function sprinkle(n, make) {
  let seed = 7;
  const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  return Array.from({ length: n }, (_, i) => make(i, r));
}

// ---------- Local : un seul téléphone, qu'on se passe de main en main ----------
function local() {
  const games = ['🧠', '🎨', '🎲', '🤩'];
  const colors = ['#fff3a3', '#ffffff', '#7cf0ff', '#b9ff7a', '#ffd1f2', '#ffb347'];
  return [
    h('div', { class: 'ms-glow' }),
    h('div', { class: 'ms-table' }),
    h('div', { class: 'ms-confetti' }, sprinkle(16, (i, r) => h('i', { style: { '--x': `${Math.round(r() * 100)}%`, '--d': `${(-r() * 6).toFixed(2)}s`, '--t': `${(4 + r() * 3).toFixed(2)}s`, '--c': colors[i % colors.length], '--r': `${Math.round(r() * 360)}deg` } }))),
    fx('🃏', 'ms-l-card d2', { '--rot': '-14deg' }),
    fx('🎉', 'ms-l-pop d3'),
    fx('🎲', 'ms-l-dice d3'),
    fx('🫱', 'ms-l-hand1 d1'),
    fx('🫲', 'ms-l-hand2 d1'),
    h('div', { class: 'ms-l-pass d2' },
      phone('ms-l-phone', ...games.map((g, i) => fx(g, 'ms-l-game', { animationDelay: `${i * 1.5}s` })))),
    fx('✨', 'ms-spark', { right: '6cqh', top: '8cqh', animationDelay: '-.8s' }),
    fx('✨', 'ms-spark', { right: '118cqh', top: '30cqh', animationDelay: '-2.1s' }),
  ];
}

// ---------- Online : chacun son téléphone, tous reliés au salon ----------
function online() {
  // Repère du réseau : 150 × 100 cqh, collé au bord droit de la case. Moyeu (salon) et 3 téléphones.
  const hub = [108, 50];
  const ph = [[38, 22], [134, 25], [124, 79]];
  const svg = `<svg class="ms-o-net" viewBox="0 0 150 100" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="msLn" x1="0" x2="1"><stop offset="0" stop-color="#7cf0ff"/><stop offset="1" stop-color="#ffb3ff"/></linearGradient></defs>
    <path class="ln faint" d="M${ph[0][0]} ${ph[0][1]} L${ph[1][0]} ${ph[1][1]}"/>
    ${ph.map(([x, y], i) => `<path class="ln" d="M${hub[0]} ${hub[1]} L${x} ${y}" style="animation-delay:${-i * 0.4}s"/>
      <circle class="dot" r="1.5"><animateMotion dur="${1.6 + i * 0.3}s" repeatCount="indefinite" path="M${hub[0]} ${hub[1]} L${x} ${y}"/></circle>
      <circle class="dot b" r="1.2"><animateMotion dur="${2 + i * 0.25}s" begin="-${0.7 + i * 0.3}s" repeatCount="indefinite" path="M${x} ${y} L${hub[0]} ${hub[1]}"/></circle>`).join('')}
  </svg>`;
  const net = h('div', { class: 'ms-o-wrap', html: svg });
  const faces = ['😎', '🤩', '😂'];
  const bubbles = ['🗳️', '👍', '🔥'];
  ph.forEach(([x, y], i) => {
    net.append(h('div', { class: 'ms-o-ph d' + (i + 1), style: { left: `${x}cqh`, top: `${y}cqh`, animationDelay: `${-i * 1.1}s` } },
      phone('ms-o-phone', fx(faces[i], 'ms-o-face')),
      h('span', { class: 'ms-o-bub' + (i ? ' l' : ''), style: { animationDelay: `${i * 1.3}s` } }, fx(bubbles[i], 'ms-o-bubi'))));
  });
  net.append(h('div', { class: 'ms-o-hub', style: { left: `${hub[0]}cqh`, top: `${hub[1]}cqh` } },
    h('i', { class: 'ring' }), h('i', { class: 'ring', style: { animationDelay: '-1s' } }), h('i', { class: 'ring', style: { animationDelay: '-2s' } }),
    fx('🌐', 'ms-o-globe')));
  return [
    h('div', { class: 'ms-grid' }),
    h('div', { class: 'ms-glow' }),
    net,
    fx('👑', 'ms-o-crown d2'),
  ];
}

// ---------- TV Mode : la télé affiche le jeu, les téléphones sont les manettes ----------
function tv() {
  const qr = h('div', { class: 'ms-t-qr' }, sprinkle(49, (i, r) => h('i', { class: r() > 0.5 || [0, 1, 7, 8, 5, 6, 12, 13, 35, 36, 42, 43].includes(i) ? 'on' : '' })));
  const quiz = h('div', { class: 'ms-t-quiz' },
    h('div', { class: 'q' }, h('i'), h('i', { class: 's' })),
    h('div', { class: 'a' }, ['c0', 'c1', 'c2', 'c3'].map((c) => h('i', { class: c }))));
  return [
    h('div', { class: 'ms-stars' }, sprinkle(22, (i, r) => h('i', { style: { left: `${Math.round(r() * 100)}%`, top: `${Math.round(r() * 70)}%`, animationDelay: `${(-r() * 3).toFixed(2)}s`, '--s': (0.6 + r() * 0.9).toFixed(2) } }))),
    h('div', { class: 'ms-t-rays' }),
    h('div', { class: 'ms-t-floor' }),
    h('div', { class: 'ms-t-tv d1' },
      h('div', { class: 'ms-t-screen' }, qr, quiz, h('i', { class: 'sheen' })),
      h('i', { class: 'foot l' }), h('i', { class: 'foot r' })),
    h('div', { class: 'ms-t-waves' }, h('i'), h('i', { style: { animationDelay: '-.7s' } }), h('i', { style: { animationDelay: '-1.4s' } })),
    phone('ms-t-ph1 d2', fx('🏆', 'ms-t-ico')),
    phone('ms-t-ph2 d3', fx('🥳', 'ms-t-ico')),
    fx('✨', 'ms-spark', { right: '104cqh', top: '6cqh', animationDelay: '-1.4s' }),
    fx('✨', 'ms-spark', { right: '6cqh', top: '6cqh', animationDelay: '-.3s' }),
  ];
}

const SCENES = { local, online, tv };

/** Scène d'une case de mode : un calque qui remplit la case (au-dessous du texte). */
export function modeScene(id) {
  return h('div', { class: 'ms ms-' + id, 'aria-hidden': 'true' }, ...(SCENES[id] ? SCENES[id]() : []));
}

/** Petite profondeur quand on bouge la souris (ordinateur, télé) : les calques glissent plus ou moins. */
export function parallax(card) {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  card.addEventListener('pointermove', (e) => {
    const b = card.getBoundingClientRect();
    card.style.setProperty('--px', (((e.clientX - b.left) / b.width) * 2 - 1).toFixed(3));
    card.style.setProperty('--py', (((e.clientY - b.top) / b.height) * 2 - 1).toFixed(3));
  });
  card.addEventListener('pointerleave', () => { card.style.setProperty('--px', 0); card.style.setProperty('--py', 0); });
}
