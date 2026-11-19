// Morpion et 4 à la suite : à deux sur le même téléphone, ou contre le téléphone.
import { h, topbar, seg } from '../ui.js';
import { get, set, getPlayers, sip } from '../store.js';
import { sfx, buzz } from '../sfx.js';

const SYM = ['❌', '⭕'];

// ---------------- Morpion ----------------
const LINES3 = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
function win3(b) {
  for (const l of LINES3) if (b[l[0]] !== null && b[l[0]] === b[l[1]] && b[l[1]] === b[l[2]]) return { p: b[l[0]], cells: l };
  return b.every((x) => x !== null) ? { p: -1, cells: [] } : null;
}
function minimax(b, me, turn, depth = 0) {
  const w = win3(b);
  if (w) return w.p === -1 ? 0 : w.p === me ? 10 - depth : depth - 10;
  let best = turn === me ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (b[i] !== null) continue;
    b[i] = turn;
    const v = minimax(b, me, 1 - turn, depth + 1);
    b[i] = null;
    best = turn === me ? Math.max(best, v) : Math.min(best, v);
  }
  return best;
}
function ai3(b, me, level) {
  const free = b.map((x, i) => (x === null ? i : -1)).filter((i) => i >= 0);
  if (level === 'facile' && Math.random() < 0.45) return free[Math.floor(Math.random() * free.length)];
  let best = -Infinity, moves = [];
  for (const i of free) {
    b[i] = me;
    const v = minimax(b, me, 1 - me);
    b[i] = null;
    if (v > best) { best = v; moves = [i]; } else if (v === best) moves.push(i);
  }
  return moves[Math.floor(Math.random() * moves.length)];
}

// ---------------- 4 à la suite ----------------
const W = 7, H = 6;
function drop(b, col) { for (let r = H - 1; r >= 0; r--) if (b[r * W + col] === null) return r * W + col; return -1; }
function win4(b) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const p = b[r * W + c];
    if (p === null) continue;
    for (const [dr, dc] of dirs) {
      const cells = [];
      for (let k = 0; k < 4; k++) {
        const rr = r + dr * k, cc = c + dc * k;
        if (rr < 0 || rr >= H || cc < 0 || cc >= W || b[rr * W + cc] !== p) break;
        cells.push(rr * W + cc);
      }
      if (cells.length === 4) return { p, cells };
    }
  }
  return b.every((x) => x !== null) ? { p: -1, cells: [] } : null;
}
function heur(b, me) {
  // Compte les fenêtres de 4 favorables, et préfère le centre.
  let s = 0;
  for (let r = 0; r < H; r++) if (b[r * W + 3] === me) s += 3;
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) for (const [dr, dc] of dirs) {
    let mine = 0, his = 0, ok = true;
    for (let k = 0; k < 4; k++) {
      const rr = r + dr * k, cc = c + dc * k;
      if (rr < 0 || rr >= H || cc < 0 || cc >= W) { ok = false; break; }
      const v = b[rr * W + cc];
      if (v === me) mine++; else if (v !== null) his++;
    }
    if (!ok || (mine && his)) continue;
    s += mine === 3 ? 6 : mine === 2 ? 2 : 0;
    s -= his === 3 ? 8 : his === 2 ? 2 : 0;
  }
  return s;
}
function ai4(b, me, level) {
  const cols = [3, 2, 4, 1, 5, 0, 6].filter((c) => drop(b, c) >= 0);
  const tryMove = (c, p) => { const i = drop(b, c); b[i] = p; const w = win4(b); b[i] = null; return w && w.p === p; };
  for (const c of cols) if (tryMove(c, me)) return c;           // gagner
  for (const c of cols) if (tryMove(c, 1 - me)) return c;       // bloquer
  if (level === 'facile' && Math.random() < 0.4) return cols[Math.floor(Math.random() * cols.length)];
  let best = -Infinity, pickC = cols[0];
  for (const c of cols) {
    const i = drop(b, c); b[i] = me;
    // Ne pas offrir une victoire juste au-dessus.
    const giveaway = [0, 1, 2, 3, 4, 5, 6].some((c2) => drop(b, c2) >= 0 && tryMove(c2, 1 - me));
    const v = heur(b, me) - (giveaway ? 1000 : 0) + Math.random();
    b[i] = null;
    if (v > best) { best = v; pickC = c; }
  }
  return pickC;
}

