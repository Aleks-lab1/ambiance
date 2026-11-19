// Jeux de rapidité en ligne : Quiz (QCM), Émojis mystères & Anagrammes (réponse libre), À vue de nez (estimation).
import { h, uid, seg } from '../ui.js';
import { gameColors } from '../themes.js';
import { podium, levelPicker } from '../common.js';
import { sfx, buzz } from '../sfx.js';
import { RACE_MODES, buildQuestions, matches, estimPoints, formatNumber } from '../race-core.js';
import QUIZ from '../data/quiz.js';
import EMOJIS from '../data/emojis.js';
import ANAG from '../data/anagrammes.js';
import ESTIM from '../data/estimations.js';

const DATA = { quiz: QUIZ, emoji: EMOJIS, anag: ANAG, estim: ESTIM };
const REVEAL_MS = 9000;
const player = (room, pid) => room.players.find((p) => p.pid === pid);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

function makeRace(mode) {
  const M = RACE_MODES[mode];
  const text = mode === 'emoji' || mode === 'anag';

  function nextQ(s) {
    s.i++;
    if (s.i >= s.list.length) { s.phase = 'end'; return; }
    s.phase = 'q';
    s.start = Date.now();
    s.deadline = s.start + s.st.time * 1000;
    s.answers = {};
    s.wrong = {};
    s.hinted = false;
  }
  const active = (room) => room.players.filter((p) => p.on).map((p) => p.pid);
  const allDone = (room, s) => active(room).every((pid) => (text ? s.answers[pid] && s.answers[pid].ok : s.answers[pid]));

  function reveal(room, s) {
    const Q = s.list[s.i];
    if (mode === 'estim') {
      const pts = estimPoints(s.answers, Q.ans.n);
      for (const [pid, p] of Object.entries(pts)) s.answers[pid].pts = p;
    }
    for (const [pid, a] of Object.entries(s.answers)) {
      const p = player(room, pid);
      if (p && a.pts) p.score += a.pts;
    }
    s.phase = 'reveal';
    s.revealUntil = Date.now() + REVEAL_MS;
  }

  return {
    id: 'race-' + mode,
    name: M.name,
    short: M.short,
    emoji: M.emoji,
    minPlayers: 2,
    defaults: { count: 10, time: mode === 'quiz' ? 20 : mode === 'estim' ? 25 : 40, themes: mode === 'quiz' ? QUIZ.themes.map((t) => t.id) : undefined },

    settingsForm(st, set) {
      const parts = [
        h('label', { class: 'field' }, 'Nombre de questions', seg([5, 10, 15, 20].map((n) => ({ value: n, label: String(n) })), st.count, (v) => set({ count: v }))),
        h('label', { class: 'field' }, 'Temps par question', seg((text ? [30, 40, 60] : [15, 20, 30]).map((n) => ({ value: n, label: n + ' s' })), st.time, (v) => set({ time: v }))),
      ];
      if (mode === 'quiz') {
        const sel = new Set(st.themes && st.themes.length ? st.themes : QUIZ.themes.map((t) => t.id));
        parts.push(h('div', { class: 'col' }, h('p', { class: 'muted small' }, 'Thèmes'),
          levelPicker(QUIZ.themes.map((t) => ({ ...t, desc: '' })), sel, (s) => set({ themes: [...s] }))));
      }
      return h('div', { class: 'col' }, parts);
    },

    init(room, st) {
      const s = { gid: uid(), st, list: buildQuestions(mode, DATA[mode], st.count, st), i: -1 };
      nextQ(s);
      return s;
    },

    action(room, s, pid, a) {
      if (a.type === 'next' && pid === room.host) {
        if (s.phase === 'q') { reveal(room, s); return true; }
        if (s.phase === 'reveal') { nextQ(s); return true; }
        return false;
      }
      if (a.type !== 'answer' || s.phase !== 'q' || !player(room, pid)) return false;
      const Q = s.list[s.i];
      const frac = clamp01((s.deadline - Date.now()) / (s.st.time * 1000));
      if (mode === 'quiz') {
        if (s.answers[pid] || !Number.isInteger(a.v) || a.v < 0 || a.v > 3) return false;
        const ok = a.v === Q.ans.i;
        s.answers[pid] = { v: a.v, ok, pts: ok ? 100 + Math.round(100 * frac) : 0 };
      } else if (mode === 'estim') {
        const v = Number(a.v);
        if (s.answers[pid] || !Number.isFinite(v)) return false;
        s.answers[pid] = { v };
      } else {
        if (s.answers[pid] && s.answers[pid].ok) return false;
        const guess = String(a.v || '').trim().slice(0, 80);
        if (!guess) return false;
        if (matches(guess, [Q.ans.text, ...(Q.ans.alts || [])], Q.ans.keys)) {
          const first = !Object.values(s.answers).some((x) => x.ok);
          s.answers[pid] = { v: guess, ok: true, pts: 100 + Math.round(100 * frac) + (first ? 50 : 0), first };
        } else {
          s.wrong[pid] = { n: ((s.wrong[pid] && s.wrong[pid].n) || 0) + 1, last: guess };
        }
      }
      if (allDone(room, s)) reveal(room, s);
      return true;
    },

    tick(room, s) {
      const now = Date.now();
      if (s.phase === 'q' && now >= s.deadline) { reveal(room, s); return true; }
      if (mode === 'anag' && s.phase === 'q' && !s.hinted && now - s.start > s.st.time * 500) { s.hinted = true; return true; }
      if (s.phase === 'reveal' && now >= s.revealUntil) { nextQ(s); return true; }
      return false;
    },

    onLeave(room, s) {
      if (s.phase === 'q' && Object.keys(s.answers).length && allDone(room, s)) reveal(room, s);
    },

    view(room, s, pid) {
      const Q = s.list[s.i];
      const mine = s.answers[pid];
      return {
        gid: s.gid, mode, i: s.i, n: s.list.length, phase: s.phase, deadline: s.deadline, revealUntil: s.revealUntil,
        q: Q ? Q.pub : null,
        hint: mode === 'anag' && s.hinted && Q ? Q.ans.text.charAt(0).toUpperCase() : null,
        answered: Object.keys(s.answers).filter((p) => !text || s.answers[p].ok),
        mine: mine ? (mode === 'quiz' ? { v: mine.v } : mine) : null,
        wrong: s.wrong[pid] || null,
        reveal: s.phase === 'reveal' && Q ? { ans: Q.ans, results: Object.entries(s.answers).map(([p, x]) => ({ pid: p, ...x })) } : null,
      };
    },

    mount(root, g) {
      const head = h('div', { class: 'row' });
      const cardSlot = h('div');
      const answerSlot = h('div', { class: 'col' });
      const status = h('p', { class: 'status-line' });
      const hostSlot = h('div', { class: 'col' });
      root.append(head, cardSlot, answerSlot, status, hostSlot);
      const timer = h('span', { class: 'pill timer-num', style: { fontSize: '15px' } });
      let v = null, room = null, lastKey = null, lastTick = null;
      let input = null;

      const iv = setInterval(updTimer, 200);
      function updTimer() {
        if (!v) return;
        if (v.phase === 'q') {
          const sec = Math.ceil(Math.max(0, v.deadline - g.now()) / 1000);
          timer.textContent = '⏱ ' + sec;
          timer.classList.toggle('low', sec <= 5);
          if (sec <= 5 && sec > 0 && sec !== lastTick) { lastTick = sec; sfx.tick(); }
        } else if (v.phase === 'reveal') {
          timer.textContent = '⏭ ' + Math.ceil(Math.max(0, v.revealUntil - g.now()) / 1000);
          timer.classList.remove('low');
        } else timer.textContent = '';
      }

      function cardFor(q) {
        const style = { '--g1': gameColors('mode-' + mode, M.colors)[0], '--g2': gameColors('mode-' + mode, M.colors)[1], minHeight: '0', padding: '22px 18px' };
        if (mode === 'quiz') return h('div', { class: 'qcard anim', style }, h('span', { class: 'badge lvl' }, q.theme), h('div', { class: 'big', style: { marginTop: '16px', fontSize: 'clamp(20px,5.4vw,28px)' } }, q.q));
        if (mode === 'emoji') return h('div', { class: 'qcard anim', style }, h('span', { class: 'badge lvl' }, q.cat), h('div', { class: 'emoji-big' }, q.e));
        if (mode === 'anag') return h('div', { class: 'qcard anim', style }, h('div', { class: 'kicker' }, `${M.kicker} · ${q.len} lettres`), h('div', { class: 'tiles' }, q.s.split('').map((c) => h('span', null, c))));
        return h('div', { class: 'qcard anim', style }, h('div', { class: 'kicker' }, M.kicker), h('div', { class: 'big', style: { fontSize: 'clamp(20px,5.4vw,28px)' } }, q.q), q.unit ? h('div', { class: 'foot' }, `Réponse en : ${q.unit}`) : null);
      }

      function answerUI() {
        const send = (val) => { g.send({ type: 'answer', v: val }); };
        if (v.phase !== 'q') return [];
        if (mode === 'quiz') {
          return [h('div', { class: 'quiz-opts' }, v.q.opts.map((o, i) => h('button', {
            class: 'quiz-opt' + (v.mine && v.mine.v === i ? ' on' : '') + (v.mine && v.mine.v !== i ? ' dim' : ''),
            disabled: !!v.mine,
            onclick: () => { send(i); sfx.pop(); buzz(15); },
          }, h('b', null, 'ABCD'[i]), o))),
          v.mine ? h('p', { class: 'muted small center' }, 'Réponse enregistrée 🔒') : null];
        }
        if (text) {
          if (v.mine && v.mine.ok) return [h('div', { class: 'panel center' }, h('h3', null, `✅ Trouvé : ${v.mine.v}`), h('p', { class: 'muted small' }, 'Bravo ! Attends les autres…'))];
          input = h('input', { class: 'input', placeholder: 'Ta réponse…', maxlength: '80', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'send' });
          return [h('form', { class: 'chat-form', onsubmit: (e) => { e.preventDefault(); const t = input.value.trim(); if (t) { send(t); input.value = ''; } } },
            input, h('button', { class: 'btn btn-primary', type: 'submit', 'aria-label': 'Envoyer' }, '➤')),
          v.wrong ? h('p', { class: 'small center', style: { color: 'var(--warn)' } }, `❌ « ${v.wrong.last} » : ce n'est pas ça (${v.wrong.n} essai${v.wrong.n > 1 ? 's' : ''})`) : null];
        }
        if (v.mine) return [h('div', { class: 'panel center' }, h('p', { class: 'muted' }, 'Ta réponse'), h('h3', null, v.q.unit ? `${formatNumber(v.mine.v)} ${v.q.unit}` : String(v.mine.v)))];
        input = h('input', { class: 'input', type: 'number', inputmode: 'decimal', placeholder: 'Ton estimation', step: 'any' });
        return [h('form', { class: 'chat-form', onsubmit: (e) => { e.preventDefault(); if (input.value !== '') { send(Number(input.value)); sfx.pop(); } } },
          input, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Valider'))];
      }

      function revealUI() {
        const r = v.reveal;
        const res = r.results.slice().sort((a, b) => (b.pts || 0) - (a.pts || 0));
        const label = (x) => (mode === 'quiz' ? v.q.opts[x.v] : mode === 'estim' ? (v.q.unit ? formatNumber(x.v) : String(x.v)) : x.v);
        const answeredPids = new Set(res.map((x) => x.pid));
        const missing = (room ? room.players.filter((p) => p.on && !answeredPids.has(p.pid)) : []);
        if (mode === 'quiz') {
          [...answerSlot.querySelectorAll('.quiz-opt')].forEach((b, i) => { b.classList.toggle('good', i === r.ans.i); });
        }
        return [
          h('div', { class: 'answer-reveal' }, h('span', { class: 'muted small' }, 'La réponse'), h('b', null, r.ans.text), r.ans.note ? h('span', { class: 'small muted' }, r.ans.note) : null),
          h('div', { class: 'scoreboard' },
            res.map((x) => h('div', { class: 'score-row' + (x.pts ? ' lead' : '') },
              h('span', null, x.ok || x.pts ? '✅' : '❌'), h('span', { class: 'n' }, g.nameOf(x.pid), h('span', { class: 'muted small' }, ' · ' + label(x))),
              h('span', { class: 's' }, x.pts ? '+' + x.pts : '0'))),
            missing.map((p) => h('div', { class: 'score-row', style: { opacity: '.5' } }, h('span', null, '💤'), h('span', { class: 'n' }, p.name), h('span', { class: 's' }, '0')))),
        ];
      }

      return {
        update(r, view) {
          room = r; v = view;
          const key = v.gid + ':' + v.i + ':' + v.phase;
          const me = r.players.find((p) => p.pid === g.me);
          if (v.phase === 'end') {
            head.replaceChildren(); cardSlot.replaceChildren(); status.textContent = ''; hostSlot.replaceChildren();
            answerSlot.replaceChildren(h('div', { class: 'center' }, h('div', { class: 'hero-emo' }, '🏆'), h('h2', null, 'Fin de la partie !')),
              podium(r.players.map((p) => ({ name: p.name, score: p.score }))), g.hostBar());
            if (lastKey !== key) sfx.fanfare();
            lastKey = key;
            return;
          }
          head.replaceChildren(h('span', { class: 'pill' }, `${M.emoji} ${v.i + 1}/${v.n}`), h('div', { class: 'grow' }), h('span', { class: 'pill' }, '🏆 ' + (me ? me.score : 0)), timer);
          const qKey = v.gid + ':' + v.i;
          if (cardSlot.dataset.k !== qKey) { cardSlot.dataset.k = qKey; cardSlot.replaceChildren(cardFor(v.q)); }
          if (v.hint && !cardSlot.querySelector('.hint-line')) { const c = cardSlot.querySelector('.qcard'); c && c.append(h('div', { class: 'foot hint-line' }, `💡 Indice : commence par « ${v.hint} »`)); }
          const keepFocus = input && document.activeElement === input && v.phase === 'q';
          const typed = input ? input.value : '';
          if (v.phase === 'q') {
            answerSlot.replaceChildren(...answerUI().filter(Boolean));
            if (keepFocus && input) { input.value = typed; input.focus(); }
            const total = r.players.filter((p) => p.on).length;
            status.textContent = text ? `🔎 ${v.answered.length}/${total} ont trouvé` : `🗳️ ${v.answered.length}/${total} ont répondu`;
          } else {
            if (mode !== 'quiz' || !answerSlot.querySelector('.quiz-opts')) answerSlot.replaceChildren(...answerUI().filter(Boolean));
            const keep = answerSlot.querySelector('.quiz-opts');
            answerSlot.replaceChildren(...[keep, ...revealUI()].filter(Boolean));
            status.textContent = '';
          }
          if (key !== lastKey) {
            if (v.phase === 'q') { lastTick = null; sfx.go(); if (text && input && window.innerWidth > 700) input.focus(); }
            if (v.phase === 'reveal') {
              const mine = v.reveal.results.find((x) => x.pid === g.me);
              if (mine && mine.pts) { sfx.ok(); buzz(40); } else { sfx.bad(); }
            }
          }
          if (v.phase === 'q' && text && v.mine && v.mine.ok && lastKey === key && !answerSlot.dataset.ok) { sfx.fanfare(); buzz([40, 30, 80]); }
          answerSlot.dataset.ok = v.mine && v.mine.ok ? '1' : '';
          lastKey = key;
          hostSlot.replaceChildren(g.isHost
            ? h('button', { class: 'btn ' + (v.phase === 'reveal' ? 'btn-primary btn-big' : 'btn-soft') + ' btn-block', onclick: () => g.send({ type: 'next' }) }, v.phase === 'reveal' ? 'Question suivante →' : '⏭ Révéler maintenant')
            : null);
          updTimer();
        },
        destroy() { clearInterval(iv); },
      };
    },
  };
}

export const raceQuiz = makeRace('quiz');
export const raceEmoji = makeRace('emoji');
export const raceAnag = makeRace('anag');
export const raceEstim = makeRace('estim');
