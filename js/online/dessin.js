// « Je dessine, tu devines » en ligne.
import { h, pick, norm, levenshtein, seg, toggleRow, setText } from '../ui.js';
import { drawNew, TV_PID, tvTimer, tvEnd } from './kit.js';
import { createBoard, createTools, applyToLog, validOp } from '../canvas.js';
import { podium } from '../common.js';
import { sfx, buzz } from '../sfx.js';
import WORDS from '../data/dessin.js';

const CHOOSE_MS = 15000;
const REVEAL_MS = 6500;
const LETTER = /[a-zà-öø-ÿœæ0-9]/i;

const player = (room, pid) => room.players.find((p) => p.pid === pid);

function wordPool(diff) {
  if (diff === 'mix') return [...WORDS.facile, ...WORDS.moyen, ...WORDS.difficile];
  return WORDS[diff] || WORDS.facile;
}

function pushMsg(s, m) {
  m.id = ++s.msgId;
  s.chat.push(m);
  if (s.chat.length > 80) s.chat.splice(0, s.chat.length - 80);
}

function drawChoices(s) {
  // 3 mots tirés sans répétition d'une partie à l'autre (mémorisés chez l'hôte).
  const out = [];
  for (let k = 0; out.length < 3 && k < 30; k++) {
    const w = drawNew(s, 'on:dessin:' + s.st.diff, () => wordPool(s.st.diff));
    if (!out.includes(w) && !s.used.has(w)) out.push(w);
  }
  return out;
}

function letterIdx(word) {
  const out = [];
  for (let i = 0; i < word.length; i++) if (LETTER.test(word[i])) out.push(i);
  return out;
}

function mask(word, hints) {
  const parts = [];
  for (let i = 0; i < word.length; i++) {
    const c = word[i];
    if (c === ' ') parts.push(' ');
    else if (!LETTER.test(c)) parts.push(c);
    else parts.push(hints.includes(i) ? c.toUpperCase() : '_');
  }
  return parts.join(' ');
}

function nextTurn(room, s, api) {
  for (;;) {
    if (!s.queue.length) {
      s.round++;
      if (s.round > s.st.rounds) { s.phase = 'end'; s.drawer = null; s.word = ''; return; }
      s.queue = room.players.filter((p) => p.on).map((p) => p.pid);
      if (!s.queue.length) { s.phase = 'end'; return; }
    }
    const pid = s.queue.shift();
    const p = player(room, pid);
    if (p && p.on) { s.drawer = pid; break; }
  }
  s.phase = 'choose';
  s.choices = drawChoices(s);
  s.word = '';
  s.found = {};
  s.hints = [];
  s.summary = null;
  s.deadline = Date.now() + CHOOSE_MS;
  s.log = [];
  s.points = 0;
  api.relay({ k: 'c' });
}

function startDraw(room, s, word) {
  s.word = word;
  s.used.add(word);
  s.phase = 'draw';
  s.start = Date.now();
  s.deadline = s.start + s.st.time * 1000;
  pushMsg(s, { kind: 'sys', text: `✏️ ${player(room, s.drawer)?.name || '?'} dessine !` });
}

function endTurn(room, s, reason) {
  const finders = Object.keys(s.found).length;
  const d = player(room, s.drawer);
  const dp = finders ? Math.min(300, 40 + 50 * finders) : 0;
  if (d) d.score += dp;
  s.summary = { word: s.word, drawer: s.drawer, drawerPts: dp, found: { ...s.found }, reason: reason || null };
  s.phase = 'reveal';
  s.deadline = Date.now() + REVEAL_MS;
  if (s.word) pushMsg(s, { kind: 'sys', text: `Le mot était : ${s.word}` });
}

