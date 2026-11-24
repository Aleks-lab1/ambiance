// Accueil : trouver vite le bon jeu (nombre de joueurs, recherche, joués récemment, tirage au hasard).
import { get, set } from './store.js';
import { norm } from './ui.js';

/** Choix « On est combien ? » (10 = 10 et plus). */
export const COUNTS = [2, 3, 4, 5, 6, 7, 8, 10];
export const countLabel = (n) => (n >= 10 ? '10+' : String(n));

/** '2-16' → [2, 16] ; '3+' → [3, ∞] ; '2' → [2, 2] ; illisible → [1, ∞]. */
export function playersRange(s) {
  const m = String(s || '').trim().match(/^(\d+)\s*(?:[-–]\s*(\d+)|(\+))?$/);
  if (!m) return [1, Infinity];
  const a = Number(m[1]);
  return [a, m[2] ? Number(m[2]) : m[3] ? Infinity : a];
}

/** Le jeu se joue-t-il à n joueurs ? (n = 0 : peu importe) */
export function fitsCount(g, n) {
  if (!n) return true;
  const [a, b] = playersRange(g.players);
  return n >= a && n <= b;
}

const low = (t) => String(t || '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const plainOf = (w) => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Recherche sans majuscules : chaque mot tapé doit être le début d'un mot du nom, de la description ou des
 * catégories du jeu (« loup » → Loup-garou). Sans accent, les accents sont ignorés (« equipe » → équipes) ;
 * avec un accent, il compte (« dés » → les jeux de dés, pas tous ceux qui contiennent « des »).
 */
export function matchSearch(g, query, extra = '') {
  const words = low(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const text = [g.name, g.desc || '', extra].join(' ');
  const exact = ' ' + low(text) + ' ';
  const plain = ' ' + norm(text) + ' ';
  return words.every((w) => (plainOf(w) !== w ? exact.includes(' ' + w) : plain.includes(' ' + norm(w))));
}

// ---------- Choix du nombre de joueurs (gardé pour la soirée : 6 h) ----------
const COUNT_KEY = 'count';
const COUNT_TTL = 6 * 3600 * 1000;
export function getCount() {
  const c = get(COUNT_KEY, null);
  return c && COUNTS.includes(c.n) && Date.now() - c.at < COUNT_TTL ? c.n : 0;
}
export function setCount(n) { set(COUNT_KEY, n ? { n, at: Date.now() } : null); }

// ---------- Joués récemment ----------
const RECENT_KEY = 'recent';
export function getRecent() {
  const v = get(RECENT_KEY, []);
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
}
export function pushRecent(id) {
  set(RECENT_KEY, [id, ...getRecent().filter((x) => x !== id)].slice(0, 8));
}

/** Tirage au hasard parmi `list`, en évitant si possible les 3 derniers jeux joués. */
export function pickGame(list, recent = getRecent(), rnd = Math.random) {
  if (!list.length) return null;
  const fresh = list.filter((g) => !recent.slice(0, 3).includes(g.id));
  const pool = fresh.length ? fresh : list;
  return pool[Math.floor(rnd() * pool.length)];
}
