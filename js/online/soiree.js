// Jeux d'ambiance en ligne : Qui a écrit ça ?, Le Curseur, Dans sa tête, Dans l'ordre !, Qui suis-je ?, Chifoumi.
import { h, uid, shuffle, seg, pick, rand } from '../ui.js';
import { gameColors } from '../themes.js';
import { levelPicker } from '../common.js';
import { sip } from '../store.js';
import { sfx, buzz } from '../sfx.js';
import { activePids, addScore, nextOn, card, endScreen, timerPill, actBtn } from './kit.js';
import { matches } from '../race-core.js';
import QAE from '../data/quiaecrit.js';
import CURSEUR from '../data/curseur.js';
import CLASSEMENT from '../data/classement.js';
import ORDRE, { fmtYear } from '../data/ordre.js';
import FRONT from '../data/front.js';

const name = (g, pid) => (pid === g.me ? 'Toi' : g.nameOf(pid));
const roundsSeg = (st, set, vals, label = 'Nombre de manches') => h('label', { class: 'field' }, label, seg(vals.map((n) => ({ value: n, label: String(n) })), st.rounds, (v) => set({ rounds: v })));
const top = (pills) => h('div', { class: 'row' }, ...pills.flatMap((p, i) => (i === 1 ? [h('div', { class: 'grow' }), p] : [p])));
const pill = (t) => h('span', { class: 'pill' }, t);

/** Liste à classer en touchant les éléments dans l'ordre. order = indices déjà classés. */
export function rankList(items, order, onChange, { disabled = false, labels = null } = {}) {
  return h('div', { class: 'rank-list' }, items.map((it, i) => {
    const pos = order.indexOf(i);
    return h('button', {
      class: 'rank-item' + (pos >= 0 ? ' on' : ''), disabled,
      onclick: () => { const o = order.slice(); if (pos >= 0) o.splice(pos); else o.push(i); onChange(o); sfx.tick(); },
    }, h('span', { class: 'rk' }, pos >= 0 ? String(pos + 1) : '·'), h('span', { class: 't' }, it), labels ? h('span', { class: 'yr' }, labels[i]) : null);
  }));
}