export default {
  id: 'dessin',
  name: 'Je dessine, tu devines',
  short: 'Dessin et devinettes',
  emoji: '🎨',
  minPlayers: 2,
  defaults: { rounds: 2, time: 80, diff: 'mix', hints: true },

  settingsForm(st, set) {
    return h('div', { class: 'col' },
      h('label', { class: 'field' }, 'Nombre de manches (chacun dessine une fois par manche)',
        seg([1, 2, 3, 4].map((n) => ({ value: n, label: String(n) })), st.rounds, (v) => set({ rounds: v }))),
      h('label', { class: 'field' }, 'Temps pour dessiner',
        seg([45, 60, 80, 100, 120].map((n) => ({ value: n, label: n + 's' })), st.time, (v) => set({ time: v }))),
      h('label', { class: 'field' }, 'Difficulté des mots',
        seg([{ value: 'facile', label: 'Facile' }, { value: 'moyen', label: 'Moyen' }, { value: 'difficile', label: 'Difficile' }, { value: 'mix', label: 'Mélange' }], st.diff, (v) => set({ diff: v }))),
      toggleRow('💡 Indices', 'Des lettres se dévoilent au fil du temps.', st.hints, (v) => set({ hints: v })));
  },

  init(room, st, api) {
    const s = { st, round: 0, queue: [], phase: 'choose', drawer: null, word: '', choices: [], deadline: 0, start: 0, found: {}, chat: [], hints: [], log: [], used: new Set(), msgId: 0, summary: null, points: 0 };
    pushMsg(s, { kind: 'sys', text: 'La partie commence ! 🎨' });
    nextTurn(room, s, api);
    return s;
  },

  action(room, s, pid, a, api) {
    const p = player(room, pid);
    if (!p) return false;
    switch (a.type) {
      case 'choose':
        if (pid === s.drawer && s.phase === 'choose' && Number.isInteger(a.i) && s.choices[a.i]) { startDraw(room, s, s.choices[a.i]); return true; }
        return false;
      case 'op': {
        if (pid !== s.drawer || s.phase !== 'draw' || !validOp(a.op)) return false;
        const op = a.op;
        if ((op.k === 's' || op.k === 'a') && s.points > 80000) return false;
        if (op.k === 'c') s.points = 0;
        if (op.p) s.points += op.p.length;
        applyToLog(s.log, op);
        api.relay(op, pid);
        return false;
      }
      case 'skip':
        if (pid !== room.host) return false;
        if (s.phase === 'choose') { nextTurn(room, s, api); return true; }
        if (s.phase === 'draw') { endTurn(room, s, 'skip'); return true; }
        return false;
      case 'guess': {
        const text = String(a.text || '').replace(/\s+/g, ' ').trim().slice(0, 60);
        if (!text) return false;
        if (s.phase === 'draw' && pid !== s.drawer && s.found[pid] == null) {
          const g = norm(text), w = norm(s.word);
          if (g === w || g.replace(/ /g, '') === w.replace(/ /g, '')) {
            const frac = Math.max(0, (s.deadline - Date.now()) / (s.st.time * 1000));
            const first = Object.keys(s.found).length === 0;
            const pts = Math.round(60 + 240 * frac) + (first ? 40 : 0);
            s.found[pid] = pts;
            p.score += pts;
            pushMsg(s, { kind: 'found', pid, text: `🎉 ${p.name} a trouvé ! (+${pts})` });
            const guessers = room.players.filter((x) => x.on && x.pid !== s.drawer);
            if (guessers.every((x) => s.found[x.pid] != null)) endTurn(room, s);
            return true;
          }
          if (w.length >= 4 && levenshtein(g, w) <= (w.length > 7 ? 2 : 1)) {
            pushMsg(s, { kind: 'close', to: pid, text: `« ${text} » : tu chauffes ! 🔥` });
            return true;
          }
          pushMsg(s, { kind: 'msg', pid, name: p.name, text });
          return true;
        }
        const restricted = s.phase === 'draw' && (pid === s.drawer || s.found[pid] != null);
        pushMsg(s, { kind: 'msg', pid, name: p.name, text, only: restricted ? [s.drawer, ...Object.keys(s.found)] : null });
        return true;
      }
      default:
        return false;
    }
  },

  tick(room, s, api) {
    const now = Date.now();
    if (s.phase === 'choose') {
      const d = player(room, s.drawer);
      if (!d || !d.on) { pushMsg(s, { kind: 'sys', text: 'Le dessinateur est parti, on passe au suivant.' }); nextTurn(room, s, api); return true; }
      if (now >= s.deadline) { startDraw(room, s, pick(s.choices)); return true; }
    } else if (s.phase === 'draw') {
      const d = player(room, s.drawer);
      if (!d || !d.on) { endTurn(room, s, 'left'); return true; }
      const guessers = room.players.filter((x) => x.on && x.pid !== s.drawer);
      if (!guessers.length || (Object.keys(s.found).length && guessers.every((x) => s.found[x.pid] != null))) { endTurn(room, s); return true; }
      if (s.st.hints) {
        const idx = letterIdx(s.word);
        const maxHints = Math.min(3, Math.floor(idx.length / 3));
        const total = s.st.time * 1000;
        const target = Math.min(maxHints, Math.floor(((now - s.start) / total) * (maxHints + 1)));
        if (s.hints.length < target) {
          const free = idx.filter((i) => !s.hints.includes(i));
          if (free.length > 1) { s.hints.push(pick(free)); return true; }
        }
      }
      if (now >= s.deadline) { endTurn(room, s); return true; }
    } else if (s.phase === 'reveal' && now >= s.deadline) {
      nextTurn(room, s, api);
      return true;
    }
    return false;
  },

  onSync(room, s, pid, api) {
    api.sendTo(pid, { t: 'draw', op: { k: 'full', log: s.log } });
  },

  // Écran télé : le dessin se trace en direct en grand, le mot masqué, les propositions et le classement.
  tvRelay: true, // les traits du dessin sont publics : la télé les reçoit (pas ceux du Téléphone dessiné)
  tv(room, s) { return this.view(room, s, TV_PID); },
  tvMount(root, g) {
    const board = createBoard({ editable: false });
    const overlay = h('div', { class: 'overlay-card hidden' });
    board.el.append(overlay);
    const word = h('div', { class: 'tv-word' });
    const tm = tvTimer(g);
    const bar = h('div', { class: 'tv-bar' });
    const chat = h('div', { class: 'chat', 'aria-live': 'polite' });
    const play = h('div', { class: 'tv-draw' }, board.el, chat);
    const endWrap = h('div', { class: 'tv-generic hidden' });
    root.append(bar, word, play, endWrap);
    let lastKey = null, lastMsg = 0;
    return {
      update(room, v) {
        if (v.phase === 'end') {
          tm.set(0); bar.classList.add('hidden'); word.classList.add('hidden'); play.classList.add('hidden'); endWrap.classList.remove('hidden');
          if (lastKey !== 'end') { endWrap.replaceChildren(...tvEnd(room)); sfx.fanfare(); }
          lastKey = 'end';
          return;
        }
        bar.classList.remove('hidden'); word.classList.remove('hidden'); play.classList.remove('hidden'); endWrap.classList.add('hidden');
        const key = v.round + ':' + v.drawer + ':' + v.phase;
        bar.replaceChildren(h('span', { class: 'pill' }, `🎨 ${v.round}/${v.rounds}`), h('span', { class: 'pill' }, `✏️ ${g.nameOf(v.drawer)} dessine`), h('div', { class: 'grow' }), tm.el);
        tm.set(v.phase === 'draw' || v.phase === 'choose' ? v.deadline : 0);
        if (v.phase === 'draw') word.replaceChildren(v.mask ? h('span', { class: 'word-mask' }, v.mask) : '');
        else if (v.phase === 'reveal') word.replaceChildren(v.summary?.word || '');
        else word.replaceChildren(h('span', { class: 'muted' }, '…'));
        if (v.phase === 'choose') {
          overlay.classList.remove('hidden');
          overlay.replaceChildren(h('div', { class: 'hero-emo' }, '🤔'), h('h3', null, `${g.nameOf(v.drawer)} choisit un mot…`), h('p', { class: 'muted small' }, 'Devinez sur vos téléphones dès que le dessin commence !'));
        } else if (v.phase === 'reveal' && v.summary) {
          const sm = v.summary;
          const finders = Object.entries(sm.found).sort((a, b) => b[1] - a[1]);
          overlay.classList.remove('hidden');
          overlay.replaceChildren(h('p', { class: 'muted' }, sm.reason === 'left' ? 'Le dessinateur est parti…' : 'Le mot était'),
            sm.word ? h('div', { class: 'reveal-word' }, sm.word) : null,
            h('div', null, finders.length
              ? finders.map(([pid, pts]) => h('div', null, `${g.nameOf(pid)} +${pts}`)).concat(h('div', { style: { color: 'var(--warn)' } }, `✏️ ${g.nameOf(sm.drawer)} +${sm.drawerPts}`))
              : h('div', null, 'Personne n\'a trouvé 😅')));
        } else overlay.classList.add('hidden');
        chat.replaceChildren(...v.chat.map((m) => {
          if (m.kind === 'sys') return h('div', { class: 'm sys' }, m.text);
          if (m.kind === 'found') return h('div', { class: 'm found' }, m.text);
          return h('div', { class: 'm' }, h('b', null, m.name + ' : '), m.text);
        }));
        chat.scrollTop = chat.scrollHeight;
        for (const m of v.chat) if (m.id > lastMsg && lastMsg && m.kind === 'found') sfx.ok();
        lastMsg = v.chat.length ? v.chat[v.chat.length - 1].id : lastMsg || 0.5;
        if (key !== lastKey && v.phase === 'reveal') sfx.end();
        if (key !== lastKey && v.phase === 'draw') sfx.go();
        lastKey = key;
      },
      onDraw(op) { board.apply(op); },
      destroy() { tm.stop(); },
    };
  },

  view(room, s, pid) {
    const isDrawer = pid === s.drawer;
    const knows = isDrawer || s.found[pid] != null || s.phase === 'reveal' || s.phase === 'end';
    return {
      phase: s.phase,
      round: s.round,
      rounds: s.st.rounds,
      time: s.st.time,
      drawer: s.drawer,
      deadline: s.deadline,
      choices: isDrawer && s.phase === 'choose' ? s.choices : null,
      word: knows && s.phase !== 'choose' ? s.word : null,
      mask: s.phase === 'draw' && !knows ? mask(s.word, s.hints) : null,
      found: s.found,
      chat: s.chat.filter((m) => (m.to ? m.to === pid : (!m.only || m.only.includes(pid)))).slice(-40),
      summary: s.phase === 'reveal' ? s.summary : null,
    };
  },

  mount(root, g) {
    const board = createBoard({ editable: false, onOp: (op) => g.send({ type: 'op', op }) });
    const tools = createTools(board);
    const toolsWrap = h('div', { class: 'hidden' }, tools);
    const roundPill = h('span', { class: 'pill' });
    const timerPill = h('span', { class: 'pill timer-num', style: { fontSize: '15px' } });
    const wordEl = h('div', { class: 'word-banner grow' });
    const scores = h('div', { class: 'mini-scores' });
    const overlay = h('div', { class: 'overlay-card hidden' });
    board.el.append(overlay);
    const chatLog = h('div', { class: 'chat', 'aria-live': 'polite' });
    const input = h('input', { class: 'input', placeholder: 'Ta réponse…', maxlength: '60', enterkeyhint: 'send', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false' });
    const form = h('form', {
      class: 'chat-form',
      onsubmit: (e) => {
        e.preventDefault();
        const t = input.value.trim();
        if (!t) return;
        g.send({ type: 'guess', text: t });
        input.value = '';
      },
    }, input, h('button', { class: 'btn btn-primary', type: 'submit', 'aria-label': 'Envoyer' }, '➤'));
    const hostSkip = h('button', { class: 'btn btn-ghost btn-sm hidden', onclick: () => g.send({ type: 'skip' }) }, '⏭ Passer ce tour');
    const playWrap = h('div', { class: 'col', style: { gap: '10px' } },
      h('div', { class: 'row' }, roundPill, wordEl, timerPill),
      scores, board.el, toolsWrap, chatLog, form, hostSkip);
    const endWrap = h('div', { class: 'col hidden' });
    root.append(playWrap, endWrap);

    let v = null;
    let lastPhase = null;
    let lastTurnKey = null;
    let lastMsgId = 0;
    let lastTick = null;

    const iv = setInterval(updTimer, 200);
    function updTimer() {
      if (!v) return;
      if (v.phase === 'draw' || v.phase === 'choose') {
        const left = Math.max(0, v.deadline - g.now());
        const sec = Math.ceil(left / 1000);
        setText(timerPill, '⏱ ' + sec);
        timerPill.classList.toggle('low', v.phase === 'draw' && sec <= 10);
        if (v.phase === 'draw' && sec <= 5 && sec > 0 && sec !== lastTick) { lastTick = sec; sfx.tick(); }
      } else setText(timerPill, '⏱ –');
    }

    function renderChat() {
      const nearBottom = chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight < 60;
      chatLog.replaceChildren(...v.chat.map((m) => {
        if (m.kind === 'sys') return h('div', { class: 'm sys' }, m.text);
        if (m.kind === 'found') return h('div', { class: 'm found' }, m.text);
        if (m.kind === 'close') return h('div', { class: 'm close' }, m.text);
        return h('div', { class: 'm' + (m.only ? ' priv' : '') }, h('b', null, m.name + ' : '), m.text);
      }));
      if (nearBottom || v.chat.length < 6) chatLog.scrollTop = chatLog.scrollHeight;
      for (const m of v.chat) {
        if (m.id > lastMsgId && lastMsgId) {
          if (m.kind === 'found') { if (m.pid === g.me) { sfx.fanfare(); buzz([40, 30, 80]); } else sfx.ok(); }
          if (m.kind === 'close') { sfx.pop(); buzz(20); }
        }
      }
      lastMsgId = v.chat.length ? v.chat[v.chat.length - 1].id : lastMsgId || 0.5;
    }

    function renderScores(room) {
      const list = room.players.slice().sort((a, b) => b.score - a.score);
      scores.replaceChildren(...list.map((p) => h('span', {
        class: 'mini-score' + (p.pid === g.me ? ' me' : '') + (v.found[p.pid] != null ? ' ok' : '') + (p.on ? '' : ' off'),
      }, p.pid === v.drawer ? '✏️' : (v.found[p.pid] != null ? '✅' : ''), p.name, h('span', { class: 'sc' }, String(p.score)))));
    }

    return {
      update(room, view) {
        v = view;
        const isDrawer = v.drawer === g.me;
        const drawing = v.phase === 'draw';
        const turnKey = v.round + ':' + v.drawer + ':' + v.phase;

        if (v.phase === 'end') {
          playWrap.classList.add('hidden');
          endWrap.classList.remove('hidden');
          endWrap.replaceChildren(
            h('div', { class: 'center' }, h('div', { class: 'hero-emo' }, '🏆'), h('h2', null, 'Fin de la partie !')),
            podium(room.players.map((p) => ({ name: p.name, score: p.score }))),
            g.hostBar());
          if (lastPhase !== 'end') sfx.fanfare();
          lastPhase = v.phase;
          return;
        }
        playWrap.classList.remove('hidden');
        endWrap.classList.add('hidden');

        roundPill.textContent = `${v.round}/${v.rounds}`;
        board.setEditable(isDrawer && drawing);
        toolsWrap.classList.toggle('hidden', !(isDrawer && drawing));
        form.classList.toggle('hidden', isDrawer && drawing);
        hostSkip.classList.toggle('hidden', !(g.isHost && (drawing || v.phase === 'choose')));

        // Mot / masque
        if (drawing && isDrawer) wordEl.replaceChildren(h('span', null, '✏️ ' + v.word));
        else if (drawing && v.word) wordEl.replaceChildren(h('span', { style: { color: 'var(--ok)' } }, '✅ ' + v.word));
        else if (drawing && v.mask) wordEl.replaceChildren(h('span', { class: 'word-mask' }, v.mask));
        else if (v.phase === 'choose') wordEl.replaceChildren(h('span', { class: 'muted small' }, isDrawer ? 'À toi de dessiner !' : `${g.nameOf(v.drawer)} choisit…`));
        else if (v.phase === 'reveal') wordEl.replaceChildren(h('span', null, v.summary?.word || ''));

        // Superposition
        if (v.phase === 'choose') {
          overlay.classList.remove('hidden');
          if (isDrawer && v.choices) {
            overlay.replaceChildren(h('h3', null, '🎨 Choisis ton mot'),
              h('div', { class: 'choices' }, v.choices.map((w, i) => h('button', { class: 'btn btn-primary', onclick: () => { g.send({ type: 'choose', i }); sfx.pop(); } }, w))),
              h('p', { class: 'muted small' }, 'Choix automatique à la fin du temps'));
          } else {
            overlay.replaceChildren(h('div', { class: 'hero-emo' }, '🤔'), h('h3', null, `${g.nameOf(v.drawer)} choisit un mot…`), h('p', { class: 'muted small' }, 'Prépare-toi à deviner !'));
          }
        } else if (v.phase === 'reveal' && v.summary) {
          overlay.classList.remove('hidden');
          const sm = v.summary;
          const finders = Object.entries(sm.found).sort((a, b) => b[1] - a[1]);
          overlay.replaceChildren(
            h('p', { class: 'muted' }, sm.reason === 'left' ? 'Le dessinateur est parti…' : 'Le mot était'),
            sm.word ? h('div', { class: 'reveal-word' }, sm.word) : null,
            h('div', { class: 'small' }, finders.length
              ? finders.map(([pid, pts]) => h('div', null, `${g.nameOf(pid)} +${pts}`)).concat(h('div', { style: { color: 'var(--warn)' } }, `✏️ ${g.nameOf(sm.drawer)} +${sm.drawerPts}`))
              : h('div', null, 'Personne n\'a trouvé 😅')));
        } else overlay.classList.add('hidden');

        if (turnKey !== lastTurnKey) {
          if (v.phase === 'choose' && isDrawer) { sfx.go(); buzz([60, 40, 60]); }
          if (v.phase === 'reveal') sfx.end();
          if (v.phase === 'draw' && !isDrawer) setTimeout(() => { if (document.activeElement !== input && window.innerWidth > 700) input.focus(); }, 50);
          lastTick = null;
        }
        lastTurnKey = turnKey;
        lastPhase = v.phase;

        renderScores(room);
        renderChat();
        updTimer();
      },
      onDraw(op) { board.apply(op); },
      destroy() { clearInterval(iv); },
    };
  },
};
