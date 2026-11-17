// Planche à dessin synchronisable : toutes les actions sont des « ops » rejouables.
// Coordonnées logiques entières sur 800×600, identiques sur tous les écrans.
import { h } from './ui.js';

export const W = 800;
export const H = 600;

export const COLORS = ['#111111', '#7a7a7a', '#ffffff', '#e53935', '#ff7a1a', '#ffd23f', '#43a047', '#1fb5ad', '#1e63d6', '#6b3fd1', '#e84aa3', '#8b5a2b'];
export const SIZES = [4, 9, 18, 36];

/** Applique une op au journal (côté hôte, sans dessin). */
export function applyToLog(log, op) {
  switch (op.k) {
    case 's': log.push({ k: 's', id: op.id, c: op.c, w: op.w, p: op.p.slice(0, 2) }); break;
    case 'a': {
      for (let i = log.length - 1; i >= 0; i--) {
        if (log[i].k === 's' && log[i].id === op.id) { log[i].p.push(...op.p); break; }
      }
      break;
    }
    case 'f': log.push({ k: 'f', x: op.x, y: op.y, c: op.c }); break;
    case 'u': log.pop(); break;
    case 'c': log.length = 0; break;
    default: break;
  }
}

export function validOp(op) {
  if (!op || typeof op !== 'object') return false;
  const num = (v) => Number.isFinite(v);
  const col = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
  switch (op.k) {
    case 's': return num(op.id) && col(op.c) && num(op.w) && op.w > 0 && op.w <= 60 && Array.isArray(op.p) && op.p.length === 2 && op.p.every(num);
    case 'a': return num(op.id) && Array.isArray(op.p) && op.p.length <= 400 && op.p.length % 2 === 0 && op.p.every(num);
    case 'f': return num(op.x) && num(op.y) && col(op.c);
    case 'u': case 'c': return true;
    default: return false;
  }
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function floodFill(g, x, y, color) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  const [r, gg, b] = hexToRgb(color);
  const i0 = (y * W + x) * 4;
  const tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2];
  if (Math.abs(tr - r) + Math.abs(tg - gg) + Math.abs(tb - b) < 8) return;
  const tol = 90;
  const seen = new Uint8Array(W * H);
  const match = (idx) => {
    const j = idx * 4;
    return Math.abs(d[j] - tr) + Math.abs(d[j + 1] - tg) + Math.abs(d[j + 2] - tb) <= tol;
  };
  const stack = [x, y];
  while (stack.length) {
    const py = stack.pop();
    let px = stack.pop();
    let idx = py * W + px;
    while (px >= 0 && !seen[idx] && match(idx)) { px--; idx--; }
    px++; idx++;
    let up = false, down = false;
    while (px < W && !seen[idx] && match(idx)) {
      seen[idx] = 1;
      const j = idx * 4;
      d[j] = r; d[j + 1] = gg; d[j + 2] = b; d[j + 3] = 255;
      if (py > 0) {
        const u = idx - W;
        if (!seen[u] && match(u)) { if (!up) { stack.push(px, py - 1); up = true; } } else up = false;
      }
      if (py < H - 1) {
        const dn = idx + W;
        if (!seen[dn] && match(dn)) { if (!down) { stack.push(px, py + 1); down = true; } } else down = false;
      }
      px++; idx++;
    }
  }
  // Petit débordement d'1 px pour couvrir l'anticrénelage des bords.
  for (let yy = 1; yy < H - 1; yy++) {
    for (let xx = 1; xx < W - 1; xx++) {
      const k = yy * W + xx;
      if (seen[k]) continue;
      if (seen[k - 1] || seen[k + 1] || seen[k - W] || seen[k + W]) {
        const j = k * 4;
        const dist = Math.abs(d[j] - tr) + Math.abs(d[j + 1] - tg) + Math.abs(d[j + 2] - tb);
        if (dist <= 260) { d[j] = r; d[j + 1] = gg; d[j + 2] = b; }
      }
    }
  }
  g.putImageData(img, 0, 0);
}

/**
 * Crée une planche.
 * onOp(op) est appelé pour chaque action locale à diffuser.
 */
