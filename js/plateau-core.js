// Logique des jeux de plateau (sans interface), partagée entre la version locale et la version en ligne.
import { shuffle } from './ui.js';

// =====================================================================
// BATAILLE NAVALE (grille 8 × 8)
// =====================================================================
export const BN = 8;
export const SHIPS = [4, 3, 3, 2, 2];
export const SHIP_NAMES = { 4: 'Croiseur', 3: 'Sous-marin', 2: 'Torpilleur' };

/** Flotte placée au hasard, sans bateaux qui se touchent. */
export function randomFleet() {
  for (let tries = 0; tries < 500; tries++) {
    const taken = new Set();
    const ships = [];
    let ok = true;
    for (const len of SHIPS) {
      let placed = false;
      for (let k = 0; k < 200 && !placed; k++) {
        const hor = Math.random() < 0.5;
        const r = Math.floor(Math.random() * (hor ? BN : BN - len + 1));
        const c = Math.floor(Math.random() * (hor ? BN - len + 1 : BN));
        const cells = Array.from({ length: len }, (_, i) => (hor ? r * BN + c + i : (r + i) * BN + c));
        if (cells.some((i) => taken.has(i))) continue;
        ships.push({ len, cells });
        // On réserve les cases autour pour que les bateaux ne se touchent pas.
        for (const i of cells) for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const rr = Math.floor(i / BN) + dr, cc = (i % BN) + dc;
          if (rr >= 0 && rr < BN && cc >= 0 && cc < BN) taken.add(rr * BN + cc);
        }
        placed = true;
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return ships;
  }
  return [];
}

/** Tire sur la case i. shots = { i: 'miss' | 'hit' | 'sunk' }. Renvoie { res, sunk, all }. */
export function fire(ships, shots, i) {
  const ship = ships.find((s) => s.cells.includes(i));
  if (!ship) { shots[i] = 'miss'; return { res: 'miss' }; }
  shots[i] = 'hit';
  const sunk = ship.cells.every((c) => shots[c] === 'hit' || shots[c] === 'sunk');
  if (sunk) ship.cells.forEach((c) => { shots[c] = 'sunk'; });
  const all = ships.every((s) => s.cells.every((c) => shots[c] === 'sunk'));
  return { res: sunk ? 'sunk' : 'hit', sunk: sunk ? ship.len : 0, all };
}

/** Le téléphone tire : il vise autour des bateaux touchés, sinon au hasard (en damier). */
export function aiShot(shots) {
  const free = (i) => i >= 0 && i < BN * BN && !shots[i];
  const hits = Object.keys(shots).map(Number).filter((i) => shots[i] === 'hit');
  const neigh = (i) => [i - BN, i + BN, (i % BN) ? i - 1 : -1, (i % BN) < BN - 1 ? i + 1 : -1].filter(free);
  if (hits.length >= 2) {
    // Continuer dans l'axe des touches alignées.
    const sameRow = hits.every((i) => Math.floor(i / BN) === Math.floor(hits[0] / BN));
    const sameCol = hits.every((i) => i % BN === hits[0] % BN);
    if (sameRow || sameCol) {
      const lo = Math.min(...hits), hi = Math.max(...hits), step = sameRow ? 1 : BN;
      const ends = [lo - step, hi + step].filter((i) => free(i) && (!sameRow || Math.floor(i / BN) === Math.floor(lo / BN)));
      if (ends.length) return ends[Math.floor(Math.random() * ends.length)];
    }
  }
  for (const i of shuffle(hits.slice())) { const n = neigh(i); if (n.length) return n[Math.floor(Math.random() * n.length)]; }
  const all = Array.from({ length: BN * BN }, (_, i) => i).filter(free);
  const checker = all.filter((i) => (Math.floor(i / BN) + (i % BN)) % 2 === 0);
  const pool = checker.length ? checker : all;
  return pool[Math.floor(Math.random() * pool.length)];
}

// =====================================================================
// MEMORY
// =====================================================================
const MEM_EMOJIS = ['🍕', '🐶', '🦄', '🍩', '🚀', '🌈', '🐙', '🍉', '🎸', '⚽', '🦊', '🍔', '🎈', '🐸', '🌵', '🍒', '🐼', '🎩', '👻', '🍭', '🦖', '🐝', '🍄', '🌻'];
/** Paquet de 2 × n cartes mélangées. */
export function memDeck(pairs) {
  const e = shuffle(MEM_EMOJIS.slice()).slice(0, pairs);
  return shuffle([...e, ...e]);
}

// =====================================================================
// YAM'S
// =====================================================================
export const YAMS_CATS = [
  { id: 'n1', name: 'As (1)', up: 1 }, { id: 'n2', name: 'Deux', up: 2 }, { id: 'n3', name: 'Trois', up: 3 },
  { id: 'n4', name: 'Quatre', up: 4 }, { id: 'n5', name: 'Cinq', up: 5 }, { id: 'n6', name: 'Six', up: 6 },
  { id: 'brelan', name: 'Brelan', hint: '3 dés identiques : total des dés' },
  { id: 'carre', name: 'Carré', hint: '4 dés identiques : total des dés' },
  { id: 'full', name: 'Full', hint: 'Brelan + paire : 25' },
  { id: 'petite', name: 'Petite suite', hint: '4 dés qui se suivent : 30' },
  { id: 'grande', name: 'Grande suite', hint: '5 dés qui se suivent : 40' },
  { id: 'yams', name: 'Yam\'s', hint: '5 dés identiques : 50' },
  { id: 'chance', name: 'Chance', hint: 'Total des dés' },
];
const sum = (d) => d.reduce((a, b) => a + b, 0);
export function yamsScore(cat, dice) {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  dice.forEach((v) => counts[v]++);
  const max = Math.max(...counts);
  const has = (seq) => seq.every((v) => counts[v] > 0);
  const c = YAMS_CATS.find((x) => x.id === cat);
  if (c.up) return counts[c.up] * c.up;
  switch (cat) {
    case 'brelan': return max >= 3 ? sum(dice) : 0;
    case 'carre': return max >= 4 ? sum(dice) : 0;
    case 'full': return counts.includes(3) && counts.includes(2) ? 25 : 0;
    case 'petite': return has([1, 2, 3, 4]) || has([2, 3, 4, 5]) || has([3, 4, 5, 6]) ? 30 : 0;
    case 'grande': return has([1, 2, 3, 4, 5]) || has([2, 3, 4, 5, 6]) ? 40 : 0;
    case 'yams': return max === 5 ? 50 : 0;
    default: return sum(dice);
  }
}
/** Totaux d'une feuille { catId: points }. */
export function yamsTotals(sheet) {
  const upper = YAMS_CATS.filter((c) => c.up).reduce((a, c) => a + (sheet[c.id] || 0), 0);
  const bonus = upper >= 63 ? 35 : 0;
  const lower = YAMS_CATS.filter((c) => !c.up).reduce((a, c) => a + (sheet[c.id] || 0), 0);
  return { upper, bonus, lower, total: upper + bonus + lower };
}
export const rollDie = () => 1 + Math.floor(Math.random() * 6);
