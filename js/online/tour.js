// Jeux en ligne « chacun son tour » : Paranoïa, Pour ou contre, 3 en 5 secondes, Deux vérités un mensonge.
import { h, uid, shuffle, seg } from '../ui.js';
import { gameColors } from '../themes.js';
import { levelPicker } from '../common.js';
import { sip } from '../store.js';
import { sfx, buzz } from '../sfx.js';
import { activePids, addScore, nextOn, card, endScreen, timerPill, actBtn, drawNew, TV_PID, tvTurn, tvSay, tvStage, tvTimer, tvWho } from './kit.js';
import { LEVELS as PARA_LEVELS } from '../games/paranoia.js';
import PARA from '../data/paranoia.js';
import DEBATS from '../data/debats.js';
import CINQ from '../data/cinq.js';
import DEUX from '../data/deuxverites.js';

const DEUX_LEVELS = [
  { id: 'soft', name: 'Classique', emoji: '🙂', desc: 'Des thèmes pour tout le monde.' },
  { id: 'hot', name: 'Hot', emoji: '🔥', desc: 'Vie amoureuse et coquine, réservé aux adultes.', adult: true },
];

function levelsForm(levels, st, set) {
  const sel = new Set((st.levels || []).filter((l) => levels.some((x) => x.id === l)));
  if (!sel.size) sel.add(levels[0].id);
  set({ levels: [...sel] });
  return h('div', { class: 'col' }, h('p', { class: 'muted small' }, 'Niveaux'), levelPicker(levels, sel, (x) => set({ levels: [...x] })));
}
const lvOf = (data, levels) => (levels && levels.length ? levels : Object.keys(data)).slice().sort();
const flat = (data, levels) => lvOf(data, levels).flatMap((l) => data[l] || []);
const name = (g, pid) => (pid === g.me ? 'Toi' : g.nameOf(pid));
const roundsForm = (st, set, label = 'Nombre de tours') => h('label', { class: 'field' }, label, seg([5, 10, 15].map((n) => ({ value: n, label: String(n) })), st.rounds, (v) => set({ rounds: v })));

