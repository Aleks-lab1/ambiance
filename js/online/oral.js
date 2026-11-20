// Jeux en ligne « à voix haute », chacun son tour : Sur le front, Ni oui ni non, Histoire folle.
import { h, uid, shuffle, seg, pick } from '../ui.js';
import { gameColors } from '../themes.js';
import { sip } from '../store.js';
import { sfx, buzz } from '../sfx.js';
import { activePids, addScore, nextOn, card, endScreen, timerPill, actBtn } from './kit.js';
import FRONT from '../data/front.js';
import NIOUI from '../data/nioui.js';
import HISTOIRE from '../data/histoire.js';

const roundsSeg = (st, set, label = 'Tours par joueur', vals = [1, 2, 3]) => h('label', { class: 'field' }, label, seg(vals.map((n) => ({ value: n, label: String(n) })), st.rounds, (v) => set({ rounds: v })));
const timeSeg = (st, set, vals, label) => h('label', { class: 'field' }, label, seg(vals.map((n) => ({ value: n, label: n + ' s' })), st.time, (v) => set({ time: v })));
const draw = (s, key, refill) => { if (!s[key].length) s[key] = refill(); return s[key].pop(); };
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;

// =====================================================================
// SUR LE FRONT : tout le monde voit le mot… sauf celui qui devine.
// =====================================================================
const frontWords = (cat) => {
  const cats = FRONT.filter((c) => c.id === cat);
  return shuffle((cats.length ? cats : FRONT).flatMap((c) => c.words));
};