export function createBoard({ editable = false, onOp = () => {} } = {}) {
  const cv = h('canvas', { class: 'board', width: W, height: H });
  const g = cv.getContext('2d', { willReadFrequently: true });
  const wrap = h('div', { class: 'board-wrap' + (editable ? '' : ' locked') }, cv);
  let log = [];
  const tool = { c: COLORS[0], w: SIZES[1], mode: 'pen' };
  let enabled = editable;

  function clear() { g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); }
  clear();

  function drawStroke(st, from = 0) {
    const p = st.p;
    g.strokeStyle = st.c; g.fillStyle = st.c; g.lineWidth = st.w; g.lineCap = 'round'; g.lineJoin = 'round';
    if (p.length === 2) {
      g.beginPath(); g.arc(p[0], p[1], st.w / 2, 0, Math.PI * 2); g.fill();
      return;
    }
    const s = Math.max(0, from - 2);
    g.beginPath();
    g.moveTo(p[s], p[s + 1]);
    for (let i = s + 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
    g.stroke();
  }
  function redraw() {
    clear();
    for (const a of log) {
      if (a.k === 's') drawStroke(a);
      else if (a.k === 'f') floodFill(g, a.x, a.y, a.c);
    }
  }
  function apply(op) {
    switch (op.k) {
      case 'full':
        log = (op.log || []).map((a) => (a.k === 's' ? { ...a, p: a.p.slice() } : { ...a }));
        redraw();
        break;
      case 's': { const st = { k: 's', id: op.id, c: op.c, w: op.w, p: op.p.slice(0, 2) }; log.push(st); drawStroke(st); break; }
      case 'a': {
        let st = null;
        for (let i = log.length - 1; i >= 0; i--) if (log[i].k === 's' && log[i].id === op.id) { st = log[i]; break; }
        if (st) { const from = st.p.length; st.p.push(...op.p); drawStroke(st, from); }
        break;
      }
      case 'f': log.push({ k: 'f', x: op.x, y: op.y, c: op.c }); floodFill(g, op.x, op.y, op.c); break;
      case 'u': log.pop(); redraw(); break;
      case 'c': log = []; clear(); break;
      default: break;
    }
  }

  // ---- Saisie ----
  let cur = null;
  let buf = [];
  let flushTimer = null;
  let last = null;
  const flush = () => {
    clearTimeout(flushTimer); flushTimer = null;
    if (cur && buf.length) { onOp({ k: 'a', id: cur, p: buf }); buf = []; }
  };
  const pos = (e) => {
    const r = cv.getBoundingClientRect();
    return [
      Math.max(0, Math.min(W, Math.round((e.clientX - r.left) / r.width * W))),
      Math.max(0, Math.min(H, Math.round((e.clientY - r.top) / r.height * H))),
    ];
  };
  cv.addEventListener('pointerdown', (e) => {
    if (!enabled) return;
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const [x, y] = pos(e);
    if (tool.mode === 'fill') {
      const op = { k: 'f', x, y, c: tool.c };
      apply(op); onOp(op);
      return;
    }
    cur = Math.floor(Math.random() * 1e9);
    last = [x, y];
    const op = { k: 's', id: cur, c: tool.mode === 'eraser' ? '#ffffff' : tool.c, w: tool.mode === 'eraser' ? Math.max(tool.w, 18) : tool.w, p: [x, y] };
    apply(op); onOp(op);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!cur || !enabled) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const pts = [];
    for (const ev of (evs.length ? evs : [e])) {
      const [x, y] = pos(ev);
      if (last && Math.abs(x - last[0]) + Math.abs(y - last[1]) < 3) continue;
      last = [x, y];
      pts.push(x, y);
    }
    if (!pts.length) return;
    apply({ k: 'a', id: cur, p: pts });
    buf.push(...pts);
    if (buf.length > 300) flush();
    else if (!flushTimer) flushTimer = setTimeout(flush, 45);
  });
  const end = () => { if (cur) { flush(); cur = null; last = null; } };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('lostpointercapture', end);

  return {
    el: wrap,
    canvas: cv,
    apply,
    tool,
    get log() { return log; },
    setEditable(v) { enabled = v; wrap.classList.toggle('locked', !v); if (!v) end(); },
    undo() { const op = { k: 'u' }; apply(op); onOp(op); },
    clearAll() { const op = { k: 'c' }; apply(op); onOp(op); },
  };
}

/** Barre d'outils pour le dessinateur. */
export function createTools(board) {
  const t = board.tool;
  const colorsRow = h('div', { class: 'tool-row' });
  const toolsRow = h('div', { class: 'tool-row' });
  function render() {
    colorsRow.replaceChildren(...COLORS.map((c) => h('button', {
      class: 'swatch' + (t.c === c && t.mode !== 'eraser' ? ' on' : ''), style: { background: c }, 'aria-label': 'Couleur ' + c,
      onclick: () => { t.c = c; if (t.mode === 'eraser') t.mode = 'pen'; render(); },
    })));
    toolsRow.replaceChildren(
      ...SIZES.map((s) => h('button', { class: 'size-btn' + (t.w === s ? ' on' : ''), 'aria-label': 'Taille ' + s, onclick: () => { t.w = s; if (t.mode === 'fill') t.mode = 'pen'; render(); } },
        h('i', { style: { width: Math.min(26, s * 0.7 + 3) + 'px', height: Math.min(26, s * 0.7 + 3) + 'px' } }))),
      h('button', { class: 'tool-btn' + (t.mode === 'pen' ? ' on' : ''), 'aria-label': 'Crayon', onclick: () => { t.mode = 'pen'; render(); } }, '✏️'),
      h('button', { class: 'tool-btn' + (t.mode === 'fill' ? ' on' : ''), 'aria-label': 'Pot de peinture', onclick: () => { t.mode = 'fill'; render(); } }, '🪣'),
      h('button', { class: 'tool-btn' + (t.mode === 'eraser' ? ' on' : ''), 'aria-label': 'Gomme', onclick: () => { t.mode = 'eraser'; render(); } }, '🧽'),
      h('button', { class: 'tool-btn', 'aria-label': 'Annuler', onclick: () => board.undo() }, '↩️'),
      h('button', { class: 'tool-btn', 'aria-label': 'Tout effacer', onclick: () => board.clearAll() }, '🗑️'),
    );
  }
  render();
  return h('div', { class: 'tools' }, colorsRow, toolsRow);
}
