// Plateaux animés du Morpion et du 4 en ligne, partagés par le jeu sur un seul téléphone (js/games/morpion.js)
// et le jeu en ligne (js/online/mots.js).
//  - 4 en ligne : une main tient le jeton au-dessus du plateau. On touche une colonne (ou on y glisse le doigt) :
//    la main s'y place, enfonce le jeton dans la fente et le lâche. Il tombe derrière la façade (on le voit passer
//    par les trous) jusqu'à sa place, et rebondit. Nouvelle partie : les jetons tombent par le bas du plateau.
//  - Morpion : la grille, les croix et les ronds se dessinent au feutre, un trait barre la ligne gagnante.
import { h } from './ui.js';
import { sfx, buzz } from './sfx.js';

export const C4_W = 7, C4_H = 6;
// Géométrie du dessin (unités du SVG) : cases de 100, cadre de 30, jetons de 86, trous de 37 de rayon.
const CELL = 100, PAD = 30, D = 86, HOLE = 37, SKY = 150, FEET = 40;
const BW = C4_W * CELL + 2 * PAD, BH = C4_H * CELL + 2 * PAD, TH = SKY + BH + FEET;
const pc = (v, t) => `${(v / t) * 100}%`;
const cx = (c) => PAD + c * CELL + CELL / 2;
const cy = (r) => PAD + r * CELL + CELL / 2;
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Attend la fin d'une animation (avec une sécurité si le navigateur ne la termine pas). */
const done = (a, ms) => Promise.race([a && a.finished ? a.finished.catch(() => {}) : wait(ms), wait(ms + 80)]);
let svgN = 0;

/** Façade du plateau : plastique percé de 42 trous, avec reliefs et ombres (les jetons passent derrière). */
function c4Face() {
  const id = 'c4f' + (++svgN);
  let holes = '', rims = '';
  for (let r = 0; r < C4_H; r++) {
    for (let c = 0; c < C4_W; c++) {
      holes += `<circle cx="${cx(c)}" cy="${cy(r)}" r="${HOLE}"/>`;
      rims += `<circle cx="${cx(c)}" cy="${cy(r)}" r="${HOLE + 3}"/>`;
    }
  }
  let slots = '';
  for (let c = 0; c < C4_W; c++) slots += `<rect x="${cx(c) - D / 2 - 2}" y="-1" width="${D + 4}" height="9" rx="4.5"/>`;
  return `<svg class="c4-face" viewBox="0 0 ${BW} ${BH}" preserveAspectRatio="none" aria-hidden="true">
<defs>
<mask id="${id}m"><rect width="${BW}" height="${BH}" fill="#fff"/><g fill="#000">${holes}</g></mask>
<linearGradient id="${id}g" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#4f7dff"/><stop offset=".55" stop-color="#2450e0"/><stop offset="1" stop-color="#1a3bb0"/></linearGradient>
<linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>
<radialGradient id="${id}s" cx=".5" cy=".64" r=".6"><stop offset=".7" stop-color="#06123d" stop-opacity="0"/><stop offset="1" stop-color="#06123d" stop-opacity=".55"/></radialGradient>
<linearGradient id="${id}l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>
<g mask="url(#${id}m)">
<rect width="${BW}" height="${BH}" rx="34" fill="url(#${id}g)"/>
<rect width="${BW}" height="${BH}" rx="34" fill="url(#${id}l)"/>
<g fill="none" stroke="url(#${id}r)" stroke-width="7">${rims}</g>
<rect x="4" y="4" width="${BW - 8}" height="${BH - 8}" rx="30" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="4"/>
<rect x="1.5" y="1.5" width="${BW - 3}" height="${BH - 3}" rx="33" fill="none" stroke="#0b2475" stroke-opacity=".6" stroke-width="3"/>
<g fill="#0b2475" fill-opacity=".55">${slots}</g>
</g>
<g fill="url(#${id}s)">${holes}</g>
</svg>`;
}

/**
 * Plateau de 4 en ligne animé.
 * onPick(colonne) : le joueur a choisi une colonne (toucher, ou glisser le doigt puis lâcher).
 * → { el, setTurn(joueur, peutJouer), drop(case, joueur) (promesse), set(plateau), win(cases), clear() (promesse), nope() }
 */
