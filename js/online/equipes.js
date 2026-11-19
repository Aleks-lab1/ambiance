// Jeux en ligne par équipes (Mots interdits, Mime express, Fredonne !, Dis-le comme…) et Loup-garou (rôles secrets).
import { h, uid, shuffle, seg, chip } from '../ui.js';
import { sip } from '../store.js';
import { sfx, buzz } from '../sfx.js';
import { activePids, isOn, timerPill, actBtn } from './kit.js';
import { ROLES } from '../games/loup.js';
import MI from '../data/motsinterdits.js';
import MIME from '../data/mime.js';
import CHANSONS from '../data/chansons.js';
import DISLE from '../data/disle.js';

const TEAMS = [{ name: 'Équipe rouge', emo: '🔴', c: '#ff4d6d' }, { name: 'Équipe bleue', emo: '🔵', c: '#2ec5ff' }];

const TYPES = {
  mi: { name: 'Mots interdits', emoji: '🚫', short: 'Par équipes, sans les mots interdits', verb: 'fait deviner', tu: 'fais deviner', buzz: true, items: () => MI, card: (it) => ({ w: it[0], forbid: it.slice(1), hint: 'Mots interdits' }), label: (it) => it[0] },
  mime: { name: 'Mime express', emoji: '🤸', short: 'Par équipes, mimer sans parler', verb: 'mime', tu: 'mimes', items: () => MIME, card: (it) => ({ w: it, top: '🤫 Mime' }), label: (it) => it },
  fredonne: { name: 'Fredonne !', emoji: '🎵', short: 'Par équipes, fredonner sans les paroles', verb: 'fredonne', tu: 'fredonnes', items: () => CHANSONS, card: (it) => ({ w: it[0], sub: it[1], top: '🎵 Fredonne' }), label: (it) => `${it[0]} — ${it[1]}` },
  disle: { name: 'Dis-le comme…', emoji: '🎭', short: 'Par équipes, deviner la manière', verb: 'joue la comédie', tu: 'joues la comédie', items: () => DISLE.manieres.map((m) => ({ m, p: DISLE.phrases[Math.floor(Math.random() * DISLE.phrases.length)] })), card: (it) => ({ top: 'Dis cette phrase…', w: `« ${it.p} »`, forbid: [it.m], hint: '…de cette manière (secret !)' }), label: (it) => it.m },
};

function wordCard(c) {
  return h('div', { class: 'word-card', style: { minHeight: '0' } },
    c.top ? h('div', { class: 'hint' }, c.top) : null,
    h('div', { class: 'w', style: c.w.length > 24 ? { fontSize: 'clamp(22px,6.5vw,32px)' } : null }, c.w),
    c.sub ? h('div', { class: 'hint' }, c.sub) : null,
    c.forbid ? [h('div', { class: 'hint', style: { color: '#c21d3b' } }, c.hint), h('div', { class: 'forbid' }, c.forbid.map((x) => h('span', null, x)))] : null);
}