// =====================================================================
// PARANOÏA
// =====================================================================
export const paranoiaOnline = {
  id: 'paranoia', name: 'Paranoïa', short: 'Question secrète, pile ou face', emoji: '🤫', minPlayers: 3,
  defaults: { levels: ['soft', 'epice'] },
  settingsForm: (st, set) => levelsForm(PARA_LEVELS, st, set),
  init(room, st) {
    const order = shuffle(activePids(room));
    const s = { gid: uid(), st, order, asker: order[0], n: 0 };
    startAsk(s);
    return s;
  },
  action(room, s, pid, a) {
    if (a.type === 'pick' && s.phase === 'ask' && pid === s.asker && a.pid !== pid && room.players.some((p) => p.pid === a.pid)) {
      s.target = a.pid; s.phase = 'flip'; s.until = Date.now() + 2600; s.revealed = Math.random() < 0.5;
      return true;
    }
    if (a.type === 'next' && s.phase === 'result' && (pid === room.host || pid === s.asker)) {
      s.asker = nextOn(room, s.order, s.asker);
      startAsk(s);
      return true;
    }
    return false;
  },
  tick(room, s) { if (s.phase === 'flip' && Date.now() >= s.until) { s.phase = 'result'; return true; } return false; },
  onLeave(room, s, pid) { if (pid === s.asker && s.phase !== 'result') { s.asker = nextOn(room, s.order, s.asker); startAsk(s); } },
  onJoin(room, s, pid) { if (!s.order.includes(pid)) s.order.push(pid); },
  view(room, s, pid) {
    const showQ = pid === s.asker || (s.phase === 'result' && s.revealed);
    return { gid: s.gid, n: s.n, phase: s.phase, asker: s.asker, target: s.target, revealed: s.phase === 'result' ? s.revealed : null, q: showQ ? s.q : null };
  },
  // Écran télé : qui lit la question secrète, qui est désigné, la pièce qui tourne, la question révélée (ou pas).
  tv(room, s) { return this.view(room, s, TV_PID); },
  tvMount(root, g) {
    const colors = gameColors('paranoia', ['#2b2d6e', '#d6336c']);
    const style = { '--g1': colors[0], '--g2': colors[1] };
    const main = h('div', { class: 'tv-fill' });
    root.append(main);
    let lastKey = null;
    return {
      update(r, v) {
        const key = `${v.gid}:${v.n}:${v.phase}`;
        if (key === lastKey) return;
        const A = g.nameOf(v.asker), T = v.target ? g.nameOf(v.target) : '';
        if (v.phase === 'ask') {
          main.replaceChildren(h('div', { class: 'tv-big-emo' }, '🤫'), tvTurn('📱', `${A} lit une question en secret…`, '… et va désigner quelqu\'un parmi vous. Qui ? Et pourquoi ? 😈'));
        } else if (v.phase === 'flip') {
          main.replaceChildren(h('div', { class: 'tv-say' }, `${A} désigne… 👉 ${T} !`), h('div', { class: 'coin spin tv-coin' }, '🪙'), h('p', { class: 'tv-status' }, 'Pile ou face : la question va-t-elle être révélée ?'));
          sfx.swoosh();
        } else {
          main.replaceChildren(h('div', { class: 'tv-say' }, `${A} a désigné ${T}`),
            h('div', { class: 'tv-card tv-bigcard', style }, h('div', { class: 'kicker' }, v.revealed ? '🪙 Face : la question est révélée !' : '🪙 Pile !'),
              h('div', { class: 'q' }, v.revealed ? v.q : '🤐 La question reste secrète…'),
              v.revealed ? null : h('div', { class: 'foot' }, `${T} peut boire ${sip(1)} pour la découvrir… ou rester dans le doute.`)));
          v.revealed ? sfx.end() : sfx.bad();
        }
        lastKey = key;
      },
      destroy() {},
    };
  },
  mount(root, g) {
    const colors = gameColors('paranoia', ['#2b2d6e', '#d6336c']);
    const main = h('div', { class: 'col' });
    root.append(main);
    let lastKey = null;
    return {
      update(r, v) {
        const key = `${v.gid}:${v.n}:${v.phase}`;
        const me = v.asker === g.me;
        const parts = [h('div', { class: 'row' }, h('span', { class: 'pill' }, `🤫 ${me ? 'À toi' : g.nameOf(v.asker)}`), h('div', { class: 'grow' }), h('span', { class: 'pill' }, `#${v.n}`))];
        if (v.phase === 'ask') {
          if (me) {
            parts.push(card(colors, 'Question secrète (ne la lis pas à voix haute !)', v.q),
              h('p', { class: 'muted small center' }, 'Réponds en désignant quelqu\'un :'),
              h('div', { class: 'vote-grid' }, r.players.filter((p) => p.on && p.pid !== g.me).map((p) => h('button', { style: { background: 'var(--card2)' }, onclick: () => { g.send({ type: 'pick', pid: p.pid }); sfx.pop(); } }, p.name))));
          } else {
            parts.push(card(colors, '🤫 Chut…', `${g.nameOf(v.asker)} lit une question en secret…`, h('div', { class: 'foot' }, '… et va désigner quelqu\'un parmi vous. Qui ? Et pourquoi ? 😈')));
          }
        } else if (v.phase === 'flip') {
          parts.push(card(colors, me ? 'Tu désignes…' : `${g.nameOf(v.asker)} désigne…`, `👉 ${name(g, v.target)} !`), h('div', { class: 'coin spin' }, '🪙'), h('p', { class: 'center muted' }, 'Pile ou face : la question va-t-elle être révélée ?'));
        } else {
          const who = me ? `Tu as désigné ${g.nameOf(v.target)}` : v.target === g.me ? `${g.nameOf(v.asker)} t'a désigné(e)` : `${g.nameOf(v.asker)} a désigné ${g.nameOf(v.target)}`;
          parts.push(card(colors, who, v.revealed ? v.q : '🤐 La question reste secrète…',
            h('div', { class: 'foot' }, v.revealed ? '🪙 Face : la question est révélée !' : `🪙 Pile ! ${v.target === g.me ? 'Tu peux boire ' + sip(1) + ' pour la découvrir… ou rester dans le doute.' : 'Le mystère reste entier.'}`)));
          if (me || g.isHost) parts.push(actBtn(g, 'Joueur suivant →', 'next', 'btn-primary btn-big'));
        }
        if (key !== lastKey) {
          if (v.phase === 'ask' && me) { sfx.go(); buzz([40, 30, 80]); }
          if (v.phase === 'flip') sfx.swoosh();
          if (v.phase === 'result') v.revealed ? sfx.end() : sfx.bad();
        }
        lastKey = key;
        main.replaceChildren(...parts);
      },
      destroy() {},
    };
  },
};
function startAsk(s) { s.n++; s.phase = 'ask'; s.target = null; s.revealed = false; s.q = drawNew(s, 'paranoia:' + lvOf(PARA, s.st.levels), () => flat(PARA, s.st.levels)); }

