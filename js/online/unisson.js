// À l'unisson (en ligne) : un thème s'affiche, chacun écrit UNE réponse en secret.
// On marque autant de points que de joueurs qui ont écrit la même chose. Les « moutons noirs » sont seuls.
import { h, uid, seg, levenshtein, setText } from '../ui.js';
import { drawNew, TV_PID, tvWho, tvTimer, tvStage, tvSay, ranking } from './kit.js';
import { gameColors } from '../themes.js';
import { podium, levelPicker } from '../common.js';
import { sfx, buzz } from '../sfx.js';
import { softNorm } from '../race-core.js';
import DATA from '../data/unisson.js';

const LEVELS = [
  { id: 'fun', name: 'Classique', emoji: '🤝', desc: 'Des thèmes pour tout le monde.' },
  { id: 'hot', name: 'Hot', emoji: '🔥', desc: 'Amour et séduction, réservé aux adultes.', adult: true },
];
const REVEAL_MS = 14000;
const player = (room, pid) => room.players.find((p) => p.pid === pid);
// « Chats », « chat », « Le chat » : même réponse.
const key = (s) => { const k = softNorm(s).replace(/ /g, ''); return k.length > 3 ? k.replace(/[sx]$/, '') : k; };

function group(answers) {
  const groups = [];
  for (const [pid, text] of Object.entries(answers)) {
    const k = key(text);
    if (!k) continue;
    let g = groups.find((x) => x.k === k || (k.length >= 5 && Math.abs(x.k.length - k.length) <= 1 && levenshtein(x.k, k) <= 1));
    if (!g) { g = { k, text, pids: [] }; groups.push(g); }
    g.pids.push(pid);
  }
  return groups.sort((a, b) => b.pids.length - a.pids.length);
}

