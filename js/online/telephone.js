// Téléphone dessiné : écrire → dessiner → deviner → dessiner… puis on révèle chaque chaîne.
// Chaque joueur traite une chaîne différente à chaque manche, il ne voit que l'étape précédente.
import { h, uid, shuffle, pick, seg } from '../ui.js';
import { createBoard, createTools } from '../canvas.js';
import { sfx, buzz } from '../sfx.js';
import PROMPTS from '../data/telephone.js';

const GRACE_MS = 4000;
const MAX_ROUNDS = 8;
const kindOf = (r) => (r === 0 ? 'write' : r % 2 === 1 ? 'draw' : 'guess');
const player = (room, pid) => room.players.find((p) => p.pid === pid);

function chainFor(s, pid, r) {
  const i = s.order.indexOf(pid);
  return i < 0 ? -1 : (((i - r) % s.N) + s.N) % s.N;
}

function sendInput(s, pid, api) {
  if (s.phase !== 'play') return;
  const c = chainFor(s, pid, s.round);
  if (c < 0) return;
  const prev = s.round > 0 ? s.chains[c].items[s.round - 1] : null;
  api.sendTo(pid, { t: 'tel', gid: s.gid, round: s.round, kind: s.kind, input: prev ? { kind: prev.kind, content: prev.content, missing: !!prev.missing, by: prev.by } : null });
}

function fillMissing(s) {
  for (const pid of s.order) {
    const c = chainFor(s, pid, s.round);
    if (!s.chains[c].items[s.round]) {
      // Texte manquant : on met une idée au hasard pour que la chaîne continue. Dessin manquant : vide.
      s.chains[c].items[s.round] = { by: pid, kind: s.kind, content: s.kind === 'draw' ? null : pick(PROMPTS), missing: true };
    }
  }
}

function startRound(room, s, api) {
  s.round++;
  if (s.round >= s.R) { s.phase = 'reveal'; s.rc = 0; s.rs = 0; return; }
  s.kind = kindOf(s.round);
  s.deadline = Date.now() + (s.kind === 'draw' ? s.st.drawTime : s.st.writeTime) * 1000;
  s.done = {};
  for (const pid of s.order) sendInput(s, pid, api);
}

function everyoneDone(room, s) {
  return s.order.every((pid) => s.done[pid] || !(player(room, pid) && player(room, pid).on));
}

