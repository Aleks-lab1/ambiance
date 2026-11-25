// Jeux en ligne de lettres et de plateau : Petit bac, Mot mystère (course), Le Pendu, Morpion & 4 en ligne.
import { h, uid, shuffle, seg, pick, norm, toast } from '../ui.js';
import { sfx, buzz } from '../sfx.js';
import { sip } from '../store.js';
import { activePids, addScore, playerOf, nextOn, timerPill, endScreen, actBtn, TV_PID, tvTurn, tvSplit, tvSay, tvStage, tvTimer } from './kit.js';
import { softNorm } from '../race-core.js';
import { loadDico, normWord } from '../bonmot-core.js';
import { score as mmScore } from '../games/motmystere.js';
import { win3, win4, drop, W } from '../games/morpion.js';
import { c4View, tttView } from '../morpion-vue.js';
import { drawing, KEYS as PENDU_KEYS, MAX as PENDU_MAX } from '../games/pendu.js';
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
  // Écran télé : la lettre géante et les catégories pendant l'écriture, puis le tableau de toutes les réponses.
  tv(room, s) { return this.view(room, s, TV_PID); },
  tvMount(root, g) {
    const bar = h('div', { class: 'tv-bar' });
    const body = h('div', { class: 'tv-fill' });
    const tm = tvTimer(g);
    const st = tvStage(root, bar, body);
    let lastKey = null;
    return {
      update(r, v) {
        if (st.end(r, v.phase === 'end')) { tm.set(0); lastKey = null; return; }
        const key = `${v.gid}:${v.round}:${v.phase}`;
        bar.replaceChildren(h('span', { class: 'pill' }, `🔤 Manche ${v.round}/${v.rounds}`), h('div', { class: 'grow' }), tm.el);
        tm.set(v.phase === 'write' ? v.deadline : 0);
        if (v.phase === 'write') {
          if (key === lastKey) return;
          body.replaceChildren(tvSplit(h('div', { class: 'letter-big tv-letter' }, v.letter),
            h('div', { class: 'tv-col' }, h('div', { class: 'tv-cats' }, v.cats.map((c) => h('span', null, c))),
              h('p', { class: 'tv-status' }, '✍️ Écrivez un mot par catégorie sur vos téléphones. Le premier qui a tout rempli peut crier STOP !'))));
          sfx.go();
        } else {
          const pl = r.players.filter((p) => v.review.cats.some((c) => c.some((x) => x.pid === p.pid)));
          body.replaceChildren(h('div', { class: 'tv-say' }, `Lettre ${v.letter} : ${v.stopBy ? `STOP de ${g.nameOf(v.stopBy)} !` : 'temps écoulé !'}`),
            h('div', { class: 'tv-pb', style: { gridTemplateColumns: `minmax(6em, auto) repeat(${pl.length}, minmax(0, 1fr))` } },
              h('span', { class: 'hd' }), ...pl.map((p) => h('span', { class: 'hd' }, `${p.name} +${v.review.pts[p.pid] || 0}`)),
              ...v.cats.flatMap((c, ci) => [h('span', { class: 'cat' }, c), ...pl.map((p) => {
                const x = v.review.cats[ci].find((y) => y.pid === p.pid);
                return h('span', { class: 'ans ' + (!x || !x.text ? 'none' : x.valid ? (x.pts === 2 ? 'uniq' : 'shared') : 'bad') }, x && x.text ? x.text : '—');
              })])),
            h('p', { class: 'tv-status' }, '🟢 2 pts réponse unique · 🟡 1 pt si partagée · ❌ refusée (l\'hôte peut corriger)'));
          if (key !== lastKey) sfx.bad();
        }
        lastKey = key;
      },
      destroy() { tm.stop(); },
    };
  },
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
  restore() { ensureDico(); }, // partie reprise par l'hôte
  action(room, s, pid, a) {
    if (a.type === 'guess' && s.phase === 'play' && !s.done[pid]) {
      const w = normWord(a.w || '');
      const rows = s.rows[pid] || (s.rows[pid] = []);
      s.msg[pid] = null;
      if (w.length !== s.target.length) { s.msg[pid] = `Il faut ${s.target.length} lettres`; return true; }
      if (!dico) { s.msg[pid] = 'Dictionnaire en cours de chargement… réessaie'; return true; }
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
  // Écran télé : la course de tous les joueurs, en couleurs seulement (aucune lettre), puis le mot.
  tv(room, s) { return this.view(room, s, TV_PID); },
  tvMount(root, g) {
    const bar = h('div', { class: 'tv-bar' });
    const boards = h('div', { class: 'tv-mm' });
    const say = tvSay();
    const tm = tvTimer(g);
    const st = tvStage(root, bar, boards, say.el);
    let lastKey = null;
    return {
      update(r, v) {
        if (st.end(r, v.phase === 'end')) { tm.set(0); lastKey = null; return; }
        if (v.phase === 'loading') { say.set('⏳ Chargement du dictionnaire…'); return; }
        bar.replaceChildren(h('span', { class: 'pill' }, `🟩 Mot ${v.round}/${v.rounds} · ${v.len} lettres`), h('div', { class: 'grow' }), tm.el);
        tm.set(v.phase === 'play' ? v.deadline : 0);
        boards.replaceChildren(...v.others.map((o) => h('div', { class: 'tv-mm-p' + (o.done ? (o.done.ok ? ' won' : ' lost') : '') },
          h('b', null, `${g.nameOf(o.pid)}${o.done ? (o.done.ok ? ` ✅ ${o.done.rank === 1 ? '1er' : o.done.rank + 'e'}` : ' ❌') : ''}`),
          h('div', { class: 'tv-mm-g', style: { '--n': v.len } }, Array.from({ length: TRIES }, (_, k) => {
            const res = o.res[k];
            return Array.from({ length: v.len }, (_, c) => h('i', { class: res ? res[c] : '' }));
          }).flat()))));
        const key = `${v.gid}:${v.round}:${v.phase}`;
        if (v.phase === 'result') {
          const w = v.finish[0];
          say.set(`Le mot était « ${v.target.toUpperCase()} » · ${w ? `🏆 ${g.nameOf(w)} a trouvé en premier !` : `Personne n'a trouvé : tout le monde prend ${sip(1)} !`}`);
          if (key !== lastKey) sfx.end();
        } else {
          say.set('📱 Trouvez le mot sur vos téléphones !');
          if (key !== lastKey) sfx.go();
        }
        lastKey = key;
      },
      destroy() { tm.stop(); },
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
            h('p', null, winner ? (winner === g.me ? '🏆 Tu as trouvé en premier !' : `🏆 ${g.nameOf(winner)} a trouvé en premier !`) : `Personne n'a trouvé : tout le monde prend ${sip(1)} !`)),
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
// MORPION & 4 EN LIGNE (le gagnant reste, le suivant prend la place du perdant)
// =====================================================================
export const morpionOnline = {
  id: 'morpion', name: 'Morpion & 4 en ligne', short: 'Le gagnant reste, au suivant !', emoji: '⭕', minPlayers: 2,
  defaults: { game: 'morpion' },
  settingsForm(st, set) { return h('label', { class: 'field' }, 'Jeu', seg([{ value: 'morpion', label: '❌⭕ Morpion' }, { value: 'quatre', label: '🔴🟡 4 en ligne' }], st.game, (v) => set({ game: v }))); },
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
  // Écran télé : le même plateau animé que sur les téléphones (vu par un spectateur), en grand, les textes à côté.
  tv(room, s) { return this.view(room, s, TV_PID); },
  tvMount(root, g) {
    const wrap = h('div', { class: 'tv-morpion' });
    root.append(wrap);
    return this.mount(wrap, { ...g, me: TV_PID, isHost: false, send() {}, hostBar: () => null });
  },
  mount(root, g) {
    // Plateau animé gardé d'une mise à jour à l'autre (js/morpion-vue.js) : chaque nouveau coup est joué en
    // animation (jeton qui tombe, trait au feutre), dans l'ordre d'arrivée, puis les textes sont mis à jour.
    const head = h('p', { class: 'center' }), status = h('h2', { class: 'center' }), slot = h('div'), foot = h('div', { class: 'col' });
    root.append(h('div', { class: 'col' }, head, status, slot, foot));
    let view = null, kind = null, boardKey = null, shown = [], cur = null, chain = Promise.resolve(), dead = false, lastKey = null, wonKey = null;
    const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
    function choose(x) {
      const v = cur;
      if (!v || v.phase !== 'play' || v.duo.indexOf(g.me) !== v.turn) return;
      if (v.quatre ? drop(v.board, x) < 0 : v.board[x] !== null) { if (v.quatre) view.nope(); return; }
      g.send({ type: 'play', i: x });
    }
    function texts(r, v) {
      const meIdx = v.duo.indexOf(g.me);
      const myTurn = v.phase === 'play' && meIdx === v.turn;
      const sym = (p) => (v.quatre ? (p ? '🟡' : '🔴') : (p ? '⭕' : '❌'));
      const pScore = (pid) => (playerOf(r, pid) || {}).score || 0;
      head.replaceChildren(h('b', null, `${sym(0)} ${name(g, v.duo[0])} (${pScore(v.duo[0])})`), '  contre  ', h('b', null, `${sym(1)} ${name(g, v.duo[1])} (${pScore(v.duo[1])})`));
      status.textContent = v.phase === 'play' ? (myTurn ? `${sym(v.turn)} À toi de jouer !` : `${sym(v.turn)} À ${g.nameOf(v.duo[v.turn])} de jouer`)
        : v.win.p < 0 ? '🤝 Match nul !' : v.duo[v.win.p] === g.me ? '🏆 Tu as gagné !' : `🏆 ${g.nameOf(v.duo[v.win.p])} gagne !`;
      foot.replaceChildren(
        v.queue.length ? h('p', { class: 'center muted small' }, `⏳ Prochains challengers : ${v.queue.map((p) => name(g, p)).join(', ')}`) : null,
        v.phase === 'over' && v.win.p >= 0 ? h('p', { class: 'center' }, v.duo[1 - v.win.p] === g.me ? `Tu prends ${sip(1)}.` : `${g.nameOf(v.duo[1 - v.win.p])} prend ${sip(1)}.`) : null,
        v.phase === 'over' && (g.isHost || meIdx >= 0) ? actBtn(g, v.queue.length && v.win.p >= 0 ? '🔁 Au suivant !' : '🔁 Revanche', 'again', 'btn-primary btn-big') : null);
      const key = `${v.gid}:${v.n}:${v.phase}:${v.turn}`;
      if (key !== lastKey) {
        if (v.phase === 'over') { v.win.p >= 0 && v.duo[v.win.p] === g.me ? (sfx.fanfare(), buzz([40, 30, 120])) : sfx.end(); } else if (myTurn) buzz(15);
      }
      lastKey = key;
      if (v.phase === 'over') {
        if (wonKey !== boardKey) { wonKey = boardKey; view.win(v.win.cells); }
        if (v.quatre) view.rest(); else view.setTurn(v.turn, false);
      } else view.setTurn(v.turn, myTurn);
    }
    async function show(r, v) {
      const bk = `${v.gid}:${v.n}`;
      if (!view || kind !== v.quatre) {
        view = v.quatre ? c4View({ onPick: choose }) : tttView({ onPick: choose });
        kind = v.quatre; boardKey = null; shown = Array(v.board.length).fill(null);
        slot.replaceChildren(view.el);
      }
      if (boardKey !== bk) {
        // Nouvelle manche : les jetons tombent par le bas (ou les traits s'effacent).
        if (boardKey !== null && shown.some((x) => x !== null)) await view.clear();
        shown = Array(v.board.length).fill(null);
        boardKey = bk;
        if (v.quatre && view.back) view.back();
      }
      const adds = v.board.map((p, i) => (p !== null && shown[i] === null ? i : -1)).filter((i) => i >= 0);
      const anim = adds.includes(v.last) ? v.last : -1;
      // Les coups « en retard » (on rejoint une partie en cours) s'affichent directement, le dernier est animé.
      if (v.quatre) { const pre = v.board.slice(); if (anim >= 0) pre[anim] = null; view.set(pre); } else for (const i of adds) if (i !== anim) view.set(i, v.board[i], false);
      if (anim >= 0) {
        if (v.quatre) await view.drop(anim, v.board[anim]);
        else { view.set(anim, v.board[anim], true); await pause(260); }
      }
      shown = v.board.slice();
      if (!dead) texts(r, v);
    }
    return {
      update(r, v) {
        // Copie : chez l'hôte, la vue partage les tableaux de l'état du jeu, qui changent au coup suivant.
        const snap = { ...v, board: v.board.slice(), duo: v.duo.slice(), queue: v.queue.slice(), win: v.win ? { p: v.win.p, cells: v.win.cells.slice() } : null };
        cur = snap;
        chain = chain.then(() => (dead ? null : show(r, snap))).catch((e) => console.error(e));
      },
      destroy() { dead = true; },
    };
  },
};
function newBoard(s) { s.n++; s.board = Array(s.quatre ? 42 : 9).fill(null); s.turn = s.first; s.phase = 'play'; s.win = null; s.last = -1; }

// =====================================================================
// LE PENDU : chacun son tour propose une lettre.
// =====================================================================
const PENDU_LEN = { court: [4, 6], moyen: [6, 9], long: [9, 13] };

export const penduOnline = {
  id: 'pendu', name: 'Le Pendu', short: 'Chacun son tour propose une lettre', emoji: '🪢', minPlayers: 2,
  defaults: { mode: 'hasard', len: 'moyen', rounds: 3 },
  settingsForm(st, set) {
    ensureDico();
    return h('div', { class: 'col' },
      h('label', { class: 'field' }, 'Le mot', seg([{ value: 'hasard', label: '🎲 Au hasard' }, { value: 'secret', label: '🤫 Un joueur choisit' }], st.mode, (v) => set({ mode: v }))),
      h('label', { class: 'field' }, 'Longueur (mot au hasard)', seg([{ value: 'court', label: 'Court' }, { value: 'moyen', label: 'Moyen' }, { value: 'long', label: 'Long' }], st.len, (v) => set({ len: v }))),
      h('label', { class: 'field' }, 'Nombre de mots', seg([3, 5, 8].map((n) => ({ value: n, label: String(n) })), st.rounds, (v) => set({ rounds: v }))),
      h('p', { class: 'muted small' }, 'Bonne lettre : +1 et tu rejoues. Mot trouvé : +2. En mode « Un joueur choisit », celui qui a choisi le mot gagne 3 points si personne ne le trouve.'));
  },
  restore() { ensureDico(); }, // partie reprise par l'hôte
  init(room, st) {
    ensureDico();
    const s = { gid: uid(), st, order: shuffle(activePids(room)), round: 0, phase: 'loading', recent: [], chooser: null, cur: null };
    if (st.mode === 'secret') penduRound(room, s);
    return s;
  },
  action(room, s, pid, a) {
    if (a.type === 'word' && s.phase === 'choose' && pid === s.chooser) {
      const w = String(a.w || '').trim().slice(0, 24);
      if (normWord(w).length < 3 || !/^[\p{L}' -]+$/u.test(w)) { s.msg = 'Un mot d\'au moins 3 lettres, sans chiffres'; return true; }
      s.msg = null;
      penduStart(room, s, w);
      return true;
    }
    if (a.type === 'letter' && s.phase === 'play' && pid === s.cur && PENDU_KEYS.includes(a.k) && !s.tried.includes(a.k)) {
      const k = a.k;
      s.tried.push(k);
      const good = s.target.includes(k.toLowerCase());
      s.last = { k, good, by: pid };
      if (good) addScore(room, pid, 1);
      else { s.errors++; s.cur = penduNext(room, s, pid); }
      if ([...new Set(s.target)].every((c) => s.tried.includes(c.toUpperCase()))) { s.phase = 'over'; s.won = pid; addScore(room, pid, 2); }
      else if (s.errors >= PENDU_MAX) { s.phase = 'over'; s.won = null; if (s.chooser) addScore(room, s.chooser, 3); }
      return true;
    }
    if (a.type === 'next' && s.phase === 'over' && (pid === room.host || pid === s.chooser) && (dico || s.st.mode === 'secret')) { penduRound(room, s); return true; }
    return false;
  },
  tick(room, s) {
    if (s.phase === 'loading' && dico) { penduRound(room, s); return true; }
    return false;
  },
  onJoin(room, s, pid) { if (!s.order.includes(pid)) s.order.push(pid); },
  onLeave(room, s, pid) {
    if (pid === s.chooser && s.phase === 'choose') { s.round--; penduRound(room, s); }
    else if (pid === s.cur && s.phase === 'play') s.cur = penduNext(room, s, pid);
  },
  view(room, s, pid) {
    if (s.phase === 'loading' || s.phase === 'end') return { gid: s.gid, phase: s.phase };
    const base = { gid: s.gid, round: s.round, rounds: s.st.rounds, phase: s.phase, chooser: s.chooser, msg: pid === s.chooser ? s.msg : null };
    if (s.phase === 'choose') return base;
    const over = s.phase === 'over';
    const slots = [...s.word.toUpperCase()].map((ch) => {
      const b = normWord(ch);
      if (!b) return { sp: ch };
      const found = [...b].every((c) => s.tried.includes(c.toUpperCase())); // « œ » = O + E
      return { c: found || over || pid === s.chooser ? ch : '', miss: !found && (over || pid === s.chooser) };
    });
    return { ...base, cur: s.cur, tried: s.tried, errors: s.errors, slots, won: s.won, last: s.last,
      good: s.tried.filter((k) => s.target.includes(k.toLowerCase())) };
  },
  // Écran télé : le dessin du pendu en grand, le mot à trous et toutes les lettres déjà proposées.
  tv(room, s) { return this.view(room, s, TV_PID); },
  tvMount(root, g) {
    const bar = h('div', { class: 'tv-bar' });
    const art = h('div', { class: 'pendu-svg tv-pendu' });
    const word = h('div', { class: 'pendu-word tv-pword' });
    const turn = h('div');
    const say = tvSay();
    const kb = h('div', { class: 'kb tv-kb' });
    const st = tvStage(root, bar, tvSplit(art, h('div', { class: 'tv-col' }, word, turn, say.el, kb)));
    let lastKey = null, wordKey = null, lastErr = 0, seenNow = [];
    return {
      update(r, v) {
        if (st.end(r, v.phase === 'end')) { lastKey = wordKey = null; return; }
        if (v.phase === 'loading') { say.set('⏳ Chargement des mots…'); return; }
        const key = `${v.gid}:${v.round}:${v.phase}:${(v.tried || []).length}`;
        if (key === lastKey) return;
        bar.replaceChildren(h('span', { class: 'pill' }, `🪢 Mot ${v.round}/${v.rounds}`), h('div', { class: 'grow' }), v.phase !== 'choose' ? h('span', { class: 'pill' }, `❤️ ${PENDU_MAX - v.errors}`) : null);
        if (v.phase === 'choose') {
          art.innerHTML = drawing(0, false); word.replaceChildren(); kb.replaceChildren(); turn.replaceChildren();
          say.set(`🤫 ${g.nameOf(v.chooser)} choisit un mot en secret…`);
          lastKey = key;
          return;
        }
        const over = v.phase === 'over';
        const wk = `${v.gid}:${v.round}`;
        if (wk !== wordKey) { wordKey = wk; lastErr = 0; seenNow = []; }
        const newErr = v.errors > lastErr;
        lastErr = v.errors;
        const seen = seenNow;
        seenNow = v.slots.map((x) => !!x.c);
        art.innerHTML = drawing(v.errors, newErr);
        art.classList.toggle('oops', newErr);
        word.style.setProperty('--len', v.slots.length);
        word.replaceChildren(...v.slots.map((x, i) => (x.sp != null ? h('span', { class: 'sp' }, x.sp === ' ' ? '\u00a0' : x.sp) : h('span', { class: 'ltr' + (x.miss ? ' miss' : '') + (x.c && !seen[i] ? ' pop-in' : '') }, x.c))));
        kb.replaceChildren(...PENDU_KEYS.map((k) => h('span', { class: 'kb-key' + (v.tried.includes(k) ? (v.good.includes(k) ? ' good' : ' bad') : '') }, k)));
        const L = v.last;
        if (over) {
          turn.replaceChildren();
          say.set(v.won ? `🎉 ${g.nameOf(v.won)} a trouvé le mot ! +2` : `💀 Pendu ! ${v.chooser ? `${g.nameOf(v.chooser)} gagne 3 points.` : `Tout le monde prend ${sip(1)}.`}`);
          v.won ? sfx.fanfare() : sfx.boom();
        } else {
          turn.replaceChildren(tvTurn('👉', `À ${g.nameOf(v.cur)}`, 'de proposer une lettre'));
          say.set(L ? (L.good ? `✅ ${g.nameOf(L.by)} a trouvé le ${L.k} (+1)` : `❌ Pas de ${L.k} dans le mot`) : (v.chooser ? `🤫 Le mot de ${g.nameOf(v.chooser)}` : '🎲 Un mot au hasard'));
          if (L) (L.good ? sfx.ok() : sfx.bad());
        }
        lastKey = key;
      },
      destroy() {},
    };
  },
  mount(root, g) {
    const main = h('div', { class: 'col' });
    root.append(main);
    let v = null, lastKey = null, onKey = null, form = null, wordKey = null, lastErr = 0, seenNow = [];
    const unbind = () => { if (onKey) document.removeEventListener('keydown', onKey); onKey = null; };
    const myTurn = () => v && v.phase === 'play' && v.cur === g.me;
    const send = (k) => { if (myTurn() && !v.tried.includes(k)) { g.send({ type: 'letter', k }); sfx.pop(); } };
    return {
      update(r, view) {
        v = view;
        if (v.phase === 'end') { unbind(); main.replaceChildren(...endScreen(r, g)); if (lastKey !== 'end') sfx.fanfare(); lastKey = 'end'; return; }
        if (v.phase === 'loading') { main.replaceChildren(h('div', { class: 'big-center' }, h('h2', null, '⏳ Chargement des mots chez l\'hôte…'))); return; }
        const key = `${v.gid}:${v.round}:${v.phase}:${(v.tried || []).length}`;
        const head = h('div', { class: 'row' }, h('span', { class: 'pill' }, `🪢 Mot ${v.round}/${v.rounds}`), h('div', { class: 'grow' }),
          v.phase !== 'choose' ? h('span', { class: 'pill' }, `❤️ ${PENDU_MAX - v.errors}`) : null);
        if (v.phase === 'choose') {
          unbind();
          const me = v.chooser === g.me;
          if (me && form && lastKey === key && !v.msg) return; // ne pas effacer la saisie
          if (me) {
            const input = h('input', { class: 'input code-input', type: 'password', placeholder: 'Le mot secret', maxlength: '20', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', style: { letterSpacing: '.15em', textTransform: 'none' } });
            form = h('form', { class: 'col', style: { width: '100%' }, onsubmit: (e) => { e.preventDefault(); const w = input.value.trim(); if (w) { g.send({ type: 'word', w }); input.blur(); } } }, input,
              v.msg ? h('p', { class: 'small center', style: { color: '#ffb3b6' } }, v.msg) : null,
              h('button', { class: 'btn btn-primary btn-big btn-block', type: 'submit' }, 'C\'est parti !'));
            main.replaceChildren(head, h('div', { class: 'big-center' }, h('div', { class: 'hero-emo' }, '🤫'), h('h2', null, 'Choisis le mot en secret'), h('p', { class: 'muted' }, 'Les autres devront le deviner lettre par lettre.'), form));
          } else {
            form = null;
            main.replaceChildren(head, h('div', { class: 'big-center' }, h('div', { class: 'hero-emo' }, '🤫'), h('h2', null, `${g.nameOf(v.chooser)} choisit un mot en secret…`)));
          }
          if (lastKey !== key && me) { sfx.go(); buzz([40, 30, 80]); }
          lastKey = key;
          return;
        }
        form = null;
        const over = v.phase === 'over';
        // Nouvelle erreur : la partie du dessin se trace ; nouvelles lettres : elles apparaissent en sautant.
        const wk = `${v.gid}:${v.round}`;
        if (wk !== wordKey) { wordKey = wk; lastErr = 0; seenNow = []; }
        const newErr = v.errors > lastErr;
        lastErr = v.errors;
        const seen = seenNow;
        seenNow = v.slots.map((x) => !!x.c);
        const keys = PENDU_KEYS.map((k) => {
          const tried = v.tried.includes(k);
          return h('button', { class: 'kb-key' + (tried ? (v.good.includes(k) ? ' good' : ' bad') : ''), disabled: tried || !myTurn(), onclick: () => send(k) }, k);
        });
        let status;
        if (over) status = v.won ? h('b', null, `🎉 ${v.won === g.me ? 'Tu as trouvé' : g.nameOf(v.won) + ' a trouvé'} le mot ! +2`) : h('b', null, `💀 Pendu ! ${v.chooser ? `${v.chooser === g.me ? 'Tu gagnes' : g.nameOf(v.chooser) + ' gagne'} 3 points.` : `Tout le monde prend ${sip(1)}.`}`);
        else if (v.chooser === g.me) status = `🤫 C'est ton mot ! ${g.nameOf(v.cur)} propose une lettre…`;
        else status = myTurn() ? '👉 À toi : propose une lettre !' : `${g.nameOf(v.cur)} propose une lettre…`;
        const L = v.last;
        main.replaceChildren(head,
          h('div', { class: 'pendu-svg' + (newErr ? ' oops' : ''), html: drawing(v.errors, newErr) }),
          h('div', { class: 'pendu-word' }, v.slots.map((x, i) => (x.sp != null ? h('span', { class: 'sp' }, x.sp === ' ' ? '\u00a0' : x.sp) : h('span', { class: 'ltr' + (x.miss ? ' miss' : '') + (x.c && !(seen[i]) ? ' pop-in' : '') }, x.c)))),
          L && !over ? h('p', { class: 'center small muted' }, L.good ? `✅ ${L.by === g.me ? 'Tu as' : g.nameOf(L.by) + ' a'} trouvé le ${L.k} (+1)` : `❌ Pas de ${L.k} dans le mot`) : null,
          h('p', { class: 'center' }, status),
          h('div', { class: 'kb' + (over ? ' done' : '') }, keys),
          over && (g.isHost || v.chooser === g.me) ? actBtn(g, v.round < v.rounds ? 'Mot suivant →' : '🏆 Classement final', 'next', 'btn-primary btn-big') : null,
          over && !(g.isHost || v.chooser === g.me) ? h('p', { class: 'status-line' }, '⏳ En attente de l\'hôte…') : null);
        if (key !== lastKey) {
          if (over) { v.won ? (sfx.fanfare(), buzz([40, 30, 40, 30, 120])) : (sfx.boom(), buzz([300, 100, 300])); }
          else if (L) { L.good ? (sfx.ok(), buzz(15)) : (sfx.bad(), buzz([80, 40, 80])); }
          if (myTurn() && (!L || !L.good || L.by !== g.me)) buzz(30);
        }
        lastKey = key;
        unbind();
        if (myTurn()) { onKey = (e) => { if (e.ctrlKey || e.metaKey || e.altKey) return; const k = normWord(e.key).toUpperCase(); if (k.length === 1) send(k); }; document.addEventListener('keydown', onKey); }
      },
      destroy() { unbind(); },
    };
  },
};
function penduNext(room, s, from) {
  let p = nextOn(room, s.order, from);
  if (p === s.chooser) p = nextOn(room, s.order, p);
  return p;
}
function penduRound(room, s) {
  s.round++;
  if (s.round > s.st.rounds) { s.phase = 'end'; return; }
  s.tried = []; s.errors = 0; s.won = null; s.last = null; s.msg = null;
  if (s.st.mode === 'secret') {
    s.chooser = s.chooser ? nextOn(room, s.order, s.chooser) : s.order[0];
    s.word = null;
    s.phase = 'choose';
    return;
  }
  const [a, b] = PENDU_LEN[s.st.len] || PENDU_LEN.moyen;
  const all = dico.playable(a, b);
  const list = all.slice(60, 5000).filter((x) => !s.recent.includes(x.n));
  const w = pick(list.length ? list : all).w;
  s.recent.push(normWord(w)); if (s.recent.length > 40) s.recent.shift();
  penduStart(room, s, w);
}
function penduStart(room, s, w) {
  s.word = w;
  s.target = normWord(w);
  s.phase = 'play';
  s.cur = penduNext(room, s, s.cur || s.chooser || s.order[s.order.length - 1]);
}
