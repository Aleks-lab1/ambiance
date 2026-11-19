// Jeux en ligne de lettres et de plateau : Petit bac, Mot mystère (course), Morpion & 4 à la suite.
import { h, uid, shuffle, seg, pick, norm, toast } from '../ui.js';
import { sfx, buzz } from '../sfx.js';
import { sip } from '../store.js';
import { activePids, addScore, playerOf, timerPill, endScreen, actBtn } from './kit.js';
import { softNorm } from '../race-core.js';
import { loadDico, normWord } from '../bonmot-core.js';
import { score as mmScore } from '../games/motmystere.js';
import { win3, win4, drop, W } from '../games/morpion.js';
import PB from '../data/petitbac.js';

const name = (g, pid) => (pid === g.me ? 'Toi' : g.nameOf(pid));
const roundsSeg = (st, set, vals = [3, 5]) => h('label', { class: 'field' }, 'Nombre de manches', seg(vals.map((n) => ({ value: n, label: String(n) })), st.rounds, (v) => set({ rounds: v })));

// =====================================================================
// PETIT BAC
// =====================================================================
const EASY = 'ABCDEFGHIJLMNOPRSTV';
const pbKey = (t) => { const k = softNorm(t).replace(/ /g, ''); return k.length > 3 ? k.replace(/[sx]$/, '') : k; };