export function start(ctx) {
  const { root, meta } = ctx;
  const opts = Object.assign({ game: 'morpion', vs: 'deux', level: 'normal' }, get('morpion', {}));
  const save = () => set('morpion', opts);
  let timers = [];
  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  const scores = [0, 0];
  let first = 0;

  function names() {
    if (opts.vs === 'ia') return ['Toi', '📱 Téléphone'];
    const l = getPlayers();
    return [l[0] || 'Joueur 1', l[1] || 'Joueur 2'];
  }

  function setup() {
    clear();
    const box = h('div', { class: 'col' });
    const render = () => box.replaceChildren(
      h('label', { class: 'field' }, 'Jeu', seg([{ value: 'morpion', label: '❌⭕ Morpion' }, { value: 'quatre', label: '🔴🟡 4 à la suite' }], opts.game, (v) => { opts.game = v; save(); })),
      h('label', { class: 'field' }, 'Adversaire', seg([{ value: 'deux', label: '👥 À deux' }, { value: 'ia', label: '📱 Le téléphone' }], opts.vs, (v) => { opts.vs = v; save(); render(); })),
      opts.vs === 'ia' ? h('label', { class: 'field' }, 'Niveau du téléphone', seg([{ value: 'facile', label: '😌 Facile' }, { value: 'normal', label: '😤 Coriace' }], opts.level, (v) => { opts.level = v; save(); })) : null,
      opts.vs === 'deux' ? h('p', { class: 'muted small' }, `Joueurs : ${names().join(' contre ')} (les deux premiers de la liste des joueurs).`) : null);
    render();
    root.replaceChildren(topbar(ctx),
      h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
      box, h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => { scores[0] = scores[1] = 0; first = 0; play(); } }, '▶ Jouer'));
  }

  function play() {
    clear();
    const quatre = opts.game === 'quatre';
    const N = names();
    const b = Array(quatre ? W * H : 9).fill(null);
    let turn = first;
    let over = false;
    const status = h('h2', { class: 'center' });
    const score = h('p', { class: 'center muted' });
    const cells = b.map((_, i) => h('button', { class: quatre ? 'c4-cell' : 'ttt-cell', 'aria-label': `Case ${i + 1}`, onclick: () => human(quatre ? i % W : i) }));
    const board = h('div', { class: quatre ? 'c4-board' : 'ttt-board' }, cells);
    const after = h('div', { class: 'col' });
    root.replaceChildren(topbar(ctx, { onBack: setup }), status, score, board, h('div', { class: 'grow' }), after);

    const isAI = (p) => opts.vs === 'ia' && p === 1;
    function info() {
      score.textContent = `${N[0]} ${scores[0]} – ${scores[1]} ${N[1]}`;
      if (!over) status.textContent = `${quatre ? (turn ? '🟡' : '🔴') : SYM[turn]} ${isAI(turn) ? 'Le téléphone réfléchit…' : `À ${N[turn] === 'Toi' ? 'toi' : N[turn]} de jouer`}`;
    }
    function place(i) {
      b[i] = turn;
      cells[i].textContent = quatre ? '' : SYM[turn];
      cells[i].classList.add(quatre ? (turn ? 'p1' : 'p0') : 'on', 'pop');
      sfx.pop(); buzz(10);
      const w = quatre ? win4(b) : win3(b);
      if (w) { end(w); return; }
      turn = 1 - turn;
      info();
      if (isAI(turn)) timers.push(setTimeout(aiMove, 450));
    }
    function human(x) {
      if (over || isAI(turn)) return;
      const i = quatre ? drop(b, x) : (b[x] === null ? x : -1);
      if (i < 0) return;
      place(i);
    }
    function aiMove() {
      if (over || !root.isConnected) return;
      const lvl = opts.level;
      const i = quatre ? drop(b, ai4(b, 1, lvl)) : ai3(b, 1, lvl);
      place(i);
    }
    function end(w) {
      over = true;
      w.cells.forEach((i) => cells[i].classList.add('win'));
      if (w.p === -1) { status.textContent = '🤝 Match nul !'; sfx.swoosh(); }
      else {
        scores[w.p]++;
        const loser = N[1 - w.p];
        status.textContent = `🏆 ${N[w.p] === 'Toi' ? 'Tu as gagné' : N[w.p] + ' gagne'} !`;
        if (isAI(w.p)) sfx.bad(); else sfx.fanfare();
        buzz([40, 30, 120]);
        score.dataset.extra = `${loser === 'Toi' ? 'Tu prends' : loser + ' prend'} ${sip(1)}.`;
      }
      info();
      if (w.p !== -1) score.textContent += ` · ${score.dataset.extra}`;
      first = 1 - first; // on alterne qui commence
      after.replaceChildren(h('div', { class: 'row' },
        h('button', { class: 'btn btn-soft grow', onclick: setup }, 'Réglages'),
        h('button', { class: 'btn btn-primary grow', onclick: play }, '🔁 Revanche')));
    }
    info();
    if (isAI(turn)) timers.push(setTimeout(aiMove, 600));
  }

  setup();
  return clear;
}