function makeTeamGame(type) {
  const T = TYPES[type];
  return {
    id: 'eq-' + type, name: T.name, short: T.short, emoji: T.emoji, minPlayers: 4,
    defaults: { time: 60, turns: 2 },
    settingsForm(st, set) {
      return h('div', { class: 'col' },
        h('p', { class: 'muted small' }, 'Les joueurs sont répartis au hasard en 2 équipes.'),
        h('label', { class: 'field' }, 'Durée d\'un tour', seg([45, 60, 90].map((n) => ({ value: n, label: n + ' s' })), st.time, (v) => set({ time: v }))),
        h('label', { class: 'field' }, 'Tours par équipe', seg([1, 2, 3, 4].map((n) => ({ value: n, label: String(n) })), st.turns, (v) => set({ turns: v }))));
    },
    init(room, st) {
      const pids = shuffle(activePids(room));
      const teams = [[], []];
      pids.forEach((p, i) => teams[i % 2].push(p));
      return { gid: uid(), st, teams, team: 0, giverIdx: [0, 0], score: [0, 0], turn: 0, deck: shuffle(T.items().slice()), phase: 'ready', results: [] };
    },
    action(room, s, pid, a) {
      const giver = giverOf(room, s);
      if (a.type === 'start' && s.phase === 'ready' && (pid === giver || pid === room.host)) {
        s.phase = 'play'; s.deadline = Date.now() + s.st.time * 1000; s.results = []; drawWord(s, T); return true;
      }
      if (s.phase === 'play' && pid === giver && (a.type === 'ok' || a.type === 'pass')) {
        s.results.push({ label: T.label(s.word), r: a.type });
        if (a.type === 'ok') s.score[s.team]++;
        drawWord(s, T); return true;
      }
      if (s.phase === 'play' && a.type === 'buzz' && T.buzz && s.teams[1 - s.team].includes(pid)) {
        s.results.push({ label: T.label(s.word), r: 'buzz', by: pid });
        s.score[s.team]--;
        drawWord(s, T); return true;
      }
      if (a.type === 'next' && s.phase === 'recap' && (pid === giver || pid === room.host)) {
        s.turn++;
        if (s.turn >= s.st.turns * 2) { s.phase = 'end'; return true; }
        s.giverIdx[s.team]++;
        s.team = 1 - s.team;
        s.phase = 'ready';
        return true;
      }
      return false;
    },
    tick(room, s) {
      if (s.phase === 'play' && Date.now() >= s.deadline) { s.results.push({ label: T.label(s.word), r: 'time' }); s.phase = 'recap'; return true; }
      return false;
    },
    onJoin(room, s, pid) { if (!s.teams.flat().includes(pid)) s.teams[s.teams[0].length <= s.teams[1].length ? 0 : 1].push(pid); },
    onLeave(room, s, pid) { if (s.phase === 'play' && pid === giverOf(room, s)) s.phase = 'recap'; },
    view(room, s, pid) {
      const giver = giverOf(room, s);
      const role = pid === giver ? 'giver' : s.teams[s.team].includes(pid) ? 'mate' : 'opp';
      const showWord = s.phase === 'play' && role !== 'mate';
      return { gid: s.gid, phase: s.phase, teams: s.teams, team: s.team, score: s.score, giver, role, myTeam: s.teams[0].includes(pid) ? 0 : 1,
        deadline: s.deadline, word: showWord ? T.card(s.word) : null, found: s.results.filter((x) => x.r === 'ok').length,
        results: s.phase === 'recap' ? s.results : null, turn: s.turn, turns: s.st.turns * 2 };
    },
    mount(root, g) {
      const main = h('div', { class: 'col' });
      const tp = timerPill(g);
      root.append(main);
      let lastKey = null;
      return {
        update(r, v) {
          const key = `${v.gid}:${v.turn}:${v.phase}:${v.found}:${v.results ? v.results.length : 0}`;
          const teamsBar = h('div', { class: 'eq-teams' }, v.teams.map((t, i) => h('div', { class: 'eq-team' + (v.team === i && v.phase !== 'end' ? ' cur' : ''), style: { '--c': TEAMS[i].c } },
            h('div', { class: 'eq-head' }, h('b', null, `${TEAMS[i].emo} ${TEAMS[i].name}`), h('span', { class: 'eq-score' }, String(v.score[i]))),
            h('div', { class: 'eq-mem' }, t.map((p) => (p === g.me ? 'Toi' : g.nameOf(p))).join(', ')))));
          const parts = [teamsBar];
          tp.set(v.phase === 'play' ? v.deadline : 0);
          const T0 = TEAMS[v.team];
          if (v.phase === 'end') {
            const w = v.score[0] === v.score[1] ? -1 : v.score[0] > v.score[1] ? 0 : 1;
            parts.push(h('div', { class: 'center' }, h('div', { class: 'hero-emo' }, '🏆'), h('h2', null, w < 0 ? 'Égalité !' : `${TEAMS[w].emo} ${TEAMS[w].name} gagne !`)),
              w >= 0 ? h('p', { class: 'center' }, `${v.myTeam === w ? 'Bravo ! 🎉' : `Ton équipe perd : ${sip(1)} chacun !`}`) : null, g.hostBar());
            if (lastKey !== 'end') sfx.fanfare();
            lastKey = 'end';
            main.replaceChildren(...parts);
            return;
          }
          parts.push(h('div', { class: 'row' }, h('span', { class: 'pill' }, `Tour ${v.turn + 1}/${v.turns}`), h('div', { class: 'grow' }), v.phase === 'play' ? h('span', { class: 'pill' }, `✅ ${v.found}`) : null, tp.el));
          if (v.phase === 'ready') {
            parts.push(h('div', { class: 'big-center', style: { padding: '8px 0' } },
              h('h2', null, `${T0.emo} ${v.role === 'giver' ? 'C\'est à toi !' : `Au tour de ${g.nameOf(v.giver)}`}`),
              h('p', { class: 'muted' }, v.role === 'giver' ? `Tu ${T.tu} pour ton équipe. Le mot s'affichera sur TON téléphone.` : v.role === 'mate' ? `${g.nameOf(v.giver)} ${T.verb} : devinez à voix haute !` : `L'autre équipe joue. ${T.buzz ? 'Tu verras le mot pour surveiller les mots interdits !' : 'Tu verras le mot pour suivre.'}`)));
            if (v.role === 'giver' || g.isHost) parts.push(actBtn(g, '▶ C\'est parti !', 'start', 'btn-primary btn-big'));
          } else if (v.phase === 'play') {
            if (v.role === 'giver') {
              parts.push(wordCard(v.word), h('div', { class: 'answer-btns' },
                h('button', { class: 'btn btn-soft btn-big', onclick: () => { g.send({ type: 'pass' }); sfx.swoosh(); } }, '⏭ Passer'),
                h('button', { class: 'btn btn-ok btn-big', onclick: () => { g.send({ type: 'ok' }); sfx.ok(); buzz(20); } }, '✅ Trouvé')));
            } else if (v.role === 'mate') {
              parts.push(h('div', { class: 'big-center' }, h('div', { class: 'hero-emo' }, '🗣️'), h('h2', null, 'Devinez !'), h('p', { class: 'muted' }, `${g.nameOf(v.giver)} ${T.verb}…`), h('div', { class: 'countdown-num', style: { fontSize: '72px' } }, String(v.found))));
            } else {
              parts.push(h('p', { class: 'center muted' }, `${T0.emo} ${g.nameOf(v.giver)} ${T.verb}… Surveillez !`), wordCard(v.word),
                T.buzz ? h('button', { class: 'btn btn-bad btn-big btn-block', onclick: () => { g.send({ type: 'buzz' }); sfx.bad(); buzz([80, 40, 80]); } }, '🚫 Mot interdit !') : null);
            }
          } else if (v.phase === 'recap') {
            parts.push(h('h2', { class: 'center' }, `⏰ Fin du tour : ${v.found} trouvé${v.found > 1 ? 's' : ''}`),
              h('div', { class: 'result-list' }, v.results.map((x) => h('div', { class: 'result-item' + (x.r === 'ok' ? '' : ' pass') }, h('span', { class: 't' }, x.label), h('span', { class: 'r' }, x.r === 'ok' ? '✅' : x.r === 'buzz' ? '🚫' : x.r === 'time' ? '⏰' : '⏭')))));
            if (v.role === 'giver' || g.isHost) parts.push(actBtn(g, 'Équipe suivante →', 'next', 'btn-primary btn-big'));
          }
          if (key !== lastKey) {
            if (v.phase === 'play' && lastKey && !lastKey.includes(':play:')) { sfx.go(); if (v.role !== 'opp') buzz([40, 30, 80]); }
            if (v.phase === 'recap') { sfx.end(); buzz(200); }
          }
          lastKey = key;
          main.replaceChildren(...parts);
        },
        destroy() { tp.stop(); },
      };
    },
  };
}
function giverOf(room, s) {
  const t = s.teams[s.team].filter((p) => isOn(room, p));
  const list = t.length ? t : s.teams[s.team];
  return list[s.giverIdx[s.team] % list.length];
}
function drawWord(s, T) {
  if (!s.deck.length) s.deck = shuffle(T.items().slice());
  s.word = s.deck.pop();
}