export const petitbacOnline = {
  id: 'petitbac', name: 'Petit bac', short: 'Une lettre, des catégories, chacun écrit', emoji: '🔤', minPlayers: 2,
  defaults: { count: 6, time: 120, rounds: 3 },
  settingsForm(st, set) {
    return h('div', { class: 'col' },
      h('label', { class: 'field' }, 'Catégories', seg([4, 5, 6, 8].map((n) => ({ value: n, label: String(n) })), st.count, (v) => set({ count: v }))),
      h('label', { class: 'field' }, 'Chrono', seg([60, 90, 120, 180].map((n) => ({ value: n, label: n < 120 ? n + ' s' : n / 60 + ' min' })), st.time, (v) => set({ time: v }))),
      roundsSeg(st, set, [1, 3, 5]));
  },
  init(room, st) {
    const s = { gid: uid(), st, round: 0, used: [], totals: Object.fromEntries(room.players.map((p) => [p.pid, 0])) };
    pbRound(s);
    return s;
  },
  action(room, s, pid, a) {
    if (a.type === 'save' && s.phase === 'write' && Array.isArray(a.list)) { s.answers[pid] = s.cats.map((_, i) => String(a.list[i] || '').trim().slice(0, 40)); return false; }
    if (a.type === 'stop' && s.phase === 'write') {
      const mine = s.answers[pid] || [];
      if (s.cats.some((_, i) => !mine[i])) return false;
      s.stopBy = pid; pbReview(room, s); return true;
    }
    if (a.type === 'toggle' && s.phase === 'review' && pid === room.host) { const k = `${a.c}:${a.pid}`; s.invalid[k] = !s.invalid[k]; pbReview(room, s); return true; }
    if (a.type === 'next' && s.phase === 'review' && pid === room.host) {
      for (const p of room.players) s.totals[p.pid] = p.score;
      pbRound(s); return true;
    }
    return false;
  },
  tick(room, s) { if (s.phase === 'write' && Date.now() >= s.deadline + 800) { pbReview(room, s); return true; } return false; },
  view(room, s, pid) { return { gid: s.gid, round: s.round, rounds: s.st.rounds, phase: s.phase, letter: s.letter, cats: s.cats, deadline: s.deadline, stopBy: s.stopBy, review: s.phase === 'review' ? s.review : null, nAns: Object.keys(s.answers).length }; },
  mount(root, g) {
    const main = h('div', { class: 'col' });
    const tp = timerPill(g);
    root.append(main);
    let lastKey = null, inputs = [], saveT = null, ended = false;
    const save = () => g.send({ type: 'save', list: inputs.map((x) => x.value) });
    return {
      update(r, v) {
        if (v.phase === 'end') { tp.set(0); main.replaceChildren(...endScreen(r, g)); if (lastKey !== 'end') sfx.fanfare(); lastKey = 'end'; return; }
        const key = `${v.gid}:${v.round}:${v.phase}`;
        if (key === lastKey && v.phase === 'write') return;
        if (key === lastKey && v.phase === 'review') { /* on redessine (validations de l'hôte) */ }
        if (v.phase === 'write') {
          ended = false;
          tp.set(v.deadline);
          inputs = v.cats.map((c) => h('input', { class: 'input', placeholder: `${c}…`, maxlength: '40', autocomplete: 'off', autocapitalize: 'sentences', spellcheck: 'false', oninput: () => { clearTimeout(saveT); saveT = setTimeout(save, 400); stopBtn.disabled = inputs.some((x) => !x.value.trim()); } }));
          const stopBtn = h('button', { class: 'btn btn-bad btn-big btn-block', disabled: true, onclick: () => { clearTimeout(saveT); save(); g.send({ type: 'stop' }); } }, '✋ STOP ! (tout est rempli)');
          main.replaceChildren(h('div', { class: 'row' }, h('div', { class: 'letter-big', style: { fontSize: '84px' } }, v.letter), h('div', { class: 'grow col' }, h('span', { class: 'pill' }, `🔤 Manche ${v.round}/${v.rounds}`), tp.el)),
            h('div', { class: 'col pb-form' }, v.cats.map((c, i) => h('label', { class: 'field' }, c, inputs[i]))), stopBtn);
          // Sauvegarde finale juste avant la fin du chrono.
          const left = v.deadline - g.now() - 300;
          setTimeout(() => { if (!ended && lastKey === key) save(); }, Math.max(0, left));
          sfx.go(); buzz(60);
        } else {
          ended = true; clearTimeout(saveT); tp.set(0);
          const rows = r.players.map((p) => ({ p, pts: v.review.pts[p.pid] || 0 })).sort((a, b) => b.pts - a.pts);
          main.replaceChildren(
            h('h2', { class: 'center' }, `Lettre ${v.letter} — ${v.stopBy ? `STOP de ${name(g, v.stopBy)} !` : 'Temps écoulé !'}`),
            g.isHost ? h('p', { class: 'muted small center' }, 'Hôte : touche une réponse pour la refuser ou l\'accepter.') : h('p', { class: 'muted small center' }, '2 pts réponse unique · 1 pt si partagée · 0 si refusée'),
            ...v.cats.map((c, ci) => h('div', { class: 'panel col pb-cat' }, h('b', null, c),
              v.review.cats[ci].map((x) => h('button', {
                class: 'pb-ans ' + (x.valid ? (x.pts === 2 ? 'uniq' : 'shared') : 'bad'),
                onclick: g.isHost && x.text ? () => g.send({ type: 'toggle', c: ci, pid: x.pid }) : null,
              }, h('span', { class: 'n' }, name(g, x.pid)), h('span', { class: 't' }, x.text || '—'), h('span', { class: 's' }, x.valid ? `+${x.pts}` : '❌'))))),
            h('div', { class: 'scoreboard' }, rows.map((x) => h('div', { class: 'score-row' }, h('span', { class: 'n' }, x.p.pid === g.me ? 'Toi' : x.p.name), h('span', { class: 'muted small' }, `total ${x.p.score}`), h('span', { class: 's' }, `+${x.pts}`)))),
            g.isHost ? actBtn(g, v.round < v.rounds ? 'Manche suivante →' : '🏆 Classement final', 'next', 'btn-primary btn-big') : null);
          if (key !== lastKey) { sfx.bad(); buzz([200, 100, 200]); }
        }
        lastKey = key;
      },
      destroy() { tp.stop(); clearTimeout(saveT); },
    };
  },
};
function pbRound(s) {
  s.round++;
  if (s.round > s.st.rounds) { s.phase = 'end'; return; }
  let avail = EASY.split('').filter((l) => !s.used.includes(l));
  if (!avail.length) { s.used = []; avail = EASY.split(''); }
  s.letter = pick(avail); s.used.push(s.letter);
  s.cats = shuffle(PB.slice()).slice(0, s.st.count);
  s.answers = {}; s.invalid = {}; s.stopBy = null; s.review = null;
  s.phase = 'write';
  s.deadline = Date.now() + s.st.time * 1000;
}
function pbReview(room, s) {
  const L = s.letter.toLowerCase();
  const pids = room.players.map((p) => p.pid);
  const pts = Object.fromEntries(pids.map((p) => [p, 0]));
  const cats = s.cats.map((_, ci) => {
    const list = pids.map((pid) => {
      const text = (s.answers[pid] || [])[ci] || '';
      const n = norm(text).replace(/ /g, '');
      const valid = !!n && n[0] === L && n.length >= 2 && !s.invalid[`${ci}:${pid}`];
      return { pid, text, valid, k: pbKey(text) };
    }).filter((x) => x.text || s.answers[x.pid]);
    for (const x of list) {
      x.pts = x.valid ? (list.some((y) => y !== x && y.valid && y.k === x.k) ? 1 : 2) : 0;
      pts[x.pid] += x.pts;
    }
    for (const x of list) delete x.k;
    return list;
  });
  s.review = { cats, pts };
  for (const p of room.players) p.score = (s.totals[p.pid] || 0) + pts[p.pid];
  s.phase = 'review';
}