export function c4View({ onPick = null } = {}) {
  const cells = Array(C4_W * C4_H).fill(null);
  const discs = h('div', { class: 'c4-discs' });
  const line = h('div', { class: 'c4-line' });
  const board = h('div', { class: 'c4-board', style: { top: pc(SKY, TH), height: pc(BH, TH) } }, discs, h('div', { class: 'c4-face-wrap', html: c4Face() }), line);
  const held = h('div', { class: 'c4-disc c4-held gone', style: { width: pc(D, BW) } });
  const hand = h('div', { class: 'c4-hand', style: { width: pc(D, BW) } }, h('img', { src: 'img/ui/main.webp', alt: '', draggable: 'false' }));
  const cols = h('div', { class: 'c4-cols', style: { height: pc(SKY + BH, TH) } }, Array.from({ length: C4_W }, (_, c) => h('button', {
    class: 'c4-col', 'aria-label': `Colonne ${c + 1}`, onclick: (e) => { if (e.detail === 0) pick(c); }, // clavier
  })));
  const el = h('div', { class: 'c4', style: { aspectRatio: `${BW} / ${TH}` } },
    h('div', { class: 'c4-feet', style: { top: pc(SKY + BH - 12, TH) } }, h('i'), h('i')), board, held, hand, cols);
  let col = 3, turn = 0, canPlay = false, busy = false, track = null, raised = true;

  // Position de la main et du jeton tenu (en % du cadre complet). lift : hauteur au-dessus de la fente.
  const HELD_Y = SKY - D - 14, IN_Y = SKY - D / 2 - 6;
  function place(c, y = HELD_Y, ms = 0) {
    for (const x of [held, hand]) {
      x.style.transitionDuration = ms + 'ms';
      x.style.left = pc(cx(c) - D / 2, BW);
      x.style.top = pc(y, TH);
    }
  }
  place(col);
  function goTo(c, speed = 1) {
    if (c === col && raised) return Promise.resolve();
    const ms = still() ? 0 : Math.round((110 + 45 * Math.abs(c - col)) * speed);
    col = c; raised = true;
    place(c, HELD_Y, ms);
    return wait(ms);
  }

  function setTurn(p, mine) {
    turn = p; canPlay = !!mine;
    el.classList.toggle('mine', canPlay);
    held.classList.remove('p0', 'p1'); held.classList.add('p' + p);
    hand.classList.remove('release');
    if (held.classList.contains('gone')) {
      held.classList.remove('gone');
      if (!still() && held.animate) held.animate([{ transform: 'translateY(-30%) scale(.5)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.3, 1.5, .5, 1)' });
    }
    if (!raised) { raised = true; place(col, HELD_Y, 180); }
  }

  const discEl = (i, p) => h('div', { class: `c4-disc p${p}`, style: { width: pc(D, BW), left: pc(cx(i % C4_W) - D / 2, BW), top: pc(cy(Math.floor(i / C4_W)) - D / 2, BH) } });

  /** Fait tomber le jeton du joueur p jusqu'à la case i (la main se déplace d'abord au-dessus de la colonne). */
  async function drop(i, p) {
    if (cells[i]) return;
    const d = discEl(i, p);
    cells[i] = d;
    if (still() || !d.animate) { discs.append(d); sfx.clack(); return; }
    busy = true;
    el.classList.add('busy');
    held.classList.remove('p0', 'p1', 'gone'); held.classList.add('p' + p);
    await goTo(i % C4_W);
    // La main enfonce le jeton dans la fente…
    place(col, IN_Y, 130);
    raised = false;
    await wait(140);
    // … et le lâche : il tombe derrière la façade, puis rebondit.
    discs.append(d);
    const a = held.getBoundingClientRect(), b = d.getBoundingClientRect();
    const dy = a.top - b.top;
    held.classList.add('gone');
    hand.classList.add('release');
    const cell = (b.height / D) * CELL;
    const fall = Math.max(0.3, -dy / cell);
    const tFall = Math.round(125 * Math.sqrt(fall) + 30), tB1 = 160, tB2 = 100, tot = tFall + tB1 + tB2;
    const b1 = Math.min(0.2, 0.06 + fall * 0.025) * cell;
    const k = d.animate([
      { transform: `translateY(${dy}px)`, easing: 'cubic-bezier(.11, 0, .5, 0)' },
      { transform: 'translateY(0)', offset: tFall / tot, easing: 'cubic-bezier(.25, .8, .5, 1)' },
      { transform: `translateY(${-b1}px)`, offset: (tFall + tB1 / 2) / tot, easing: 'cubic-bezier(.5, 0, .75, .4)' },
      { transform: 'translateY(0)', offset: (tFall + tB1) / tot, easing: 'cubic-bezier(.25, .8, .5, 1)' },
      { transform: `translateY(${-b1 * 0.28}px)`, offset: (tFall + tB1 + tB2 / 2) / tot, easing: 'cubic-bezier(.5, 0, .75, .4)' },
      { transform: 'translateY(0)' },
    ], { duration: tot });
    setTimeout(() => {
      sfx.clack(); buzz(12);
      if (board.animate) board.animate([{ transform: 'none' }, { transform: `translateY(${Math.min(3, fall)}px)` }, { transform: 'none' }], { duration: 160, easing: 'ease-out' });
    }, tFall);
    setTimeout(() => sfx.clack(0.3), tFall + tB1);
    await done(k, tot);
    busy = false;
    el.classList.remove('busy');
  }

  /** Affiche directement un plateau (sans animation), par ex. en rejoignant une partie en cours. */
  function set(b) {
    b.forEach((p, i) => {
      if (p === null && cells[i]) { cells[i].remove(); cells[i] = null; }
      if (p !== null && !cells[i]) { cells[i] = discEl(i, p); discs.append(cells[i]); }
    });
  }

  /** Jetons gagnants : ils brillent et un trait les relie. */
  function win(list) {
    if (!list || !list.length) return;
    cells.forEach((d, i) => d && d.classList.toggle(list.includes(i) ? 'win' : 'dim', true));
    const [a, z] = [list[0], list[list.length - 1]];
    const x1 = cx(a % C4_W), y1 = cy(Math.floor(a / C4_W)), x2 = cx(z % C4_W), y2 = cy(Math.floor(z / C4_W));
    line.innerHTML = `<svg viewBox="0 0 ${BW} ${BH}" preserveAspectRatio="none"><path pathLength="1" d="M${x1} ${y1} L${x2} ${y2}"/></svg>`;
  }

  /** Vide le plateau : les jetons tombent par le bas. */
  async function clear() {
    const list = cells.filter(Boolean);
    cells.fill(null);
    line.innerHTML = '';
    if (!list.length) return;
    if (still() || !list[0].animate) { list.forEach((d) => d.remove()); return; }
    const hgt = board.getBoundingClientRect().height;
    sfx.rattle();
    await Promise.all(list.map((d) => {
      d.classList.remove('win', 'dim');
      const k = d.animate([{ transform: 'none', opacity: 1 }, { transform: `translateY(${hgt * 0.9}px)`, opacity: 0 }],
        { duration: 520, delay: Math.random() * 160, easing: 'cubic-bezier(.5, 0, .9, .5)', fill: 'forwards' });
      return done(k, 700).then(() => d.remove());
    }));
  }

  /** Colonne pleine : la main fait « non ». */
  function nope() {
    if (hand.animate) hand.animate([{ transform: 'none' }, { transform: 'translateX(-8%) rotate(-6deg)' }, { transform: 'translateX(8%) rotate(6deg)' }, { transform: 'none' }], { duration: 300 });
    sfx.bad(); buzz(30);
  }

  // Doigt sur le plateau : la main suit la colonne touchée, et lâche le jeton quand on relève le doigt.
  const colAt = (e) => { const r = cols.getBoundingClientRect(); return Math.max(0, Math.min(C4_W - 1, Math.floor((((e.clientX - r.left) / r.width) * BW - PAD) / CELL))); };
  function hover(c) { if (c === col || busy) return; col = c; place(c, HELD_Y, 90); }
  function pick(c) { if (!canPlay || busy) return; if (onPick) onPick(c); }
  cols.addEventListener('pointerdown', (e) => {
    if (!canPlay || busy || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    track = e.pointerId;
    try { cols.setPointerCapture(e.pointerId); } catch { /* */ }
    hover(colAt(e));
  });
  cols.addEventListener('pointermove', (e) => { if (track === e.pointerId || (e.pointerType === 'mouse' && track === null && canPlay)) hover(colAt(e)); });
  cols.addEventListener('pointerup', (e) => { if (track !== e.pointerId) return; track = null; const c = colAt(e); hover(c); pick(c); });
  cols.addEventListener('pointercancel', () => { track = null; });

  return {
    el, setTurn, drop, set, win, clear, nope, goTo,
    get busy() { return busy; },
    /** Le joueur ne peut plus jouer (partie finie) : la main s'en va. */
    rest() { canPlay = false; el.classList.remove('mine'); held.classList.add('gone'); hand.classList.add('away'); },
    back() { hand.classList.remove('away'); },
  };
}

// =====================================================================
// Morpion : grille et symboles dessinés au feutre.
// =====================================================================
const X_SVG = '<svg viewBox="0 0 100 100" class="mk x"><path pathLength="1" d="M19 18 Q50 52 81 83"/><path pathLength="1" d="M81 19 Q49 50 18 82"/></svg>';
const O_SVG = '<svg viewBox="0 0 100 100" class="mk o"><path pathLength="1" d="M50 18 C69 17 82 32 81 51 C80 70 66 83 49 82 C31 81 18 67 19 49 C20 31 33 19 52 20"/></svg>';
const GRID_SVG = '<svg viewBox="0 0 300 300" class="ttt-grid" aria-hidden="true"><path pathLength="1" d="M101 16 Q98 150 102 284"/><path pathLength="1" d="M199 18 Q202 150 198 286"/><path pathLength="1" d="M16 100 Q150 103 284 99"/><path pathLength="1" d="M14 199 Q150 196 286 201"/></svg>';

/** Grille de morpion. onPick(case). → { el, set(case, joueur, animer), win(cases), clear() (promesse), setTurn(joueur, peutJouer) } */
export function tttView({ onPick = null } = {}) {
  const cells = Array.from({ length: 9 }, (_, i) => h('button', { class: 'ttt-c', 'aria-label': `Case ${i + 1}`, onclick: () => { if (can && !marks[i] && onPick) onPick(i); } }));
  const line = h('div', { class: 'ttt-line' });
  const el = h('div', { class: 'ttt' }, h('div', { class: 'ttt-grid-wrap', html: GRID_SVG }), h('div', { class: 'ttt-cells' }, cells), line);
  const marks = Array(9).fill(null);
  let can = false;
  return {
    el,
    setTurn(p, mine) { can = !!mine; el.classList.toggle('mine', can); el.dataset.turn = String(p); },
    set(i, p, anim = true) {
      if (marks[i] === p) return;
      marks[i] = p;
      cells[i].innerHTML = p === null ? '' : p === 0 ? X_SVG : O_SVG;
      cells[i].classList.toggle('on', p !== null);
      if (p !== null && anim && !still()) { cells[i].firstChild.classList.add('draw'); sfx.scribble(); buzz(10); }
    },
    win(list) {
      if (!list || list.length < 3) return;
      const pos = (i) => [50 + (i % 3) * 100, 50 + Math.floor(i / 3) * 100];
      const [x1, y1] = pos(list[0]), [x2, y2] = pos(list[2]);
      const ex = (x2 - x1) * 0.18, ey = (y2 - y1) * 0.18;
      line.innerHTML = `<svg viewBox="0 0 300 300"><path pathLength="1" d="M${x1 - ex} ${y1 - ey} L${x2 + ex} ${y2 + ey}"/></svg>`;
      list.forEach((i) => cells[i].classList.add('win'));
      el.classList.add('over');
      setTimeout(() => sfx.scribble(), 120);
    },
    async clear() {
      const on = cells.filter((c, i) => marks[i] !== null);
      line.innerHTML = '';
      el.classList.remove('over');
      if (on.length && !still()) {
        on.forEach((c) => c.classList.add('erase'));
        await wait(260);
      }
      cells.forEach((c, i) => { c.innerHTML = ''; c.className = 'ttt-c'; marks[i] = null; });
    },
  };
}
