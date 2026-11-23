// Jeux de cartes en ligne, un joueur désigné à la fois : Et si… ?, Confidences, Cap ou pas cap ?, Action ou vérité.
// La carte s'affiche sur tous les téléphones. Le joueur désigné (ou l'hôte) agit, les autres regardent.
import { h, uid, shuffle, pick } from '../ui.js';
import { gameColors } from '../themes.js';
import { levelPicker } from '../common.js';
import { sip } from '../store.js';
import { sfx, buzz } from '../sfx.js';
import { LEVELS } from '../data/levels.js';
import { LEVELS as ACTION_LEVELS } from '../games/action.js';
import { activePids, addScore, nextOn, playerOf, actBtn, drawNew } from './kit.js';
import ETSI from '../data/etsi.js';
import CONF from '../data/confidences.js';
import CAP from '../data/cap.js';
import ACTION from '../data/action.js';

const HOTPP = ['#b0123f', '#1c0614'];
const KIND = {
  action: { label: '🎯 Action', colors: ['#ff512f', '#dd2476'] },
  verite: { label: '💬 Vérité', colors: ['#2ec5ff', '#7c5cff'] },
};

const MODES = {
  etsi: {
    name: 'Et si… ?', emoji: '🌀', short: 'Une situation folle : qu\'est-ce que tu ferais ?', data: ETSI, levels: LEVELS.etsi, colors: ['#4568dc', '#b06ab3'], kicker: 'Et si…',
    foot: (me, n) => (me ? 'À toi de répondre en premier ! Puis chacun donne sa réponse : la plus folle gagne.' : `${n} répond en premier, puis chacun son tour. La réponse la plus folle gagne !`),
  },
  confidences: {
    name: 'Confidences', emoji: '💬', short: 'Des questions pour vraiment se connaître', data: CONF, levels: LEVELS.confidences, colors: ['#c94b4b', '#4b134f'], kicker: '💬 Confidence',
    foot: (me, n) => (me ? 'Réponds honnêtement… puis les autres peuvent répondre à leur tour.' : `${n} répond honnêtement… puis les autres peuvent répondre à leur tour.`),
  },
  cap: {
    name: 'Cap ou pas cap ?', emoji: '💪', short: 'Un défi : cap ou pas cap ?', data: CAP, levels: LEVELS.cap, colors: ['#f12711', '#f5af19'], kicker: '🎯 Cap ou pas cap ?', challenge: true,
  },
  action: {
    name: 'Action ou vérité', emoji: '🎯', short: 'Choisis : action ou vérité ?', levels: ACTION_LEVELS, colors: ['#e94057', '#8a2387'], challenge: true, choose: true, defaults: ['soft', 'fun'],
  },
};

function levelsForm(levels, st, set) {
  const sel = new Set((st.levels || []).filter((l) => levels.some((x) => x.id === l)));
  if (!sel.size) sel.add(levels[0].id);
  set({ levels: [...sel] });
  return h('div', { class: 'col' }, h('p', { class: 'muted small' }, 'Niveaux d\'intensité'), levelPicker(levels, sel, (x) => set({ levels: [...x] })));
}

