// Icônes de l'interface, à la place des emojis. Les dessins sont dans icons-data.js (généré par
// scripts/gen-icons.mjs d'après la table scripts/icons-map.mjs : Phosphor Icons, MIT, et game-icons.net, CC BY 3.0).
// Les textes de l'interface gardent leurs emojis dans le code (« 🎯 Au tour de Bob ») : h(), append(),
// replaceChildren() (js/ui.js) et setText() les remplacent par l'icône correspondante au moment de l'affichage.
import { ICONS, EMOJI } from './icons-data.js';

const SVG = 'http://www.w3.org/2000/svg';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Les emojis connus, les plus longs d'abord (« 🕵️‍♀️ » avant « 🕵 »), suivis ou non du sélecteur FE0F.
const RE = new RegExp('(?:' + Object.keys(EMOJI).sort((a, b) => b.length - a.length).map(esc).join('|') + ')️?', 'gu');
const norm = (e) => (EMOJI[e] ? e : e.replace(/️$/, ''));

/** Conteneurs dont les emojis font partie du jeu (Émojis mystères, Memory, Chifoumi…) : jamais remplacés. */
export const KEEP = '.keep-emo, .emoji-big, .mc-front, .chi-hand, .chi-btn, .chi-arena, select, option, textarea, input';
export const KEEP_CLASS = /(^|\s)(keep-emo|emoji-big|mc-front|chi-hand|chi-btn|chi-arena)(\s|$)/;

const cache = new Map();
/** Icône SVG (taille 1em, couleur du texte) : icon('trophy'), icon('circle', '#ff4d6d'), icon('heart|regular'). */
export function icon(name, color = null, cls = '') {
  const key = name + '#' + (color || '') + cls;
  let t = cache.get(key);
  if (!t) {
    const d = ICONS[name];
    t = document.createElementNS(SVG, 'svg');
    t.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
    t.setAttribute('viewBox', `0 0 ${d ? d[0] : 256} ${d ? d[0] : 256}`);
    t.setAttribute('aria-hidden', 'true');
    t.setAttribute('fill', 'currentColor');
    if (color) t.style.color = color;
    if (d) t.innerHTML = d[1];
    cache.set(key, t);
  }
  return t.cloneNode(true);
}

/** Le texte contient-il un emoji qui a son icône ? */
export function hasEmoji(s) { RE.lastIndex = 0; return RE.test(s); }

/** Découpe un texte en morceaux de texte et icônes (nœuds DOM). */
export function emojiNodes(s) {
  const out = [];
  let last = 0;
  RE.lastIndex = 0;
  for (let m; (m = RE.exec(s));) {
    if (m.index > last) out.push(document.createTextNode(s.slice(last, m.index)));
    const [name, color] = EMOJI[norm(m[0])].split('#');
    out.push(icon(name, color ? '#' + color : null));
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(document.createTextNode(s.slice(last)));
  return out;
}