export const frontOnline = {
  id: 'front', name: 'Sur le front', short: 'Les autres voient ton mot, pas toi !', emoji: '🤳', minPlayers: 2,
  defaults: { cat: 'mix', time: 60, rounds: 1 },
  settingsForm(st, set) {
    const cats = [{ id: 'mix', name: 'Grand mélange', emoji: '🎲' }, ...FRONT];
    if (!cats.some((c) => c.id === st.cat)) set({ cat: 'mix' });
    const chips = h('div', { class: 'chips' });
    const render = () => chips.replaceChildren(...cats.map((c) => h('button', { class: 'chip' + (st.cat === c.id ? ' on' : ''), onclick: () => { set({ cat: c.id }); render(); } }, `${c.emoji} ${c.name}`)));
    render();
    return h('div', { class: 'col' },
      h('p', { class: 'muted small' }, 'Catégorie'), chips,
      timeSeg(st, set, [45, 60, 90], 'Durée d\'un tour'),
      roundsSeg(st, set));
  },
  init(room, st) {
    const order = shuffle(activePids(room));
    return { gid: uid(), st, order, guesser: order[0], phase: 'ready', turn: 1, total: (st.rounds || 1) * order.length, deck: frontWords(st.cat), results: [], wk: 0 };
  },
  action(room, s, pid, a) {
    const me = pid === s.guesser;
    if (a.type === 'start' && s.phase === 'ready' && (me || pid === room.host)) {
      s.phase = 'play'; s.results = []; s.deadline = Date.now() + s.st.time * 1000; frontNext(s); return true;
    }
    if ((a.type === 'ok' || a.type === 'pass') && s.phase === 'play' && a.k === s.wk && (!me || a.type === 'pass')) {
      s.results.push({ w: s.word, r: a.type });
      if (a.type === 'ok') addScore(room, s.guesser, 1);
      frontNext(s);
      return true;
    }
    if (a.type === 'next' && s.phase === 'recap' && (me || pid === room.host)) {
      s.turn++;
      if (s.turn > s.total) { s.phase = 'end'; return true; }
      s.guesser = nextOn(room, s.order, s.guesser);
      s.phase = 'ready';
      return true;
    }
    return false;
  },
  tick(room, s) {
    if (s.phase === 'play' && Date.now() >= s.deadline) { s.results.push({ w: s.word, r: 'time' }); s.phase = 'recap'; return true; }
    return false;
  },
  onJoin(room, s, pid) { if (!s.order.includes(pid)) s.order.push(pid); },
  onLeave(room, s, pid) {
    if (pid !== s.guesser) return;
    if (s.phase === 'play') s.phase = 'recap';
    else if (s.phase === 'ready') s.guesser = nextOn(room, s.order, pid);
  },
  view(room, s, pid) {
    return { gid: s.gid, phase: s.phase, guesser: s.guesser, turn: s.turn, total: s.total, deadline: s.deadline, wk: s.wk,
      word: s.phase === 'play' && pid !== s.guesser ? s.word : null, found: s.results.filter((x) => x.r === 'ok').length,
      results: s.phase === 'recap' ? s.results : null };
  },
  mount(root, g) {
    const main = h('div', { class: 'col' });
    const tp = timerPill(g);
    root.append(main);
    let lastKey = null, lastFound = 0;
    return {
      update(r, v) {
        if (v.phase === 'end') { tp.set(0); main.replaceChildren(...endScreen(r, g, 'Fin de la partie !', h('p', { class: 'center muted' }, '1 point par mot deviné.'))); if (lastKey !== 'end') sfx.fanfare(); lastKey = 'end'; return; }
        const me = v.guesser === g.me;
        const N = g.nameOf(v.guesser);
        tp.set(v.phase === 'play' ? v.deadline : 0);
        const key = `${v.gid}:${v.turn}:${v.phase}:${v.wk}`;
        const parts = [h('div', { class: 'row' }, h('span', { class: 'pill' }, `🤳 ${Math.min(v.turn, v.total)}/${v.total}`), h('div', { class: 'grow' }), v.phase === 'play' ? h('span', { class: 'pill' }, `✅ ${v.found}`) : null, tp.el)];
        if (v.phase === 'ready') {
          parts.push(h('div', { class: 'big-center', style: { padding: '8px 0' } },
            h('div', { class: 'hero-emo' }, me ? '🤔' : '🤳'),
            h('h2', null, me ? 'C\'est à toi de deviner !' : `${N} va deviner`),
            h('p', { class: 'muted' }, me ? 'Les autres voient ton mot sur leur téléphone et te le font deviner. Toi, tu ne le vois pas !' : `Le mot va s'afficher sur ton téléphone : fais-le deviner à ${N} sans le dire !`)));
          parts.push(me || g.isHost ? actBtn(g, '▶ C\'est parti !', 'start', 'btn-primary btn-big') : h('p', { class: 'status-line' }, `⏳ ${N} lance le chrono…`));
        } else if (v.phase === 'play') {
          if (me) {
            parts.push(h('div', { class: 'big-center' }, h('div', { class: 'hero-emo' }, '🙈'), h('h2', null, 'Devine ton mot !'),
              h('p', { class: 'muted' }, 'Écoute les indices et réponds à voix haute. Les autres valident quand tu as trouvé.'),
              h('div', { class: 'countdown-num', style: { fontSize: '72px' } }, String(v.found))),
            h('button', { class: 'btn btn-soft btn-big btn-block', onclick: () => { g.send({ type: 'pass', k: v.wk }); sfx.swoosh(); } }, '⏭ Passer ce mot'));
          } else {
            parts.push(h('div', { class: 'word-card', style: { minHeight: '0' } }, h('div', { class: 'hint' }, `Fais deviner à ${N}`), h('div', { class: 'w' }, v.word)),
              h('div', { class: 'answer-btns' },
                h('button', { class: 'btn btn-soft btn-big', onclick: () => { g.send({ type: 'pass', k: v.wk }); sfx.swoosh(); } }, '⏭ Passer'),
                h('button', { class: 'btn btn-ok btn-big', onclick: () => { g.send({ type: 'ok', k: v.wk }); sfx.ok(); buzz(20); } }, '✅ Trouvé')));
          }
        } else if (v.phase === 'recap') {
          parts.push(h('h2', { class: 'center' }, `⏰ ${me ? 'Tu as trouvé' : N + ' a trouvé'} ${plural(v.found, 'mot')} !`),
            h('div', { class: 'result-list' }, v.results.map((x) => h('div', { class: 'result-item' + (x.r === 'ok' ? '' : ' pass') }, h('span', { class: 't' }, x.w), h('span', { class: 'r' }, x.r === 'ok' ? '✅' : x.r === 'time' ? '⏰' : '⏭')))),
            me || g.isHost ? actBtn(g, 'Joueur suivant →', 'next', 'btn-primary btn-big') : h('p', { class: 'status-line' }, `⏳ ${N} passe au joueur suivant…`));
        }
        if (key !== lastKey) {
          if (v.phase === 'play' && lastKey && !lastKey.includes(':play:')) { sfx.go(); if (me) buzz([40, 30, 80]); }
          else if (v.phase === 'play' && me && v.found > lastFound) { sfx.ok(); buzz(30); }
          if (v.phase === 'recap') { sfx.end(); buzz(200); }
        }
        lastFound = v.found;
        lastKey = key;
        main.replaceChildren(...parts);
      },
      destroy() { tp.stop(); },
    };
  },
};
function frontNext(s) { s.word = draw(s, 'deck', () => frontWords(s.st.cat)); s.wk++; }

