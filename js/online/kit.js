// Petits outils partagés par les jeux en ligne.
import { h } from '../ui.js';
import { podium } from '../common.js';
import { sfx } from '../sfx.js';
import { makeDeck } from '../store.js';

const DECKS = new WeakMap();
/**
 * Pioche sans répétition, même d'une partie à l'autre : comme en local, les cartes déjà tirées sont
 * mémorisées dans le téléphone de l'hôte (makeDeck de store.js). `key` identifie le paquet (y mettre les
 * niveaux choisis) ; `items` = tableau, ou fonction qui le construit (appelée une fois par partie).
 * Même clé et même forme d'éléments que la version locale = mémoire partagée entre local et en ligne.
 */
export function drawNew(s, key, items) {
  let decks = DECKS.get(s);
  if (!decks) DECKS.set(s, (decks = {}));
  if (!decks[key]) decks[key] = makeDeck(key, typeof items === 'function' ? items() : items);
  return decks[key].next();
}

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

// ---------- Écran télé (js/online/tv.js) ----------
/** Identifiant « personne » : view(room, s, TV_PID) = ce que voit un spectateur, sans aucun secret. */
export const TV_PID = '__tv';

/** Fin de partie à la télé : podium en grand. */
export function tvEnd(room) {
  return [h('div', { class: 'tv-hero' }, '🏆'), h('h1', null, 'Fin de la partie !'),
    h('div', { class: 'tv-podium' }, podium(room.players.map((p) => ({ name: p.name, score: p.score }))))];
}

/** Compte à rebours de la télé : { el, set(deadline) } (tic-tac les 5 dernières secondes). */
export function tvTimer(g) {
  const el = h('div', { class: 'tv-timer hidden' });
  let deadline = 0, last = null;
  const iv = setInterval(() => {
    if (!deadline) return;
    const sec = Math.ceil(Math.max(0, deadline - g.now()) / 1000);
    el.textContent = String(sec);
    el.classList.toggle('low', sec <= 5);
    if (sec <= 5 && sec > 0 && sec !== last) { last = sec; sfx.tick(); }
  }, 200);
  return {
    el,
    set(d) { deadline = d || 0; el.classList.toggle('hidden', !deadline); if (!deadline) el.textContent = ''; },
    stop() { clearInterval(iv); },
  };
}

/**
 * Pastilles des joueurs, allumées pour ceux qui ont déjà répondu : { el, set(room, faits, exclus) }.
 * Les pastilles restent les mêmes d'une mise à jour à l'autre : seule celle qui s'allume s'anime.
 */
export function tvWho() {
  const el = h('div', { class: 'tv-who' });
  const chips = new Map();
  return {
    el,
    set(room, done, skip = []) {
      const d = new Set(done);
      const list = room.players.filter((p) => p.on && !skip.includes(p.pid));
      const keep = new Set(list.map((p) => p.pid));
      for (const [pid, c] of chips) if (!keep.has(pid)) { c.remove(); chips.delete(pid); }
      for (const p of list) {
        let c = chips.get(p.pid);
        if (!c) { c = h('span', { class: 'tv-chip' }); chips.set(p.pid, c); el.append(c); }
        c.classList.toggle('done', d.has(p.pid));
        const t = (d.has(p.pid) ? '✓ ' : '') + p.name;
        if (c.textContent !== t) c.textContent = t;
      }
    },
  };
}
