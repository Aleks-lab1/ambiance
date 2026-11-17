// Qui commence ? Chacun pose un doigt, le hasard choisit.
import { h, topbar, seg, shuffle } from '../ui.js';
import { get, set } from '../store.js';
import { sfx, buzz } from '../sfx.js';

const COLORS = ['#ff4d8d', '#2ec5ff', '#ffc93c', '#22d39a', '#b07cff', '#ff7a45', '#00e5ff', '#ff5a5f', '#a8e063', '#f857a6'];

export function start(ctx) {
  const { root, meta } = ctx;
  let cleanupZone = null;
  const opts = Object.assign({ mode: 'one' }, get('doigt', {}));

  function setup() {
    cleanupZone && cleanupZone();
    root.replaceChildren(
      topbar(ctx),
      h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
      h('label', { class: 'field' }, 'Mode', seg([{ value: 'one', label: '1 gagnant' }, { value: 'teams', label: '2 équipes' }, { value: 'order', label: 'Ordre de jeu' }], opts.mode, (v) => { opts.mode = v; set('doigt', opts); })),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: zone }, '☝️ C\'est parti'));
  }

  function zone() {
    const touches = new Map(); // id -> {x,y,el,color}
    let phase = 'wait';
    let timer = null;
    const hint = h('div', { class: 'hint' }, h('div', { style: { fontSize: '64px' } }, '☝️'), 'Posez tous un doigt sur l\'écran', h('span', { class: 'small' }, '2 doigts minimum'));
    const close = h('button', { class: 'icon-btn', 'aria-label': 'Fermer', onclick: () => { teardown(); setup(); } }, '✕');
    const again = h('button', { class: 'btn btn-primary btn-sm hidden', onclick: reset }, '🔁 Recommencer');
    const el = h('div', { class: 'touch-zone' }, hint, h('div', { class: 'top-ui' }, close, again));
    document.body.append(el);
    let colorIdx = 0;

    function reset() {
      phase = 'wait';
      clearTimeout(timer);
      for (const t of touches.values()) t.el.remove();
      touches.clear();
      again.classList.add('hidden');
      hint.style.display = '';
      colorIdx = 0;
    }

    function schedule() {
      clearTimeout(timer);
      if (phase !== 'wait') return;
      hint.style.display = touches.size ? 'none' : '';
      if (touches.size >= 2) timer = setTimeout(choose, 2200);
    }

    function choose() {
      if (touches.size < 2) return;
      phase = 'done';
      const list = shuffle([...touches.values()]);
      if (opts.mode === 'one') {
        list.forEach((t, i) => t.el.classList.add(i === 0 ? 'winner' : 'loser'));
      } else if (opts.mode === 'teams') {
        list.forEach((t, i) => { const c = i % 2 ? '#2ec5ff' : '#ff4d8d'; t.el.style.background = c; t.el.style.color = c; t.el.textContent = ''; });
      } else {
        list.forEach((t, i) => { t.el.textContent = String(i + 1); });
      }
      sfx.fanfare(); buzz([80, 40, 120]);
      again.classList.remove('hidden');
    }

    // Pointer Events : multi-touch sur mobile, et chaque clic = un « doigt » à la souris.
    let mouseId = 100000;
    const onDown = (e) => {
      if (phase !== 'wait' || e.target.closest('button')) return;
      e.preventDefault();
      const id = e.pointerType === 'mouse' ? mouseId++ : e.pointerId;
      const color = COLORS[colorIdx++ % COLORS.length];
      const d = h('div', { class: 'finger', style: { left: e.clientX + 'px', top: e.clientY + 'px', background: color, color, display: 'grid', placeItems: 'center', fontSize: '44px', fontWeight: '900' } });
      el.append(d);
      touches.set(id, { el: d, color });
      sfx.pop();
      schedule();
    };
    const onMove = (e) => {
      const x = touches.get(e.pointerId);
      if (x && e.pointerType !== 'mouse') { x.el.style.left = e.clientX + 'px'; x.el.style.top = e.clientY + 'px'; }
    };
    const onUp = (e) => {
      if (phase !== 'wait' || e.pointerType === 'mouse') return;
      const x = touches.get(e.pointerId);
      if (x) { x.el.remove(); touches.delete(e.pointerId); }
      schedule();
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    function teardown() { clearTimeout(timer); el.remove(); cleanupZone = null; }
    cleanupZone = teardown;
  }

  setup();
  return () => cleanupZone && cleanupZone();
}
