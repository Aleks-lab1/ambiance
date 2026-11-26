// Jeux de rapidité en ligne : Quiz (QCM), Émojis mystères & Anagrammes (réponse libre), À vue de nez (estimation).
import { h, uid, seg, setText, modal } from '../ui.js';
import { gameColors } from '../themes.js';
import { podium, themeGrid } from '../common.js';
import { TV_PID, tvTimer, tvEnd, tvWho } from './kit.js';
import { sfx, buzz } from '../sfx.js';
import { RACE_MODES, questionSource, matches, estimPoints, formatNumber, isQcm, isText, CALC_LEVELS, COUNT_LABEL, quizThemes, themeChoice, themesOf } from '../race-core.js';
import VF from '../data/vraifaux.js';
import QUIZ from '../data/quiz.js';
import EMOJIS from '../data/emojis.js';
import ANAG from '../data/anagrammes.js';
import ESTIM from '../data/estimations.js';

const DATA = { quiz: QUIZ, emoji: EMOJIS, anag: ANAG, estim: ESTIM, vf: VF, calc: null };
const REVEAL_MS = 9000;
const player = (room, pid) => room.players.find((p) => p.pid === pid);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
// Source de questions de chaque partie (gardée chez l'hôte, hors de l'état envoyé aux joueurs).
const SOURCES = new WeakMap();

