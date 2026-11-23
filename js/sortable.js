// Liste à remettre dans l'ordre en faisant glisser les éléments (doigt ou souris) :
// Dans l'ordre !, Dans sa tête. Les autres éléments s'écartent en douceur pendant le glissement,
// les numéros se mettent à jour en direct, et la correction fait glisser chaque carte à sa vraie place.
import { h } from './ui.js';
import { sfx, buzz } from './sfx.js';

const EASE = 'cubic-bezier(.2, .8, .3, 1)';

/**
 * sortList(items, options) → { el, order(), locked, lock(), check(sol), settle(sol, labels), destroy() }
 *   items : textes à classer ; order : ordre affiché au départ (indices dans items, par défaut 0..n-1).
 *   top / bottom : petites étiquettes au-dessus et en dessous (« ⬆ Plus ancien »…).
 *   labels : texte affiché à droite de chaque élément (indices dans items), par ex. les années.
 *   onChange(order) : appelé après chaque déplacement.
 */
export function sortList(items, { order = null, top = null, bottom = null, labels = null, locked = false, onChange = null } = {}) {
  const els = items.map((txt, i) => h('div', {
    class: 'sort-item', tabindex: '0', role: 'listitem', 'data-i': String(i),
  }, h('span', { class: 'rk' }), h('span', { class: 't' }, txt), h('span', { class: 'yr' }), h('span', { class: 'grip', 'aria-hidden': 'true' })));
  const list = h('div', { class: 'sort-list', role: 'list' }, (order || items.map((_, i) => i)).map((i) => els[i]));
  const el = h('div', { class: 'sort-wrap' },
    top ? h('div', { class: 'sort-edge' }, top) : null, list, bottom ? h('div', { class: 'sort-edge' }, bottom) : null);
  let isLocked = false, drag = null, settleT = null, scrollRaf = null;

  const current = () => [...list.children];
  const order$ = () => current().map((x) => Number(x.dataset.i));
  const numbers = (seq = current()) => seq.forEach((x, k) => {
    x.querySelector('.rk').textContent = String(k + 1);
    x.setAttribute('aria-label', `${k + 1}. ${items[Number(x.dataset.i)]}`);
  });
  numbers();
  if (labels) setLabels(labels);

  function setLabels(lb, anim = false) {
    els.forEach((x, i) => {
      const y = x.querySelector('.yr');
      y.textContent = lb[i] == null ? '' : String(lb[i]);
      if (anim) { y.classList.remove('show'); void y.offsetWidth; }
      y.classList.add('show');
    });
  }

  /** Anime un changement d'ordre (technique « FLIP ») : chaque carte glisse de son ancienne place à la nouvelle. */
  function flip(mutate, dur = 260, easing = EASE) {
    const first = new Map(current().map((x) => [x, x.getBoundingClientRect().top]));
    mutate();
    for (const x of current()) {
      const dy = first.get(x) - x.getBoundingClientRect().top;
      if (Math.abs(dy) < 1 || !x.animate) continue;
      x.classList.add('moving');
      const a = x.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: dur, easing });
      a.onfinish = a.oncancel = () => x.classList.remove('moving');
    }
  }

  // ---------------- Glisser-déposer ----------------
  function down(e) {
    const item = e.currentTarget;
    if (isLocked || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    commit(); // une carte encore en train de se poser : on termine tout de suite
    const seq = current();
    const sy = window.scrollY;
    const rects = seq.map((x) => { const r = x.getBoundingClientRect(); return { top: r.top + sy, h: r.height }; });
    const gap = rects.length > 1 ? rects[1].top - (rects[0].top + rects[0].h) : 0;
    drag = { item, seq, rects, gap, from: seq.indexOf(item), to: seq.indexOf(item), y0: e.clientY + sy, y: e.clientY, id: e.pointerId };
    try { item.setPointerCapture(e.pointerId); } catch { /* */ }
    item.classList.add('drag');
    list.classList.add('dragging');
    item.style.transform = 'translateY(0) scale(1.04) rotate(-1deg)';
    sfx.tick(); buzz(8);
  }
  function move(e) {
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    drag.y = e.clientY;
    follow();
    autoScroll();
  }
  function follow() {
    const { item, seq, rects, from } = drag;
    const dy = drag.y + window.scrollY - drag.y0;
    item.style.transform = `translateY(${dy}px) scale(1.04) rotate(-1deg)`;
    // Nouvelle place = nombre de cartes dont le milieu est au-dessus du milieu de la carte tenue.
    const mid = rects[from].top + rects[from].h / 2 + dy;
    let to = 0;
    rects.forEach((r, k) => { if (k !== from && r.top + r.h / 2 < mid) to++; });
    if (to === drag.to) return;
    drag.to = to;
    const tops = layout();
    seq.forEach((x, k) => { if (k !== from) x.style.transform = `translateY(${tops[k] - rects[k].top}px)`; });
    const nseq = seq.slice(); nseq.splice(from, 1); nseq.splice(to, 0, item);
    numbers(nseq);
    sfx.tock(); buzz(5);
  }
  /** Position (en haut) de chaque carte si la carte tenue était posée à la place drag.to. */
  function layout() {
    const { seq, rects, gap, from, to } = drag;
    const idx = seq.map((_, k) => k); idx.splice(from, 1); idx.splice(to, 0, from);
    const tops = [];
    let y = rects[0].top;
    for (const k of idx) { tops[k] = y; y += rects[k].h + gap; }
    return tops;
  }
  function up(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const { item, seq, rects, from, to } = drag;
    const tops = layout();
    drag = null;
    cancelAnimationFrame(scrollRaf); scrollRaf = null;
    item.classList.remove('drag');
    item.classList.add('settling');
    item.style.transform = `translateY(${tops[from] - rects[from].top}px)`;
    const nseq = seq.slice(); nseq.splice(from, 1); nseq.splice(to, 0, item);
    settleT = { seq: nseq, changed: from !== to, t: setTimeout(commit, 200) };
    if (from !== to) { sfx.pop(); buzz(10); }
  }
  /** Fin du dépôt : on range vraiment les cartes dans le nouvel ordre et on enlève les décalages, sans saut visible. */
  function commit() {
    if (!settleT) return;
    clearTimeout(settleT.t);
    const { seq, changed } = settleT;
    settleT = null;
    for (const x of els) { x.style.transition = 'none'; x.style.transform = ''; x.classList.remove('settling'); }
    list.replaceChildren(...seq);
    void list.offsetHeight;
    for (const x of els) x.style.transition = '';
    list.classList.remove('dragging');
    numbers();
    if (changed && onChange) onChange(order$());
  }
  /** Fait défiler la page quand on tient une carte près du bord de l'écran. */
  function autoScroll() {
    if (scrollRaf || !drag) return;
    const step = () => {
      scrollRaf = null;
      if (!drag) return;
      const vh = window.innerHeight, edge = 70;
      const v = drag.y < edge ? -Math.ceil((edge - drag.y) / 6) : drag.y > vh - edge ? Math.ceil((drag.y - (vh - edge)) / 6) : 0;
      if (!v) return;
      const before = window.scrollY;
      window.scrollBy(0, v);
      if (window.scrollY !== before) follow();
      scrollRaf = requestAnimationFrame(step);
    };
    scrollRaf = requestAnimationFrame(step);
  }
  // Clavier : flèches haut / bas pour déplacer la carte sélectionnée.
  function key(e) {
    if (isLocked || drag || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    commit();
    const item = e.currentTarget;
    const seq = current();
    const k = seq.indexOf(item), j = k + (e.key === 'ArrowUp' ? -1 : 1);
    if (j < 0 || j >= seq.length) return;
    flip(() => { seq.splice(k, 1); seq.splice(j, 0, item); list.replaceChildren(...seq); numbers(); });
    item.focus();
    sfx.tock();
    if (onChange) onChange(order$());
  }
  for (const x of els) {
    x.addEventListener('pointerdown', down);
    x.addEventListener('pointermove', move);
    x.addEventListener('pointerup', up);
    x.addEventListener('pointercancel', up);
    x.addEventListener('lostpointercapture', up);
    x.addEventListener('keydown', key);
  }

  function lock() {
    if (isLocked) return;
    if (drag) up({ pointerId: drag.id });
    commit();
    isLocked = true;
    el.classList.add('locked');
    for (const x of els) x.removeAttribute('tabindex');
  }
  if (locked) lock();

  return {
    el,
    order: () => { commit(); return order$(); },
    get locked() { return isLocked; },
    lock,
    /** Colore chaque carte : bien placée (vert) ou pas (rouge). Renvoie le nombre de cartes bien placées. */
    check(sol) {
      lock();
      let ok = 0;
      current().forEach((x, k) => { const good = Number(x.dataset.i) === sol[k]; if (good) ok++; x.classList.add(good ? 'good' : 'bad'); });
      return ok;
    },
    /** Fait glisser les cartes dans l'ordre sol (la bonne réponse) et affiche les étiquettes (années…). */
    settle(sol, lb = null) {
      lock();
      flip(() => { list.replaceChildren(...sol.map((i) => els[i])); numbers(); }, 650, 'cubic-bezier(.3, 1.25, .5, 1)');
      if (lb) setTimeout(() => setLabels(lb, true), 350);
    },
    /** Marque des cartes (indices dans items) avec une classe, ex. celles d'un joueur. */
    mark(cls, set) { els.forEach((x, i) => x.classList.toggle(cls, set.includes(i))); },
    labels: (lb) => setLabels(lb, true),
    destroy() { cancelAnimationFrame(scrollRaf); if (settleT) clearTimeout(settleT.t); },
  };
}
