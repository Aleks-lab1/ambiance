// Logique commune aux jeux de rapidité (Quiz, Émojis mystères, Anagrammes, À vue de nez),
// utilisée à la fois par la version un seul téléphone et par la version en ligne.
import { shuffle, norm, levenshtein } from './ui.js';

export const RACE_MODES = {
  quiz: { name: 'Le Quiz', emoji: '🧠', short: 'QCM, le plus rapide gagne', colors: ['#5f2c82', '#49a09d'], kicker: 'Question' },
  emoji: { name: 'Émojis mystères', emoji: '🧩', short: 'Devine le film en émojis', colors: ['#f7971e', '#ffd200'], kicker: 'Que cachent ces émojis ?' },
  anag: { name: 'Anagrammes', emoji: '🔀', short: 'Remets les lettres en ordre', colors: ['#1d976c', '#93f9b9'], kicker: 'Retrouve le mot' },
  estim: { name: 'À vue de nez', emoji: '📏', short: 'Le plus proche gagne', colors: ['#e65c00', '#f9d423'], kicker: 'À ton avis…' },
};

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

/**
 * Construit une liste de questions.
 * Renvoie [{ pub, ans }] : pub = ce que voient les joueurs, ans = la solution (gardée par l'hôte).
 */
export function buildQuestions(mode, data, count, opts = {}) {
  let pool;
  if (mode === 'quiz') {
    const themes = new Set(opts.themes && opts.themes.length ? opts.themes : data.themes.map((t) => t.id));
    const tById = Object.fromEntries(data.themes.map((t) => [t.id, t]));
    pool = data.q.filter((q) => themes.has(q[0])).map(([t, q, good, ...bad]) => {
      const opts4 = shuffle([good, ...bad.slice(0, 3)]);
      const th = tById[t];
      return { pub: { q, opts: opts4, theme: th ? `${th.emoji} ${th.name}` : '' }, ans: { i: opts4.indexOf(good), text: good } };
    });
  } else if (mode === 'emoji') {
    pool = data.map(([e, a, cat, alts, keys]) => ({ pub: { e, cat }, ans: { text: a, alts: alts || [], keys: keys || null } }));
  } else if (mode === 'anag') {
    pool = data.map((w) => ({ pub: { s: scramble(w), len: norm(w).replace(/ /g, '').length }, ans: { text: w } }));
  } else {
    pool = data.map(([q, n, unit, note]) => ({ pub: { q, unit }, ans: { n, text: unit ? `${formatNumber(n)} ${unit}` : String(n), note: note || '' } }));
  }
  return shuffle(pool).slice(0, Math.max(1, count));
}

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
