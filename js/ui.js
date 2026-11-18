// Petits utilitaires d'interface, sans framework.

// Garde-fou : append()/replaceChildren() natifs affichent « null », « false » ou « [object …] » en texte
// quand on leur passe une valeur vide ou un tableau. Dans toute l'appli, une valeur vide veut dire
// « rien à afficher » et un tableau est déplié, exactement comme avec h().
if (typeof Element !== 'undefined' && !Element.prototype.__ambianceSafe) {
  const keep = (k) => k !== null && k !== undefined && k !== false && k !== true;
  for (const name of ['append', 'replaceChildren', 'prepend']) {
    const native = Element.prototype[name];
    Element.prototype[name] = function (...kids) { return native.apply(this, kids.flat(Infinity).filter(keep)); };
  }
  Element.prototype.__ambianceSafe = true;
}

/** Crée un élément DOM : h('div', {class:'x', onclick}, enfants...) */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  appendKids(el, kids);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv;
        }
      } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  return el;
}

function appendKids(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false || k === true) continue;
    el.append(k instanceof Node ? k : String(k));
  }
}

export function mount(node) {
  const app = document.getElementById('app');
  app.replaceChildren(node);
  window.scrollTo(0, 0);
}

export const $ = (sel, root = document) => root.querySelector(sel);

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const rand = (min, max) => min + Math.random() * (max - min);
export const randInt = (min, max) => Math.floor(rand(min, max + 1));
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Normalise un texte pour comparer des réponses (accents, casse, ponctuation). */
export function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

// ---------- Toasts ----------
let toastRoot;
export function toast(msg, ms = 2400) {
  if (!toastRoot) { toastRoot = h('div', { id: 'toasts' }); document.body.append(toastRoot); }
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  toastRoot.append(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, ms);
  return t;
}

// ---------- Modales ----------
export function modal({ title, content, actions = [{ label: 'OK', value: true, primary: true }], dismissable = true, onOpen }) {
  return new Promise((resolve) => {
    let done = false;
    const close = (v) => { if (done) return; done = true; overlay.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape' && dismissable) close(null); };
    const overlay = h('div', {
      class: 'modal-overlay',
      onclick: (e) => { if (e.target === overlay && dismissable) close(null); },
    },
      h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
        title && h('h2', null, title),
        content,
        actions.length ? h('div', { class: 'modal-actions' },
          actions.map((a) => h('button', { class: 'btn ' + (a.cls || (a.primary ? 'btn-primary' : 'btn-ghost')), onclick: () => close(typeof a.value === 'function' ? a.value() : a.value) }, a.label))) : null,
      ));
    document.body.append(overlay);
    document.addEventListener('keydown', onKey);
    onOpen && onOpen(close);
  });
}

export function confirmBox(text, { ok = 'Oui', cancel = 'Annuler', title } = {}) {
  return modal({ title, content: h('p', null, text), actions: [{ label: cancel, value: false }, { label: ok, value: true, primary: true }] });
}

export function rulesModal(meta) {
  return modal({
    title: `${meta.emoji} ${meta.name}`,
    content: h('div', { class: 'rules' }, (meta.rules || [meta.desc]).map((r) => h('p', { html: r }))),
    actions: [{ label: 'Compris !', value: true, primary: true }],
  });
}

// ---------- Mise en page ----------
export function topbar(ctx, { title, emoji, right, onBack } = {}) {
  const meta = ctx.meta || {};
  return h('div', { class: 'topbar' },
    h('button', { class: 'icon-btn', 'aria-label': 'Retour', onclick: onBack || (() => ctx.exit()) }, '←'),
    h('span', { class: 'emo' }, emoji ?? meta.emoji),
    h('h1', null, title ?? meta.name),
    right,
    meta.rules ? h('button', { class: 'icon-btn', 'aria-label': 'Règles', onclick: () => rulesModal(meta) }, '?') : null,
  );
}

export function chip(label, on, onclick) {
  return h('button', { class: 'chip' + (on ? ' on' : ''), onclick, 'aria-pressed': on ? 'true' : 'false' }, label);
}