// =====================================================================
// POUR OU CONTRE
// =====================================================================
export const debatsOnline = {
  id: 'debats', name: 'Pour ou contre', short: 'Deux joueurs débattent, les autres votent', emoji: '🎤', minPlayers: 3,
  defaults: { time: 45, rounds: 5 },
  settingsForm(st, set) {
    return h('div', { class: 'col' },
      h('label', { class: 'field' }, 'Temps de parole', seg([30, 45, 60].map((n) => ({ value: n, label: n + ' s' })), st.time, (v) => set({ time: v }))),
      roundsForm(st, set, 'Nombre de débats'));
  },
  init(room, st) {
    const s = { gid: uid(), st, order: shuffle(activePids(room)), i: -1, round: 0 };
    nextDebate(room, s);
    return s;
  },
  action(room, s, pid, a) {
    if (a.type === 'done' && ((s.phase === 'pour' && pid === s.pour) || (s.phase === 'contre' && pid === s.contre))) { advance(room, s); return true; }
    if (a.type === 'vote' && s.phase === 'vote' && pid !== s.pour && pid !== s.contre && (a.v === 0 || a.v === 1)) {
      s.votes[pid] = a.v;
      if (judges(room, s).every((p) => s.votes[p] != null)) result(room, s);
      return true;
    }
    if (a.type === 'skip' && pid === room.host && s.phase !== 'result') { advance(room, s); return true; }
    if (a.type === 'next' && pid === room.host && s.phase === 'result') { nextDebate(room, s); return true; }
    return false;
  },
  tick(room, s) { if ((s.phase === 'pour' || s.phase === 'contre') && Date.now() >= s.deadline) { advance(room, s); return true; } return false; },
  onLeave(room, s) { if (s.phase === 'vote' && judges(room, s).every((p) => s.votes[p] != null)) result(room, s); },
  view(room, s, pid) {
    return { gid: s.gid, round: s.round, rounds: s.st.rounds, phase: s.phase, topic: s.topic, pour: s.pour, contre: s.contre, deadline: s.deadline, mine: s.votes[pid] ?? null, voted: Object.keys(s.votes), votes: s.phase === 'result' ? s.votes : null, winner: s.winner };
  },
  // Écran télé : le sujet en grand, le POUR et le CONTRE face à face, l'orateur qui a la parole et son chrono.
  tv(room, s) { return this.view(room, s, TV_PID); },
  tvMount(root, g) {
    const colors = gameColors('debats', ['#f857a6', '#ff5858']);
    const bar = h('div', { class: 'tv-bar' });
    const cardSlot = h('div');
    const sides = [h('div', { class: 'tv-side tv-pour' }), h('div', { class: 'tv-side tv-contre' })];
    const say = tvSay();
    const who = tvWho();
    const res = h('div');
    const tm = tvTimer(g);
    const st = tvStage(root, bar, cardSlot, h('div', { class: 'tv-vs tv-debate' }, sides[0], h('div', { class: 'or' }, 'VS'), sides[1]), say.el, who.el, res);
    let lastKey = null;
    return {
      update(r, v) {
        if (st.end(r, v.phase === 'end')) { tm.set(0); lastKey = null; return; }
        const key = `${v.gid}:${v.round}:${v.phase}`;
        tm.set(v.phase === 'pour' || v.phase === 'contre' ? v.deadline : 0);
        bar.replaceChildren(h('span', { class: 'pill' }, `🎤 Débat ${v.round}/${v.rounds}`), h('div', { class: 'grow' }), tm.el);
        if (cardSlot.dataset.k !== v.gid + ':' + v.round) {
          cardSlot.dataset.k = v.gid + ':' + v.round;
          cardSlot.replaceChildren(h('div', { class: 'tv-card', style: { '--g1': colors[0], '--g2': colors[1] } }, h('div', { class: 'kicker' }, 'Le sujet'), h('div', { class: 'q' }, v.topic)));
        }
        const n = v.votes ? [0, 1].map((i) => Object.values(v.votes).filter((x) => x === i).length) : null;
        [v.pour, v.contre].forEach((p, i) => {
          sides[i].classList.toggle('on', v.phase === (i ? 'contre' : 'pour'));
          sides[i].classList.toggle('win', v.phase === 'result' && v.winner === p);
          sides[i].classList.toggle('lose', v.phase === 'result' && v.winner != null && v.winner !== p);
          sides[i].replaceChildren(h('div', { class: 'k' }, i ? '🔴 CONTRE' : '🟢 POUR'), h('div', { class: 't' }, g.nameOf(p)),
            n ? h('div', { class: 'k' }, `${n[i]} vote${n[i] > 1 ? 's' : ''}`) : null);
        });
        if (v.phase === 'pour' || v.phase === 'contre') say.set(`🎙️ ${g.nameOf(v.phase === 'pour' ? v.pour : v.contre)} défend le ${v.phase.toUpperCase()} !`);
        else if (v.phase === 'vote') say.set('🗳️ Votez sur vos téléphones : qui a été le plus convaincant ?');
        else {
          const loser = v.winner == null ? null : (v.winner === v.pour ? v.contre : v.pour);
          say.set(v.winner == null ? '🤝 Égalité !' : `🏆 ${g.nameOf(v.winner)} remporte le débat ! ${g.nameOf(loser)} prend ${sip(1)}.`);
        }
        who.el.classList.toggle('hidden', v.phase !== 'vote');
        if (v.phase === 'vote') who.set(r, v.voted, [v.pour, v.contre]);
        if (key !== lastKey) { if (v.phase === 'result') sfx.end(); else sfx.go(); }
        lastKey = key;
      },
      destroy() { tm.stop(); },
    };
  },
  mount(root, g) {
    const colors = gameColors('debats', ['#f857a6', '#ff5858']);
    const main = h('div', { class: 'col' });
    const tp = timerPill(g);
    root.append(main);
    let lastKey = null;
    return {
      update(r, v) {
        if (v.phase === 'end') { tp.set(0); main.replaceChildren(...endScreen(r, g)); lastKey = 'end'; return; }
        const key = `${v.gid}:${v.round}:${v.phase}`;
        tp.set(v.phase === 'pour' || v.phase === 'contre' ? v.deadline : 0);
        const speaker = v.phase === 'pour' ? v.pour : v.phase === 'contre' ? v.contre : null;
        const parts = [
          h('div', { class: 'row' }, h('span', { class: 'pill' }, `🎤 ${v.round}/${v.rounds}`), h('div', { class: 'grow' }), tp.el),
          card(colors, 'Le sujet', v.topic,
            h('div', { class: 'debate-sides' }, h('span', { class: 'side pour' + (v.phase === 'pour' ? ' on' : '') }, `🟢 POUR : ${name(g, v.pour)}`), h('span', { class: 'side contre' + (v.phase === 'contre' ? ' on' : '') }, `🔴 CONTRE : ${name(g, v.contre)}`))),
        ];
        if (speaker) {
          parts.push(h('h2', { class: 'center' }, speaker === g.me ? `🎙️ À toi : défends le ${v.phase.toUpperCase()} !` : `🎙️ ${g.nameOf(speaker)} défend le ${v.phase.toUpperCase()}`));
          if (speaker === g.me) parts.push(actBtn(g, '✋ J\'ai fini', 'done', 'btn-primary'));
        } else if (v.phase === 'vote') {
          if (g.me === v.pour || g.me === v.contre) parts.push(h('p', { class: 'center' }, '🤞 Les autres votent pour le plus convaincant…'));
          else parts.push(h('p', { class: 'center muted' }, 'Qui a été le plus convaincant ?'), h('div', { class: 'answer-btns' },
            h('button', { class: 'btn btn-big ' + (v.mine === 0 ? 'btn-ok' : 'btn-soft'), onclick: () => { g.send({ type: 'vote', v: 0 }); sfx.pop(); } }, `🟢 ${name(g, v.pour)}`),
            h('button', { class: 'btn btn-big ' + (v.mine === 1 ? 'btn-bad' : 'btn-soft'), onclick: () => { g.send({ type: 'vote', v: 1 }); sfx.pop(); } }, `🔴 ${name(g, v.contre)}`)));
          parts.push(h('p', { class: 'status-line' }, `🗳️ ${v.voted.length} vote${v.voted.length > 1 ? 's' : ''}`));
        } else if (v.phase === 'result') {
          const n0 = Object.values(v.votes).filter((x) => x === 0).length, n1 = Object.values(v.votes).filter((x) => x === 1).length;
          const loser = v.winner == null ? null : (v.winner === v.pour ? v.contre : v.pour);
          parts.push(h('div', { class: 'panel center col' },
            h('h3', null, v.winner == null ? '🤝 Égalité !' : `🏆 ${name(g, v.winner)} remporte le débat !`),
            h('p', null, `🟢 ${n0} vote${n0 > 1 ? 's' : ''} · 🔴 ${n1} vote${n1 > 1 ? 's' : ''}`),
            loser ? h('p', { class: 'small' }, `Perdant : ${name(g, loser)} → ${sip(1)} !`) : null));
          parts.push(g.isHost ? actBtn(g, 'Débat suivant →', 'next', 'btn-primary btn-big') : null);
        }
        if (g.isHost && v.phase !== 'result') parts.push(h('button', { class: 'btn btn-ghost btn-sm', onclick: () => g.send({ type: 'skip' }) }, '⏭ Passer cette étape'));
        if (key !== lastKey) { if (speaker === g.me) { sfx.go(); buzz([40, 30, 80]); } else if (v.phase === 'result') sfx.end(); }
        lastKey = key;
        main.replaceChildren(...parts);
      },
      destroy() { tp.stop(); },
    };
  },
};
const judges = (room, s) => activePids(room).filter((p) => p !== s.pour && p !== s.contre);
function nextDebate(room, s) {
  s.round++;
  if (s.round > s.st.rounds) { s.phase = 'end'; return; }
  const on = s.order.filter((p) => room.players.some((x) => x.pid === p && x.on));
  s.i++;
  s.pour = on[(2 * s.i) % on.length];
  s.contre = on[(2 * s.i + 1) % on.length];
  if (s.contre === s.pour) s.contre = on[(2 * s.i + 2) % on.length];
  s.topic = drawNew(s, 'debats', DEBATS);
  s.votes = {};
  s.winner = null;
  s.phase = 'pour';
  s.deadline = Date.now() + s.st.time * 1000;
}
function advance(room, s) {
  if (s.phase === 'pour') { s.phase = 'contre'; s.deadline = Date.now() + s.st.time * 1000; } else if (s.phase === 'contre') { s.phase = 'vote'; s.deadline = 0; } else if (s.phase === 'vote') result(room, s);
}
function result(room, s) {
  const n0 = Object.values(s.votes).filter((x) => x === 0).length, n1 = Object.values(s.votes).filter((x) => x === 1).length;
  s.winner = n0 === n1 ? null : n0 > n1 ? s.pour : s.contre;
  if (s.winner) addScore(room, s.winner, 1);
  s.phase = 'result';
}