// =====================================================================
// QUI A ÉCRIT ÇA ?
// =====================================================================
const QAE_LEVELS = [
  { id: 'fun', name: 'Classique', emoji: '😄', desc: 'Souvenirs, hontes et rêves.' },
  { id: 'hot', name: 'Hot', emoji: '🔥', desc: 'Amour et séduction, réservé aux adultes.', adult: true },
];
export const quiaecritOnline = {
  id: 'quiaecrit', name: 'Qui a écrit ça ?', short: 'Réponses anonymes : devine l\'auteur', emoji: '🕵️‍♀️', minPlayers: 3,
  defaults: { rounds: 3, time: 60, levels: ['fun'] },
  settingsForm(st, set) {
    const sel = new Set((st.levels || []).filter((l) => QAE[l]));
    if (!sel.size) sel.add('fun');
    set({ levels: [...sel] });
    return h('div', { class: 'col' }, roundsSeg(st, set, [2, 3, 5]),
      h('label', { class: 'field' }, 'Temps pour écrire', seg([45, 60, 90].map((n) => ({ value: n, label: n + ' s' })), st.time, (v) => set({ time: v }))),
      levelPicker(QAE_LEVELS, sel, (x) => set({ levels: [...x] })));
  },
  init(room, st) {
    const s = { gid: uid(), st, round: 0, deck: shuffle((st.levels || ['fun']).flatMap((l) => QAE[l] || [])) };
    qaeRound(s);
    return s;
  },
  action(room, s, pid, a) {
    if (a.type === 'answer' && s.phase === 'write') {
      const t = String(a.v || '').trim().slice(0, 120);
      if (!t) return false;
      s.answers[pid] = t;
      if (activePids(room).every((p) => s.answers[p])) qaeGuess(s);
      return true;
    }
    if (a.type === 'vote' && s.phase === 'guess') {
      const cur = s.list[s.idx];
      if (pid === cur.pid || !room.players.some((p) => p.pid === a.pid)) return false;
      s.votes[pid] = a.pid;
      if (activePids(room).filter((p) => p !== cur.pid).every((p) => s.votes[p])) qaeReveal(room, s);
      return true;
    }
    if (a.type === 'next' && pid === room.host) {
      if (s.phase === 'write') { qaeGuess(s); return true; }
      if (s.phase === 'guess') { qaeReveal(room, s); return true; }
      if (s.phase === 'reveal') { qaeNext(room, s); return true; }
    }
    return false;
  },
  tick(room, s) {
    const now = Date.now();
    if (s.phase === 'write' && now >= s.deadline) { qaeGuess(s); return true; }
    if (s.phase === 'guess' && now >= s.deadline) { qaeReveal(room, s); return true; }
    return false;
  },
  view(room, s, pid) {
    const cur = s.list && s.list[s.idx];
    return { gid: s.gid, round: s.round, rounds: s.st.rounds, phase: s.phase, prompt: s.prompt, deadline: s.deadline, mine: s.answers[pid] || null, nAns: Object.keys(s.answers).length,
      idx: s.idx, total: s.list ? s.list.length : 0, text: cur ? cur.text : null, isMine: cur ? cur.pid === pid : false, myVote: s.votes ? s.votes[pid] || null : null,
      nVotes: s.votes ? Object.keys(s.votes).length : 0, author: s.phase === 'reveal' ? cur.pid : null, votes: s.phase === 'reveal' ? s.votes : null };
  },
  mount(root, g) {
    const colors = gameColors('quiaecrit', ['#8e2de2', '#4a00e0']);
    const main = h('div', { class: 'col' });
    const tp = timerPill(g);
    root.append(main);
    let lastKey = null, input = null;
    return {
      update(r, v) {
        if (v.phase === 'end') { tp.set(0); main.replaceChildren(...endScreen(r, g)); if (lastKey !== 'end') sfx.fanfare(); lastKey = 'end'; return; }
        const key = `${v.gid}:${v.round}:${v.phase}:${v.idx}`;
        tp.set(v.phase === 'write' || v.phase === 'guess' ? v.deadline : 0);
        if (v.phase === 'write' && key === lastKey && !v.mine && input) { main.querySelector('.status-line').textContent = `✍️ ${v.nAns} réponse${v.nAns > 1 ? 's' : ''}`; return; }
        const parts = [top([pill(`🕵️‍♀️ ${v.round}/${v.rounds}`), tp.el]), card(colors, v.phase === 'write' ? 'Réponds en secret…' : 'La question était…', v.prompt)];
        input = null;
        if (v.phase === 'write') {
          if (v.mine) parts.push(h('div', { class: 'panel center' }, h('p', { class: 'muted small' }, 'Ta réponse'), h('h3', null, v.mine), h('p', { class: 'muted small' }, 'Les autres devront deviner que c\'est toi 😏')));
          else {
            input = h('textarea', { class: 'input', rows: 2, maxlength: '120', placeholder: 'Ta réponse (reste vague si tu veux piéger les autres !)', style: { minHeight: '70px' } });
            parts.push(input, h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => { const t = input.value.trim(); if (t) { g.send({ type: 'answer', v: t }); sfx.pop(); } } }, 'Envoyer'));
          }
          parts.push(h('p', { class: 'status-line' }, `✍️ ${v.nAns} réponse${v.nAns > 1 ? 's' : ''}`));
          if (g.isHost) parts.push(actBtn(g, '⏭ Passer à la suite', 'next'));
        } else {
          parts.push(h('div', { class: 'tel-text', style: { fontSize: '22px' } }, `« ${v.text} »`), h('p', { class: 'center muted small' }, `Réponse ${v.idx + 1}/${v.total} · Qui a écrit ça ?`));
          if (v.phase === 'guess') {
            if (v.isMine) parts.push(h('p', { class: 'center' }, '🤫 C\'est ta réponse ! Garde ton sérieux…'));
            else parts.push(h('div', { class: 'vote-grid' }, r.players.filter((p) => p.pid !== g.me).map((p) => h('button', {
              class: v.myVote === p.pid ? 'on' : '', style: { background: v.myVote === p.pid ? '#fff' : 'var(--card2)' }, onclick: () => { g.send({ type: 'vote', pid: p.pid }); sfx.pop(); },
            }, p.name))));
            parts.push(h('p', { class: 'status-line' }, `🗳️ ${v.nVotes} vote${v.nVotes > 1 ? 's' : ''}`));
            if (g.isHost) parts.push(actBtn(g, '👀 Révéler', 'next'));
          } else {
            const good = Object.entries(v.votes).filter(([, x]) => x === v.author).map(([p]) => name(g, p));
            const bad = Object.entries(v.votes).filter(([, x]) => x !== v.author).map(([p]) => name(g, p));
            parts.push(h('div', { class: 'panel center col' }, h('h2', null, `✍️ ${name(g, v.author)} !`),
              h('p', null, good.length ? `✅ Bien vu : ${good.join(', ')} (+1)` : '✅ Personne n\'a trouvé !'),
              bad.length ? h('p', { class: 'small' }, `❌ Piégés : ${bad.join(', ')} → +${bad.length} pour ${name(g, v.author)}, et ${sip(1)} pour les piégés !`) : null));
            if (g.isHost) parts.push(actBtn(g, 'Suivant →', 'next', 'btn-primary btn-big'));
          }
        }
        if (key !== lastKey) { if (v.phase === 'write') sfx.go(); if (v.phase === 'reveal') sfx.end(); }
        lastKey = key;
        main.replaceChildren(...parts);
      },
      destroy() { tp.stop(); },
    };
  },
};
function qaeRound(s) {
  s.round++;
  if (s.round > s.st.rounds) { s.phase = 'end'; return; }
  if (!s.deck.length) s.deck = shuffle(QAE.fun.slice());
  s.prompt = s.deck.pop();
  s.answers = {}; s.list = null; s.idx = 0; s.votes = {};
  s.phase = 'write'; s.deadline = Date.now() + s.st.time * 1000;
}
function qaeGuess(s) {
  s.list = shuffle(Object.entries(s.answers).map(([pid, text]) => ({ pid, text })));
  if (!s.list.length) { qaeRound(s); return; }
  s.idx = 0; s.votes = {}; s.phase = 'guess'; s.deadline = Date.now() + 30000;
}
function qaeReveal(room, s) {
  const author = s.list[s.idx].pid;
  for (const [p, x] of Object.entries(s.votes)) { if (x === author) addScore(room, p, 1); else addScore(room, author, 1); }
  s.phase = 'reveal';
}
function qaeNext(room, s) {
  s.idx++;
  if (s.idx >= s.list.length) { qaeRound(s); return; }
  s.votes = {}; s.phase = 'guess'; s.deadline = Date.now() + 30000;
}

