// Les 3 grandes cases de l'accueil (Local, Online, TV Mode), d'après la maquette de l'utilisateur
// (scripts/images/maquette-accueil.webp) : l'illustration de droite est découpée dans la maquette
// (img/ui/mode-<id>.webp, `node scripts/gen-images.mjs modes`), le reste est refait en HTML/CSS (fond, icône,
// titre en Fredoka, sous-titre, bouton) pour rester net et corrigeable. Styles : css/style.css (« Cases des modes »).
import { h } from './ui.js';

// Icônes au trait blanc de la maquette (téléphone, globe, télé) avec leurs petits traits d'éclat.
const ICONS = {
  local: '<rect x="12" y="5" width="22" height="37" rx="5"/><path d="M20 36h6"/><path class="sp" d="M40 10l4-4M42 17h6M38 3l1-3"/>',
  online: '<circle cx="25" cy="24" r="15"/><ellipse cx="25" cy="24" rx="6.5" ry="15"/><path d="M11 18.5h28M11 29.5h28"/><path class="sp" d="M3 13l3 2M2 21h3M45 8l3-3M47 15h4"/>',
  tv: '<rect x="6" y="15" width="34" height="24" rx="5"/><path d="M15 6l8 8 8-8M18 44h10M23 39v5"/><path class="sp" d="M45 13l4-4M47 20h5"/>',
};

export function modeIcon(id) {
  return h('span', { class: 'mode-ico', 'aria-hidden': 'true', html: `<svg viewBox="0 0 54 48">${ICONS[id] || ''}</svg>` });
}

/** Calque illustré d'une case : fond aux couleurs de la maquette, illustration à droite, petites étincelles. */
export function modeArt(id) {
  const img = h('img', { class: 'mode-art', src: `img/ui/mode-${id}.webp`, alt: '', decoding: 'async', draggable: 'false' });
  img.addEventListener('error', () => img.remove(), { once: true });
  return h('span', { class: 'mode-bg', 'aria-hidden': 'true' },
    img,
    h('i', { class: 'mode-spark s1' }), h('i', { class: 'mode-spark s2' }), h('i', { class: 'mode-spark s3' }));
}

/** Petite profondeur quand on bouge la souris (ordinateur, télé) : l'illustration glisse un peu. */
export function parallax(card) {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  card.addEventListener('pointermove', (e) => {
    const b = card.getBoundingClientRect();
    card.style.setProperty('--px', (((e.clientX - b.left) / b.width) * 2 - 1).toFixed(3));
    card.style.setProperty('--py', (((e.clientY - b.top) / b.height) * 2 - 1).toFixed(3));
  });
  card.addEventListener('pointerleave', () => { card.style.setProperty('--px', 0); card.style.setProperty('--py', 0); });
}
