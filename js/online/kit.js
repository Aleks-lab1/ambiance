// Petits outils partagés par les jeux en ligne.
import { h } from '../ui.js';
import { podium } from '../common.js';
import { sfx } from '../sfx.js';

export const activePids = (room) => room.players.filter((p) => p.on).map((p) => p.pid);
export const playerOf = (room, pid) => room.players.find((p) => p.pid === pid);
export const addScore = (room, pid, n) => { const p = playerOf(room, pid); if (p) p.score += n; };
export const isOn = (room, pid) => room.players.some((p) => p.pid === pid && p.on);

/** Prochain joueur connecté après `cur` dans `order` (en boucle). */
export function nextOn(room, order, cur) {
  const i = order.indexOf(cur);
  for (let k = 1; k <= order.length; k++) {
    const p = order[(i + k + order.length) % order.length];
    if (isOn(room, p)) return p;
  }
  return cur;
}

/** Carte colorée façon jeux de questions. */
export function card(colors, kicker, big, ...extra) {
  return h('div', { class: 'qcard anim', style: { '--g1': colors[0], '--g2': colors[1], minHeight: '0', padding: '22px 18px' } },
    kicker ? h('div', { class: 'kicker' }, kicker) : null,
    big != null ? h('div', { class: 'big' }, big) : null,
    ...extra);
}

/** Écran de fin standard : podium des scores + boutons de l'hôte. */
export function endScreen(r, g, title = 'Fin de la partie !', extra = null) {
  return [
    h('div', { class: 'center' }, h('div', { class: 'hero-emo' }, '🏆'), h('h2', null, title)),
    podium(r.players.map((p) => ({ name: p.name, score: p.score }))),
    extra,
    g.hostBar(),
  ];
}

/** Pastille de compte à rebours synchronisée sur l'horloge de l'hôte. */
export function timerPill(g) {
  const el = h('span', { class: 'pill timer-num', style: { fontSize: '15px' } });
  let dl = 0, last = null;
  const iv = setInterval(() => {
    if (!dl) { el.textContent = ''; return; }
    const sec = Math.ceil(Math.max(0, dl - g.now()) / 1000);
    el.textContent = '⏱ ' + sec;
    el.classList.toggle('low', sec <= 5);
    if (sec <= 3 && sec > 0 && sec !== last) { last = sec; sfx.tick(); }
  }, 200);
  return { el, set(d) { if (d !== dl) last = null; dl = d || 0; }, stop() { clearInterval(iv); } };
}

/** Bouton réservé à l'hôte (ou à un joueur autorisé). */
export function actBtn(g, label, a, cls = 'btn-soft') {
  return h('button', { class: 'btn btn-block ' + cls, onclick: () => g.send(typeof a === 'string' ? { type: a } : a) }, label);
}

export const waitHost = () => h('p', { class: 'status-line' }, '⏳ En attente de l\'hôte…');