// =====================================================================
// NI OUI NI NON
// =====================================================================
export const niouiOnline = {
  id: 'nioui', name: 'Ni oui ni non', short: 'Tiens sans dire oui ni non', emoji: '🙅', minPlayers: 2,
  defaults: { time: 60, rounds: 1 },
  settingsForm(st, set) {
    return h('div', { class: 'col' },
      h('p', { class: 'muted small' }, 'Un joueur pose les questions pièges qui s\'affichent sur son téléphone. Celui qui répond doit tenir sans dire oui ni non. Les autres ont un buzzer.'),
      timeSeg(st, set, [30, 45, 60, 90], 'Temps à tenir'),
      roundsSeg(st, set));
  },
  init(room, st) {
    const order = shuffle(activePids(room));
    const s = { gid: uid(), st, order, victim: order[0], phase: 'ready', turn: 1, total: (st.rounds || 1) * order.length, deck: shuffle(NIOUI.slice()), qn: 0 };
    s.asker = nextOn(room, order, s.victim);
    return s;
  },
  action(room, s, pid, a) {
    const host = pid === room.host;
    if (a.type === 'start' && s.phase === 'ready' && (pid === s.victim || pid === s.asker || host)) {
      s.phase = 'play'; s.deadline = Date.now() + s.st.time * 1000; s.qn = 1; s.q = draw(s, 'deck', () => shuffle(NIOUI.slice())); s.by = null; return true;
    }
    if (a.type === 'q' && s.phase === 'play' && (pid === s.asker || host)) { s.q = draw(s, 'deck', () => shuffle(NIOUI.slice())); s.qn++; return true; }
    if (a.type === 'fail' && s.phase === 'play' && pid !== s.victim) { s.phase = 'result'; s.won = false; s.by = pid; return true; }
    if (a.type === 'next' && s.phase === 'result' && (pid === s.victim || pid === s.asker || host)) {
      s.turn++;
      if (s.turn > s.total) { s.phase = 'end'; return true; }
      s.victim = nextOn(room, s.order, s.victim);
      s.asker = nextOn(room, s.order, s.victim);
      s.phase = 'ready';
      return true;
    }
    return false;
  },
  tick(room, s) {
    if (s.phase === 'play' && Date.now() >= s.deadline) { s.phase = 'result'; s.won = true; addScore(room, s.victim, 1); return true; }
    return false;
  },
  onJoin(room, s, pid) { if (!s.order.includes(pid)) s.order.push(pid); },
  onLeave(room, s, pid) {
    if (s.phase === 'end' || s.phase === 'result') return;
    if (pid === s.victim) { s.victim = nextOn(room, s.order, pid); s.asker = nextOn(room, s.order, s.victim); s.phase = 'ready'; }
    else if (pid === s.asker) s.asker = nextOn(room, s.order, s.victim);
  },
  view(room, s) { return { gid: s.gid, phase: s.phase, victim: s.victim, asker: s.asker, q: s.q, qn: s.qn, deadline: s.deadline, won: s.won, by: s.by, turn: s.turn, total: s.total, time: s.st.time }; },
  mount(root, g) {
    const colors = gameColors('nioui', ['#ff416c', '#ff4b2b']);
    const main = h('div', { class: 'col' });
    const tp = timerPill(g);
    root.append(main);
    let lastKey = null;
    return {
      update(r, v) {
        if (v.phase === 'end') { tp.set(0); main.replaceChildren(...endScreen(r, g, 'Fin de la partie !', h('p', { class: 'center muted' }, '1 point à chaque fois qu\'on tient jusqu\'au bout.'))); if (lastKey !== 'end') sfx.fanfare(); lastKey = 'end'; return; }
        const isV = v.victim === g.me, isA = v.asker === g.me;
        const V = g.nameOf(v.victim), A = g.nameOf(v.asker);
        tp.set(v.phase === 'play' ? v.deadline : 0);
        const key = `${v.gid}:${v.turn}:${v.phase}:${v.qn}`;
        const parts = [h('div', { class: 'row' }, h('span', { class: 'pill' }, `🙅 ${isV ? 'Toi' : V}`), h('div', { class: 'grow' }), v.phase === 'play' ? h('span', { class: 'pill' }, `❓ ${v.qn}`) : null, tp.el)];
        const buzzer = () => h('button', { class: 'btn btn-bad btn-big btn-block', onclick: () => { g.send({ type: 'fail' }); sfx.bad(); buzz([80, 40, 80]); } }, `😱 ${V} a dit oui ou non !`);
        if (v.phase === 'ready') {
          parts.push(h('div', { class: 'big-center', style: { padding: '8px 0' } },
            h('div', { class: 'hero-emo' }, '🙅'),
            h('h2', null, isV ? 'C\'est à toi de tenir !' : isA ? `Tu interroges ${V}` : `Au tour de ${V}`),
            h('p', { class: 'muted', style: { maxWidth: '34ch' } }, isV
              ? `${A} va te poser des questions pièges. Tiens ${v.time} secondes sans dire oui, non, ouais, nan, si, ok… ni hocher la tête !`
              : isA ? `Les questions s'afficheront sur ton téléphone : pose-les très vite à ${V} !`
                : `${A} pose les questions, ${V} doit tenir ${v.time} secondes. Si tu entends un oui ou un non, buzze !`)));
          parts.push(isV || isA || g.isHost ? actBtn(g, '▶ C\'est parti !', 'start', 'btn-primary btn-big') : h('p', { class: 'status-line' }, '⏳ Ça va commencer…'));
        } else if (v.phase === 'play') {
          if (isA) {
            const c = card(colors, 'Pose cette question', v.q, h('div', { class: 'foot' }, '👆 Touche la carte pour la question suivante'));
            c.style.cursor = 'pointer';
            c.onclick = () => { g.send({ type: 'q' }); sfx.pop(); };
            parts.push(c, buzzer());
          } else if (isV) {
            parts.push(h('div', { class: 'big-center' }, h('div', { class: 'hero-emo' }, '🤐'), h('h2', null, 'Tiens bon !'), h('p', { class: 'muted' }, 'Ni oui, ni non, ni hochement de tête…')),
              card(colors, `${A} te demande`, v.q));
          } else {
            parts.push(card(colors, `${A} demande à ${V}`, v.q), buzzer());
          }
          if (g.isHost && !isA) parts.push(h('button', { class: 'btn btn-ghost btn-sm', onclick: () => g.send({ type: 'q' }) }, '⏭ Question suivante'));
        } else if (v.phase === 'result') {
          const qs = plural(v.qn, 'question');
          parts.push(h('div', { class: 'big-center', style: { padding: '8px 0' } },
            h('div', { class: 'hero-emo' }, v.won ? '🏆' : '😱'),
            h('h2', null, v.won ? (isV ? `Tu as tenu ${v.time} secondes !` : `${V} a tenu ${v.time} secondes !`) : (isV ? 'Perdu, tu as craqué !' : `${V} a craqué !`)),
            h('p', null, v.won ? `Imbattable ! +1 point (${qs}).` : `${isV ? 'Tu prends' : V + ' prend'} ${sip(2)} après ${qs}.${v.by ? ` Buzzé par ${v.by === g.me ? 'toi' : g.nameOf(v.by)}.` : ''}`)));
          parts.push(isV || isA || g.isHost ? actBtn(g, 'Joueur suivant →', 'next', 'btn-primary btn-big') : h('p', { class: 'status-line' }, '⏳ Au suivant…'));
        }
        if (key !== lastKey) {
          if (v.phase === 'play' && v.qn === 1) { sfx.go(); if (isV) buzz([40, 30, 80]); }
          if (v.phase === 'result') { v.won ? (sfx.fanfare(), buzz([60, 40, 100])) : (sfx.bad(), buzz([150, 80, 150])); }
        }
        lastKey = key;
        main.replaceChildren(...parts);
      },
      destroy() { tp.stop(); },
    };
  },
};

