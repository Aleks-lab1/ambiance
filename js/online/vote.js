// Jeux de vote en ligne : Tu préfères, C'est un 10 mais…, Qui de nous…
import { h, shuffle } from '../ui.js';
import { gameColors } from '../themes.js';
import { LEVELS } from '../data/levels.js';
import { levelPicker } from '../common.js';
import { drinks, drinkPl } from '../store.js';
import { sfx, buzz } from '../sfx.js';
import TP from '../data/tupreferes.js';
import DIX from '../data/dix.js';
import QUI from '../data/qui.js';
import OP from '../data/opinions.js';
import JAMAIS from '../data/jamais.js';

const MODES = {
  tp: { name: 'Tu préfères', emoji: '🤔', short: 'Votez pour un camp', data: TP, levels: LEVELS.tupreferes, kicker: 'Tu préfères…', min: 2, colors: ['#7c5cff', '#2ec5ff'] },
  dix: { name: "C'est un 10 mais…", emoji: '💯', short: 'Notez sur 10', data: DIX, levels: LEVELS.dix, kicker: "C'est un 10 mais…", min: 2, colors: ['#ff3d6e', '#ffc93c'] },
  op: { name: 'Opinions impopulaires', emoji: '🗣️', short: 'D\'accord ou pas ?', data: OP, levels: LEVELS.opinions, kicker: 'Opinion impopulaire…', min: 2, colors: ['#ee0979', '#ff6a00'] },
  jamais: { name: 'Je n\'ai jamais', emoji: '🙊', short: 'Qui l\'a déjà fait ?', data: JAMAIS, levels: LEVELS.jamais, kicker: 'Je n\'ai jamais…', min: 2, colors: ['#ff4d8d', '#ff9a5a'] },
  qui: { name: 'Qui de nous…', emoji: '👉', short: 'Désignez quelqu\'un', data: QUI, levels: LEVELS.qui, kicker: 'Qui de nous est le plus susceptible de…', min: 3, colors: ['#00b39b', '#5a6cff'] },
};