/** Contrôle segmenté : options [{value,label}] */
export function seg(options, value, onChange) {
  const wrap = h('div', { class: 'seg', role: 'radiogroup' });
  const render = () => wrap.replaceChildren(...options.map((o) => h('button', {
    class: o.value === value ? 'on' : '', role: 'radio', 'aria-checked': o.value === value ? 'true' : 'false',
    onclick: () => { value = o.value; render(); onChange(value); },
  }, o.label)));
  render();
  return wrap;
}

export function toggleRow(label, sub, checked, onChange) {
  const input = h('input', { type: 'checkbox', checked, onchange: (e) => onChange(e.target.checked, e.target) });
  return h('label', { class: 'toggle-row' },
    h('div', { class: 'lbl' }, h('b', null, label), sub ? h('span', null, sub) : null),
    h('span', { class: 'switch' }, input, h('i')));
}

export function stepper(value, min, max, onChange, fmt = (v) => v) {
  const val = h('b', { style: { minWidth: '3ch', textAlign: 'center', fontSize: '20px' } }, fmt(value));
  const set = (v) => { value = clamp(v, min, max); val.textContent = fmt(value); onChange(value); };
  return h('div', { class: 'row' },
    h('button', { class: 'icon-btn', 'aria-label': 'Moins', onclick: () => set(value - 1) }, '−'),
    val,
    h('button', { class: 'icon-btn', 'aria-label': 'Plus', onclick: () => set(value + 1) }, '+'));
}

// ---------- Minuteur ----------
/** Compte à rebours robuste (basé sur l'horloge). */
export function countdown({ seconds, onTick, onEnd }) {
  let end = Date.now() + seconds * 1000;
  let pausedLeft = null;
  let lastSec = null;
  const iv = setInterval(tick, 100);
  function tick() {
    if (pausedLeft != null) return;
    const left = Math.max(0, end - Date.now());
    const sec = Math.ceil(left / 1000);
    onTick && onTick(left, sec, sec !== lastSec);
    lastSec = sec;
    if (left <= 0) { clearInterval(iv); onEnd && onEnd(); }
  }
  setTimeout(tick, 0);
  return {
    stop() { clearInterval(iv); },
    pause() { if (pausedLeft == null) pausedLeft = Math.max(0, end - Date.now()); },
    resume() { if (pausedLeft != null) { end = Date.now() + pausedLeft; pausedLeft = null; } },
    add(sec) { end += sec * 1000; },
    get left() { return pausedLeft ?? Math.max(0, end - Date.now()); },
    get paused() { return pausedLeft != null; },
  };
}

/** Barre de temps + nombre de secondes. */
export function timerView(total) {
  const bar = h('i');
  const num = h('span', { class: 'timer-num' }, String(total));
  const track = h('div', { class: 'timer grow' }, bar);
  const el = h('div', { class: 'row' }, track, num);
  return {
    el,
    set(leftMs, totalMs = total * 1000) {
      const f = Math.max(0, Math.min(1, leftMs / totalMs));
      bar.style.transform = `scaleX(${f})`;
      const s = Math.ceil(leftMs / 1000);
      num.textContent = String(s);
      const low = s <= 5;
      track.classList.toggle('low', low);
      num.classList.toggle('low', low);
    },
  };
}

// ---------- Écran allumé ----------
let wakeLock = null;
let wantWake = false;
export async function keepAwake(on = true) {
  wantWake = on;
  try {
    if (on && 'wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release(); wakeLock = null;
    }
  } catch { /* non supporté */ }
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (wantWake && document.visibilityState === 'visible') keepAwake(true); });

/** Swipe gauche/droite simple sur un élément. */
export function onSwipe(el, { left, right }) {
  let x0 = null, y0 = null;
  el.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; });
  el.addEventListener('pointerup', (e) => {
    if (x0 == null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      el.dataset.swiped = '1';
      setTimeout(() => delete el.dataset.swiped, 50);
      dx < 0 ? left && left() : right && right();
    }
  });
}

export function plural(n, one, many) { return `${n} ${n > 1 ? many : one}`; }