export default {
  id: 'telephone',
  name: 'Téléphone dessiné',
  short: 'Écris, dessine, devine',
  emoji: '📞',
  minPlayers: 3,
  defaults: { drawTime: 80, writeTime: 40 },

  settingsForm(st, set) {
    return h('div', { class: 'col' },
      h('label', { class: 'field' }, 'Temps pour dessiner', seg([60, 80, 100, 120].map((n) => ({ value: n, label: n + ' s' })), st.drawTime, (v) => set({ drawTime: v }))),
      h('label', { class: 'field' }, 'Temps pour écrire', seg([30, 40, 60].map((n) => ({ value: n, label: n + ' s' })), st.writeTime, (v) => set({ writeTime: v }))),
      h('p', { class: 'muted tiny' }, `Une partie dure autant de manches qu'il y a de joueurs (${MAX_ROUNDS} maximum).`));
  },

  init(room, st, api) {
    const order = shuffle(room.players.filter((p) => p.on).map((p) => p.pid));
    const s = { gid: uid(), st, order, N: order.length, R: Math.min(order.length, MAX_ROUNDS), round: -1, phase: 'play', chains: order.map((owner) => ({ owner, items: [] })) };
    startRound(room, s, api);
    return s;
  },

  action(room, s, pid, a, api) {
    if (a.type === 'submit' && s.phase === 'play' && a.round === s.round && s.order.includes(pid) && !s.done[pid]) {
      let content = a.content;
      if (s.kind === 'draw') {
        if (typeof content !== 'string' || !content.startsWith('data:image/') || content.length > 450000) return false;
      } else {
        content = String(content || '').replace(/\s+/g, ' ').trim().slice(0, 120) || pick(PROMPTS);
      }
      s.chains[chainFor(s, pid, s.round)].items[s.round] = { by: pid, kind: s.kind, content };
      s.done[pid] = true;
      if (everyoneDone(room, s)) { fillMissing(s); startRound(room, s, api); }
      return true;
    }
    if (a.type === 'step' && pid === room.host && s.phase === 'reveal') {
      s.rs++;
      if (s.rs >= s.R) { s.rc++; s.rs = 0; if (s.rc >= s.N) s.phase = 'end'; }
      return true;
    }
    if (a.type === 'skip' && pid === room.host && s.phase === 'play') { fillMissing(s); startRound(room, s, api); return true; }
    return false;
  },

  tick(room, s, api) {
    if (s.phase === 'play' && (Date.now() > s.deadline + GRACE_MS || (Object.keys(s.done).length && everyoneDone(room, s)))) {
      fillMissing(s);
      startRound(room, s, api);
      return true;
    }
    return false;
  },

  onSync(room, s, pid, api) { sendInput(s, pid, api); },

  view(room, s, pid) {
    const online = s.order.filter((p) => player(room, p) && player(room, p).on);
    const v = {
      gid: s.gid, phase: s.phase, round: s.round, R: s.R, N: s.N, kind: s.kind, deadline: s.deadline,
      inGame: s.order.includes(pid), myDone: !!(s.done && s.done[pid]),
      done: s.done ? Object.keys(s.done).length : 0, total: online.length,
    };
    if (s.phase === 'reveal') {
      const ch = s.chains[s.rc];
      v.reveal = { rc: s.rc, rs: s.rs, owner: ch.owner, item: ch.items[s.rs] || null };
    }
    return v;
  },

  mount(root, g) {
    const box = h('div', { class: 'col' });
    root.append(box);
    let v = null;
    let room = null;
    const inputs = {};
    let builtKey = null;
    let board = null;
    let autoTimer = null;
    let progress = null;
    let timerEl = null;
    let submitFn = null;
    const sent = {};
    let chainKey = null;
    let chainItems = [];
    let lastPhase = null;
    let lastTick = null;

    const iv = setInterval(() => {
      if (!v || v.phase !== 'play' || !timerEl) return;
      const sec = Math.ceil(Math.max(0, v.deadline - g.now()) / 1000);
      timerEl.textContent = '⏱ ' + sec;
      timerEl.classList.toggle('low', sec <= 10);
      if (sec <= 5 && sec > 0 && sec !== lastTick && submitFn) { lastTick = sec; sfx.tick(); }
    }, 250);

    function exportDrawing() {
      const c = document.createElement('canvas');
      c.width = 400; c.height = 300;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 400, 300);
      ctx.drawImage(board.canvas, 0, 0, 400, 300);
      return c.toDataURL('image/jpeg', 0.72);
    }

    function head(label) {
      timerEl = h('span', { class: 'pill timer-num', style: { fontSize: '15px' } });
      progress = h('span', { class: 'pill' });
      return h('div', { class: 'row' }, h('span', { class: 'pill' }, label), h('div', { class: 'grow' }), progress, timerEl);
    }

    function setProgress() { if (progress) progress.textContent = `✅ ${v.done}/${v.total}`; }

    function buildTask(key, msg) {
      clearTimeout(autoTimer);
      board = null;
      submitFn = null;
      const kind = msg.kind;
      const label = kind === 'write' ? '✍️ Écris' : kind === 'draw' ? '🎨 Dessine' : '🤔 Devine';
      const doSend = (content) => {
        if (sent[key]) return;
        sent[key] = true;
        clearTimeout(autoTimer);
        g.send({ type: 'submit', round: msg.round, content });
        sfx.pop(); buzz(20);
        render();
      };
      if (kind === 'write') {
        const input = h('input', { class: 'input', maxlength: '120', placeholder: 'Ex. : un chat qui fait du ski', enterkeyhint: 'send' });
        submitFn = () => doSend(input.value.trim() || pick(PROMPTS));
        box.replaceChildren(head(`Manche 1/${v.R}`),
          h('div', { class: 'qcard anim', style: { '--g1': '#00b09b', '--g2': '#96c93d', minHeight: '0' } }, h('div', { class: 'kicker' }, '✍️ À toi d\'écrire'), h('div', { class: 'big', style: { fontSize: '22px' } }, 'Écris une phrase que le joueur suivant devra dessiner')),
          input,
          h('div', { class: 'row' }, h('button', { class: 'btn btn-soft', onclick: () => { input.value = pick(PROMPTS); } }, '🎲 Une idée'), h('button', { class: 'btn btn-primary grow', onclick: () => submitFn() }, 'Envoyer')));
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitFn(); });
      } else if (kind === 'draw') {
        board = createBoard({ editable: true });
        const what = msg.input && msg.input.content ? msg.input.content : pick(PROMPTS);
        submitFn = () => doSend(exportDrawing());
        box.replaceChildren(head(`${label} · ${msg.round + 1}/${v.R}`),
          h('div', { class: 'panel center' }, h('span', { class: 'muted small' }, msg.input && msg.input.missing ? 'Le joueur précédent n\'a rien écrit, voici une idée :' : `${g.nameOf(msg.input && msg.input.by)} a écrit :`), h('h3', null, `« ${what} »`)),
          board.el, createTools(board),
          h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => submitFn() }, 'Envoyer mon dessin'));
      } else {
        const input = h('input', { class: 'input', maxlength: '120', placeholder: 'Qu\'est-ce que c\'est ?', enterkeyhint: 'send' });
        submitFn = () => doSend(input.value.trim() || 'Aucune idée 🤷');
        const img = msg.input && msg.input.content
          ? h('img', { class: 'tel-img', src: msg.input.content, alt: 'Dessin à deviner' })
          : h('div', { class: 'panel center' }, '😶 Le joueur précédent n\'a rien dessiné… invente quelque chose !');
        box.replaceChildren(head(`${label} · ${msg.round + 1}/${v.R}`),
          h('p', { class: 'muted center' }, `Qu'a dessiné ${g.nameOf(msg.input && msg.input.by)} ?`), img, input,
          h('button', { class: 'btn btn-primary btn-block', onclick: () => submitFn() }, 'Envoyer'));
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitFn(); });
      }
      // Envoi automatique juste avant la fin du temps.
      autoTimer = setTimeout(() => submitFn && submitFn(), Math.max(0, v.deadline - g.now() - 900));
      builtKey = key;
      lastTick = null;
      sfx.go(); buzz([40, 30, 40]);
      setProgress();
    }

    function waiting(text) {
      clearTimeout(autoTimer);
      submitFn = null;
      board = null;
      box.replaceChildren(head(`Manche ${v.round + 1}/${v.R}`), h('div', { class: 'big-center' }, h('div', { class: 'hero-emo' }, '⏳'), h('h2', null, text), h('p', { class: 'muted' }, 'En attente des autres joueurs…')));
      setProgress();
    }

    function itemEl(it) {
      const name = g.nameOf(it.by);
      if (it.missing && it.kind === 'draw') return h('div', { class: 'tel-step' }, h('p', { class: 'muted' }, `😶 ${name} n'a rien dessiné`));
      if (it.kind === 'draw') return h('div', { class: 'tel-step' }, h('p', null, `🎨 ${name} a dessiné :`), h('img', { class: 'tel-img', src: it.content, alt: 'Dessin' }));
      const verb = it.kind === 'write' ? 'a écrit' : 'a cru voir';
      return h('div', { class: 'tel-step' }, h('p', null, `${it.kind === 'write' ? '✍️' : '🤔'} ${name} ${verb}${it.missing ? ' (au hasard)' : ''} :`), h('div', { class: 'tel-text' }, `« ${it.content} »`));
    }

    function render() {
      if (!v) return;
      if (v.phase === 'play') {
        const key = v.gid + ':' + v.round;
        if (!v.inGame) { if (builtKey !== 'spect') { box.replaceChildren(h('div', { class: 'big-center' }, h('div', { class: 'hero-emo' }, '👀'), h('h2', null, 'Partie en cours'), h('p', { class: 'muted' }, 'Tu pourras jouer à la prochaine partie !'))); builtKey = 'spect'; } return; }
        if (sent[key] || v.myDone) { if (builtKey !== key + ':wait') { waiting('C\'est envoyé !'); builtKey = key + ':wait'; } else setProgress(); return; }
        if (builtKey === key) { setProgress(); return; }
        const msg = inputs[key];
        if (!msg) { if (builtKey !== key + ':load') { box.replaceChildren(h('div', { class: 'big-center' }, h('p', { class: 'muted' }, 'Chargement…'))); builtKey = key + ':load'; } return; }
        buildTask(key, msg);
        return;
      }
      clearTimeout(autoTimer);
      submitFn = null;
      if (v.phase === 'reveal') {
        const ck = v.gid + ':' + v.reveal.rc;
        if (chainKey !== ck) { chainKey = ck; chainItems = []; }
        if (v.reveal.item && !chainItems[v.reveal.rs]) { chainItems[v.reveal.rs] = v.reveal.item; sfx.pop(); }
        const last = v.reveal.rc === v.N - 1 && v.reveal.rs === v.R - 1;
        const endOfChain = v.reveal.rs === v.R - 1;
        box.replaceChildren(
          h('div', { class: 'row' }, h('span', { class: 'pill' }, `📞 Chaîne de ${g.nameOf(v.reveal.owner)}`), h('div', { class: 'grow' }), h('span', { class: 'pill' }, `${v.reveal.rc + 1}/${v.N}`)),
          ...chainItems.filter(Boolean).map(itemEl),
          g.isHost
            ? h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => g.send({ type: 'step' }) }, last ? '🏁 Terminer' : endOfChain ? 'Chaîne suivante →' : 'Étape suivante →')
            : h('p', { class: 'status-line' }, '👀 L\'hôte dévoile les étapes une par une…'));
        const lastEl = box.querySelector('.tel-step:last-of-type');
        if (lastEl) lastEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        builtKey = 'reveal';
      } else if (v.phase === 'end') {
        if (lastPhase !== 'end') sfx.fanfare();
        box.replaceChildren(h('div', { class: 'big-center' }, h('div', { class: 'hero-emo' }, '🎉'), h('h2', null, 'Toutes les chaînes sont révélées !'), h('p', { class: 'muted' }, 'Alors, quelle chaîne a le plus dérapé ?')), g.hostBar());
        builtKey = 'end';
      }
      lastPhase = v.phase;
    }

    return {
      update(r, view) {
        room = r;
        if (v && view.gid !== v.gid) { builtKey = null; chainKey = null; }
        v = view;
        render();
        if (g.isHost && v.phase === 'play' && !box.querySelector('.tel-skip')) {
          box.append(h('button', { class: 'btn btn-ghost btn-sm tel-skip', onclick: () => g.send({ type: 'skip' }) }, '⏭ Passer à la manche suivante'));
        }
      },
      onMessage(m) {
        if (m.t !== 'tel') return;
        inputs[m.gid + ':' + m.round] = m;
        if (v) render();
      },
      destroy() { clearInterval(iv); clearTimeout(autoTimer); },
    };
  },
};