// =====================================================================
// HISTOIRE FOLLE
// =====================================================================
export const histoireOnline = {
  id: 'histoire', name: 'Histoire folle', short: 'Une histoire à tour de rôle, avec des mots imposés', emoji: '📚', minPlayers: 2,
  defaults: { time: 30, rounds: 2 },
  settingsForm(st, set) {
    return h('div', { class: 'col' },
      timeSeg(st, set, [20, 30, 45], 'Temps par joueur'),
      roundsSeg(st, set, 'Tours par joueur', [1, 2, 3, 5]));
  },
  init(room, st) {
    const order = shuffle(activePids(room));
    return { gid: uid(), st, order, who: order[0], starter: pick(HISTOIRE.starters), chain: [], phase: 'intro', turn: 0, total: (st.rounds || 2) * order.length, words: shuffle(HISTOIRE.words.slice()) };
  },
  action(room, s, pid, a) {
    const can = pid === s.who || pid === room.host;
    if (a.type === 'go' && (s.phase === 'intro' || s.phase === 'ready') && can) {
      s.word = draw(s, 'words', () => shuffle(HISTOIRE.words.slice()));
      s.deadline = Date.now() + s.st.time * 1000;
      s.phase = 'play';
      return true;
    }
    if (a.type === 'placed' && s.phase === 'play' && can && typeof a.ok === 'boolean') { histoireDone(room, s, a.ok); return true; }
    if (a.type === 'finish' && pid === room.host && s.phase !== 'end') { s.phase = 'end'; return true; }
    return false;
  },
  tick(room, s) {
    if (s.phase === 'play' && Date.now() >= s.deadline) { histoireDone(room, s, false); return true; }
    return false;
  },
  onJoin(room, s, pid) { if (!s.order.includes(pid)) s.order.push(pid); },
  onLeave(room, s, pid) { if (pid === s.who && s.phase !== 'end') { s.who = nextOn(room, s.order, pid); if (s.phase === 'play') s.phase = 'ready'; } },
  view(room, s) { return { gid: s.gid, phase: s.phase, who: s.who, starter: s.starter, word: s.phase === 'play' ? s.word : null, deadline: s.deadline, chain: s.chain, turn: s.turn, total: s.total }; },
  mount(root, g) {
    const colors = gameColors('histoire', ['#8360c3', '#2ebf91']);
    const main = h('div', { class: 'col' });
    const tp = timerPill(g);
    root.append(main);
    let lastKey = null;
    const story = (v) => h('div', { class: 'panel col' }, h('p', null, h('b', null, v.starter)),
      v.chain.length ? [h('p', { class: 'muted small' }, 'Les mots imposés, dans l\'ordre :'),
        h('div', { class: 'chips' }, v.chain.map((c) => h('span', { class: 'chip' + (c.ok ? ' on' : '') }, `${c.ok ? '✅' : '❌'} ${c.w} · ${c.p === g.me ? 'toi' : g.nameOf(c.p)}`)))] : null);
    return {
      update(r, v) {
        if (v.phase === 'end') { tp.set(0); main.replaceChildren(...endScreen(r, g, 'Fin de l\'histoire !', story(v))); if (lastKey !== 'end') sfx.fanfare(); lastKey = 'end'; return; }
        const me = v.who === g.me;
        const N = g.nameOf(v.who);
        const can = me || g.isHost;
        tp.set(v.phase === 'play' ? v.deadline : 0);
        const key = `${v.gid}:${v.turn}:${v.phase}`;
        const parts = [h('div', { class: 'row' }, h('span', { class: 'pill' }, `📚 Tour ${Math.min(v.turn + 1, v.total)}/${v.total}`), h('div', { class: 'grow' }), tp.el)];
        if (v.phase === 'intro') {
          parts.push(card(colors, 'L\'histoire commence ainsi…', v.starter),
            h('p', { class: 'center muted' }, me ? 'Lis le début à voix haute, puis continue l\'histoire !' : `${N} lit le début à voix haute, puis continue l'histoire.`),
            can ? actBtn(g, me ? '▶ C\'est parti !' : `▶ Lancer le tour de ${N}`, 'go', 'btn-primary btn-big') : h('p', { class: 'status-line' }, `⏳ ${N} va commencer…`));
        } else if (v.phase === 'ready') {
          const last = v.chain[v.chain.length - 1];
          const lastMe = last && last.p === g.me;
          if (last) parts.push(h('div', { class: 'panel center' }, h('h3', null, last.ok ? `✅ « ${last.w} » bien placé ${lastMe ? 'par toi' : 'par ' + g.nameOf(last.p)} !` : `❌ Raté ! ${lastMe ? 'Tu prends' : g.nameOf(last.p) + ' prend'} ${sip(1)}.`)));
          parts.push(h('div', { class: 'big-center', style: { padding: '8px 0' } }, h('div', { class: 'hero-emo' }, '🗣️'),
            h('h2', null, me ? 'À toi de continuer l\'histoire !' : `Au tour de ${N}`)),
          can ? actBtn(g, me ? '▶ À moi !' : `▶ Lancer le tour de ${N}`, 'go', 'btn-primary btn-big') : h('p', { class: 'status-line' }, `⏳ ${N} se prépare…`),
          story(v));
        } else if (v.phase === 'play') {
          parts.push(h('div', { class: 'word-card' }, h('div', { class: 'hint' }, me ? 'Continue l\'histoire en plaçant :' : `${N} doit placer :`), h('div', { class: 'w' }, v.word)));
          if (can) {
            parts.push(h('div', { class: 'answer-btns' },
              h('button', { class: 'btn btn-bad btn-big', onclick: () => g.send({ type: 'placed', ok: false }) }, '❌ Raté'),
              h('button', { class: 'btn btn-ok btn-big', onclick: () => g.send({ type: 'placed', ok: true }) }, '✅ Placé !')));
          } else parts.push(h('p', { class: 'status-line' }, '👂 Écoute bien : le mot va-t-il être placé ?'));
        }
        if (g.isHost) parts.push(h('button', { class: 'btn btn-ghost btn-sm', onclick: () => g.send({ type: 'finish' }) }, '📜 Terminer l\'histoire'));
        if (key !== lastKey) {
          if (v.phase === 'play') { sfx.go(); if (me) buzz([40, 30, 80]); }
          if (v.phase === 'ready' && v.chain.length) { const l = v.chain[v.chain.length - 1]; l.ok ? sfx.ok() : sfx.bad(); }
        }
        lastKey = key;
        main.replaceChildren(...parts);
      },
      destroy() { tp.stop(); },
    };
  },
};
function histoireDone(room, s, ok) {
  s.chain.push({ p: s.who, w: s.word, ok });
  if (ok) addScore(room, s.who, 1);
  s.turn++;
  if (s.turn >= s.total) { s.phase = 'end'; return; }
  s.who = nextOn(room, s.order, s.who);
  s.phase = 'ready';
}