// =====================================================================
// LE CURSEUR
// =====================================================================
export const cursorPoints = (d) => (d <= 4 ? 4 : d <= 10 ? 3 : d <= 18 ? 2 : d <= 28 ? 1 : 0);
export function scaleEl(pair, { target = null, marks = [], value = null } = {}) {
  return h('div', { class: 'scale' },
    h('div', { class: 'scale-labels' }, h('span', null, `⬅️ ${pair[0]}`), h('span', null, `${pair[1]} ➡️`)),
    h('div', { class: 'scale-bar' + (marks.length ? ' with-marks' : '') },
      target != null ? h('div', { class: 'scale-target', style: { left: `clamp(18px, ${target}%, calc(100% - 18px))` } }) : null,
      ...marks.map((m) => h('div', { class: 'scale-mark' + (m.me ? ' me' : ''), style: { left: `${m.v}%` }, title: m.label }, h('span', null, m.label))),
      value != null ? h('div', { class: 'scale-mark me', style: { left: `${value}%` } }) : null));
}
export const curseurOnline = {
  id: 'curseur', name: 'Le Curseur', short: 'Un indice, placez le curseur', emoji: '🎚️', minPlayers: 2,
  defaults: { rounds: 6 },
  settingsForm: (st, set) => roundsSeg(st, set, [4, 6, 10], 'Nombre de tours'),
  init(room, st) {
    const order = shuffle(activePids(room));
    const s = { gid: uid(), st, order, giver: order[0], round: 0, deck: shuffle(CURSEUR.slice()) };
    curRound(room, s, true);
    return s;
  },
  action(room, s, pid, a) {
    if (a.type === 'clue' && s.phase === 'clue' && pid === s.giver) { const t = String(a.v || '').trim().slice(0, 60); if (!t) return false; s.clue = t; s.phase = 'guess'; return true; }
    if (a.type === 'guess' && s.phase === 'guess' && pid !== s.giver && Number.isFinite(a.v)) {
      s.guesses[pid] = Math.max(0, Math.min(100, Math.round(a.v)));
      if (activePids(room).filter((p) => p !== s.giver).every((p) => s.guesses[p] != null)) curReveal(room, s);
      return true;
    }
    if (a.type === 'reveal' && s.phase === 'guess' && (pid === room.host || pid === s.giver)) { curReveal(room, s); return true; }
    if (a.type === 'next' && s.phase === 'reveal' && (pid === room.host || pid === s.giver)) { curRound(room, s); return true; }
    return false;
  },
  onLeave(room, s, pid) { if (pid === s.giver && s.phase !== 'reveal') curRound(room, s); },
  view(room, s, pid) {
    const giver = pid === s.giver;
    return { gid: s.gid, round: s.round, rounds: s.st.rounds, phase: s.phase, giver: s.giver, pair: s.pair, clue: s.clue,
      target: giver || s.phase === 'reveal' ? s.target : null, mine: s.guesses[pid] ?? null, nG: Object.keys(s.guesses).length, guesses: s.phase === 'reveal' ? s.guesses : null, pts: s.pts };
  },
  mount(root, g) {
    const colors = gameColors('curseur', ['#ff6a00', '#ee0979']);
    const main = h('div', { class: 'col' });
    root.append(main);
    let lastKey = null;
    return {
      update(r, v) {
        if (v.phase === 'end') { main.replaceChildren(...endScreen(r, g)); if (lastKey !== 'end') sfx.fanfare(); lastKey = 'end'; return; }
        const key = `${v.gid}:${v.round}:${v.phase}`;
        const me = v.giver === g.me;
        if (key === lastKey && v.phase === 'guess' && !me) { const st = main.querySelector('.status-line'); if (st) st.textContent = `🎚️ ${v.nG} curseur${v.nG > 1 ? 's' : ''} posé${v.nG > 1 ? 's' : ''}`; if (v.mine == null) return; }
        if (key === lastKey && v.phase === 'clue' && me) return;
        const parts = [top([pill(`🎚️ ${v.round}/${v.rounds}`), pill(`💡 ${name(g, v.giver)}`)])];
        if (v.phase === 'clue') {
          if (me) {
            const input = h('input', { class: 'input', maxlength: '60', placeholder: 'Ton indice (un mot, un nom, un truc…)', autocomplete: 'off' });
            parts.push(card(colors, 'Ta cible secrète', null, scaleEl(v.pair, { target: v.target })),
              h('p', { class: 'muted small center' }, 'Donne un indice qui se place à peu près là sur l\'échelle. Exemple : « soupe » pour Froid ↔ Chaud vers la droite.'),
              h('form', { class: 'chat-form', onsubmit: (e) => { e.preventDefault(); const t = input.value.trim(); if (t) { g.send({ type: 'clue', v: t }); sfx.pop(); } } }, input, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Envoyer')));
          } else parts.push(card(colors, 'L\'échelle', null, scaleEl(v.pair)), h('p', { class: 'center muted' }, `💡 ${g.nameOf(v.giver)} cherche un indice…`));
        } else if (v.phase === 'guess') {
          parts.push(card(colors, `L'indice de ${name(g, v.giver)}`, `« ${v.clue} »`, scaleEl(v.pair, me ? { target: v.target } : {})));
          if (!me) {
            const range = h('input', { type: 'range', min: '0', max: '100', value: String(v.mine ?? 50), class: 'scale-range' });
            parts.push(range, h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => { g.send({ type: 'guess', v: Number(range.value) }); sfx.pop(); buzz(15); } }, v.mine != null ? '✅ Curseur posé (tu peux le changer)' : '📍 Poser mon curseur'));
          } else parts.push(h('p', { class: 'center' }, '🤐 Pas un mot ! Les autres placent leur curseur…'), actBtn(g, '👀 Révéler', 'reveal'));
          parts.push(h('p', { class: 'status-line' }, `🎚️ ${v.nG} curseur${v.nG > 1 ? 's' : ''} posé${v.nG > 1 ? 's' : ''}`));
        } else {
          const marks = Object.entries(v.guesses).map(([p, x]) => ({ v: x, label: name(g, p), me: p === g.me }));
          parts.push(card(colors, `L'indice : « ${v.clue} »`, null, scaleEl(v.pair, { target: v.target, marks })),
            h('div', { class: 'scoreboard' }, Object.entries(v.pts).sort((a, b) => b[1] - a[1]).map(([p, n]) => h('div', { class: 'score-row' }, h('span', { class: 'n' }, name(g, p) + (p === v.giver ? ' 💡' : '')), h('span', { class: 's' }, `+${n}`)))));
          if (me || g.isHost) parts.push(actBtn(g, 'Tour suivant →', 'next', 'btn-primary btn-big'));
          if (key !== lastKey) sfx.end();
        }
        lastKey = key;
        main.replaceChildren(...parts);
      },
      destroy() {},
    };
  },
};
function curRound(room, s, first = false) {
  s.round++;
  if (s.round > s.st.rounds) { s.phase = 'end'; return; }
  if (!first) s.giver = nextOn(room, s.order, s.giver);
  if (!s.deck.length) s.deck = shuffle(CURSEUR.slice());
  s.pair = s.deck.pop();
  s.target = Math.round(rand(6, 94));
  s.clue = ''; s.guesses = {}; s.pts = null; s.phase = 'clue';
}
function curReveal(room, s) {
  const pts = {};
  for (const [p, x] of Object.entries(s.guesses)) { pts[p] = cursorPoints(Math.abs(x - s.target)); addScore(room, p, pts[p]); }
  const vals = Object.values(pts);
  pts[s.giver] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  addScore(room, s.giver, pts[s.giver]);
  s.pts = pts; s.phase = 'reveal';
}