export const eqMI = makeTeamGame('mi');
export const eqMime = makeTeamGame('mime');
export const eqFredonne = makeTeamGame('fredonne');
export const eqDisle = makeTeamGame('disle');

// =====================================================================
// LOUP-GAROU : l'hôte est le meneur, chacun reçoit son rôle en secret.
// =====================================================================
const NIGHT = [
  '🌙 Tout le village s\'endort, fermez les yeux.',
  '🔮 Voyante, réveille-toi et désigne un joueur : je te montre son rôle. Rendors-toi.',
  '🩺 Docteur, réveille-toi et désigne le joueur que tu protèges cette nuit. Rendors-toi.',
  '🐺 Loups-garous, réveillez-vous, mettez-vous d\'accord sur une victime. Rendormez-vous.',
  '☀️ Le village se réveille… Annonce qui est mort cette nuit (touche son nom pour l\'éliminer).',
  '🗳️ Débat, puis vote : le joueur éliminé est révélé. Touche son nom.',
];

export const loupOnline = {
  id: 'loup', name: 'Loup-garou', short: 'Rôles secrets, l\'hôte est le meneur', emoji: '🐺', minPlayers: 5,
  defaults: { wolves: 'auto', voyante: true, docteur: true, chasseur: true },
  settingsForm(st, set) {
    const chips = h('div', { class: 'chips' });
    const render = () => chips.replaceChildren(...['voyante', 'docteur', 'chasseur'].map((k) => chip(`${ROLES[k].emoji} ${ROLES[k].name}`, st[k] !== false, () => { set({ [k]: st[k] === false }); render(); })));
    render();
    return h('div', { class: 'col' },
      h('p', { class: 'muted small' }, 'L\'hôte est le meneur : il ne joue pas, il voit tous les rôles et lit le script.'),
      h('label', { class: 'field' }, 'Loups-garous', seg([{ value: 'auto', label: 'Auto' }, { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }], st.wolves, (v) => set({ wolves: v }))),
      h('p', { class: 'muted small' }, 'Rôles spéciaux'), chips);
  },
  init(room, st) {
    const players = shuffle(activePids(room).filter((p) => p !== room.host));
    const n = players.length;
    const wolves = st.wolves === 'auto' ? Math.max(1, Math.round(n / 4.5)) : Math.min(Math.max(1, st.wolves), n - 1);
    const roles = Array(wolves).fill('loup');
    for (const k of ['voyante', 'docteur', 'chasseur']) if (st[k] !== false && roles.length < n - 1) roles.push(k);
    while (roles.length < n) roles.push('villageois');
    const deal = shuffle(roles);
    const role = Object.fromEntries(players.map((p, i) => [p, deal[i]]));
    return { gid: uid(), st, players, role, alive: Object.fromEntries(players.map((p) => [p, true])), over: false, step: 0, day: 1 };
  },
  action(room, s, pid, a) {
    if (pid !== room.host) return false;
    if (a.type === 'kill' && s.role[a.pid]) { s.alive[a.pid] = !s.alive[a.pid]; return true; }
    if (a.type === 'step') { s.step = (s.step + 1) % NIGHT.length; if (s.step === 0) s.day++; return true; }
    if (a.type === 'reveal') { s.over = true; return true; }
    return false;
  },
  view(room, s, pid) {
    const host = pid === room.host;
    const myRole = s.role[pid] || null;
    const wolves = s.players.filter((p) => s.role[p] === 'loup');
    return {
      gid: s.gid, host, over: s.over, step: s.step, day: s.day, players: s.players, alive: s.alive,
      myRole, wolves: myRole === 'loup' || host || s.over ? wolves : null,
      roles: host || s.over ? s.role : Object.fromEntries(s.players.filter((p) => !s.alive[p]).map((p) => [p, s.role[p]])),
    };
  },
  mount(root, g) {
    const main = h('div', { class: 'col' });
    root.append(main);
    let shown = false, lastGid = null;
    return {
      update(r, v) {
        if (v.gid !== lastGid) { shown = false; lastGid = v.gid; sfx.go(); }
        const aliveW = v.wolves ? v.wolves.filter((p) => v.alive[p]).length : null;
        const aliveAll = v.players.filter((p) => v.alive[p]).length;
        const winner = aliveW == null ? null : aliveW === 0 ? 'village' : aliveW >= aliveAll - aliveW ? 'loups' : null;
        const list = h('div', { class: 'scoreboard' }, v.players.map((p) => {
          const rr = v.roles[p] ? ROLES[v.roles[p]] : null;
          return h('div', { class: 'score-row', style: { opacity: v.alive[p] ? 1 : 0.5 } },
            h('span', null, rr ? rr.emoji : '❔'), h('span', { class: 'n' }, (p === g.me ? 'Toi' : g.nameOf(p)) + (v.alive[p] ? '' : ' ✝')),
            h('span', { class: 'muted small' }, rr ? rr.name : ''),
            v.host && !v.over ? h('button', { class: 'btn btn-sm ' + (v.alive[p] ? 'btn-bad' : 'btn-soft'), onclick: () => g.send({ type: 'kill', pid: p }) }, v.alive[p] ? '✝ Éliminer' : '↩️') : null);
        }));
        if (v.host) {
          main.replaceChildren(
            h('div', { class: 'panel col' }, h('h3', null, `🎙️ Tu es le meneur · Jour ${v.day}`), h('p', null, h('b', null, NIGHT[v.step])),
              !v.over ? actBtn(g, 'Étape suivante du script →', 'step', 'btn-primary') : null),
            winner ? h('div', { class: 'conn-banner' }, winner === 'village' ? '🎉 Plus aucun loup : le village a gagné !' : '🐺 Les loups sont aussi nombreux que les villageois : les loups ont gagné !') : null,
            list,
            !v.over ? actBtn(g, '🏁 Fin de partie : révéler tous les rôles', 'reveal') : g.hostBar());
          return;
        }
        const R = v.myRole ? ROLES[v.myRole] : null;
        const roleCard = R ? h('button', {
          class: 'role-card loup-secret' + (shown ? '' : ' hidden-role'), style: { '--g1': R.colors[0], '--g2': R.colors[1], width: '100%' },
          onclick: () => { shown = !shown; sfx.pop(); this.update(r, v); },
        }, shown ? [h('div', { class: 'emo' }, R.emoji), h('h2', null, R.name), h('p', null, R.desc),
          v.myRole === 'loup' && v.wolves.length > 1 ? h('p', null, h('b', null, `Tes complices : ${v.wolves.filter((p) => p !== g.me).map((p) => g.nameOf(p)).join(', ')}`)) : null,
          h('p', { class: 'small' }, 'Touche pour cacher')] : [h('div', { class: 'emo' }, '🂠'), h('h2', null, 'Ton rôle secret'), h('p', null, 'Touche pour le voir… sans que les autres regardent !')]) : h('p', { class: 'center muted' }, 'Tu observes la partie.');
        main.replaceChildren(
          h('p', { class: 'center muted' }, `🎙️ Meneur : ${g.nameOf(r.host)} · Jour ${v.day}`),
          v.alive[g.me] === false ? h('div', { class: 'conn-banner' }, '✝ Tu es mort… Ne dis plus rien, mais tu peux suivre la partie !') : null,
          roleCard,
          v.over ? h('div', { class: 'conn-banner' }, '🏁 Partie terminée : tous les rôles sont révélés !') : null,
          list,
          v.over ? g.hostBar() : null);
      },
      destroy() {},
    };
  },
};