// =====================================================================
// MOT MYSTÈRE (course)
// =====================================================================
let dico = null;
const ensureDico = () => loadDico().then((d) => { dico = d; }).catch(() => {});
const TRIES = 6;

export const motmystereOnline = {
  id: 'motmystere', name: 'Le Mot mystère', short: 'Course : trouve le mot avant les autres', emoji: '🟩', minPlayers: 2,
  defaults: { len: 5, rounds: 3, time: 180 },
  settingsForm(st, set) {
    ensureDico();
    return h('div', { class: 'col' },
      h('label', { class: 'field' }, 'Longueur du mot', seg([5, 6, 7].map((n) => ({ value: n, label: `${n} lettres` })), st.len, (v) => set({ len: v }))),
      h('label', { class: 'field' }, 'Temps par mot', seg([120, 180, 300].map((n) => ({ value: n, label: n / 60 + ' min' })), st.time, (v) => set({ time: v }))),
      roundsSeg(st, set, [1, 3, 5]));
  },
  init(room, st) { ensureDico(); return { gid: uid(), st, round: 0, phase: 'loading', recent: [] }; },
  action(room, s, pid, a) {
    if (a.type === 'guess' && s.phase === 'play' && !s.done[pid]) {
      const w = normWord(a.w || '');
      const rows = s.rows[pid] || (s.rows[pid] = []);
      s.msg[pid] = null;
      if (w.length !== s.target.length) { s.msg[pid] = `Il faut ${s.target.length} lettres`; return true; }
      if (!dico.has(w)) { s.msg[pid] = `« ${w.toUpperCase()} » n'est pas dans le dictionnaire`; return true; }
      rows.push({ w, res: mmScore(w, s.target) });
      if (w === s.target) {
        s.finish.push(pid);
        s.done[pid] = { ok: true, tries: rows.length, rank: s.finish.length };
        addScore(room, pid, [3, 2][s.finish.length - 1] || 1);
      } else if (rows.length >= TRIES) s.done[pid] = { ok: false };
      if (activePids(room).every((p) => s.done[p])) s.phase = 'result';
      return true;
    }
    if (a.type === 'next' && s.phase === 'result' && pid === room.host) { mmRound(s); return true; }
    return false;
  },
  tick(room, s) {
    if (s.phase === 'loading' && dico) { mmRound(s); return true; }
    if (s.phase === 'play' && Date.now() >= s.deadline) { s.phase = 'result'; return true; }
    return false;
  },
  view(room, s, pid) {
    if (s.phase === 'loading' || s.phase === 'end') return { gid: s.gid, phase: s.phase };
    return {
      gid: s.gid, round: s.round, rounds: s.st.rounds, phase: s.phase, len: s.target.length, deadline: s.deadline,
      rows: s.rows[pid] || [], done: s.done[pid] || null, msg: s.msg[pid] || null,
      others: room.players.filter((p) => p.pid !== pid).map((p) => ({ pid: p.pid, res: (s.rows[p.pid] || []).map((r) => r.res), done: s.done[p.pid] || null })),
      target: s.phase === 'result' ? s.targetShown : null, finish: s.finish,
    };
  },
  mount(root, g) {
    const main = h('div', { class: 'col' });
    const tp = timerPill(g);
    root.append(main);
    let lastKey = null, cur = '', v = null, grid = null, kb = null, keys = {}, others = null, msgEl = null, onKey = null;
    const ROWS = ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'];
    function drawGrid() {
      const n = v.len;
      grid.replaceChildren(...Array.from({ length: TRIES }, (_, r) => {
        const row = v.rows[r];
        return h('div', { class: 'mm-row', style: { '--n': n } }, Array.from({ length: n }, (_, c) => {
          if (row) return h('div', { class: 'mm-cell ' + row.res[c] }, row.w[c].toUpperCase());
          const typing = r === v.rows.length && !v.done;
          return h('div', { class: 'mm-cell' + (typing && cur[c] ? ' filled' : '') }, typing ? (cur[c] || '').toUpperCase() : '');
        }));
      }));
      const st = {};
      const rank = { absent: 0, near: 1, good: 2 };
      v.rows.forEach((row) => [...row.w].forEach((ch, i) => { const K = ch.toUpperCase(); if (!st[K] || rank[row.res[i]] > rank[st[K]]) st[K] = row.res[i]; }));
      Object.entries(keys).forEach(([K, el]) => { el.classList.remove('good', 'near', 'absent'); if (st[K]) el.classList.add(st[K]); });
    }
    const type = (k) => { if (!v || v.phase !== 'play' || v.done || cur.length >= v.len) return; cur += k.toLowerCase(); sfx.tick(); drawGrid(); };
    const back = () => { if (!cur) return; cur = cur.slice(0, -1); drawGrid(); };
    const enter = () => { if (!v || v.phase !== 'play' || v.done) return; if (cur.length < v.len) { toast(`Il faut ${v.len} lettres`, 1200); return; } g.send({ type: 'guess', w: cur }); };
    onKey = (e) => { if (e.ctrlKey || e.metaKey || e.altKey) return; if (e.key === 'Enter') { e.preventDefault(); enter(); } else if (e.key === 'Backspace') back(); else { const k = normWord(e.key).toUpperCase(); if (k.length === 1 && keys[k]) type(k); } };
    document.addEventListener('keydown', onKey);
    return {
      update(r, view) {
        const prev = v;
        v = view;
        if (v.phase === 'end') { tp.set(0); main.replaceChildren(...endScreen(r, g)); if (lastKey !== 'end') sfx.fanfare(); lastKey = 'end'; return; }
        if (v.phase === 'loading') { main.replaceChildren(h('div', { class: 'big-center' }, h('h2', null, '⏳ Chargement du dictionnaire chez l\'hôte…'))); return; }
        const key = `${v.gid}:${v.round}`;
        if (key !== lastKey) {
          cur = ''; keys = {};
          grid = h('div', { class: 'mm-grid' });
          msgEl = h('p', { class: 'center small', style: { minHeight: '20px', color: '#ffb3b6' } });
          others = h('div', { class: 'mm-others' });
          kb = h('div', { class: 'kb mm-kb' }, ROWS.map((row, i) => h('div', { class: 'kb-row' },
            i === 2 ? h('button', { class: 'kb-key wide', onclick: enter }, 'OK') : null,
            [...row].map((k) => (keys[k] = h('button', { class: 'kb-key', onclick: () => type(k) }, k))),
            i === 2 ? h('button', { class: 'kb-key wide', 'aria-label': 'Effacer', onclick: back }, '⌫') : null)));
          main.replaceChildren(h('div', { class: 'row' }, h('span', { class: 'pill' }, `🟩 Mot ${v.round}/${v.rounds}`), h('div', { class: 'grow' }), tp.el), others, grid, msgEl, kb, h('div', { class: 'mm-after col' }));
          sfx.go();
        }
        if (prev && prev.rows && v.rows.length > prev.rows.length && key === lastKey) { cur = ''; const last = v.rows[v.rows.length - 1]; last.res.every((x) => x === 'good') ? (sfx.fanfare(), buzz([40, 30, 120])) : sfx.pop(); }
        msgEl.textContent = v.msg || '';
        if (v.msg && (!prev || prev.msg !== v.msg)) { sfx.bad(); const row = grid.children[v.rows.length]; row && (row.classList.remove('shake'), void row.offsetWidth, row.classList.add('shake')); }
        tp.set(v.phase === 'play' ? v.deadline : 0);
        drawGrid();
        others.replaceChildren(...v.others.map((o) => h('div', { class: 'mm-other' + (o.done && o.done.ok ? ' won' : '') },
          h('span', { class: 'nm' }, `${g.nameOf(o.pid)}${o.done ? (o.done.ok ? ' ✅' : ' ❌') : ''}`),
          h('span', { class: 'dots' }, o.res.slice(-1).flatMap((res) => res.map((x) => h('i', { class: x })))))));
        const after = main.querySelector('.mm-after');
        if (v.phase === 'result') {
          kb.classList.add('done');
          const winner = v.finish[0];
          after.replaceChildren(h('div', { class: 'panel center col' },
            h('h3', null, `Le mot était « ${v.target.toUpperCase()} »`),
            h('p', null, winner ? `🏆 ${name(g, winner)} a trouvé en premier !` : `Personne n'a trouvé : tout le monde prend ${sip(1)} !`)),
          g.isHost ? actBtn(g, v.round < v.rounds ? 'Mot suivant →' : '🏆 Classement final', 'next', 'btn-primary btn-big') : null);
          if (lastKey !== key + ':r') sfx.end();
          lastKey = key + ':r';
          return;
        }
        after.replaceChildren(v.done ? h('p', { class: 'center' }, v.done.ok ? `🎉 Trouvé (${v.done.rank === 1 ? '1er' : v.done.rank + 'e'}) ! On attend les autres…` : '😵 Plus d\'essais… On attend les autres.') : null);
        lastKey = key;
      },
      destroy() { tp.stop(); document.removeEventListener('keydown', onKey); },
    };
  },
};
function mmRound(s) {
  s.round++;
  if (s.round > s.st.rounds) { s.phase = 'end'; return; }
  const n = s.st.len;
  const list = dico.playable(n, n).slice(n === 5 ? 80 : 50, n === 5 ? 1800 : 2600).filter((x) => !s.recent.includes(x.n));
  const w = pick(list);
  s.recent.push(w.n);
  s.target = w.n; s.targetShown = w.w;
  s.rows = {}; s.done = {}; s.msg = {}; s.finish = [];
  s.phase = 'play';
  s.deadline = Date.now() + s.st.time * 1000;
}

