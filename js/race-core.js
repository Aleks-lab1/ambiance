// Logique commune aux jeux de rapidité (Quiz, Émojis mystères, Anagrammes, À vue de nez),
// utilisée à la fois par la version un seul téléphone et par la version en ligne.
import { shuffle, norm, levenshtein } from './ui.js';
import { makeDeck } from './store.js';

export const RACE_MODES = {
  quiz: { name: 'Le Quiz', emoji: '🧠', short: 'QCM, le plus rapide gagne', colors: ['#5f2c82', '#49a09d'], kicker: 'Question' },
  emoji: { name: 'Émojis mystères', emoji: '🧩', short: 'Devine le film en émojis', colors: ['#f7971e', '#ffd200'], kicker: 'Que cachent ces émojis ?' },
  anag: { name: 'Anagrammes', emoji: '🔀', short: 'Remets les lettres en ordre', colors: ['#1d976c', '#93f9b9'], kicker: 'Retrouve le mot' },
  estim: { name: 'À vue de nez', emoji: '📏', short: 'Le plus proche gagne', colors: ['#e65c00', '#f9d423'], kicker: 'À ton avis…' },
  vf: { name: 'Vrai ou faux', emoji: '✅', short: 'Info ou intox ?', colors: ['#11998e', '#e94057'], kicker: 'Vrai ou faux ?' },
  calc: { name: 'Calcul express', emoji: '🧮', short: 'Calcul mental chronométré', colors: ['#4568dc', '#00c9a7'], kicker: 'Calcule !' },
};

/** Modes à choix multiples (boutons) et modes à réponse libre (texte). */
export const isQcm = (mode) => mode === 'quiz' || mode === 'vf';
export const isText = (mode) => mode === 'emoji' || mode === 'anag' || mode === 'calc';

export const CALC_LEVELS = [
  { value: 'facile', label: '😌 Facile' },
  { value: 'moyen', label: '🤔 Moyen' },
  { value: 'dur', label: '🔥 Difficile' },
];

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
/** Un calcul au hasard : { q: '7 × 8', n: 56 }. */
export function makeCalc(level = 'moyen') {
  const kinds = level === 'facile' ? ['+', '-', 'x'] : level === 'moyen' ? ['+', '-', 'x', 'x', '/', 'mix'] : ['x', 'x', '/', 'mix', 'mix', 'sq', '%'];
  const k = kinds[ri(0, kinds.length - 1)];
  if (level === 'facile') {
    if (k === '+') { const a = ri(3, 40), b = ri(2, 30); return { q: `${a} + ${b}`, n: a + b }; }
    if (k === '-') { const a = ri(10, 60), b = ri(2, a - 1); return { q: `${a} − ${b}`, n: a - b }; }
    const a = ri(2, 6), b = ri(2, 10); return { q: `${a} × ${b}`, n: a * b };
  }
  if (level === 'moyen') {
    if (k === '+') { const a = ri(25, 99), b = ri(15, 99); return { q: `${a} + ${b}`, n: a + b }; }
    if (k === '-') { const a = ri(40, 150), b = ri(12, a - 5); return { q: `${a} − ${b}`, n: a - b }; }
    if (k === 'x') { const a = ri(3, 10), b = ri(4, 12); return { q: `${a} × ${b}`, n: a * b }; }
    if (k === '/') { const b = ri(2, 9), n = ri(3, 12); return { q: `${b * n} ÷ ${b}`, n }; }
    const a = ri(2, 9), b = ri(2, 9), c = ri(3, 20); return { q: `${a} × ${b} + ${c}`, n: a * b + c };
  }
  if (k === 'x') { const a = ri(12, 25), b = ri(3, 9); return { q: `${a} × ${b}`, n: a * b }; }
  if (k === '/') { const b = ri(3, 12), n = ri(6, 25); return { q: `${b * n} ÷ ${b}`, n }; }
  if (k === 'sq') { const a = ri(11, 20); return { q: `${a}²`, n: a * a }; }
  if (k === '%') { const p = [10, 20, 25, 50, 75][ri(0, 4)], base = [40, 60, 80, 120, 200, 240, 360][ri(0, 6)]; return { q: `${p} % de ${base}`, n: (p * base) / 100 }; }
  const a = ri(6, 15), b = ri(3, 9), c = ri(10, 60); return Math.random() < 0.5 ? { q: `${a} × ${b} − ${c}`, n: a * b - c } : { q: `(${a} + ${c}) × ${b}`, n: (a + c) * b };
}

// Articles et petits mots ignorés pour comparer les réponses libres.
const LEADING = /^(le|la|les|l|un|une|des|du|de|d|the)\s+/;

export function softNorm(s) {
  return norm(s).replace(LEADING, '').replace(/\s+/g, ' ').trim();
}