// =====================================================================
// 3 EN 5 SECONDES
// =====================================================================
export const cinqOnline = {
  id: 'cinq', name: '3 en 5 secondes', short: 'Cite 3 choses en 5 secondes', emoji: '⏱️', minPlayers: 2,
  defaults: { rounds: 10 },
  settingsForm: (st, set) => roundsForm(st, set),
  init(room, st) {
    const order = shuffle(activePids(room));
    const s = { gid: uid(), st, order, player: order[0], round: 0 };
    nextCinq(room, s, true);
    return s;
  },
  action(room, s, pid, a) {
    if (a.type === 'go' && s.phase === 'ready' && pid === s.player) { s.phase = 'run'; s.until = Date.now() + 5300; return true; }
    if (a.type === 'judge' && s.phase === 'judge' && pid !== s.player && typeof a.ok === 'boolean') {
      s.votes[pid] = a.ok;
      if (activePids(room).filter((p) => p !== s.player).every((p) => s.votes[p] != null)) judgeEnd(room, s);
      return true;
    }
    if (a.type === 'next' && s.phase === 'result' && (pid === room.host || pid === s.player)) { nextCinq(room, s); return true; }
    return false;
  },
  tick(room, s) { if (s.phase === 'run' && Date.now() >= s.until) { s.phase = 'judge'; return true; } return false; },
  onLeave(room, s, pid) { if (pid === s.player && s.phase !== 'result') nextCinq(room, s); },
  view(room, s, pid) { return { gid: s.gid, round: s.round, rounds: s.st.rounds, phase: s.phase, player: s.player, prompt: s.prompt, until: s.until, mine: s.votes[pid] ?? null, nv: Object.keys(s.votes).length, ok: s.ok }; },
  // Écran télé : le thème en grand et un compte à rebours géant de 5 secondes.
  tv(room, s) { return this.view(room, s, TV_PID); },
  tvMount(root, g) {
    const colors = gameColors('cinq', ['#00c6ff', '#0072ff']);
    const bar = h('div', { class: 'tv-bar' });
    const turn = h('div');
    const cardSlot = h('div');
    const big = h('div', { class: 'tv-count' });
    const say = tvSay();
    const st = tvStage(root, bar, turn, cardSlot, big, say.el);
    let lastKey = null, iv = null;
    return {
      update(r, v) {
        clearInterval(iv);
        if (st.end(r, v.phase === 'end')) { lastKey = null; return; }
        const key = `${v.gid}:${v.round}:${v.phase}`;
        const N = g.nameOf(v.player);
        bar.replaceChildren(h('span', { class: 'pill' }, `⏱️ Tour ${v.round}/${v.rounds}`), h('div', { class: 'grow' }), v.phase === 'judge' ? h('span', { class: 'pill' }, `🗳️ ${v.nv} avis`) : null);
        if (key !== lastKey) {
          turn.replaceChildren(tvTurn('🎯', N, 'doit citer 3…'));
          cardSlot.replaceChildren(h('div', { class: 'tv-card tv-bigcard', style: { '--g1': colors[0], '--g2': colors[1] } }, h('div', { class: 'kicker' }, 'Cite 3…'), h('div', { class: 'q' }, v.prompt)));
          if (v.phase === 'run') sfx.go(); if (v.phase === 'judge') sfx.end(); if (v.phase === 'result') v.ok ? sfx.ok() : sfx.bad();
        }
        big.textContent = '';
        if (v.phase === 'run') {
          const upd = () => { const n = Math.ceil(Math.max(0, v.until - 300 - g.now()) / 1000); if (big.textContent !== String(n)) { big.textContent = String(n); big.classList.remove('pop-in'); void big.offsetWidth; big.classList.add('pop-in'); if (n > 0) sfx.tick(); } };
          upd(); iv = setInterval(upd, 100);
          say.set('');
        } else if (v.phase === 'ready') say.set(`📱 ${N} lance le chrono sur son téléphone…`);
        else if (v.phase === 'judge') say.set('Alors, réussi ? Jugez sur vos téléphones !');
        else say.set(v.ok ? `✅ Réussi ! ${N} +1` : `❌ Raté ! ${N} prend ${sip(1)}.`);
        lastKey = key;
      },
      destroy() { clearInterval(iv); },
    };
  },
  mount(root, g) {
    const colors = gameColors('cinq', ['#00c6ff', '#0072ff']);
    const main = h('div', { class: 'col' });
    root.append(main);
    let lastKey = null, iv = null;
    return {
      update(r, v) {
        clearInterval(iv);
        if (v.phase === 'end') { main.replaceChildren(...endScreen(r, g)); lastKey = 'end'; return; }
        const key = `${v.gid}:${v.round}:${v.phase}`;
        const me = v.player === g.me;
        const parts = [h('div', { class: 'row' }, h('span', { class: 'pill' }, `⏱️ ${v.round}/${v.rounds}`), h('div', { class: 'grow' }), h('span', { class: 'pill' }, `🎯 ${name(g, v.player)}`)),
          card(colors, `${me ? 'Cite' : g.nameOf(v.player) + ' doit citer'} 3…`, v.prompt)];
        if (v.phase === 'ready') parts.push(me ? actBtn(g, '▶ Go ! (5 secondes)', 'go', 'btn-primary btn-big') : h('p', { class: 'center muted' }, `${g.nameOf(v.player)} va lancer le chrono…`));
        if (v.phase === 'run') {
          const num = h('div', { class: 'countdown-num' });
          parts.push(num);
          const upd = () => { const n = Math.ceil(Math.max(0, v.until - 300 - g.now()) / 1000); if (num.textContent !== String(n)) { num.textContent = String(n); if (n > 0) sfx.tick(); } };
          upd(); iv = setInterval(upd, 100);
        }
        if (v.phase === 'judge') {
          if (me) parts.push(h('p', { class: 'center' }, '🤞 Les autres jugent…'));
          else parts.push(h('p', { class: 'center muted' }, 'Alors, réussi ?'), h('div', { class: 'answer-btns' },
            h('button', { class: 'btn btn-big ' + (v.mine === false ? 'btn-bad' : 'btn-soft'), onclick: () => g.send({ type: 'judge', ok: false }) }, '❌ Raté'),
            h('button', { class: 'btn btn-big ' + (v.mine === true ? 'btn-ok' : 'btn-soft'), onclick: () => g.send({ type: 'judge', ok: true }) }, '✅ Réussi')));
        }
        if (v.phase === 'result') {
          parts.push(h('div', { class: 'panel center' }, h('h3', null, v.ok ? `✅ Réussi ! ${name(g, v.player)} +1` : `❌ Raté ! ${name(g, v.player)} ${v.player === g.me ? 'prends' : 'prend'} ${sip(1)}.`)));
          if (me || g.isHost) parts.push(actBtn(g, 'Joueur suivant →', 'next', 'btn-primary btn-big'));
        }
        if (key !== lastKey) { if (v.phase === 'run') sfx.go(); if (v.phase === 'judge') sfx.end(); if (v.phase === 'result') v.ok ? sfx.ok() : sfx.bad(); }
        lastKey = key;
        main.replaceChildren(...parts);
      },
      destroy() { clearInterval(iv); },
    };
  },
};
function nextCinq(room, s, first = false) {
  s.round++;
  if (s.round > s.st.rounds) { s.phase = 'end'; return; }
  if (!first) s.player = nextOn(room, s.order, s.player);
  s.prompt = drawNew(s, 'cinq', CINQ);
  s.votes = {}; s.ok = null; s.phase = 'ready';
}
function judgeEnd(room, s) {
  const vals = Object.values(s.votes);
  s.ok = vals.filter(Boolean).length >= vals.length / 2;
  if (s.ok) addScore(room, s.player, 1);
  s.phase = 'result';
}