// =====================================================================
// MORPION & 4 À LA SUITE (le gagnant reste, le suivant prend la place du perdant)
// =====================================================================
export const morpionOnline = {
  id: 'morpion', name: 'Morpion & 4 à la suite', short: 'Le gagnant reste, au suivant !', emoji: '⭕', minPlayers: 2,
  defaults: { game: 'morpion' },
  settingsForm(st, set) { return h('label', { class: 'field' }, 'Jeu', seg([{ value: 'morpion', label: '❌⭕ Morpion' }, { value: 'quatre', label: '🔴🟡 4 à la suite' }], st.game, (v) => set({ game: v }))); },
  init(room, st) {
    const order = activePids(room);
    const s = { gid: uid(), st, quatre: st.game === 'quatre', duo: [order[0], order[1]], queue: order.slice(2), first: 0, n: 0 };
    newBoard(s);
    return s;
  },
  action(room, s, pid, a) {
    if (a.type === 'play' && s.phase === 'play' && pid === s.duo[s.turn] && Number.isInteger(a.i)) {
      const i = s.quatre ? (a.i >= 0 && a.i < W ? drop(s.board, a.i) : -1) : (a.i >= 0 && a.i < 9 && s.board[a.i] === null ? a.i : -1);
      if (i < 0) return false;
      s.board[i] = s.turn;
      s.last = i;
      const w = s.quatre ? win4(s.board) : win3(s.board);
      if (w) {
        s.phase = 'over'; s.win = w;
        if (w.p >= 0) addScore(room, s.duo[w.p], 1);
      } else s.turn = 1 - s.turn;
      return true;
    }
    if (a.type === 'again' && s.phase === 'over' && (pid === room.host || s.duo.includes(pid))) {
      if (s.win.p >= 0 && s.queue.length) {
        const loser = s.duo[1 - s.win.p];
        const challenger = s.queue.shift();
        s.queue.push(loser);
        s.duo[1 - s.win.p] = challenger;
        s.first = 1 - s.win.p; // le challenger commence
      } else s.first = 1 - s.first;
      newBoard(s);
      return true;
    }
    return false;
  },
  onJoin(room, s, pid) { if (!s.duo.includes(pid) && !s.queue.includes(pid)) s.queue.push(pid); },
  onLeave(room, s, pid) {
    const k = s.duo.indexOf(pid);
    if (k >= 0 && s.queue.length) { s.duo[k] = s.queue.shift(); newBoard(s); }
  },
  view(room, s) { return { gid: s.gid, n: s.n, quatre: s.quatre, board: s.board, duo: s.duo, queue: s.queue, turn: s.turn, phase: s.phase, win: s.win, last: s.last }; },
  mount(root, g) {
    const main = h('div', { class: 'col' });
    root.append(main);
    let lastKey = null;
    return {
      update(r, v) {
        const key = `${v.gid}:${v.n}:${v.phase}:${v.board.filter((x) => x !== null).length}`;
        const meIdx = v.duo.indexOf(g.me);
        const myTurn = v.phase === 'play' && meIdx === v.turn;
        const sym = (p) => (v.quatre ? (p ? '🟡' : '🔴') : (p ? '⭕' : '❌'));
        let status;
        if (v.phase === 'play') status = myTurn ? `${sym(v.turn)} À toi de jouer !` : `${sym(v.turn)} À ${g.nameOf(v.duo[v.turn])} de jouer`;
        else status = v.win.p < 0 ? '🤝 Match nul !' : `🏆 ${name(g, v.duo[v.win.p])} gagne !`;
        const cells = v.board.map((x, i) => h('button', {
          class: (v.quatre ? 'c4-cell' : 'ttt-cell') + (x === null ? '' : v.quatre ? (x ? ' p1' : ' p0') : ' on') + (v.win && v.win.cells.includes(i) ? ' win' : '') + (i === v.last ? ' pop' : ''),
          disabled: !myTurn, onclick: () => g.send({ type: 'play', i: v.quatre ? i % W : i }),
        }, !v.quatre && x !== null ? sym(x) : ''));
        const pScore = (pid) => (playerOf(r, pid) || {}).score || 0;
        main.replaceChildren(
          h('p', { class: 'center' }, h('b', null, `${sym(0)} ${name(g, v.duo[0])} (${pScore(v.duo[0])})`), '  contre  ', h('b', null, `${sym(1)} ${name(g, v.duo[1])} (${pScore(v.duo[1])})`)),
          h('h2', { class: 'center' }, status),
          h('div', { class: v.quatre ? 'c4-board' : 'ttt-board' }, cells),
          v.queue.length ? h('p', { class: 'center muted small' }, `⏳ Prochains challengers : ${v.queue.map((p) => name(g, p)).join(', ')}`) : null,
          v.phase === 'over' && v.win.p >= 0 ? h('p', { class: 'center' }, v.duo[1 - v.win.p] === g.me ? `Tu prends ${sip(1)}.` : `${g.nameOf(v.duo[1 - v.win.p])} prend ${sip(1)}.`) : null,
          v.phase === 'over' && (g.isHost || meIdx >= 0) ? actBtn(g, v.queue.length && v.win.p >= 0 ? '🔁 Au suivant !' : '🔁 Revanche', 'again', 'btn-primary btn-big') : null);
        if (key !== lastKey) {
          if (v.phase === 'over') { v.win.p >= 0 && v.duo[v.win.p] === g.me ? (sfx.fanfare(), buzz([40, 30, 120])) : sfx.end(); } else if (myTurn) { sfx.pop(); buzz(15); } else sfx.tick();
        }
        lastKey = key;
      },
      destroy() {},
    };
  },
};
function newBoard(s) { s.n++; s.board = Array(s.quatre ? 42 : 9).fill(null); s.turn = s.first; s.phase = 'play'; s.win = null; s.last = -1; }