function makeCardGame(id) {
  const M = MODES[id];
  const validLevels = (ls) => {
    const v = (Array.isArray(ls) ? ls : []).filter((l) => M.levels.some((x) => x.id === l));
    return v.length ? v : [M.levels[0].id];
  };
  const pool = (s, kind) => validLevels(s.st.levels).flatMap((l) => ((kind ? ACTION[kind] : M.data)[l] || []).map((t) => ({ l, t })));

  function draw(room, s) {
    // Action ou vérité : mêmes clés que la version locale (action.js), mémoire partagée.
    const lv = validLevels(s.st.levels).slice().sort();
    const key = id === 'action' ? `action:${s.kind === 'action' ? 'a' : 'v'}:${lv}` : `on:${id}:${lv.join(',')}`;
    const c = drawNew(s, key, () => pool(s, s.kind)) || { l: M.levels[0].id, t: '…' };
    // Action ou vérité : {joueur} = un autre joueur au hasard.
    const others = activePids(room).filter((p) => p !== s.who);
    s.card = { l: c.l, t: c.t.replace(/\{joueur\}/g, () => (others.length ? playerOf(room, pick(others)).name : 'quelqu\'un')) };
  }

  function turn(room, s, first = false) {
    if (!first) s.who = nextOn(room, s.order, s.who);
    s.n++;
    s.done = null;
    s.kind = null;
    s.card = null;
    if (M.choose) { s.phase = 'choose'; return; }
    draw(room, s);
    s.phase = 'card';
  }

  return {
    id, name: M.name, short: M.short, emoji: M.emoji, minPlayers: 2,
    defaults: { levels: M.defaults || [M.levels[0].id] },
    settingsForm: (st, set) => levelsForm(M.levels, st, set),
    init(room, st) {
      const order = shuffle(activePids(room));
      const s = { gid: uid(), st, order, who: order[0], n: 0 };
      turn(room, s, true);
      return s;
    },
    action(room, s, pid, a) {
      const can = pid === s.who || pid === room.host;
      if (!can) return false;
      if (a.type === 'choose' && s.phase === 'choose' && ['action', 'verite', 'hasard'].includes(a.kind)) {
        s.kind = a.kind === 'hasard' ? (Math.random() < 0.5 ? 'action' : 'verite') : a.kind;
        draw(room, s);
        s.phase = 'card';
        return true;
      }
      if (a.type === 'other' && s.phase === 'card') { draw(room, s); s.n++; return true; }
      if (a.type === 'done' && s.phase === 'card' && M.challenge && typeof a.ok === 'boolean') {
        s.done = a.ok;
        if (a.ok) addScore(room, s.who, 1);
        s.phase = 'result';
        return true;
      }
      if (a.type === 'next' && (s.phase === 'result' || (s.phase === 'card' && !M.challenge))) { turn(room, s); return true; }
      return false;
    },
    onJoin(room, s, pid) { if (!s.order.includes(pid)) s.order.push(pid); },
    onLeave(room, s, pid) { if (pid === s.who && s.phase !== 'result') turn(room, s); },
    view(room, s) { return { gid: s.gid, n: s.n, phase: s.phase, who: s.who, card: s.card, kind: s.kind, done: s.done }; },
    mount(root, g) {
      const colors = gameColors(id, M.colors);
      const main = h('div', { class: 'col' });
      root.append(main);
      let lastKey = null;

      function cardEl(v, me, N, fresh) {
        const lvl = M.levels.find((l) => l.id === v.card.l) || {};
        const c = lvl.extreme ? HOTPP : v.kind ? KIND[v.kind].colors : colors;
        return h('div', { class: 'qcard' + (fresh ? ' anim' : ''), style: { '--g1': c[0], '--g2': c[1], minHeight: '0', padding: '22px 18px' } },
          lvl.name ? h('span', { class: 'badge lvl' }, `${lvl.emoji} ${lvl.name}`) : null,
          h('div', { class: 'who', style: { marginTop: lvl.name ? '22px' : '0' } }, me ? '🎯 À toi !' : `🎯 ${N}`),
          h('div', { class: 'kicker' }, v.kind ? KIND[v.kind].label : M.kicker),
          h('div', { class: 'big' }, v.card.t),
          M.foot ? h('div', { class: 'foot' }, M.foot(me, N)) : M.challenge && v.phase === 'card' ? h('div', { class: 'foot' }, `Refus ? ${sip(2)} !`) : null);
      }

      return {
        update(r, v) {
          const key = `${v.gid}:${v.n}:${v.phase}`;
          const fresh = key !== lastKey;
          const me = v.who === g.me;
          const N = g.nameOf(v.who);
          const can = me || g.isHost;
          const mine = r.players.find((p) => p.pid === g.me);
          const parts = [h('div', { class: 'row' },
            h('span', { class: 'pill' }, `${M.emoji} ${me ? 'À toi' : N}`), h('div', { class: 'grow' }),
            M.challenge ? h('span', { class: 'pill' }, `🏆 ${mine ? mine.score : 0}`) : null)];

          if (v.phase === 'choose') {
            parts.push(h('div', { class: 'big-center', style: { padding: '8px 0' } },
              h('div', { class: 'hero-emo' }, '🤔'),
              h('h2', null, me ? 'À toi de jouer !' : `Au tour de ${N}`),
              h('p', { class: 'muted' }, me ? 'Action ou vérité ?' : can ? `${N} choisit sur son téléphone (tu peux aussi choisir pour lui ou elle).` : `${N} choisit : action ou vérité ?`)));
            if (can) {
              parts.push(h('div', { class: 'col' },
                h('button', { class: 'btn btn-primary btn-big', style: { '--g1': KIND.action.colors[0], '--g2': KIND.action.colors[1] }, onclick: () => { g.send({ type: 'choose', kind: 'action' }); sfx.pop(); } }, '🎯 Action'),
                h('button', { class: 'btn btn-primary btn-big', style: { '--g1': KIND.verite.colors[0], '--g2': KIND.verite.colors[1] }, onclick: () => { g.send({ type: 'choose', kind: 'verite' }); sfx.pop(); } }, '💬 Vérité'),
                h('button', { class: 'btn btn-soft', onclick: () => { g.send({ type: 'choose', kind: 'hasard' }); sfx.pop(); } }, '🎲 Laisser le hasard choisir')));
            }
          } else if (v.phase === 'card') {
            parts.push(cardEl(v, me, N, fresh));
            if (M.challenge) {
              if (can) {
                parts.push(h('div', { class: 'answer-btns' },
                  h('button', { class: 'btn btn-bad btn-big', onclick: () => g.send({ type: 'done', ok: false }) }, M.choose ? (me ? '🙅 Je refuse' : '🙅 Refusé') : '🙅 Pas cap'),
                  h('button', { class: 'btn btn-ok btn-big', onclick: () => g.send({ type: 'done', ok: true }) }, M.choose ? (v.kind === 'verite' ? '✅ Répondu' : '✅ Fait !') : '💪 Cap !')),
                h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { g.send({ type: 'other' }); sfx.swoosh(); } }, '🔄 Autre carte'));
              } else parts.push(h('p', { class: 'status-line' }, M.choose ? `👀 ${N} relève le défi ?` : `👀 ${N} est cap ou pas cap ?`));
            } else if (can) {
              parts.push(actBtn(g, 'Joueur suivant →', 'next', 'btn-primary btn-big'),
                h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { g.send({ type: 'other' }); sfx.swoosh(); } }, '🔄 Autre carte'));
            } else parts.push(h('p', { class: 'status-line' }, `Quand tout le monde a répondu, ${N} passe à la suite.`));
          } else if (v.phase === 'result') {
            parts.push(cardEl(v, me, N, false),
              h('div', { class: 'panel center' }, h('h3', null, v.done
                ? (me ? '💪 Bien joué, +1 point !' : `💪 ${N} l'a fait : +1 point !`)
                : (me ? `🙅 Tu refuses : tu prends ${sip(2)} !` : `🙅 ${N} refuse et prend ${sip(2)} !`))));
            if (can) parts.push(actBtn(g, 'Joueur suivant →', 'next', 'btn-primary btn-big'));
            else parts.push(h('p', { class: 'status-line' }, `⏳ ${N} passe au joueur suivant…`));
          }

          if (fresh) {
            if (v.phase === 'card') { sfx.swoosh(); if (me) buzz([40, 30, 60]); }
            if (v.phase === 'choose' && me) { sfx.go(); buzz([40, 30, 60]); }
            if (v.phase === 'result') (v.done ? sfx.ok() : sfx.bad());
          }
          lastKey = key;
          main.replaceChildren(...parts);
        },
        destroy() {},
      };
    },
  };
}

export const etsiOnline = makeCardGame('etsi');
export const confidencesOnline = makeCardGame('confidences');
export const capOnline = makeCardGame('cap');
export const actionOnline = makeCardGame('action');