// =====================================================================
// DANS SA TÊTE
// =====================================================================
export const danssateteOnline = {
  id: 'danssatete', name: 'Dans sa tête', short: 'Devine le classement d\'un joueur', emoji: '🧠', minPlayers: 3,
  defaults: { rounds: 6 },
  settingsForm: (st, set) => roundsSeg(st, set, [4, 6, 10], 'Nombre de tours'),
  init(room, st) {
    const order = shuffle(activePids(room));
    const s = { gid: uid(), st, order, judge: order[0], round: 0, deck: shuffle(CLASSEMENT.slice()) };
    dstRound(room, s, true);
    return s;
  },
  action(room, s, pid, a) {
    if (a.type === 'rank' && s.phase === 'rank' && Array.isArray(a.o) && a.o.length === 5 && new Set(a.o).size === 5 && a.o.every((x) => Number.isInteger(x) && x >= 0 && x < 5)) {
      s.ranks[pid] = a.o;
      if (s.ranks[s.judge] && activePids(room).every((p) => s.ranks[p])) dstReveal(room, s);
      return true;
    }
    if (a.type === 'reveal' && s.phase === 'rank' && pid === room.host && s.ranks[s.judge]) { dstReveal(room, s); return true; }
    if (a.type === 'next' && s.phase === 'reveal' && (pid === room.host || pid === s.judge)) { dstRound(room, s); return true; }
    return false;
  },
  onLeave(room, s, pid) { if (pid === s.judge && s.phase === 'rank') dstRound(room, s); },
  view(room, s, pid) {
    return { gid: s.gid, round: s.round, rounds: s.st.rounds, phase: s.phase, judge: s.judge, theme: s.theme, items: s.items, mine: s.ranks[pid] || null,
      done: Object.keys(s.ranks), judgeRank: s.phase === 'reveal' ? s.ranks[s.judge] : null, ranks: s.phase === 'reveal' ? s.ranks : null, pts: s.pts };
  },
  mount(root, g) {
    const colors = gameColors('danssatete', ['#c94b4b', '#4b134f']);
    const main = h('div', { class: 'col' });
    root.append(main);
    let lastKey = null, order = [];
    const render = (r, v) => {
      const me = v.judge === g.me;
      const parts = [top([pill(`🧠 ${v.round}/${v.rounds}`), pill(`🎯 ${name(g, v.judge)}`)]),
        card(colors, me ? 'Classe selon TES goûts (1 = le mieux)' : `Comment ${g.nameOf(v.judge)} a-t-il classé…`, v.theme)];
      if (v.phase === 'rank') {
        if (v.mine) parts.push(h('div', { class: 'rank-list' }, v.mine.map((i, k) => h('div', { class: 'rank-item on' }, h('span', { class: 'rk' }, String(k + 1)), h('span', { class: 't' }, v.items[i])))),
          h('p', { class: 'status-line' }, `✅ Envoyé · ${v.done.length}/${r.players.filter((p) => p.on).length} ont classé`));
        else {
          parts.push(h('p', { class: 'muted small center' }, 'Touche les éléments dans l\'ordre, du 1er au 5e (touche à nouveau pour annuler).'),
            rankList(v.items, order, (o) => { order = o; render(r, v); }),
            h('button', { class: 'btn btn-primary btn-big btn-block', disabled: order.length < 5, onclick: () => { g.send({ type: 'rank', o: order }); sfx.pop(); } }, 'Valider mon classement'));
        }
        if (g.isHost && v.done.includes(v.judge)) parts.push(actBtn(g, '👀 Révéler sans attendre', 'reveal'));
      } else {
        parts.push(h('p', { class: 'center' }, h('b', null, me ? 'Ton classement :' : `Le classement de ${g.nameOf(v.judge)} :`)),
          h('div', { class: 'rank-list' }, v.judgeRank.map((i, k) => h('div', { class: 'rank-item on' }, h('span', { class: 'rk' }, String(k + 1)), h('span', { class: 't' }, v.items[i]),
            h('span', { class: 'yr' }, Object.entries(v.ranks).filter(([p, o]) => p !== v.judge && o[k] === i).map(([p]) => name(g, p)).join(', '))))),
          h('div', { class: 'scoreboard' }, Object.entries(v.pts).sort((a, b) => b[1] - a[1]).map(([p, n]) => h('div', { class: 'score-row' }, h('span', { class: 'n' }, name(g, p)), h('span', { class: 's' }, `+${n}`)))));
        if (me || g.isHost) parts.push(actBtn(g, 'Tour suivant →', 'next', 'btn-primary btn-big'));
      }
      main.replaceChildren(...parts);
    };
    return {
      update(r, v) {
        if (v.phase === 'end') { main.replaceChildren(...endScreen(r, g)); if (lastKey !== 'end') sfx.fanfare(); lastKey = 'end'; return; }
        const key = `${v.gid}:${v.round}:${v.phase}`;
        if (key !== lastKey) { order = []; if (v.phase === 'reveal') sfx.end(); else sfx.go(); }
        lastKey = key;
        render(r, v);
      },
      destroy() {},
    };
  },
};
function dstRound(room, s, first = false) {
  s.round++;
  if (s.round > s.st.rounds) { s.phase = 'end'; return; }
  if (!first) s.judge = nextOn(room, s.order, s.judge);
  if (!s.deck.length) s.deck = shuffle(CLASSEMENT.slice());
  const [theme, items] = s.deck.pop();
  s.theme = theme; s.items = shuffle(items.slice());
  s.ranks = {}; s.pts = null; s.phase = 'rank';
}
function dstReveal(room, s) {
  const ref = s.ranks[s.judge];
  const pts = {};
  let good = 0;
  for (const [p, o] of Object.entries(s.ranks)) {
    if (p === s.judge) continue;
    pts[p] = o.filter((x, k) => ref[k] === x).length;
    if (pts[p] >= 3) good++;
    addScore(room, p, pts[p]);
  }
  pts[s.judge] = good;
  addScore(room, s.judge, good);
  s.pts = pts; s.phase = 'reveal';
}

