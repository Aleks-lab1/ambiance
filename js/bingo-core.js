// Bingo : construction des grilles, détection des lignes, affichage de la grille.
import { h, shuffle } from './ui.js';

export const FREE = 12; // case centrale offerte

/** 24 situations tirées au hasard parmi `count`. */
export function newCard(count) {
  return shuffle(Array.from({ length: count }, (_, i) => i)).slice(0, 24);
}

/** Texte de la case n° pos (0..24) d'une grille. */
export function cellText(card, list, pos) {
  if (pos === FREE) return '⭐ Case offerte';
  return list[card[pos < FREE ? pos : pos - 1]];
}

const LINES = [
  ...[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => r * 5 + c)),
  ...[0, 1, 2, 3, 4].map((c) => [0, 1, 2, 3, 4].map((r) => r * 5 + c)),
  [0, 6, 12, 18, 24], [4, 8, 12, 16, 20],
];

/** Lignes complètes (indices de LINES) pour un ensemble de cases cochées. */
export function completeLines(marks) {
  const m = new Set([...marks, FREE]);
  return LINES.map((l, i) => (l.every((p) => m.has(p)) ? i : -1)).filter((i) => i >= 0);
}
export function lineCells(i) { return LINES[i]; }
export function isFull(marks) { return new Set([...marks, FREE]).size >= 25; }

/** Grille cliquable. */
export function gridEl({ card, list, marks, onToggle, highlight = [] }) {
  const m = new Set(marks);
  const hl = new Set(highlight);
  return h('div', { class: 'bingo-grid' }, Array.from({ length: 25 }, (_, pos) => h('button', {
    class: 'bingo-cell' + (pos === FREE || m.has(pos) ? ' on' : '') + (pos === FREE ? ' free' : '') + (hl.has(pos) ? ' hl' : ''),
    disabled: pos === FREE,
    onclick: () => onToggle(pos),
  }, cellText(card, list, pos))));
}