// =====================================================================
// DEUX VÉRITÉS, UN MENSONGE
// =====================================================================
export const deuxOnline = {
  id: 'deuxverites', name: 'Deux vérités, un mensonge', short: 'Démasque le mensonge', emoji: '🤥', minPlayers: 3,
  defaults: { levels: ['soft'] },
  settingsForm: (st, set) => levelsForm(DEUX_LEVELS, st, set),
  init(room, st) {
    const order = shuffle(activePids(room));
    const s = { gid: uid(), st, order, teller: order[0], n: 0 };
    startDeux(s);
    return s;
  },
  action(room, s, pid, a) {
    if (a.type === 'submit' && s.phase === 'write' && pid === s.teller && Array.isArray(a.items) && a.items.length === 3 && [0, 1, 2].includes(a.lie)) {
      const items = a.items.map((t) => String(t || '').trim().slice(0, 140));
      if (items.some((t) => !t)) return false;
      const order = shuffle([0, 1, 2]);
      s.items = order.map((i) => items[i]);
      s.lie = order.indexOf(a.lie);
      s.phase = 'vote';
      return true;
    }
    if (a.type === 'vote' && s.phase === 'vote' && pid !== s.teller && [0, 1, 2].includes(a.v)) {
      s.votes[pid] = a.v;
      if (activePids(room).filter((p) => p !== s.teller).every((p) => s.votes[p] != null)) deuxResult(room, s);
      return true;
    }
    if (a.type === 'reveal' && s.phase === 'vote' && (pid === room.host || pid === s.teller)) { deuxResult(room, s); return true; }
    if (a.type === 'next' && s.phase === 'result' && (pid === room.host || pid === s.teller)) { s.teller = nextOn(room, s.order, s.teller); startDeux(s); return true; }
    return false;
  },
  onLeave(room, s, pid) { if (pid === s.teller && s.phase !== 'result') { s.teller = nextOn(room, s.order, s.teller); startDeux(s); } },
  onJoin(room, s, pid) { if (!s.order.includes(pid)) s.order.push(pid); },
  view(room, s, pid) {
    return { gid: s.gid, n: s.n, phase: s.phase, teller: s.teller, theme: s.theme, items: s.items, mine: s.votes[pid] ?? null, nv: Object.keys(s.votes).length,
      lie: s.phase === 'result' || pid === s.teller ? s.lie : null, votes: s.phase === 'result' ? s.votes : null };
  },
  // Écran télé : les trois anecdotes en grand, puis le mensonge démasqué et qui s'est fait piéger.
  tv(room, s) { return this.view(room, s, TV_PID); },
  tvMount(root, g) {
    const colors = gameColors('deuxverites', ['#283c86', '#45a247']);
    const bar = h('div', { class: 'tv-bar' });
    const cardSlot = h('div');
    const items = h('div', { class: 'tv-col' });
    const say = tvSay();
    const main = h('div', { class: 'tv-fill' }, bar, cardSlot, items, say.el);
    root.append(main);
    let lastKey = null;
    return {
      update(r, v) {
        const key = `${v.gid}:${v.n}:${v.phase}`;
        const T = g.nameOf(v.teller);
        bar.replaceChildren(h('span', { class: 'pill' }, `🤥 ${T}`), h('div', { class: 'grow' }), v.phase === 'vote' ? h('span', { class: 'pill' }, `🗳️ ${v.nv} vote${v.nv > 1 ? 's' : ''}`) : null);
        if (key === lastKey) return;
        cardSlot.replaceChildren(h('div', { class: 'tv-card', style: { '--g1': colors[0], '--g2': colors[1] } }, h('div', { class: 'kicker' }, `Trois anecdotes de ${T}…`), h('div', { class: 'q' }, v.theme)));
        if (v.phase === 'write') { items.replaceChildren(); say.set(`✍️ ${T} écrit 2 vérités et 1 mensonge… Préparez vos questions !`); }
        else {
          const counts = [0, 1, 2].map((i) => (v.votes ? Object.values(v.votes).filter((x) => x === i).length : 0));
          items.replaceChildren(...v.items.map((t, i) => {
            const res = v.phase === 'result';
            return h('div', { class: 'tv-anec' + (res ? (v.lie === i ? ' lie' : ' truth') : '') },
              h('b', null, String(i + 1)), h('span', { class: 't' }, t),
              res ? h('span', { class: 'm' }, `${v.lie === i ? '🤥 MENSONGE' : '✅ Vrai'} · ${counts[i]} vote${counts[i] > 1 ? 's' : ''}`) : null);
          }));
          if (v.phase === 'vote') say.set(`📱 Votez pour l'anecdote que vous croyez fausse. ${T}, défends tes histoires !`);
          else {
            const fooled = Object.entries(v.votes).filter(([, x]) => x !== v.lie).map(([p]) => g.nameOf(p));
            say.set(fooled.length ? `Piégés : ${fooled.join(', ')} → ${sip(1)} chacun !` : 'Personne n\'a été piégé !');
            sfx.end();
          }
        }
        lastKey = key;
      },
      destroy() {},
    };
  },
  mount(root, g) {
    const colors = gameColors('deuxverites', ['#283c86', '#45a247']);
    const main = h('div', { class: 'col' });
    root.append(main);
    let lastKey = null, form = null;
    return {
      update(r, v) {
        const key = `${v.gid}:${v.n}:${v.phase}`;
        const me = v.teller === g.me;
        if (v.phase === 'write' && me && form && lastKey === key) return; // ne pas effacer la saisie
        const parts = [h('div', { class: 'row' }, h('span', { class: 'pill' }, `🤥 ${me ? 'À toi' : g.nameOf(v.teller)}`), h('div', { class: 'grow' }), h('span', { class: 'pill' }, `#${v.n}`)),
          card(colors, `Trois anecdotes ${me ? '' : 'de ' + g.nameOf(v.teller) + ' '}…`, v.theme)];
        form = null;
        if (v.phase === 'write') {
          if (me) {
            let lie = 2;
            const ins = [0, 1, 2].map((i) => h('textarea', { class: 'input', rows: 2, maxlength: '140', placeholder: i === 2 ? 'Anecdote n°3' : `Anecdote n°${i + 1}`, style: { minHeight: '64px' } }));
            const pick = h('div', { class: 'seg' });
            const renderPick = () => pick.replaceChildren(...[0, 1, 2].map((i) => h('button', { class: i === lie ? 'on' : '', type: 'button', onclick: () => { lie = i; renderPick(); } }, `n°${i + 1}`)));
            renderPick();
            form = h('div', { class: 'col' }, h('p', { class: 'muted small' }, 'Écris 2 vérités et 1 mensonge (dans l\'ordre que tu veux) :'), ...ins,
              h('label', { class: 'field' }, 'Laquelle est le mensonge ?', pick),
              h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => { const items = ins.map((x) => x.value.trim()); if (items.some((t) => !t)) return; g.send({ type: 'submit', items, lie }); sfx.pop(); } }, 'Envoyer'));
            parts.push(form);
          } else parts.push(h('p', { class: 'center muted' }, `✍️ ${g.nameOf(v.teller)} écrit ses anecdotes… Préparez vos questions !`));
        } else {
          const counts = [0, 1, 2].map((i) => (v.votes ? Object.values(v.votes).filter((x) => x === i).length : 0));
          parts.push(h('div', { class: 'col' }, v.items.map((t, i) => {
            const isLie = v.lie === i && v.phase === 'result';
            const b = h('button', {
              class: 'reveal-opt' + (isLie ? ' lie' : '') + (v.mine === i ? ' mine' : '') + (v.phase === 'result' && !isLie ? ' truth' : ''),
              style: { textAlign: 'left', color: 'inherit' },
              onclick: v.phase === 'vote' && !me ? () => { g.send({ type: 'vote', v: i }); sfx.pop(); } : null,
            }, h('div', { class: 'txt' }, `${i + 1}. ${t}`),
            v.phase === 'result' ? h('div', { class: 'meta' }, h('span', null, isLie ? '🤥 MENSONGE' : '✅ Vrai'), h('b', null, `${counts[i]} vote${counts[i] > 1 ? 's' : ''}`)) : (me && v.lie === i ? h('div', { class: 'meta' }, h('span', null, '🤫 (ton mensonge)')) : null));
            return b;
          })));
          if (v.phase === 'vote') {
            parts.push(h('p', { class: 'status-line' }, me ? `🗳️ ${v.nv} vote${v.nv > 1 ? 's' : ''}… raconte et défends tes histoires !` : (v.mine != null ? 'Vote enregistré, tu peux encore changer.' : 'Touche l\'anecdote que tu crois fausse.')));
            if (me || g.isHost) parts.push(actBtn(g, '👀 Révéler', 'reveal'));
          } else {
            const fooled = Object.entries(v.votes).filter(([, x]) => x !== v.lie).map(([p]) => name(g, p));
            parts.push(h('p', { class: 'center' }, fooled.length ? `Piégés : ${fooled.join(', ')} → ${sip(1)} chacun !` : 'Personne n\'a été piégé !'));
            if (me || g.isHost) parts.push(actBtn(g, 'Joueur suivant →', 'next', 'btn-primary btn-big'));
          }
        }
        if (key !== lastKey && v.phase === 'result') sfx.end();
        lastKey = key;
        main.replaceChildren(...parts);
      },
      destroy() {},
    };
  },
};
function startDeux(s) { s.n++; s.phase = 'write'; s.items = null; s.lie = null; s.votes = {}; s.theme = drawNew(s, 'on:deuxverites:' + lvOf(DEUX, s.st.levels), () => flat(DEUX, s.st.levels)); }
function deuxResult(room, s) {
  for (const [p, x] of Object.entries(s.votes)) { if (x === s.lie) addScore(room, p, 1); else addScore(room, s.teller, 1); }
  s.phase = 'result';
}