// =====================================================================
// DANS L'ORDRE !
// =====================================================================
export function ordreQuestion() {
  for (let k = 0; k < 50; k++) {
    const pickd = shuffle(ORDRE.slice()).slice(0, 4);
    const ys = pickd.map((e) => e[1]).sort((a, b) => a - b);
    if (ys.every((y, i) => i === 0 || y - ys[i - 1] >= 2)) return pickd;
  }
  return shuffle(ORDRE.slice()).slice(0, 4);
}
export const ordreOnline = {
  id: 'ordre', name: 'Dans l\'ordre !', short: 'Remets les événements dans l\'ordre', emoji: '📅', minPlayers: 2,
  defaults: { rounds: 8, time: 30 },
  settingsForm(st, set) {
    return h('div', { class: 'col' }, roundsSeg(st, set, [5, 8, 12], 'Nombre de questions'),
      h('label', { class: 'field' }, 'Temps', seg([20, 30, 45].map((n) => ({ value: n, label: n + ' s' })), st.time, (v) => set({ time: v }))));
  },
  init(room, st) { const s = { gid: uid(), st, round: 0 }; ordRound(s); return s; },
  action(room, s, pid, a) {
    if (a.type === 'order' && s.phase === 'q' && !s.answers[pid] && Array.isArray(a.o) && a.o.length === 4 && new Set(a.o).size === 4) {
      const ok = a.o.filter((x, k) => s.sol[k] === x).length;
      const perfect = ok === 4;
      const first = perfect && !Object.values(s.answers).some((x) => x.ok === 4);
      s.answers[pid] = { o: a.o, ok, pts: ok + (perfect ? 2 : 0) + (first ? 1 : 0), first };
      addScore(room, pid, s.answers[pid].pts);
      if (activePids(room).every((p) => s.answers[p])) s.phase = 'reveal';
      return true;
    }
    if (a.type === 'next' && pid === room.host) { if (s.phase === 'q') s.phase = 'reveal'; else ordRound(s); return true; }
    return false;
  },
  tick(room, s) { if (s.phase === 'q' && Date.now() >= s.deadline) { s.phase = 'reveal'; return true; } return false; },
  view(room, s, pid) {
    return { gid: s.gid, round: s.round, rounds: s.st.rounds, phase: s.phase, items: s.items.map((e) => e[0]), deadline: s.deadline, mine: s.answers[pid] || null, n: Object.keys(s.answers).length,
      sol: s.phase === 'reveal' ? s.sol : null, years: s.phase === 'reveal' ? s.items.map((e) => fmtYear(e[1])) : null, answers: s.phase === 'reveal' ? s.answers : null };
  },
  mount(root, g) {
    const main = h('div', { class: 'col' });
    const tp = timerPill(g);
    root.append(main);
    let lastKey = null, order = [];
    const render = (r, v) => {
      tp.set(v.phase === 'q' ? v.deadline : 0);
      const parts = [top([pill(`📅 ${v.round}/${v.rounds}`), tp.el]), h('p', { class: 'center' }, h('b', null, 'Du plus ancien au plus récent :'))];
      if (v.phase === 'q') {
        if (v.mine) parts.push(rankList(v.items, v.mine.o, () => {}, { disabled: true }), h('p', { class: 'status-line' }, `✅ Envoyé · ${v.n} réponse${v.n > 1 ? 's' : ''}`));
        else parts.push(rankList(v.items, order, (o) => { order = o; render(r, v); }),
          h('button', { class: 'btn btn-primary btn-big btn-block', disabled: order.length < 4, onclick: () => { g.send({ type: 'order', o: order }); sfx.pop(); } }, 'Valider'));
        if (g.isHost) parts.push(actBtn(g, '⏭ Révéler', 'next'));
      } else {
        parts.push(rankList(v.sol.map((i) => v.items[i]), [0, 1, 2, 3], () => {}, { disabled: true, labels: v.sol.map((i) => v.years[i]) }),
          h('div', { class: 'scoreboard' }, r.players.map((p) => ({ p, a: v.answers[p.pid] })).sort((a, b) => ((b.a && b.a.pts) || 0) - ((a.a && a.a.pts) || 0)).map((x) => h('div', { class: 'score-row' },
            h('span', { class: 'n' }, (x.p.pid === g.me ? 'Toi' : x.p.name) + (x.a && x.a.first ? ' ⚡' : '')), h('span', { class: 'muted small' }, x.a ? `${x.a.ok}/4 bien placés` : '💤'), h('span', { class: 's' }, `+${x.a ? x.a.pts : 0}`)))),
          g.isHost ? actBtn(g, v.round < v.rounds ? 'Question suivante →' : '🏆 Classement final', 'next', 'btn-primary btn-big') : null);
      }
      main.replaceChildren(...parts);
    };
    return {
      update(r, v) {
        if (v.phase === 'end') { tp.set(0); main.replaceChildren(...endScreen(r, g)); if (lastKey !== 'end') sfx.fanfare(); lastKey = 'end'; return; }
        const key = `${v.gid}:${v.round}:${v.phase}`;
        if (key !== lastKey) { order = []; v.phase === 'q' ? sfx.go() : (v.mine && v.mine.ok === 4 ? sfx.ok() : sfx.end()); }
        lastKey = key;
        render(r, v);
      },
      destroy() { tp.stop(); },
    };
  },
};
function ordRound(s) {
  s.round++;
  if (s.round > s.st.rounds) { s.phase = 'end'; return; }
  s.items = ordreQuestion();
  s.sol = s.items.map((e, i) => [e[1], i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  s.answers = {}; s.phase = 'q'; s.deadline = Date.now() + s.st.time * 1000;
}

// =====================================================================
// QUI SUIS-JE ?
// =====================================================================
const QSJ_CATS = ['celebrites', 'personnages', 'animaux', 'metiers', 'objets', 'films'];
export const quisuisjeOnline = {
  id: 'quisuisje', name: 'Qui suis-je ?', short: 'Tout le monde voit ton identité… sauf toi', emoji: '🎭', minPlayers: 3,
  defaults: { cat: 'celebrites' },
  settingsForm(st, set) {
    return h('label', { class: 'field' }, 'Thème', seg(FRONT.filter((c) => QSJ_CATS.includes(c.id)).map((c) => ({ value: c.id, label: c.emoji })), st.cat, (v) => set({ cat: v })));
  },
  init(room, st) {
    const cat = FRONT.find((c) => c.id === st.cat) || FRONT.find((c) => c.id === 'celebrites');
    const order = shuffle(activePids(room));
    const words = shuffle(cat.words.slice());
    const who = Object.fromEntries(order.map((p, i) => [p, words[i % words.length]]));
    return { gid: uid(), st, cat: cat.name, order, who, asker: order[0], found: {}, rank: 0, wrong: {}, phase: 'play' };
  },
  action(room, s, pid, a) {
    if (s.phase !== 'play' || !s.who[pid]) return false;
    if (a.type === 'guess' && !s.found[pid]) {
      const t = String(a.v || '').trim().slice(0, 60);
      if (!t) return false;
      if (matches(t, [s.who[pid]])) {
        s.rank++;
        s.found[pid] = { rank: s.rank };
        addScore(room, pid, Math.max(1, 4 - s.rank));
        if (s.asker === pid) s.asker = nextAsker(room, s);
      } else s.wrong[pid] = t;
      qsjEnd(room, s);
      return true;
    }
    if (a.type === 'giveup' && !s.found[pid]) { s.found[pid] = { gaveUp: true }; if (s.asker === pid) s.asker = nextAsker(room, s); qsjEnd(room, s); return true; }
    if (a.type === 'next' && (pid === s.asker || pid === room.host)) { s.asker = nextAsker(room, s); return true; }
    return false;
  },
  onLeave(room, s, pid) { if (pid === s.asker) s.asker = nextAsker(room, s); },
  view(room, s, pid) {
    const mineKnown = s.found[pid] || s.phase === 'end';
    return { gid: s.gid, phase: s.phase, cat: s.cat, asker: s.asker, found: s.found, wrong: s.wrong[pid] || null,
      ids: Object.fromEntries(s.order.map((p) => [p, p === pid && !mineKnown ? null : s.who[p]])) };
  },
  mount(root, g) {
    const main = h('div', { class: 'col' });
    root.append(main);
    let lastKey = null, typed = '', inputEl = null, lastWrong = null;
    return {
      update(r, v) {
        const me = v.asker === g.me;
        const myFound = v.found[g.me];
        const base = `${v.gid}:${v.phase}:${Object.keys(v.found).length}:${v.asker}`;
        // Ne pas interrompre la saisie si rien ne change pour moi.
        if (inputEl && document.activeElement === inputEl && lastKey && lastKey.startsWith(base) && v.wrong === lastWrong) return;
        lastWrong = v.wrong;
        inputEl = null;
        const parts = [];
        if (v.phase === 'end') parts.push(...endScreen(r, g, 'Tout le monde s\'est trouvé !'));
        else {
          parts.push(top([pill(`🎭 ${v.cat}`), pill(me ? '🗣️ À toi de poser une question !' : `🗣️ ${g.nameOf(v.asker)} pose une question`)]),
            h('p', { class: 'muted small center' }, 'Pose des questions fermées à voix haute (« Suis-je une femme ? »), les autres répondent oui ou non. Puis passe au suivant.'));
        }
        parts.push(h('div', { class: 'qsj-grid' }, Object.entries(v.ids).map(([p, w]) => h('div', { class: 'qsj-card' + (p === g.me ? ' me' : '') + (v.found[p] ? ' found' : '') },
          h('div', { class: 'nm' }, (p === g.me ? 'Toi' : g.nameOf(p)) + (v.found[p] ? (v.found[p].gaveUp ? ' 🏳️' : ` ✅ ${v.found[p].rank === 1 ? '1er' : v.found[p].rank + 'e'}`) : '')),
          h('div', { class: 'w' }, w || '❓❓❓')))));
        if (v.phase === 'play') {
          if (!myFound) {
            const input = h('input', { class: 'input', placeholder: 'Je pense être…', maxlength: '60', autocomplete: 'off', value: typed, oninput: (e) => { typed = e.target.value; } });
            inputEl = input;
            parts.push(h('form', { class: 'chat-form', onsubmit: (e) => { e.preventDefault(); const t = input.value.trim(); if (t) { g.send({ type: 'guess', v: t }); typed = ''; } } }, input, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Deviner')),
              v.wrong ? h('p', { class: 'small center', style: { color: 'var(--warn)' } }, `❌ « ${v.wrong} » : non !`) : null);
          }
          parts.push(h('div', { class: 'row' },
            me || g.isHost ? h('button', { class: 'btn btn-soft grow', onclick: () => g.send({ type: 'next' }) }, 'Au suivant →') : null,
            !myFound ? h('button', { class: 'btn btn-ghost grow', onclick: () => g.send({ type: 'giveup' }) }, '🏳️ J\'abandonne') : null));
        }
        const key = base;
        if (key !== lastKey) { if (myFound && !(lastKey || '').includes(`found-${g.me}`)) { if (!myFound.gaveUp) { sfx.fanfare(); buzz([40, 30, 120]); } } else if (me) { sfx.go(); buzz(30); } }
        lastKey = key + (myFound ? `found-${g.me}` : '');
        main.replaceChildren(...parts);
      },
      destroy() {},
    };
  },
};
function nextAsker(room, s) {
  const cand = s.order.filter((p) => !s.found[p] && room.players.some((x) => x.pid === p && x.on));
  if (!cand.length) return s.asker;
  const i = s.order.indexOf(s.asker);
  for (let k = 1; k <= s.order.length; k++) { const p = s.order[(i + k) % s.order.length]; if (cand.includes(p)) return p; }
  return cand[0];
}
function qsjEnd(room, s) { if (s.order.filter((p) => room.players.some((x) => x.pid === p && x.on)).every((p) => s.found[p])) s.phase = 'end'; }

// =====================================================================
// CHIFOUMI (pierre, feuille, ciseaux) : chacun contre tous
// =====================================================================
export const CHI = [{ id: 'pierre', e: '🪨', n: 'Pierre' }, { id: 'feuille', e: '📄', n: 'Feuille' }, { id: 'ciseaux', e: '✂️', n: 'Ciseaux' }];
export const beats = (a, b) => (a === 'pierre' && b === 'ciseaux') || (a === 'feuille' && b === 'pierre') || (a === 'ciseaux' && b === 'feuille');
export const chifoumiOnline = {
  id: 'chifoumi', name: 'Chifoumi', short: 'Pierre, feuille, ciseaux : chacun contre tous', emoji: '✂️', minPlayers: 2,
  defaults: { rounds: 7 },
  settingsForm: (st, set) => roundsSeg(st, set, [5, 7, 10]),
  init(room, st) { const s = { gid: uid(), st, round: 0 }; chiRound(s); return s; },
  action(room, s, pid, a) {
    if (a.type === 'pick' && s.phase === 'pick' && CHI.some((c) => c.id === a.c)) {
      s.picks[pid] = a.c;
      if (activePids(room).every((p) => s.picks[p])) chiReveal(room, s);
      return true;
    }
    return false;
  },
  tick(room, s) {
    const now = Date.now();
    if (s.phase === 'pick' && now >= s.deadline) { chiReveal(room, s); return true; }
    if (s.phase === 'reveal' && now >= s.until) { chiRound(s); return true; }
    return false;
  },
  view(room, s, pid) { return { gid: s.gid, round: s.round, rounds: s.st.rounds, phase: s.phase, deadline: s.deadline, mine: s.picks[pid] || null, n: Object.keys(s.picks).length, picks: s.phase === 'reveal' ? s.picks : null, gains: s.gains }; },
  mount(root, g) {
    const main = h('div', { class: 'col' });
    const tp = timerPill(g);
    root.append(main);
    let lastKey = null;
    return {
      update(r, v) {
        if (v.phase === 'end') { tp.set(0); main.replaceChildren(...endScreen(r, g)); if (lastKey !== 'end') sfx.fanfare(); lastKey = 'end'; return; }
        const key = `${v.gid}:${v.round}:${v.phase}`;
        tp.set(v.phase === 'pick' ? v.deadline : 0);
        const parts = [top([pill(`✂️ Manche ${v.round}/${v.rounds}`), tp.el])];
        if (v.phase === 'pick') {
          parts.push(h('h2', { class: 'center' }, v.mine ? 'Choix verrouillé 🔒' : 'Choisis en secret !'),
            h('div', { class: 'chi-btns' }, CHI.map((c) => h('button', { class: 'chi-btn' + (v.mine === c.id ? ' on' : ''), onclick: () => { g.send({ type: 'pick', c: c.id }); sfx.pop(); buzz(15); } }, h('span', { class: 'e' }, c.e), h('span', null, c.n)))),
            h('p', { class: 'status-line' }, `${v.n}/${r.players.filter((p) => p.on).length} ont choisi · tu marques 1 point par joueur battu`));
        } else {
          parts.push(h('div', { class: 'scoreboard' }, r.players.filter((p) => v.picks[p.pid]).sort((a, b) => (v.gains[b.pid] || 0) - (v.gains[a.pid] || 0)).map((p) => {
            const c = CHI.find((x) => x.id === v.picks[p.pid]);
            return h('div', { class: 'score-row' }, h('span', { style: { fontSize: '28px' } }, c.e), h('span', { class: 'n' }, p.pid === g.me ? 'Toi' : p.name), h('span', { class: 'muted small' }, `total ${p.score}`), h('span', { class: 's' }, `+${v.gains[p.pid] || 0}`));
          })), h('p', { class: 'status-line' }, 'Manche suivante dans un instant…'));
          if (key !== lastKey) (v.gains[g.me] || 0) > 0 ? sfx.ok() : sfx.bad();
        }
        if (key !== lastKey && v.phase === 'pick') sfx.go();
        lastKey = key;
        main.replaceChildren(...parts);
      },
      destroy() { tp.stop(); },
    };
  },
};
function chiRound(s) {
  s.round++;
  if (s.round > s.st.rounds) { s.phase = 'end'; return; }
  s.picks = {}; s.gains = {}; s.phase = 'pick'; s.deadline = Date.now() + 12000;
}
function chiReveal(room, s) {
  for (const p of activePids(room)) if (!s.picks[p]) s.picks[p] = pick(CHI).id; // pas de choix : au hasard
  const ps = Object.keys(s.picks);
  for (const p of ps) {
    s.gains[p] = ps.filter((q) => q !== p && beats(s.picks[p], s.picks[q])).length;
    addScore(room, p, s.gains[p]);
  }
  s.phase = 'reveal'; s.until = Date.now() + 4500;
}
