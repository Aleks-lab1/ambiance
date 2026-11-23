// L'Imposteur en ligne : chacun voit son mot secret sur son téléphone.
import { h, shuffle, toggleRow, seg } from '../ui.js';
import { sfx, buzz } from '../sfx.js';
import PAIRS from '../data/imposteur.js';
import { drawNew } from './kit.js';

const player = (room, pid) => room.players.find((p) => p.pid === pid);

function newRound(room, s) {
  const pair = drawNew(s, 'imposteur', PAIRS); // même paquet que la version locale
  const flip = Math.random() < 0.5;
  const civ = flip ? pair[0] : pair[1];
  const imp = flip ? pair[1] : pair[0];
  const active = room.players.filter((p) => p.on).map((p) => p.pid);
  const nImp = Math.max(1, Math.min(s.st.impostors, Math.floor((active.length - 1) / 2)));
  const imps = new Set(shuffle(active.slice()).slice(0, nImp));
  s.roles = {};
  s.words = {};
  for (const pid of active) {
    s.roles[pid] = imps.has(pid) ? 'imp' : 'civ';
    s.words[pid] = imps.has(pid) ? (s.st.blank ? null : imp) : civ;
  }
  s.pair = { civ, imp };
  let order = shuffle(active.slice());
  // Le premier à parler a toujours un mot.
  const firstOk = order.findIndex((pid) => s.words[pid]);
  if (firstOk > 0) order = order.slice(firstOk).concat(order.slice(0, firstOk));
  s.order = order;
  s.votes = {};
  s.result = null;
  s.phase = 'words';
  s.round++;
}

function resolve(room, s) {
  const counts = {};
  for (const t of Object.values(s.votes)) counts[t] = (counts[t] || 0) + 1;
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const tie = !ranked.length || (ranked[1] && ranked[1][1] === ranked[0][1]);
  const out = tie ? null : ranked[0][0];
  const caught = out ? s.roles[out] === 'imp' : false;
  for (const [pid, role] of Object.entries(s.roles)) {
    const p = player(room, pid);
    if (!p) continue;
    if (caught && role === 'civ') p.score += 1;
    if (!caught && role === 'imp') p.score += 2;
  }
  s.result = { out, caught, tie, counts };
  s.phase = 'reveal';
}