const unisson = {
  id: 'unisson',
  name: 'À l\'unisson',
  short: 'Répondez tous pareil',
  emoji: '🤝',
  minPlayers: 3,
  defaults: { rounds: 8, time: 25, levels: ['fun'] },

  settingsForm(st, set) {
    const sel = new Set((st.levels || []).filter((l) => LEVELS.some((x) => x.id === l)));
    if (!sel.size) sel.add('fun');
    set({ levels: [...sel] });
    return h('div', { class: 'col' },
      h('label', { class: 'field' }, 'Nombre de manches', seg([5, 8, 12].map((n) => ({ value: n, label: String(n) })), st.rounds, (v) => set({ rounds: v }))),
      h('label', { class: 'field' }, 'Temps pour répondre', seg([15, 25, 40].map((n) => ({ value: n, label: n + ' s' })), st.time, (v) => set({ time: v }))),
      h('p', { class: 'muted small' }, 'Thèmes'),
      levelPicker(LEVELS, sel, (s) => set({ levels: [...s] })));
  },

  init(room, st) {
    const lv = (st.levels || ['fun']).filter((l) => DATA[l]);
    const lvs = (lv.length ? lv : ['fun']).slice().sort();
    const s = { gid: uid(), st, all: lvs.flatMap((l) => DATA[l]), key: 'on:unisson:' + lvs, round: 0, phase: 'write' };
    next(room, s);
    return s;
  },

  action(room, s, pid, a) {
    if (a.type === 'next' && pid === room.host) {
      if (s.phase === 'write') { reveal(room, s); return true; }
      if (s.phase === 'reveal') { next(room, s); return true; }
      return false;
    }
    if (a.type !== 'answer' || s.phase !== 'write' || !player(room, pid)) return false;
    const t = String(a.v || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!t) return false;
    s.answers[pid] = t;
    const active = room.players.filter((p) => p.on).map((p) => p.pid);
    if (active.every((p) => s.answers[p])) reveal(room, s);
    return true;
  },

  tick(room, s) {
    const now = Date.now();
    if (s.phase === 'write' && now >= s.deadline) { reveal(room, s); return true; }
    if (s.phase === 'reveal' && now >= s.deadline) { next(room, s); return true; }
    return false;
  },

  onLeave(room, s) {
    if (s.phase !== 'write') return;
    const active = room.players.filter((p) => p.on).map((p) => p.pid);
    if (active.length && active.every((p) => s.answers[p])) reveal(room, s);
  },

  view(room, s, pid) {
    return {
      gid: s.gid, phase: s.phase, round: s.round, rounds: s.st.rounds, prompt: s.prompt, deadline: s.deadline,
      answered: Object.keys(s.answers), mine: s.answers[pid] || null,
      groups: s.phase === 'reveal' ? s.groups : null, gains: s.phase === 'reveal' ? s.gains : null,
    };
  },

  // Écran télé : le thème en grand, qui a déjà répondu, puis les réponses regroupées (les plus nombreuses en haut).
  tv(room, s) { return this.view(room, s, TV_PID); },
  tvMount(root, g) {
    const colors = gameColors('unisson', ['#00b09b', '#96c93d']);
    const bar = h('div', { class: 'tv-bar' });
    const cardSlot = h('div');
    const who = tvWho();
    const say = tvSay();
    const groups = h('div', { class: 'tv-groups' });
    const tm = tvTimer(g);
    const st = tvStage(root, bar, cardSlot, who.el, say.el, groups);
    let lastKey = null;
    return {
      update(r, v) {
        if (st.end(r, v.phase === 'end')) { tm.set(0); lastKey = null; return; }
        const k = `${v.gid}:${v.round}:${v.phase}`;
        tm.set(v.phase === 'write' ? v.deadline : 0);
        bar.replaceChildren(h('span', { class: 'pill' }, `🤝 Manche ${v.round}/${v.rounds}`), h('div', { class: 'grow' }), tm.el);
        if (cardSlot.dataset.k !== `${v.gid}:${v.round}`) {
          cardSlot.dataset.k = `${v.gid}:${v.round}`;
          cardSlot.replaceChildren(h('div', { class: 'tv-card tv-bigcard', style: { '--g1': colors[0], '--g2': colors[1] } }, h('div', { class: 'kicker' }, 'Pensez tous pareil…'), h('div', { class: 'q' }, v.prompt)));
        }
        who.el.classList.toggle('hidden', v.phase !== 'write');
        if (v.phase === 'write') who.set(r, v.answered);
        if (k === lastKey) return;
        if (v.phase === 'write') {
          say.set('📱 Écrivez UNE réponse en secret : comme la majorité !');
          groups.replaceChildren();
          sfx.go();
        } else {
          const lone = v.groups.length > 1 && v.groups[0].pids.length > 1;
          say.set(v.groups.length && v.groups[0].pids.length > 1 ? `🤝 ${v.groups[0].pids.length} esprits à l'unisson !` : '🐑 Que des moutons noirs !');
          groups.replaceChildren(...v.groups.map((gr) => h('div', { class: 'tv-group' + (gr.pids.length > 1 ? ' many' : '') },
            h('b', null, gr.text), h('span', { class: 'n' }, gr.pids.length > 1 ? `× ${gr.pids.length} · +${gr.pids.length - 1} chacun` : (lone ? '🐑 Mouton noir' : '0')),
            h('span', { class: 'who' }, gr.pids.map((p) => g.nameOf(p)).join(', ')))));
          sfx.end();
        }
        lastKey = k;
      },
      destroy() { tm.stop(); },
    };
  },
  mount(root, g) {
    const head = h('div', { class: 'row' });
    const cardSlot = h('div');
    const body = h('div', { class: 'col' });
    const status = h('p', { class: 'status-line' });
    const hostSlot = h('div', { class: 'col' });
    root.append(head, cardSlot, body, status, hostSlot);
    const timer = h('span', { class: 'pill timer-num', style: { fontSize: '15px' } });
    let v = null, lastKey = null, input = null, lastTick = null;
    const colors = gameColors('unisson', ['#00b09b', '#96c93d']);

    const iv = setInterval(() => {
      if (!v || v.phase === 'end') { timer.textContent = ''; return; }
      const sec = Math.ceil(Math.max(0, v.deadline - g.now()) / 1000);
      setText(timer, (v.phase === 'write' ? '⏱ ' : '⏭ ') + sec);
      timer.classList.toggle('low', v.phase === 'write' && sec <= 5);
      if (v.phase === 'write' && sec <= 3 && sec > 0 && sec !== lastTick) { lastTick = sec; sfx.tick(); }
    }, 200);

    return {
      update(r, view) {
        v = view;
        const k = `${v.gid}:${v.round}:${v.phase}`;
        const me = r.players.find((p) => p.pid === g.me);
        if (v.phase === 'end') {
          head.replaceChildren(); cardSlot.replaceChildren(); status.textContent = ''; hostSlot.replaceChildren();
          body.replaceChildren(h('div', { class: 'center' }, h('div', { class: 'hero-emo' }, '🏆'), h('h2', null, 'Fin de la partie !')),
            podium(ranking(r, g)), g.hostBar());
          lastKey = k;
          return;
        }
        head.replaceChildren(h('span', { class: 'pill' }, `🤝 ${v.round}/${v.rounds}`), h('div', { class: 'grow' }), h('span', { class: 'pill' }, '🏆 ' + (me ? me.score : 0)), timer);
        if (cardSlot.dataset.k !== `${v.gid}:${v.round}`) {
          cardSlot.dataset.k = `${v.gid}:${v.round}`;
          cardSlot.replaceChildren(h('div', { class: 'qcard anim', style: { '--g1': colors[0], '--g2': colors[1], minHeight: '0', padding: '22px 18px' } },
            h('div', { class: 'kicker' }, 'Pensez tous pareil…'), h('div', { class: 'big' }, v.prompt)));
        }
        if (v.phase === 'write') {
          if (v.mine) {
            body.replaceChildren(h('div', { class: 'panel center' }, h('p', { class: 'muted small' }, 'Ta réponse'), h('h3', null, v.mine), h('p', { class: 'muted small' }, 'Attends les autres… 🤞')));
            body.dataset.k = k + ':done';
          } else if (body.dataset.k !== k + ':form') {
            const typed = input ? input.value : '';
            input = h('input', { class: 'input', placeholder: 'Ta réponse (un mot ou deux)…', maxlength: '40', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'send' });
            input.value = lastKey === k ? typed : '';
            body.replaceChildren(h('form', { class: 'chat-form', onsubmit: (e) => { e.preventDefault(); const t = input.value.trim(); if (t) { g.send({ type: 'answer', v: t }); sfx.pop(); buzz(15); } } },
              input, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Valider')),
            h('p', { class: 'muted small center' }, 'Essaie de répondre comme la majorité !'));
            body.dataset.k = k + ':form';
          }
          const total = r.players.filter((p) => p.on).length;
          setText(status, `✍️ ${v.answered.length}/${total} ont répondu`);
        } else {
          body.dataset.k = k;
          const lone = v.groups.length > 1 && v.groups[0].pids.length > 1;
          body.replaceChildren(h('div', { class: 'col' }, v.groups.map((gr) => h('div', { class: 'reveal-opt' + (gr.pids.length > 1 ? ' real' : '') },
            h('div', { class: 'txt' }, `${gr.text}${gr.pids.length > 1 ? ' × ' + gr.pids.length : ''}`),
            h('div', { class: 'meta' }, h('span', null, gr.pids.map((p) => (p === g.me ? 'Toi' : g.nameOf(p))).join(', ')),
              h('b', null, gr.pids.length > 1 ? `+${gr.pids.length - 1} chacun` : (lone ? '🐑 Mouton noir' : '0')))))));
          status.textContent = '';
          if (lastKey !== k) {
            const mine = v.gains[g.me] || 0;
            if (mine) { sfx.ok(); buzz(40); } else sfx.bad();
          }
        }
        if (lastKey !== k && v.phase === 'write') { lastTick = null; sfx.go(); }
        lastKey = k;
        hostSlot.replaceChildren(g.isHost
          ? h('button', { class: 'btn ' + (v.phase === 'reveal' ? 'btn-primary btn-big' : 'btn-soft') + ' btn-block', onclick: () => g.send({ type: 'next' }) }, v.phase === 'reveal' ? 'Manche suivante →' : '⏭ Révéler maintenant')
          : null);
      },
      destroy() { clearInterval(iv); },
    };
  },
};

function next(room, s) {
  s.round++;
  if (s.round > s.st.rounds) { s.phase = 'end'; return; }
  s.prompt = drawNew(s, s.key, s.all);
  s.answers = {};
  s.phase = 'write';
  s.deadline = Date.now() + s.st.time * 1000;
}

function reveal(room, s) {
  s.groups = group(s.answers).map((gr) => ({ text: gr.text, pids: gr.pids }));
  s.gains = {};
  for (const gr of s.groups) {
    const pts = gr.pids.length - 1;
    for (const pid of gr.pids) {
      s.gains[pid] = pts;
      const p = player(room, pid);
      if (p) p.score += pts;
    }
  }
  s.phase = 'reveal';
  s.deadline = Date.now() + REVEAL_MS;
}

export default unisson;