/** Une réponse libre est-elle acceptable ? (tolère accents, articles, petites fautes) */
export function matches(guess, answers, keys) {
  const g = softNorm(guess);
  if (!g) return false;
  const gc = g.replace(/ /g, '');
  for (const a of answers) {
    const nc = softNorm(a).replace(/ /g, '');
    if (!nc) continue;
    if (gc === nc) return true;
    const tol = nc.length >= 14 ? 3 : nc.length >= 8 ? 2 : nc.length >= 5 ? 1 : 0;
    if (tol && Math.abs(gc.length - nc.length) <= tol && levenshtein(gc, nc) <= tol) return true;
  }
  if (keys && keys.length && keys.every((k) => g.includes(norm(k)))) return true;
  return false;
}

/** Mélange les lettres d'un mot (sans accents, en majuscules), différent de l'original. */
export function scramble(word) {
  const clean = norm(word).replace(/ /g, '').toUpperCase();
  const letters = clean.split('');
  let s = clean;
  for (let i = 0; i < 30 && s === clean; i++) s = shuffle(letters.slice()).join('');
  return s;
}

export function formatNumber(n) {
  return Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 3 });
}

/** Entrées brutes du jeu (filtrées par thème pour le Quiz). */
function rawPool(mode, data, opts) {
  if (mode === 'quiz') {
    const themes = new Set(opts.themes && opts.themes.length ? opts.themes : data.themes.map((t) => t.id));
    const pool = data.q.filter((q) => themes.has(q[0]));
    return pool.length ? pool : data.q;
  }
  return data;
}

/** Transforme une entrée brute en question : pub = ce que voient les joueurs, ans = la solution (gardée par l'hôte). */
function toQuestion(mode, data, raw) {
  if (mode === 'quiz') {
    const [t, q, good, ...bad] = raw;
    const opts4 = shuffle([good, ...bad.slice(0, 3)]);
    const th = data.themes.find((x) => x.id === t);
    return { pub: { q, opts: opts4, theme: th ? `${th.emoji} ${th.name}` : '' }, ans: { i: opts4.indexOf(good), text: good } };
  }
  if (mode === 'emoji') { const [e, a, cat, alts, keys] = raw; return { pub: { e, cat }, ans: { text: a, alts: alts || [], keys: keys || null } }; }
  if (mode === 'vf') { const [q, ok, note] = raw; return { pub: { q, opts: ['Vrai', 'Faux'], theme: '✅ Vrai ou faux' }, ans: { i: ok ? 0 : 1, text: ok ? 'Vrai' : 'Faux', note: note || '' } }; }
  if (mode === 'anag') return { pub: { s: scramble(raw), len: norm(raw).replace(/ /g, '').length }, ans: { text: raw } };
  const [q, n, unit, note] = raw;
  return { pub: { q, unit }, ans: { n, text: unit ? `${formatNumber(n)} ${unit}` : String(n), note: note || '' } };
}

/**
 * Source de questions sans répétition, même d'une partie à l'autre : les questions déjà posées sont
 * mémorisées dans le téléphone (celui de l'hôte en ligne). Quand toutes ont été vues, on recommence.
 * next() → { pub, ans }. Sert aussi pour le mode « sans limite ».
 */
export function questionSource(mode, data, opts = {}) {
  if (mode === 'calc') {
    const seen = new Set();
    return {
      total: Infinity,
      next() {
        let c = makeCalc(opts.level);
        for (let k = 0; k < 40 && seen.has(c.q); k++) c = makeCalc(opts.level);
        seen.add(c.q);
        return { pub: { q: c.q }, ans: { text: String(c.n), alts: [] } };
      },
    };
  }
  const raw = rawPool(mode, data, opts);
  const deck = makeDeck('race:' + mode, raw);
  return { total: raw.length, next: () => toQuestion(mode, data, deck.next()) };
}

/** Liste de `count` questions (sans répétition d'une partie à l'autre). */
export function buildQuestions(mode, data, count, opts = {}) {
  const src = questionSource(mode, data, opts);
  return Array.from({ length: Math.max(1, count) }, () => src.next());
}

/** Choix du nombre de questions : 0 = sans limite. */
export const COUNT_LABEL = (n) => (n ? String(n) : '∞');

/** Points de l'estimation : le plus proche 300 (+200 si pile), puis 150, puis 75 (ex æquo = mêmes points). */
export function estimPoints(answers, target) {
  const entries = Object.entries(answers).map(([pid, a]) => ({ pid, d: Math.abs(a.v - target) }));
  const dists = [...new Set(entries.map((e) => e.d))].sort((a, b) => a - b);
  const out = {};
  for (const e of entries) {
    const rank = dists.indexOf(e.d);
    out[e.pid] = (rank === 0 ? 300 : rank === 1 ? 150 : rank === 2 ? 75 : 0) + (e.d === 0 ? 200 : 0);
  }
  return out;
}
