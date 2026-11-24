// Jeux d'ambiance en ligne : Qui a écrit ça ?, Le Curseur, Dans sa tête, Dans l'ordre !, Qui suis-je ?, Chifoumi.
import { h, uid, shuffle, seg, pick, rand } from '../ui.js';
import { gameColors } from '../themes.js';
import { levelPicker } from '../common.js';
import { sip } from '../store.js';
import { sfx, buzz } from '../sfx.js';
import { activePids, addScore, nextOn, card, endScreen, timerPill, actBtn, drawNew, TV_PID, tvTimer, tvEnd } from './kit.js';
import { sortList } from '../sortable.js';
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

/** Étiquettes en haut et en bas de la liste de Dans l'ordre ! (aussi utilisées par la version locale). */
export const ORDRE_EDGES = { top: '⬆️ Plus ancien', bottom: '⬇️ Plus récent' };

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
    const s = { gid: uid(), st, round: 0 };
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
  // Écran télé : la question, puis chaque réponse anonyme en grand, et la révélation de l'auteur avec les votes.
  tv(room, s) { return this.view(room, s, TV_PID); },
  tvMount(root, g) {
    const colors = gameColors('quiaecrit', ['#8e2de2', '#4a00e0']);
    const style = { '--g1': colors[0], '--g2': colors[1] };
    const tm = tvTimer(g);
    const main = h('div', { class: 'col', style: { gap: '1em' } });
    root.append(main);
    let lastKey = null;
    return {
      update(r, v) {
        if (v.phase === 'end') { tm.set(0); if (lastKey !== 'end') { main.replaceChildren(...tvEnd(r)); sfx.fanfare(); } lastKey = 'end'; return; }
        const key = `${v.gid}:${v.round}:${v.phase}:${v.idx}`;
        tm.set(v.phase === 'write' || v.phase === 'guess' ? v.deadline : 0);
        const n = r.players.filter((p) => p.on).length;
        const statusText = v.phase === 'write' ? `✍️ ${v.nAns}/${n} réponse${v.nAns > 1 ? 's' : ''}`
          : `Réponse ${v.idx + 1}/${v.total} · Qui a écrit ça ? · 🗳️ ${v.nVotes} vote${v.nVotes > 1 ? 's' : ''}`;
        // Même étape : seul le compteur change (la carte et la réponse ne rejouent pas leur animation).
        if (key === lastKey) { const st = main.querySelector('.tv-status'); if (st) st.textContent = statusText; return; }
        const bar = h('div', { class: 'tv-bar' }, h('span', { class: 'pill' }, `🕵️‍♀️ Manche ${v.round}/${v.rounds}`), h('div', { class: 'grow' }), tm.el);
        if (v.phase === 'write') {
          main.replaceChildren(bar, h('div', { class: 'tv-card', style }, h('div', { class: 'kicker' }, 'Répondez en secret sur vos téléphones…'), h('div', { class: 'q' }, v.prompt)),
            h('p', { class: 'tv-status' }, statusText));
        } else {
          const parts = [bar, h('div', { class: 'tv-card', style: { ...style, padding: '.8em 1.2em' } }, h('div', { class: 'kicker' }, 'La question était'), h('div', { class: 'q', style: { fontSize: '1.4em' } }, v.prompt)),
            h('div', { class: 'tv-quote' }, `« ${v.text} »`)];
          if (v.phase === 'guess') {
            parts.push(h('p', { class: 'tv-status' }, statusText));
          } else {
            const votes = Object.entries(v.votes || {});
            parts.push(h('div', { class: 'tv-author' }, `✍️ C'est ${g.nameOf(v.author)} !`),
              h('div', { class: 'tv-results' }, votes.length
                ? votes.map(([p, x]) => h('span', { class: 'tv-res' + (x === v.author ? ' ok' : '') }, `${x === v.author ? '✅' : '❌'} ${g.nameOf(p)} → ${g.nameOf(x)}`))
                : h('span', { class: 'tv-res' }, 'Personne n\'a voté')));
          }
          main.replaceChildren(...parts);
        }
        if (key !== lastKey) { if (v.phase === 'write' || v.phase === 'guess') sfx.go(); if (v.phase === 'reveal') sfx.end(); }
        lastKey = key;
      },
      destroy() { tm.stop(); },
    };
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
  const lv = (s.st.levels && s.st.levels.length ? s.st.levels : ['fun']).filter((l) => QAE[l]).sort();
  s.prompt = drawNew(s, 'on:quiaecrit:' + lv, () => lv.flatMap((l) => QAE[l]));
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
/** Échelle du Curseur. input : curseur (input range) posé directement sur l'échelle, qu'on fait glisser. */
export function scaleEl(pair, { target = null, marks = [], value = null, input = null } = {}) {
  return h('div', { class: 'scale' },
    h('div', { class: 'scale-labels' }, h('span', null, `⬅️ ${pair[0]}`), h('span', null, `${pair[1]} ➡️`)),
    h('div', { class: 'scale-bar' + (marks.length ? ' with-marks' : '') + (input ? ' with-input' : '') },
      target != null ? h('div', { class: 'scale-target', style: { left: `clamp(18px, ${target}%, calc(100% - 18px))` } }) : null,
      ...marks.map((m, i) => h('div', { class: 'scale-mark' + (m.me ? ' me' : ''), style: { left: `${m.v}%`, animationDelay: `${0.25 + i * 0.08}s` }, title: m.label }, h('span', null, m.label))),
      value != null ? h('div', { class: 'scale-mark me', style: { left: `${value}%` } }) : null,
      input));
}
/** Curseur à faire glisser sur l'échelle (petit tic tous les 10 %). */
export function scaleRange(value = 50) {
  let last = Math.round(value / 10);
  return h('input', { type: 'range', min: '0', max: '100', value: String(value), class: 'scale-range', 'aria-label': 'Position du curseur',
    oninput: (e) => { const k = Math.round(Number(e.target.value) / 10); if (k !== last) { last = k; sfx.tick(); } } });
}
export const curseurOnline = {
  id: 'curseur', name: 'Le Curseur', short: 'Un indice, placez le curseur', emoji: '🎚️', minPlayers: 2,
  defaults: { rounds: 6 },
  settingsForm: (st, set) => roundsSeg(st, set, [4, 6, 10], 'Nombre de tours'),
  init(room, st) {
    const order = shuffle(activePids(room));
    const s = { gid: uid(), st, order, giver: order[0], round: 0 };
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
          const range = me ? null : scaleRange(v.mine ?? 50);
          parts.push(card(colors, `L'indice de ${name(g, v.giver)}`, `« ${v.clue} »`, scaleEl(v.pair, me ? { target: v.target } : { input: range })));
          if (!me) {
            parts.push(h('p', { class: 'muted small center' }, 'Fais glisser le curseur sur l\'échelle.'), h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => { g.send({ type: 'guess', v: Number(range.value) }); sfx.pop(); buzz(15); } }, v.mine != null ? '✅ Curseur posé (tu peux le changer)' : '📍 Poser mon curseur'));
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
  s.pair = drawNew(s, 'on:curseur', CURSEUR);
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
    const s = { gid: uid(), st, order, judge: order[0], round: 0 };
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
    // La liste reste la même d'une mise à jour à l'autre (sinon un glissement en cours serait interrompu
    // dès qu'un autre joueur valide) : on ne remplace que l'en-tête et le bas de l'écran.
    const head = h('div', { class: 'col' }), slot = h('div', { class: 'col' }), foot = h('div', { class: 'col' });
    const main = h('div', { class: 'col' }, head, slot, foot);
    root.append(main);
    let lastKey = null, list = null, listKey = null, shownKey = null;
    return {
      update(r, v) {
        if (v.phase === 'end') { main.replaceChildren(...endScreen(r, g)); if (lastKey !== 'end') sfx.fanfare(); lastKey = 'end'; list = null; listKey = null; return; }
        if (head.parentNode !== main) main.replaceChildren(head, slot, foot);
        const key = `${v.gid}:${v.round}:${v.phase}`, qk = `${v.gid}:${v.round}`;
        if (key !== lastKey) { if (v.phase === 'reveal') sfx.end(); else sfx.go(); }
        lastKey = key;
        const me = v.judge === g.me;
        head.replaceChildren(top([pill(`🧠 ${v.round}/${v.rounds}`), pill(`🎯 ${name(g, v.judge)}`)]),
          card(colors, me ? 'Classe selon TES goûts' : `Comment ${g.nameOf(v.judge)} a-t-il classé…`, v.theme));
        if (v.phase === 'rank') {
          if (listKey !== qk) {
            list = sortList(v.items, { top: '⬆️ N°1', bottom: '⬇️ N°5', order: v.mine || null });
            listKey = qk;
            slot.replaceChildren(list.el);
          }
          if (v.mine) list.lock();
          foot.replaceChildren(
            v.mine ? h('p', { class: 'status-line' }, `✅ Envoyé · ${v.done.length}/${r.players.filter((p) => p.on).length} ont classé`)
              : h('p', { class: 'muted small center' }, 'Fais glisser les cartes pour les classer, du n°1 (en haut) au n°5.'),
            v.mine ? null : h('button', { class: 'btn btn-primary btn-big btn-block', onclick: (e) => { e.currentTarget.disabled = true; list.lock(); g.send({ type: 'rank', o: list.order() }); sfx.pop(); } }, 'Valider mon classement'),
            g.isHost && v.done.includes(v.judge) ? actBtn(g, '👀 Révéler sans attendre', 'reveal') : null);
          return;
        }
        // Révélation : chaque carte glisse à la place choisie par le joueur désigné.
        const ref = v.judgeRank;
        const finders = v.items.map((_, i) => Object.entries(v.ranks).filter(([p, o]) => p !== v.judge && o[ref.indexOf(i)] === i).map(([p]) => name(g, p)).join(', '));
        if (shownKey !== qk) {
          shownKey = qk;
          if (list && listKey === qk && v.mine && !me) {
            list.check(ref);
            const l = list;
            setTimeout(() => { if (l === list) { l.settle(ref, finders); sfx.swoosh(); } }, 750);
          } else {
            list = sortList(v.items, { order: ref, locked: true, labels: finders });
            listKey = qk;
            slot.replaceChildren(list.el);
          }
        }
        foot.replaceChildren(h('p', { class: 'center' }, h('b', null, me ? 'Ton classement est révélé !' : `Le classement de ${g.nameOf(v.judge)} :`)),
          h('div', { class: 'scoreboard' }, Object.entries(v.pts).sort((a, b) => b[1] - a[1]).map(([p, n]) => h('div', { class: 'score-row' }, h('span', { class: 'n' }, name(g, p)), h('span', { class: 's' }, `+${n}`)))),
          me || g.isHost ? actBtn(g, 'Tour suivant →', 'next', 'btn-primary btn-big') : null);
      },
      destroy() { if (list) list.destroy(); },
    };
  },
};
function dstRound(room, s, first = false) {
  s.round++;
  if (s.round > s.st.rounds) { s.phase = 'end'; return; }
  if (!first) s.judge = nextOn(room, s.order, s.judge);
  const [theme, items] = drawNew(s, 'on:classement', CLASSEMENT);
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
    const tp = timerPill(g);
    // Même principe que Dans sa tête : la liste n'est jamais recréée pendant une question.
    const head = h('div', { class: 'col' }), slot = h('div', { class: 'col' }), foot = h('div', { class: 'col' });
    const main = h('div', { class: 'col' }, head, slot, foot);
    root.append(main);
    let lastKey = null, list = null, listKey = null, shownKey = null, auto = null, sent = null;
    const send = () => { if (!list || sent === listKey) return; sent = listKey; list.lock(); g.send({ type: 'order', o: list.order() }); sfx.pop(); };
    return {
      update(r, v) {
        if (v.phase === 'end') { tp.set(0); main.replaceChildren(...endScreen(r, g)); if (lastKey !== 'end') sfx.fanfare(); lastKey = 'end'; list = null; listKey = null; return; }
        if (head.parentNode !== main) main.replaceChildren(head, slot, foot);
        const key = `${v.gid}:${v.round}:${v.phase}`, qk = `${v.gid}:${v.round}`;
        if (key !== lastKey) { v.phase === 'q' ? sfx.go() : (v.mine && v.mine.ok === 4 ? sfx.ok() : sfx.end()); }
        lastKey = key;
        tp.set(v.phase === 'q' ? v.deadline : 0);
        clearTimeout(auto);
        head.replaceChildren(top([pill(`📅 ${v.round}/${v.rounds}`), tp.el]),
          h('p', { class: 'center' }, h('b', null, v.phase === 'q' ? 'Remets-les dans l\'ordre !' : 'La bonne réponse :')));
        if (v.phase === 'q') {
          if (listKey !== qk) { list = sortList(v.items, { ...ORDRE_EDGES, order: v.mine ? v.mine.o : null }); listKey = qk; slot.replaceChildren(list.el); }
          if (v.mine) list.lock();
          // Temps presque écoulé : on envoie l'ordre actuel plutôt que de tout perdre.
          else auto = setTimeout(send, Math.max(0, v.deadline - g.now() - 700));
          foot.replaceChildren(
            v.mine ? h('p', { class: 'status-line' }, `✅ Envoyé · ${v.n} réponse${v.n > 1 ? 's' : ''}`)
              : h('p', { class: 'muted small center' }, 'Fais glisser les cartes, du plus ancien (en haut) au plus récent.'),
            v.mine ? null : h('button', { class: 'btn btn-primary btn-big btn-block', onclick: (e) => { e.currentTarget.disabled = true; send(); } }, 'Valider'),
            g.isHost ? actBtn(g, '⏭ Révéler', 'next') : null);
          return;
        }
        if (shownKey !== qk) {
          shownKey = qk;
          if (list && listKey === qk && v.mine) {
            list.check(v.sol);
            const l = list;
            setTimeout(() => { if (l === list) { l.settle(v.sol, v.years); if (v.mine.ok < 4) sfx.swoosh(); } }, v.mine.ok === 4 ? 250 : 750);
          } else {
            list = sortList(v.items, { order: v.sol, locked: true, labels: v.years });
            listKey = qk;
            slot.replaceChildren(list.el);
          }
        }
        foot.replaceChildren(
          h('div', { class: 'scoreboard' }, r.players.map((p) => ({ p, a: v.answers[p.pid] })).sort((a, b) => ((b.a && b.a.pts) || 0) - ((a.a && a.a.pts) || 0)).map((x) => h('div', { class: 'score-row' },
            h('span', { class: 'n' }, (x.p.pid === g.me ? 'Toi' : x.p.name) + (x.a && x.a.first ? ' ⚡' : '')), h('span', { class: 'muted small' }, x.a ? `${x.a.ok}/4 bien placé${x.a.ok > 1 ? 's' : ''}` : '💤'), h('span', { class: 's' }, `+${x.a ? x.a.pts : 0}`)))),
          g.isHost ? actBtn(g, v.round < v.rounds ? 'Question suivante →' : '🏆 Classement final', 'next', 'btn-primary btn-big') : null);
      },
      destroy() { tp.stop(); clearTimeout(auto); if (list) list.destroy(); },
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
    const s = { gid: uid(), st, cat: cat.name, order, asker: order[0], found: {}, rank: 0, wrong: {}, phase: 'play' };
    // Identités tirées sans répétition d'une partie à l'autre, et toutes différentes dans la partie.
    const words = new Set();
    for (let k = 0; words.size < order.length && k < 200; k++) words.add(drawNew(s, 'on:quisuisje:' + cat.id, cat.words));
    const list = [...words];
    s.who = Object.fromEntries(order.map((p, i) => [p, list[i % list.length]]));
    return s;
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
/**
 * Deux poings face à face : count() les fait battre « Chi… Fou… Mi ! » (promesse, ~1 s), puis show() révèle
 * les deux choix (w > 0 : la gauche gagne, w < 0 : la droite gagne). Aussi utilisé par la version locale.
 */
export function chiArena(leftName, rightName) {
  const L = h('span', { class: 'chi-hand' }, '✊'), R = h('span', { class: 'chi-hand bot' }, '✊');
  const word = h('span', { class: 'chi-word' });
  const ln = h('small', null, leftName), rn = h('small', null, rightName);
  const el = h('div', { class: 'chi-arena' }, h('div', { class: 'chi-side' }, L, ln), word, h('div', { class: 'chi-side' }, R, rn));
  const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
  return {
    el,
    names(a, b) { ln.textContent = a; rn.textContent = b; },
    async count() {
      L.textContent = R.textContent = '✊';
      el.classList.remove('done', 'lw', 'rw', 'tie');
      for (const w of ['Chi…', 'Fou…', 'Mi !']) {
        word.textContent = w;
        el.classList.remove('pump'); void el.offsetWidth; el.classList.add('pump');
        sfx.tick(); buzz(8);
        await pause(330);
      }
      el.classList.remove('pump');
    },
    show(a, b, w) {
      const e = (id) => (CHI.find((x) => x.id === id) || {}).e || '❔';
      L.textContent = e(a); R.textContent = b ? e(b) : '❔';
      word.textContent = w > 0 ? '>' : w < 0 ? '<' : '=';
      el.classList.add('done', w > 0 ? 'lw' : w < 0 ? 'rw' : 'tie');
    },
  };
}
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
    let lastKey = null, shown = null, arena = null;
    const render = (r, v) => {
      const parts = [top([pill(`✂️ Manche ${v.round}/${v.rounds}`), tp.el])];
      if (v.phase === 'pick') {
        parts.push(h('h2', { class: 'center' }, v.mine ? 'Choix verrouillé 🔒' : 'Choisis en secret !'),
          h('div', { class: 'chi-btns' }, CHI.map((c) => h('button', { class: 'chi-btn' + (v.mine === c.id ? ' on' : ''), onclick: () => { g.send({ type: 'pick', c: c.id }); sfx.pop(); buzz(15); } }, h('span', { class: 'e' }, c.e), h('span', null, c.n)))),
          h('p', { class: 'status-line' }, `${v.n}/${r.players.filter((p) => p.on).length} ont choisi · tu marques 1 point par joueur battu`));
      } else {
        parts.push(arena.el, h('div', { class: 'scoreboard chi-scores' }, r.players.filter((p) => v.picks[p.pid]).sort((a, b) => (v.gains[b.pid] || 0) - (v.gains[a.pid] || 0)).map((p) => {
          const c = CHI.find((x) => x.id === v.picks[p.pid]);
          return h('div', { class: 'score-row' }, h('span', { style: { fontSize: '28px' } }, c.e), h('span', { class: 'n' }, p.pid === g.me ? 'Toi' : p.name), h('span', { class: 'muted small' }, `total ${p.score}`), h('span', { class: 's' }, `+${v.gains[p.pid] || 0}`));
        })), h('p', { class: 'status-line' }, 'Manche suivante dans un instant…'));
      }
      main.replaceChildren(...parts);
    };
    return {
      update(r, v) {
        if (v.phase === 'end') { tp.set(0); main.replaceChildren(...endScreen(r, g)); if (lastKey !== 'end') sfx.fanfare(); lastKey = 'end'; return; }
        const key = `${v.gid}:${v.round}:${v.phase}`;
        tp.set(v.phase === 'pick' ? v.deadline : 0);
        if (key !== lastKey && v.phase === 'pick') sfx.go();
        if (key !== lastKey && v.phase === 'reveal') {
          // « Chi… Fou… Mi ! » puis on montre son choix face à celui d'un adversaire (le meilleur de la manche).
          lastKey = key;
          const others = r.players.filter((p) => p.pid !== g.me && v.picks[p.pid]);
          const best = others.sort((a, b) => (v.gains[b.pid] || 0) - (v.gains[a.pid] || 0))[0];
          arena = chiArena('Toi', best ? (others.length > 1 ? `${best.name} (et les autres)` : best.name) : '…');
          main.replaceChildren(top([pill(`✂️ Manche ${v.round}/${v.rounds}`), tp.el]), arena.el);
          arena.count().then(() => {
            if (lastKey !== key) return;
            const mine = v.picks[g.me], his = best ? v.picks[best.pid] : null;
            arena.show(mine, his, mine && his ? (beats(mine, his) ? 1 : beats(his, mine) ? -1 : 0) : 0);
            shown = key;
            render(r, v);
            (v.gains[g.me] || 0) > 0 ? sfx.ok() : sfx.bad();
          });
          return;
        }
        lastKey = key;
        if (v.phase === 'reveal' && shown !== key) return; // compte à rebours en cours
        render(r, v);
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
  s.phase = 'reveal'; s.until = Date.now() + 5500; // dont ~1 s de « Chi… Fou… Mi ! »
}