function makeRace(mode) {
  const M = RACE_MODES[mode];
  const text = isText(mode);
  const qcm = isQcm(mode);

  function nextQ(s) {
    s.i++;
    // count = 0 : sans limite, on tire une nouvelle question tant que l'hôte n'arrête pas.
    if (s.st.count && s.i >= s.st.count) { s.phase = 'end'; return; }
    if (!s.list[s.i]) s.list.push(SOURCES.get(s).next());
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
    defaults: { count: 10, time: mode === 'quiz' ? 20 : mode === 'vf' ? 15 : mode === 'calc' ? 20 : mode === 'estim' ? 25 : 40, themes: mode === 'quiz' ? [] : undefined, level: mode === 'calc' ? 'moyen' : undefined },

    settingsForm(st, set) {
      const parts = [
        h('label', { class: 'field' }, 'Nombre de questions', seg([5, 10, 15, 20, 0].map((n) => ({ value: n, label: COUNT_LABEL(n) })), st.count, (v) => set({ count: v }))),
        st.count === 0 ? h('p', { class: 'muted small' }, '∞ Sans limite : les questions s\'enchaînent jusqu\'à ce que l\'hôte touche « Terminer ».') : null,
        h('label', { class: 'field' }, 'Temps par question', seg((mode === 'vf' ? [10, 15, 20] : mode === 'calc' ? [10, 20, 30] : text ? [30, 40, 60] : [15, 20, 30]).map((n) => ({ value: n, label: n + ' s' })), st.time, (v) => set({ time: v }))),
        mode === 'calc' ? h('label', { class: 'field' }, 'Difficulté', seg(CALC_LEVELS, st.level || 'moyen', (v) => set({ level: v }))) : null,
      ];
      if (mode === 'quiz') {
        parts.push(h('div', { class: 'col' }, h('p', { class: 'muted small' }, 'Thème'),
          themeGrid(quizThemes(QUIZ), themeChoice(st.themes), (v) => set({ themes: themesOf(v) }))));
      }
      return h('div', { class: 'col' }, parts);
    },
    // Quiz : au lancement, le chef choisit le thème (ou « Tout mélanger ») dans une fenêtre. true = lancer.
    choose: mode === 'quiz' ? (st, set) => {
      let close = null;
      return modal({
        title: '🧠 Quel thème ?',
        content: h('div', { class: 'col' }, h('p', { class: 'muted small' }, 'Touche un thème pour lancer le Quiz.'),
          themeGrid(quizThemes(QUIZ), themeChoice(st.themes), (v) => { set({ themes: themesOf(v) }); if (close) close(true); })),
        actions: [{ label: 'Annuler', value: false }],
        onOpen: (c) => { close = c; },
      }).then((v) => v === true);
    } : undefined,

    init(room, st) {
      const s = { gid: uid(), st, list: [], i: -1 };
      SOURCES.set(s, questionSource(mode, DATA[mode], st));
      nextQ(s);
      return s;
    },

    // Partie reprise par l'hôte (save.js) : la pioche de questions est recréée (déjà vues : mémoire du téléphone).
    restore(room, s) { SOURCES.set(s, questionSource(mode, DATA[mode], s.st)); },

    action(room, s, pid, a) {
      if (a.type === 'stop' && pid === room.host && s.phase !== 'end') {
        if (s.phase === 'q') reveal(room, s);
        s.phase = 'end';
        return true;
      }
      if (a.type === 'next' && pid === room.host) {
        if (s.phase === 'q') { reveal(room, s); return true; }
        if (s.phase === 'reveal') { nextQ(s); return true; }
        return false;
      }
      if (a.type !== 'answer' || s.phase !== 'q' || !player(room, pid)) return false;
      const Q = s.list[s.i];
      const frac = clamp01((s.deadline - Date.now()) / (s.st.time * 1000));
      if (qcm) {
        if (s.answers[pid] || !Number.isInteger(a.v) || a.v < 0 || a.v >= Q.pub.opts.length) return false;
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
        const good = mode === 'calc' ? Number(guess.replace(/\s/g, '').replace(',', '.')) === Number(Q.ans.text) : matches(guess, [Q.ans.text, ...(Q.ans.alts || [])], Q.ans.keys);
        if (good) {
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
        gid: s.gid, mode, i: s.i, n: s.st.count || 0, phase: s.phase, deadline: s.deadline, revealUntil: s.revealUntil,
        q: Q ? Q.pub : null,
        hint: mode === 'anag' && s.hinted && Q ? Q.ans.text.charAt(0).toUpperCase() : null,
        answered: Object.keys(s.answers).filter((p) => !text || s.answers[p].ok),
        mine: mine ? (qcm ? { v: mine.v } : mine) : null,
        wrong: s.wrong[pid] || null,
        reveal: s.phase === 'reveal' && Q ? { ans: Q.ans, results: Object.entries(s.answers).map(([p, x]) => ({ pid: p, ...x })) } : null,
      };
    },

    // Écran télé : la question et les 4 réponses en grand, qui a répondu, puis la bonne réponse et qui l'a trouvée.
    tv(room, s) { return this.view(room, s, TV_PID); },
    tvMount(root, g) {
      const [c1, c2] = gameColors('mode-' + mode, M.colors);
      const bar = h('div', { class: 'tv-bar' });
      const cardSlot = h('div');
      const optSlot = h('div');
      const who = tvWho();
      const whoSlot = h('div', null, who.el);
      const after = h('div', { class: 'col', style: { gap: '.8em', alignItems: 'center' } });
      const tm = tvTimer(g);
      root.append(bar, cardSlot, optSlot, whoSlot, after);
      let lastKey = null;
      const style = { '--g1': c1, '--g2': c2 };
      function tvCard(q) {
        if (qcm) return h('div', { class: 'tv-card', style }, h('div', { class: 'kicker' }, q.theme || M.kicker), h('div', { class: 'q' }, q.q));
        if (mode === 'calc') return h('div', { class: 'tv-card', style }, h('div', { class: 'kicker' }, M.kicker), h('div', { class: 'calc-big' }, q.q, ' = ?'));
        if (mode === 'emoji') return h('div', { class: 'tv-card', style }, h('div', { class: 'kicker' }, q.cat || M.kicker), h('div', { class: 'emoji-big' }, q.e));
        if (mode === 'anag') return h('div', { class: 'tv-card', style }, h('div', { class: 'kicker' }, `${M.kicker} · ${q.len} lettres`), h('div', { class: 'tiles' }, q.s.split('').map((c) => h('span', null, c))));
        return h('div', { class: 'tv-card', style }, h('div', { class: 'kicker' }, M.kicker), h('div', { class: 'q' }, q.q), q.unit ? h('div', { class: 'kicker' }, `Réponse en : ${q.unit}`) : null);
      }
      function revealParts(v) {
        const r = v.reveal;
        const res = r.results.slice().sort((a, b) => (b.pts || 0) - (a.pts || 0));
        const label = (x) => (mode === 'estim' ? (v.q.unit ? `${formatNumber(x.v)} ${v.q.unit}` : String(x.v)) : String(x.v));
        return [
          qcm && !r.ans.note ? null : h('div', { class: 'tv-answer' }, h('span', null, 'La réponse'), h('b', null, r.ans.text), r.ans.note ? h('span', null, r.ans.note) : null),
          h('div', { class: 'tv-results' }, res.length
            ? res.map((x) => h('span', { class: 'tv-res' + (x.pts ? ' ok' : '') }, `${x.pts ? '✅' : '❌'} ${g.nameOf(x.pid)}${qcm ? '' : ' · ' + label(x)}${x.pts ? ' +' + x.pts : ''}`))
            : h('span', { class: 'tv-res' }, 'Personne n\'a répondu 😅')),
        ];
      }
      return {
        update(room, v) {
          if (v.phase === 'end') {
            tm.set(0); bar.replaceChildren(); cardSlot.replaceChildren(); optSlot.replaceChildren(); whoSlot.classList.add('hidden');
            if (lastKey !== 'end') { after.replaceChildren(...tvEnd(room)); sfx.fanfare(); }
            lastKey = 'end';
            return;
          }
          const qKey = v.gid + ':' + v.i;
          const key = qKey + ':' + v.phase;
          bar.replaceChildren(h('span', { class: 'pill' }, `${M.emoji} Question ${v.i + 1}${v.n ? '/' + v.n : ''}`), h('div', { class: 'grow' }), tm.el);
          tm.set(v.phase === 'q' ? v.deadline : 0);
          if (cardSlot.dataset.k !== qKey) { cardSlot.dataset.k = qKey; cardSlot.replaceChildren(tvCard(v.q)); after.replaceChildren(); delete after.dataset.k; }
          if (v.hint && !cardSlot.querySelector('.hint-line')) cardSlot.firstChild.append(h('div', { class: 'kicker hint-line' }, `💡 Indice : commence par « ${v.hint} »`));
          if (qcm) {
            if (optSlot.dataset.k !== qKey) {
              optSlot.dataset.k = qKey;
              optSlot.replaceChildren(h('div', { class: 'tv-opts' }, v.q.opts.map((o, i) => h('div', { class: 'tv-opt c' + i }, h('b', null, 'ABCD'[i]), h('span', { class: 't' }, o), h('span', { class: 'who' })))));
            }
            optSlot.querySelectorAll('.tv-opt').forEach((el, i) => {
              const good = !!v.reveal && i === v.reveal.ans.i;
              el.classList.toggle('good', good);
              el.classList.toggle('dim', !!v.reveal && !good);
              el.querySelector('.who').textContent = v.reveal ? v.reveal.results.filter((x) => x.v === i).map((x) => g.nameOf(x.pid)).join(', ') : '';
            });
          } else optSlot.replaceChildren();
          whoSlot.classList.toggle('hidden', v.phase !== 'q');
          who.set(room, v.answered);
          if (v.phase === 'reveal' && after.dataset.k !== key) { after.dataset.k = key; after.replaceChildren(...revealParts(v).filter(Boolean)); }
          if (key !== lastKey) { if (v.phase === 'q') sfx.go(); else if (v.phase === 'reveal') sfx.ok(); }
          lastKey = key;
        },
        destroy() { tm.stop(); },
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
          setText(timer, '⏱ ' + sec);
          timer.classList.toggle('low', sec <= 5);
          if (sec <= 5 && sec > 0 && sec !== lastTick) { lastTick = sec; sfx.tick(); }
        } else if (v.phase === 'reveal') {
          setText(timer, '⏭ ' + Math.ceil(Math.max(0, v.revealUntil - g.now()) / 1000));
          timer.classList.remove('low');
        } else timer.textContent = '';
      }

      function cardFor(q) {
        const style = { '--g1': gameColors('mode-' + mode, M.colors)[0], '--g2': gameColors('mode-' + mode, M.colors)[1], minHeight: '0', padding: '22px 18px' };
        if (qcm) return h('div', { class: 'qcard anim', style }, h('span', { class: 'badge lvl' }, q.theme), h('div', { class: 'big', style: { marginTop: '16px', fontSize: 'clamp(20px,5.4vw,28px)' } }, q.q));
        if (mode === 'calc') return h('div', { class: 'qcard anim', style }, h('div', { class: 'kicker' }, M.kicker), h('div', { class: 'calc-big' }, q.q, ' = ?'));
        if (mode === 'emoji') return h('div', { class: 'qcard anim', style }, h('span', { class: 'badge lvl' }, q.cat), h('div', { class: 'emoji-big' }, q.e));
        if (mode === 'anag') return h('div', { class: 'qcard anim', style }, h('div', { class: 'kicker' }, `${M.kicker} · ${q.len} lettres`), h('div', { class: 'tiles' }, q.s.split('').map((c) => h('span', null, c))));
        return h('div', { class: 'qcard anim', style }, h('div', { class: 'kicker' }, M.kicker), h('div', { class: 'big', style: { fontSize: 'clamp(20px,5.4vw,28px)' } }, q.q), q.unit ? h('div', { class: 'foot' }, `Réponse en : ${q.unit}`) : null);
      }

      function answerUI() {
        const send = (val) => { g.send({ type: 'answer', v: val }); };
        if (v.phase !== 'q') return [];
        if (qcm) {
          return [h('div', { class: 'quiz-opts' + (mode === 'vf' ? ' vf' : '') }, v.q.opts.map((o, i) => h('button', {
            class: 'quiz-opt' + (v.mine && v.mine.v === i ? ' on' : '') + (v.mine && v.mine.v !== i ? ' dim' : ''),
            disabled: !!v.mine,
            onclick: () => { send(i); sfx.pop(); buzz(15); },
          }, h('b', null, 'ABCD'[i]), o))),
          v.mine ? h('p', { class: 'muted small center' }, 'Réponse enregistrée 🔒') : null];
        }
        if (text) {
          if (v.mine && v.mine.ok) return [h('div', { class: 'panel center' }, h('h3', null, `✅ Trouvé : ${v.mine.v}`), h('p', { class: 'muted small' }, 'Bravo ! Attends les autres…'))];
          input = h('input', { class: 'input', placeholder: mode === 'calc' ? 'Le résultat…' : 'Ta réponse…', inputmode: mode === 'calc' ? 'decimal' : null, maxlength: '80', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'send' });
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
        const label = (x) => (qcm ? v.q.opts[x.v] : mode === 'estim' ? (v.q.unit ? formatNumber(x.v) : String(x.v)) : x.v);
        const answeredPids = new Set(res.map((x) => x.pid));
        const missing = (room ? room.players.filter((p) => p.on && !answeredPids.has(p.pid)) : []);
        if (qcm) {
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
          head.replaceChildren(h('span', { class: 'pill' }, v.n ? `${M.emoji} ${v.i + 1}/${v.n}` : `${M.emoji} ${v.i + 1} · ∞`), h('div', { class: 'grow' }), h('span', { class: 'pill' }, '🏆 ' + (me ? me.score : 0)), timer);
          const qKey = v.gid + ':' + v.i;
          if (cardSlot.dataset.k !== qKey) { cardSlot.dataset.k = qKey; cardSlot.replaceChildren(cardFor(v.q)); }
          if (v.hint && !cardSlot.querySelector('.hint-line')) { const c = cardSlot.querySelector('.qcard'); c && c.append(h('div', { class: 'foot hint-line' }, `💡 Indice : commence par « ${v.hint} »`)); }
          const keepFocus = input && document.activeElement === input && v.phase === 'q';
          const typed = input ? input.value : '';
          if (v.phase === 'q') {
            answerSlot.replaceChildren(...answerUI().filter(Boolean));
            if (keepFocus && input) { input.value = typed; input.focus(); }
            const total = r.players.filter((p) => p.on).length;
            setText(status, text ? `🔎 ${v.answered.length}/${total} ont trouvé` : `🗳️ ${v.answered.length}/${total} ont répondu`);
          } else {
            if (!qcm || !answerSlot.querySelector('.quiz-opts')) answerSlot.replaceChildren(...answerUI().filter(Boolean));
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
          const last = v.n && v.i + 1 >= v.n;
          hostSlot.replaceChildren(...(g.isHost ? [
            h('button', { class: 'btn ' + (v.phase === 'reveal' ? 'btn-primary btn-big' : 'btn-soft') + ' btn-block', onclick: () => g.send({ type: 'next' }) }, v.phase === 'reveal' ? (last ? '🏆 Voir le classement' : 'Question suivante →') : '⏭ Révéler maintenant'),
            !last ? h('button', { class: 'btn btn-ghost btn-sm', onclick: () => g.send({ type: 'stop' }) }, '🏁 Terminer la partie') : null,
          ].filter(Boolean) : []));
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
export const raceVf = makeRace('vf');
export const raceCalc = makeRace('calc');
