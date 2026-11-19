// Le Bon Mot : dictionnaire et tirage des lettres (logique pure, sans interface).

/** Forme comparable d'un mot : minuscules, sans accents, lettres uniquement (« Éléphant » → « elephant »). */
export function normWord(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z]/g, '');
}

/** Décode la liste « front coding » de data/mots.js en tableau trié. */
export function decodeDico(s) {
  const out = [];
  let prev = '';
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s.charCodeAt(i);
    // Repère : 0-9 puis A-Z = nombre de lettres communes avec le mot précédent.
    const p = c >= 48 && c <= 57 ? c - 48 : c >= 65 && c <= 90 ? c - 55 : -1;
    i++;
    if (p < 0) continue; // retour à la ligne
    let j = i;
    while (j < n) { const d = s.charCodeAt(j); if (d < 97 || d > 122) break; j++; }
    const w = prev.slice(0, p) + s.slice(i, j);
    out.push(w);
    prev = w;
    i = j;
  }
  return out;
}

// Nombre minimal de mots courants pour qu'un tirage soit jouable.
const MIN_COMMON = {
  start: { 1: 50, 2: 25, 3: 12 },
  in: { 1: 300, 2: 80, 3: 40 },
};

/** Les lettres imposées sont-elles respectées ? (mot et lettres déjà normalisés) */
export function fits(word, letters, pos = 'start') {
  return pos === 'in' ? word.includes(letters) : word.startsWith(letters);
}

/** Longueur minimale d'un mot : 3 lettres, et toujours plus long que les lettres imposées. */
export function minLength(letters) {
  return Math.max(3, letters.length + 1);
}

// Exemples faciles pour les lettres rares, peu présentes dans les mots courants.
const RARE = {
  k: ['kiwi', 'koala', 'karaté', 'kayak', 'kilo', 'ketchup'],
  w: ['wagon', 'western', 'whisky', 'week-end', 'wifi'],
  x: ['xylophone', 'xénophobe', 'xérès'],
  y: ['yaourt', 'yeux', 'yoga', 'yacht', 'yoyo'],
  z: ['zèbre', 'zoo', 'zéro', 'zone', 'zut'],
};

export function makeDico({ DICO, COMMUNS }) {
  const words = decodeDico(DICO);
  const common = COMMUNS.split(/\s+/).filter(Boolean).map((w) => ({ w, n: normWord(w) }));

  function lowerBound(x) {
    let lo = 0, hi = words.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (words[m] < x) lo = m + 1; else hi = m; }
    return lo;
  }

  /** Le mot (normalisé) existe-t-il ? */
  function has(n) { return words[lowerBound(n)] === n; }

  /** Mots du dictionnaire qui commencent par `prefix` (au plus `max`), hors `exclude`. */
  function withPrefix(prefix, { max = Infinity, exclude, minLen = minLength(prefix) } = {}) {
    const out = [];
    for (let i = lowerBound(prefix); i < words.length && words[i].startsWith(prefix) && out.length < max; i++) {
      const w = words[i];
      if (w.length >= minLen && !(exclude && exclude.has(w))) out.push(w);
    }
    return out;
  }

  // Tirages possibles pour chaque position et longueur, calculés à la demande.
  const cache = new Map();
  function candidates(pos, len) {
    const key = pos + len;
    if (cache.has(key)) return cache.get(key);
    const count = new Map();
    for (const { n } of common) {
      if (n.length <= len) continue;
      const subs = new Set();
      if (pos === 'in') for (let i = 0; i + len <= n.length; i++) subs.add(n.slice(i, i + len));
      else subs.add(n.slice(0, len));
      for (const s of subs) count.set(s, (count.get(s) || 0) + 1);
    }
    const min = MIN_COMMON[pos][len];
    const list = [...count].filter(([, c]) => c >= min).map(([s, c]) => ({ s, w: Math.sqrt(c) }));
    cache.set(key, list);
    return list;
  }

  /** Tire des lettres au hasard (les plus faciles un peu plus souvent), en évitant `recent`. */
  function draw(pos, len, recent = [], rnd = Math.random) {
    let list = candidates(pos, len).filter((c) => !recent.includes(c.s));
    if (!list.length) list = candidates(pos, len);
    let r = rnd() * list.reduce((a, c) => a + c.w, 0);
    for (const c of list) { r -= c.w; if (r <= 0) return c.s; }
    return list[list.length - 1].s;
  }

  /** Quelques mots courants qui convenaient (pour montrer ce qu'on aurait pu dire). */
  function examples(letters, pos, used, k = 3, rnd = Math.random) {
    const mix = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const min = minLength(letters);
    const pool = [];
    for (const c of common) {
      if (c.n.length >= min && fits(c.n, letters, pos) && !used.has(c.n)) pool.push(c.w);
      if (pool.length >= 40) break;
    }
    mix(pool);
    if (pool.length < k && pos === 'start') {
      // Lettres rares (X, Y, W…) : quelques mots connus, sinon les plus courts du dictionnaire.
      const easy = mix((RARE[letters[0]] || []).filter((w) => fits(normWord(w), letters) && !used.has(normWord(w))));
      const more = withPrefix(letters, { max: 400, exclude: used }).sort((a, b) => a.length - b.length);
      for (const w of [...easy, ...more]) {
        if (pool.length >= k) break;
        if (!pool.some((p) => normWord(p) === normWord(w))) pool.push(w);
      }
    }
    return pool.slice(0, k);
  }

  /**
   * Mots en chaîne : lettres que le mot suivant doit reprendre.
   * On garde les `k` dernières lettres, ou moins si presque aucun mot ne commence ainsi.
   */
  function chainLetters(word, k, used) {
    for (let len = Math.min(k, word.length); len >= 1; len--) {
      const s = word.slice(-len);
      if (len === 1 || withPrefix(s, { max: 5, exclude: used }).length >= 5) return { letters: s, reduced: len < k };
    }
    return { letters: word.slice(-1), reduced: k > 1 };
  }

  /** Lettre de départ au hasard (parmi les lettres courantes). */
  function randomStart(rnd = Math.random) { return draw('start', 1, [], rnd); }

  return { size: words.length, has, withPrefix, candidates, draw, examples, chainLetters, randomStart };
}

// Le dictionnaire (1,7 Mo) n'est chargé et décodé qu'une fois, en local comme en ligne.
let dicoP = null;
export const loadDico = () => (dicoP ||= import('./data/mots.js').then(makeDico).catch((e) => { dicoP = null; throw e; }));