function makeVote(mode) {
  const M = MODES[mode];
  const binary = mode === 'tp' || mode === 'op' || mode === 'jamais';
  const optLabel = (it, i) => (mode === 'tp' ? it[i] : mode === 'jamais' ? (i === 0 ? '🙋 Je l\'ai déjà fait' : '🙅 Jamais') : (i === 0 ? '👍 D\'accord' : '👎 Pas d\'accord'));
  const validLevels = (ls) => (Array.isArray(ls) ? ls.filter((l) => M.levels.some((x) => x.id === l)) : []);

  function next(s) {
    if (!s.deck.length) s.deck = shuffle(s.all.slice());
    s.q = s.deck.pop();
    s.n++;
    s.votes = {};
    s.phase = 'vote';
  }
  const activePids = (room) => room.players.filter((p) => p.on).map((p) => p.pid);
  const allVoted = (room, s) => activePids(room).every((pid) => s.votes[pid] != null);

  return {
    id: 'vote-' + mode,
    name: M.name,
    short: M.short,
    emoji: M.emoji,
    minPlayers: M.min,
    defaults: { levels: [M.levels[0].id] },

    settingsForm(st, set) {
      const sel = new Set(validLevels(st.levels));
      if (!sel.size) sel.add(M.levels[0].id);
      set({ levels: [...sel] });
      return h('div', { class: 'col' }, h('p', { class: 'muted small' }, 'Niveaux d\'intensité'), levelPicker(M.levels, sel, (s) => set({ levels: [...s] })));
    },

    init(room, st) {
      const lv = validLevels(st.levels);
      const all = (lv.length ? lv : [M.levels[0].id]).flatMap((l) => (M.data[l] || []).map((it) => ({ l, it })));
      const s = { all, deck: shuffle(all.slice()), q: null, n: 0, votes: {}, phase: 'vote' };
      next(s);
      return s;
    },

    action(room, s, pid, a) {
      if (a.type === 'vote' && s.phase === 'vote') {
        let v = a.v;
        if (binary && v !== 0 && v !== 1) return false;
        if (mode === 'dix' && !(Number.isInteger(v) && v >= 0 && v <= 10)) return false;
        if (mode === 'qui' && !room.players.some((p) => p.pid === v)) return false;
        s.votes[pid] = v;
        if (allVoted(room, s)) s.phase = 'results';
        return true;
      }
      if (a.type === 'reveal' && pid === room.host && s.phase === 'vote') { s.phase = 'results'; return true; }
      if (a.type === 'next' && pid === room.host) { next(s); return true; }
      return false;
    },

    onLeave(room, s) {
      if (s.phase === 'vote' && Object.keys(s.votes).length && allVoted(room, s)) s.phase = 'results';
    },

    view(room, s, pid) {
      return {
        phase: s.phase, q: s.q, n: s.n,
        mine: s.votes[pid] ?? null,
        voted: Object.keys(s.votes),
        votes: s.phase === 'results' ? s.votes : null,
      };
    },

    mount(root, g) {
      const cardSlot = h('div');
      const voteSlot = h('div', { class: 'col' });
      const status = h('p', { class: 'status-line' });
      const hostSlot = h('div', { class: 'col' });
      root.append(cardSlot, voteSlot, status, hostSlot);
      let lastN = -1, lastPhase = null;

      function renderCard(v) {
        const lvl = M.levels.find((l) => l.id === v.q.l) || M.levels[0];
        const card = h('div', { class: 'qcard anim', style: { '--g1': gameColors('mode-' + mode, M.colors)[0], '--g2': gameColors('mode-' + mode, M.colors)[1], minHeight: '0', padding: '22px 18px' } },
          h('span', { class: 'badge lvl' }, `${lvl.emoji} ${lvl.name}`),
          h('span', { class: 'count' }, `#${v.n}`),
          h('div', { class: 'kicker', style: { marginTop: '14px' } }, mode === 'dix' && typeof v.q.it === 'object' ? `C'est un ${v.q.it.n} mais…` : M.kicker),
          mode === 'tp' ? null : h('div', { class: 'big' }, typeof v.q.it === 'object' ? v.q.it.t : (mode === 'op' ? `« ${v.q.it} »` : v.q.it)),
          binary ? h('div', { class: 'tp', 'data-slot': 'tp' }) : null);
        cardSlot.replaceChildren(card);
      }

      function voteUI(room, v) {
        const sendVote = (val) => { g.send({ type: 'vote', v: val }); sfx.pop(); buzz(15); };
        if (binary) {
          const slot = cardSlot.querySelector('[data-slot=tp]');
          const opt = (i) => h('button', {
            class: 'tp-opt' + (v.mine === i ? ' sel' : (v.mine != null ? ' dim' : '')),
            onclick: v.phase === 'vote' ? () => sendVote(i) : null,
          }, optLabel(v.q.it, i));
          if (v.phase === 'vote') slot.replaceChildren(opt(0), h('div', { class: 'tp-or' }, 'OU'), opt(1));
          else {
            const votes = Object.entries(v.votes);
            const total = votes.length || 1;
            const side = (i) => votes.filter(([, x]) => x === i).map(([pid]) => g.nameOf(pid));
            const a = side(0), b = side(1);
            const bar = (i, names) => h('div', { class: 'bar-res' },
              h('div', { class: 'lbl' }, h('span', null, optLabel(v.q.it, i)), h('span', null, Math.round(names.length / total * 100) + '%')),
              h('div', { class: 'bar' }, h('i', { style: { width: (names.length / total * 100) + '%' } })),
              h('div', { class: 'names' }, names.join(', ') || '—'));
            let verdict;
            if (mode === 'jamais') verdict = a.length ? `${a.join(', ')} ${a.length > 1 ? drinkPl(1) : drinks(1)} ! 🍹 Racontez !` : 'Personne ? Bande de saints 😇';
            else if (a.length === b.length) verdict = 'Égalité parfaite ! Tout le monde trinque 🥂';
            else { const min = a.length < b.length ? a : b; verdict = min.length ? `La minorité (${min.join(', ')}) ${drinks(1)} !` : 'Unanimité ! 🤝'; }
            slot.replaceChildren(bar(0, a), bar(1, b), h('div', { class: 'foot' }, verdict));
          }
          voteSlot.replaceChildren();
        } else if (mode === 'dix') {
          if (v.phase === 'vote') {
            voteSlot.replaceChildren(h('p', { class: 'muted small center' }, 'Ta nouvelle note :'),
              h('div', { class: 'vote-grid nums' }, Array.from({ length: 11 }, (_, i) => h('button', { class: v.mine === i ? 'on' : '', onclick: () => sendVote(i), style: { background: v.mine === i ? '#fff' : 'var(--card2)' } }, String(i)))));
          } else {
            const votes = Object.entries(v.votes).map(([pid, x]) => ({ name: g.nameOf(pid), x })).sort((a, b) => b.x - a.x);
            const avg = votes.reduce((s, x) => s + x.x, 0) / (votes.length || 1);
            const hi = votes[0], lo = votes[votes.length - 1];
            voteSlot.replaceChildren(h('div', { class: 'panel center col' },
              h('p', { class: 'muted' }, 'Note moyenne'),
              h('div', { class: 'letter-big', style: { fontSize: '72px' } }, avg.toFixed(1).replace('.', ',')),
              h('div', { class: 'scoreboard' }, votes.map((x) => h('div', { class: 'score-row' }, h('span', { class: 'n' }, x.name), h('span', { class: 's' }, x.x + '/10')))),
              votes.length > 1 && hi.x !== lo.x ? h('p', { class: 'small' }, `😇 Plus indulgent : ${hi.name} · 😈 Plus sévère : ${lo.name}`) : null));
          }
        } else if (mode === 'qui') {
          if (v.phase === 'vote') {
            voteSlot.replaceChildren(h('p', { class: 'muted small center' }, 'Désigne quelqu\'un (vote secret) :'),
              h('div', { class: 'vote-grid' }, room.players.filter((p) => p.on).map((p) => h('button', { class: v.mine === p.pid ? 'on' : '', style: { background: v.mine === p.pid ? '#fff' : 'var(--card2)' }, onclick: () => sendVote(p.pid) }, p.name + (p.pid === g.me ? ' (moi)' : '')))));
          } else {
            const counts = {};
            for (const [voter, target] of Object.entries(v.votes)) (counts[target] = counts[target] || []).push(g.nameOf(voter));
            const ranked = Object.entries(counts).sort((a, b) => b[1].length - a[1].length);
            const total = Object.keys(v.votes).length || 1;
            const top = ranked[0];
            const tie = ranked[1] && ranked[1][1].length === top[1].length;
            voteSlot.replaceChildren(h('div', { class: 'panel col' },
              top ? h('h3', { class: 'center' }, tie ? '🤝 Égalité !' : `👉 ${g.nameOf(top[0])} !`) : null,
              ranked.map(([pid, voters]) => h('div', { class: 'bar-res' },
                h('div', { class: 'lbl' }, h('span', null, g.nameOf(pid)), h('span', null, voters.length)),
                h('div', { class: 'bar' }, h('i', { style: { width: (voters.length / total * 100) + '%', background: 'linear-gradient(90deg,#00b39b,#5a6cff)' } })),
                h('div', { class: 'names muted' }, 'par ' + voters.join(', ')))),
              top && !tie ? h('p', { class: 'center small' }, `${g.nameOf(top[0])} ${drinks(top[1].length)} !`) : null));
          }
        }
      }

      return {
        update(room, v) {
          if (v.n !== lastN) { renderCard(v); lastN = v.n; }
          voteUI(room, v);
          const active = room.players.filter((p) => p.on);
          if (v.phase === 'vote') {
            const missing = active.filter((p) => !v.voted.includes(p.pid)).map((p) => p.name);
            status.textContent = `🗳️ ${v.voted.length}/${active.length} ont voté` + (missing.length && missing.length <= 4 ? ` · on attend ${missing.join(', ')}` : '');
          } else status.textContent = '';
          if (v.phase === 'results' && lastPhase === 'vote') { sfx.end(); buzz(40); }
          lastPhase = v.phase;
          if (g.isHost) {
            hostSlot.replaceChildren(
              v.phase === 'vote'
                ? h('button', { class: 'btn btn-soft btn-block', onclick: () => g.send({ type: 'reveal' }) }, '👀 Révéler sans attendre')
                : h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => g.send({ type: 'next' }) }, 'Question suivante →'),
              h('button', { class: 'btn btn-ghost btn-sm', onclick: () => g.send({ type: 'lobby:end' }) }, '🎮 Changer de jeu'));
          } else {
            hostSlot.replaceChildren(v.phase === 'results' ? h('p', { class: 'status-line' }, '⏳ L\'hôte passe à la question suivante…') : null);
          }
        },
        destroy() {},
      };
    },
  };
}

export const voteTP = makeVote('tp');
export const voteDix = makeVote('dix');
export const voteQui = makeVote('qui');
export const voteOp = makeVote('op');
export const voteJamais = makeVote('jamais');