export default {
  id: 'imposteur',
  name: "L'Imposteur",
  short: 'Démasquez l\'intrus',
  emoji: '🕵️',
  minPlayers: 3,
  defaults: { impostors: 1, blank: false },

  settingsForm(st, set) {
    return h('div', { class: 'col' },
      h('label', { class: 'field' }, 'Nombre d\'imposteurs', seg([1, 2, 3].map((n) => ({ value: n, label: String(n) })), st.impostors, (v) => set({ impostors: v }))),
      toggleRow('🤐 Mode « Sans mot »', 'L\'imposteur ne reçoit aucun mot : il doit bluffer.', st.blank, (v) => set({ blank: v })),
      h('p', { class: 'muted tiny' }, 'Le nombre d\'imposteurs est limité automatiquement s\'il y a peu de joueurs.'));
  },

  init(room, st) {
    const s = { st, round: 0 };
    newRound(room, s);
    return s;
  },

  action(room, s, pid, a) {
    const host = pid === room.host;
    if (a.type === 'tovote' && host && s.phase === 'words') { s.phase = 'vote'; return true; }
    if (a.type === 'vote' && s.phase === 'vote' && s.roles[pid] && s.roles[a.target] && a.target !== pid) {
      s.votes[pid] = a.target;
      const voters = Object.keys(s.roles).filter((x) => player(room, x)?.on);
      if (voters.every((x) => s.votes[x])) resolve(room, s);
      return true;
    }
    if (a.type === 'resolve' && host && s.phase === 'vote') { resolve(room, s); return true; }
    if (a.type === 'next' && host) { newRound(room, s); return true; }
    return false;
  },

  onLeave(room, s) {
    if (s.phase === 'vote') {
      const voters = Object.keys(s.roles).filter((x) => player(room, x)?.on);
      if (voters.length && voters.every((x) => s.votes[x])) resolve(room, s);
    }
  },

  view(room, s, pid) {
    const inRound = !!s.roles[pid];
    return {
      phase: s.phase,
      round: s.round,
      inRound,
      word: inRound ? s.words[pid] : undefined,
      blank: s.st.blank,
      order: s.order,
      voted: Object.keys(s.votes),
      myVote: s.votes[pid] || null,
      players: Object.keys(s.roles),
      reveal: s.phase === 'reveal' ? { roles: s.roles, pair: s.pair, votes: s.votes, result: s.result } : null,
    };
  },

  mount(root, g) {
    const box = h('div', { class: 'col' });
    root.append(box);
    let shown = false;
    let lastKey = null;

    return {
      update(room, v) {
        const key = v.round + ':' + v.phase;
        if (key !== lastKey) {
          if (v.phase === 'words') { shown = false; sfx.go(); buzz(50); }
          if (v.phase === 'reveal') sfx.end();
          lastKey = key;
        }
        const names = (list) => list.map((pid) => g.nameOf(pid));
        const parts = [h('div', { class: 'spread' }, h('span', { class: 'pill' }, `Manche ${v.round}`), h('span', { class: 'pill' }, '🏆 ' + (room.players.find((p) => p.pid === g.me)?.score ?? 0) + ' pts'))];

        if (!v.inRound) {
          parts.push(h('div', { class: 'panel center col' }, h('div', { class: 'hero-emo' }, '👀'), h('h3', null, 'Tu es spectateur pour cette manche'), h('p', { class: 'muted' }, 'Tu joueras à la prochaine !')));
        } else if (v.phase === 'words') {
          const secret = h('button', {
            class: 'secret-btn',
            onclick: () => { shown = !shown; sfx.pop(); this.update(room, v); },
          }, shown
            ? (v.word
              ? [h('span', { class: 'muted small' }, 'Ton mot secret'), h('div', { class: 'reveal-word' }, v.word), h('span', { class: 'muted small' }, 'Touche pour cacher')]
              : [h('div', { class: 'emo' }, '🤐'), h('b', null, 'Tu n\'as pas de mot !'), h('span', { class: 'muted small' }, 'Tu es l\'imposteur. Écoute les autres et bluffe…')])
            : [h('div', { class: 'emo' }, '🔒'), 'Touche pour voir ton mot', h('span', { class: 'muted small' }, 'Cache ton écran !')]);
          parts.push(secret,
            h('div', { class: 'panel col' },
              h('h3', null, '🗣️ Ordre de parole'),
              h('p', { class: 'muted small' }, 'Chacun dit UN mot en lien avec son mot secret. Faites 1 ou 2 tours, puis votez.'),
              h('ol', { style: { margin: '0', paddingLeft: '22px', fontWeight: '700' } }, names(v.order).map((n) => h('li', null, n)))),
            g.isHost ? h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => g.send({ type: 'tovote' }) }, '🗳️ Passer au vote') : h('p', { class: 'status-line' }, 'L\'hôte lancera le vote quand vous serez prêts.'));
        } else if (v.phase === 'vote') {
          parts.push(h('div', { class: 'panel col' },
            h('h3', null, '🗳️ Qui est l\'imposteur ?'),
            h('div', { class: 'plist-sel' }, v.players.filter((pid) => pid !== g.me).map((pid) => h('button', {
              class: v.myVote === pid ? 'on' : '',
              onclick: () => { g.send({ type: 'vote', target: pid }); sfx.pop(); buzz(15); },
            }, '🕵️ ' + g.nameOf(pid), v.voted.includes(pid) ? h('span', { class: 'rl' }, 'a voté') : null)))),
          h('p', { class: 'status-line' }, `${v.voted.length}/${v.players.length} votes`),
          g.isHost ? h('button', { class: 'btn btn-soft btn-block', onclick: () => g.send({ type: 'resolve' }) }, '👀 Révéler maintenant') : null);
        } else if (v.phase === 'reveal') {
          const r = v.reveal.result;
          const imps = Object.entries(v.reveal.roles).filter(([, role]) => role === 'imp').map(([pid]) => g.nameOf(pid));
          let title;
          if (r.tie) title = '🤝 Égalité… personne n\'est éliminé. Les imposteurs gagnent !';
          else if (r.caught) title = `🎉 ${g.nameOf(r.out)} était bien un imposteur !`;
          else title = `😱 ${g.nameOf(r.out)} était innocent… Les imposteurs gagnent !`;
          parts.push(
            h('div', { class: 'role-card', style: { '--g1': r.caught ? '#11998e' : '#e94057', '--g2': r.caught ? '#38ef7d' : '#8a2387' } },
              h('div', { class: 'emo' }, r.caught ? '🎉' : '🕵️'),
              h('h3', null, title),
              h('p', null, `Imposteur${imps.length > 1 ? 's' : ''} : `, h('b', null, imps.join(', ')))),
            h('div', { class: 'panel col' },
              h('div', { class: 'spread' }, h('span', null, '👥 Mot des civils'), h('b', null, v.reveal.pair.civ)),
              h('div', { class: 'spread' }, h('span', null, '🕵️ Mot de l\'imposteur'), h('b', null, v.blank ? '(aucun)' : v.reveal.pair.imp))),
            h('div', { class: 'panel col' }, h('h3', null, 'Votes'),
              Object.entries(v.reveal.votes).map(([voter, t]) => h('div', { class: 'small' }, `${g.nameOf(voter)} → ${g.nameOf(t)}`))),
            h('div', { class: 'scoreboard' }, room.players.slice().sort((a, b) => b.score - a.score).map((p) => h('div', { class: 'score-row' }, h('span', { class: 'n' }, p.name), h('span', { class: 's' }, String(p.score))))),
            g.isHost
              ? h('div', { class: 'col' },
                h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => g.send({ type: 'next' }) }, 'Manche suivante →'),
                h('button', { class: 'btn btn-ghost btn-sm', onclick: () => g.send({ type: 'lobby:end' }) }, '🎮 Changer de jeu'))
              : h('p', { class: 'status-line' }, '⏳ L\'hôte lance la manche suivante…'));
        }
        box.replaceChildren(...parts);
      },
      destroy() {},
    };
  },
};
