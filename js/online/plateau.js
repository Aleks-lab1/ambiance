// Jeux de plateau en ligne : Bataille navale (le gagnant reste), Memory, Yam's.
import { h, uid, seg, setText } from '../ui.js';
import { sip } from '../store.js';
import { sfx, buzz } from '../sfx.js';
import { dieFace, tumble } from '../common.js';
import { activePids, addScore, playerOf, endScreen, actBtn, TV_PID, tvTurn, tvSplit, tvSay, tvStage } from './kit.js';
import { BN, randomFleet, fire, memDeck, YAMS_CATS, yamsScore, yamsTotals, rollDie } from '../plateau-core.js';

// En mode « chacun son tour » sur un seul téléphone (g.hotseat), on affiche toujours les prénoms.
const name = (g, pid) => (pid === g.me && !g.hotseat ? 'Toi' : g.nameOf(pid));
const yourTurn = (g) => (g.hotseat ? `À ${g.nameOf(g.me)} !` : 'À toi !');

// ---------------- Rendus partagés (aussi utilisés par les versions locales) ----------------
/**
 * Grille de bataille navale. ships = cases de bateaux visibles, shots = tirs reçus.
 * fx = { i, res } : dernier tir, animé (gerbe d'eau si raté, explosion si touché / coulé).
 */
export function bnGrid(shots, { ships = null, onFire = null, small = false, fx = null } = {}) {
  const shipSet = new Set(ships ? ships.flatMap((s) => s.cells) : []);
  // Bateau qui vient de couler : les cases coulées reliées à la case touchée (les bateaux ne se touchent jamais).
  const sunk = new Set();
  if (fx && fx.res === 'sunk') {
    const todo = [fx.i];
    while (todo.length) {
      const i = todo.pop();
      if (sunk.has(i) || shots[i] !== 'sunk') continue;
      sunk.add(i);
      if (i >= BN) todo.push(i - BN);
      if (i < BN * (BN - 1)) todo.push(i + BN);
      if (i % BN) todo.push(i - 1);
      if (i % BN < BN - 1) todo.push(i + 1);
    }
  }
  return h('div', { class: 'bn-grid' + (small ? ' small' : '') + (fx && fx.res !== 'miss' ? ' fx-shake' : '') }, Array.from({ length: BN * BN }, (_, i) => {
    const st = shots[i];
    const anim = fx && fx.i === i ? ' fx-' + fx.res : sunk.has(i) ? ' fx-sunk' : '';
    return h('button', {
      class: 'bn-cell' + (shipSet.has(i) ? ' ship' : '') + (st ? ' ' + st : '') + anim,
      disabled: !onFire || !!st, onclick: onFire && !st ? () => onFire(i) : null,
      'aria-label': `Case ${String.fromCharCode(65 + Math.floor(i / BN))}${(i % BN) + 1}`,
    }, h('span', null, st === 'miss' ? '•' : st === 'hit' ? '🔥' : st === 'sunk' ? '💥' : ''));
  }));
}
/** Plateau de Memory : les cartes se retournent en 3D et restent les mêmes d'une mise à jour à l'autre. */
export function memBoard(n, onFlip) {
  const cols = n > 16 ? 6 : 4;
  const state = Array.from({ length: n }, () => ({ up: false, done: false }));
  const fronts = [];
  let can = false;
  const cards = state.map((st, i) => {
    const front = h('span', { class: 'mc-face mc-front' });
    fronts.push(front);
    return h('button', { class: 'mc', 'aria-label': `Carte ${i + 1}`, onclick: () => { if (can && !st.up && !st.done) onFlip(i); } },
      h('span', { class: 'mc-in' }, h('span', { class: 'mc-face mc-back' }), front));
  });
  const el = h('div', { class: 'mem-grid', style: { gridTemplateColumns: `repeat(${cols}, 1fr)` } }, cards);
  return {
    el,
    update(v, canFlip) {
      can = !!canFlip;
      el.classList.toggle('mine', can);
      let flips = 0;
      v.cards.forEach((face, i) => {
        const st = state[i], c = cards[i];
        const up = face !== null, done = !!(v.owners && v.owners[i]);
        if (up && !st.up) { fronts[i].textContent = face; c.classList.add('up'); flips++; }
        if (!up && st.up) {
          c.classList.remove('up');
          setTimeout(() => { if (!state[i].up) fronts[i].textContent = ''; }, 500); // on efface la face une fois retournée
        }
        if (done !== st.done) c.classList.toggle('done', done);
        c.classList.toggle('miss', v.phase === 'show' && up && !done);
        st.up = up; st.done = done;
        c.disabled = !can || up;
      });
      if (flips) sfx.card();
    },
  };
}
export function yamsSheet(players, sheets, { cur = null, dice = null, canScore = false, onScore = null, meLabel = null } = {}) {
  const head = h('tr', null, h('th', null, ''), players.map((p) => h('th', { class: p.pid === cur ? 'cur' : '' }, meLabel && p.pid === meLabel ? 'Toi' : p.name)));
  const row = (c) => h('tr', null, h('td', { class: 'cat', title: c.hint || '' }, c.name), players.map((p) => {
    const v = sheets[p.pid] ? sheets[p.pid][c.id] : undefined;
    if (v != null) return h('td', { class: 'val' + (p.pid === cur ? ' cur' : '') }, String(v));
    if (p.pid === cur && canScore && dice) {
      const pts = yamsScore(c.id, dice);
      return h('td', { class: 'cur' }, h('button', { class: 'ys-pick' + (pts ? '' : ' zero'), onclick: () => onScore(c.id) }, String(pts)));
    }
    return h('td', { class: p.pid === cur ? 'cur' : '' }, '');
  }));
  const tot = (label, f, cls = '') => h('tr', { class: 'tot ' + cls }, h('td', { class: 'cat' }, label), players.map((p) => h('td', { class: p.pid === cur ? 'cur' : '' }, String(f(yamsTotals(sheets[p.pid] || {}))))));
  return h('div', { class: 'ys-wrap' }, h('table', { class: 'ys' }, h('thead', null, head), h('tbody', null,
    YAMS_CATS.filter((c) => c.up).map(row), tot('Bonus (≥ 63)', (t) => t.bonus), YAMS_CATS.filter((c) => !c.up).map(row), tot('TOTAL', (t) => t.total, 'big'))));
}
export function diceRow(dice, held, onHold) {
  return h('div', { class: 'dice-row ys-dice' }, dice.map((v, i) => h('button', { class: 'ys-die' + (held[i] ? ' held' : ''), disabled: !onHold, onclick: onHold ? () => onHold(i) : null }, dieFace(v, 'md' + (held[i] ? ' hl' : '')))));
}

// =====================================================================
// BATAILLE NAVALE
// =====================================================================
export const batailleOnline = {
  id: 'bataille', name: 'Bataille navale', short: 'Coule la flotte adverse, le gagnant reste', emoji: '🚢', minPlayers: 2,
  defaults: {},
  settingsForm: () => h('p', { class: 'muted small' }, 'Grille 8 × 8, 5 bateaux placés au hasard (tu peux les remélanger). Touché = tu rejoues. Le gagnant reste et affronte le suivant.'),
  init(room) {
    const order = activePids(room);
    const s = { gid: uid(), duo: [order[0], order[1]], queue: order.slice(2), first: 0, n: 0 };
    bnNew(s);
    return s;
  },
  action(room, s, pid, a) {
    const k = s.duo.indexOf(pid);
    if (s.phase === 'place' && k >= 0) {
      if (a.type === 'shuffle' && !s.ready[k]) { s.fleets[k] = randomFleet(); return true; }
      if (a.type === 'ready') { s.ready[k] = true; if (s.ready[0] && s.ready[1]) s.phase = 'play'; return true; }
    }
    if (a.type === 'fire' && s.phase === 'play' && k === s.turn && Number.isInteger(a.i) && a.i >= 0 && a.i < BN * BN) {
      const shots = s.shots[1 - k];
      if (shots[a.i]) return false;
      const r = fire(s.fleets[1 - k], shots, a.i);
      s.last = { by: k, i: a.i, res: r.res, len: r.sunk };
      if (r.all) { s.phase = 'over'; s.winner = k; addScore(room, pid, 1); } else if (r.res === 'miss') s.turn = 1 - s.turn;
      return true;
    }
    if (a.type === 'again' && s.phase === 'over' && (pid === room.host || k >= 0)) {
      if (s.queue.length) { const loser = s.duo[1 - s.winner]; s.duo[1 - s.winner] = s.queue.shift(); s.queue.push(loser); s.first = 1 - s.winner; } else s.first = 1 - s.first;
      bnNew(s);
      return true;
    }
    return false;
  },
  onJoin(room, s, pid) { if (!s.duo.includes(pid) && !s.queue.includes(pid)) s.queue.push(pid); },
  onLeave(room, s, pid) { const k = s.duo.indexOf(pid); if (k >= 0 && s.queue.length) { s.duo[k] = s.queue.shift(); bnNew(s); } },
  view(room, s, pid) {
    const k = s.duo.indexOf(pid);
    return { gid: s.gid, n: s.n, phase: s.phase, duo: s.duo, queue: s.queue, turn: s.turn, me: k, ready: s.ready, last: s.last, winner: s.winner,
      myFleet: k >= 0 ? s.fleets[k] : null, shotsOn: s.shots, // shots[i] = tirs reçus par le joueur i
      fleets: s.phase === 'over' ? s.fleets : null };
  },
  // Écran télé : les deux mers côte à côte (seulement les tirs : les bateaux restent cachés jusqu'à la fin).
  tv(room, s) { return this.view(room, s, TV_PID); },
  tvMount(root, g) {
    const say = tvSay();
    const sub = h('p', { class: 'tv-status' });
    const seas = h('div', { class: 'tv-seas' });
    const queue = h('p', { class: 'tv-status' });
    root.append(h('div', { class: 'tv-fill' }, say.el, sub, seas, queue));
    let lastKey = null;
    return {
      update(r, v) {
        const key = `${v.gid}:${v.n}:${v.phase}:${v.turn}:${JSON.stringify(v.last)}:${v.ready.join()}`;
        if (key === lastKey) return;
        const N = (k) => g.nameOf(v.duo[k]);
        const sc = (k) => (playerOf(r, v.duo[k]) || {}).score || 0;
        const fresh = v.last && lastKey ? { i: v.last.i, res: v.last.res } : null;
        const hitOn = v.last ? 1 - v.last.by : -1;
        if (v.phase === 'place') {
          say.set(`🚢 ${N(0)} contre ${N(1)}`);
          setText(sub, `Les capitaines placent leur flotte… ${v.ready.map((x, k) => (x ? '✅ ' : '⏳ ') + N(k)).join(' · ')}`);
          seas.replaceChildren();
        } else {
          if (v.phase === 'over') say.set(`🏆 ${N(v.winner)} a coulé toute la flotte !`);
          else say.set(`🎯 ${N(v.turn)} tire…`);
          setText(sub, v.phase === 'over' ? `${N(1 - v.winner)} prend ${sip(2)} !`
            : v.last ? `${N(v.last.by)} : ${v.last.res === 'miss' ? 'à l\'eau 🌊' : v.last.res === 'hit' ? 'touché 🔥 (rejoue)' : `coulé 💥 (bateau de ${v.last.len})`}` : 'Touché = on rejoue');
          // Mer de chaque capitaine : les tirs qu'il a reçus.
          seas.replaceChildren(...[0, 1].map((k) => h('div', { class: 'tv-sea' + (v.phase === 'play' && v.turn === 1 - k ? ' aimed' : '') },
            h('b', null, `🚢 ${N(k)} · ${sc(k)} 🏆`),
            bnGrid(v.shotsOn[k], { ships: v.fleets ? v.fleets[k] : null, fx: hitOn === k ? fresh : null }))));
        }
        setText(queue, v.queue.length ? `⏳ Prochains capitaines : ${v.queue.map((p) => g.nameOf(p)).join(', ')}` : '');
        if (fresh) { v.last.res === 'miss' ? sfx.splash() : sfx.boom(); }
        if (v.phase === 'over' && !/:over:/.test(lastKey || '')) sfx.fanfare();
        lastKey = key;
      },
      destroy() {},
    };
  },
  mount(root, g) {
    const main = h('div', { class: 'col' });
    root.append(main);
    let lastKey = null;
    return {
      update(r, v) {
        const k = v.me;
        const key = `${v.gid}:${v.n}:${v.phase}:${v.turn}:${JSON.stringify(v.last)}`;
        const parts = [h('p', { class: 'center' }, h('b', null, `🚢 ${name(g, v.duo[0])} (${(playerOf(r, v.duo[0]) || {}).score || 0})`), '  contre  ', h('b', null, `${name(g, v.duo[1])} (${(playerOf(r, v.duo[1]) || {}).score || 0})`))];
        if (v.phase === 'place') {
          if (k >= 0) {
            parts.push(h('h2', { class: 'center' }, v.ready[k] ? '✅ Prêt ! On attend l\'autre…' : 'Ta flotte'), bnGrid({}, { ships: v.myFleet }),
              !v.ready[k] ? h('div', { class: 'row' }, h('button', { class: 'btn btn-soft grow', onclick: () => g.send({ type: 'shuffle' }) }, '🔀 Remélanger'), h('button', { class: 'btn btn-primary grow', onclick: () => { g.send({ type: 'ready' }); sfx.pop(); } }, '✅ Prêt')) : null);
          } else parts.push(h('p', { class: 'center muted' }, 'Les deux capitaines placent leur flotte…'));
        } else {
          const opp = k >= 0 ? 1 - k : 1;
          const myTurn = v.phase === 'play' && k === v.turn;
          let status;
          if (v.phase === 'over') status = v.duo[v.winner] === g.me && !g.hotseat ? '🏆 Tu as coulé toute la flotte !' : `🏆 ${g.nameOf(v.duo[v.winner])} a coulé toute la flotte !`;
          else status = myTurn ? '🎯 À toi de tirer !' : `⏳ ${name(g, v.duo[v.turn])} tire…`;
          const lastTxt = v.last ? `${name(g, v.duo[v.last.by])} : ${v.last.res === 'miss' ? 'à l\'eau 🌊' : v.last.res === 'hit' ? 'touché 🔥 (rejoue)' : `coulé 💥 (bateau de ${v.last.len})`}` : '';
          // Le dernier tir est animé une seule fois (gerbe d'eau ou explosion) sur la grille qui l'a reçu.
          const fresh = key !== lastKey && v.last && lastKey ? { i: v.last.i, res: v.last.res } : null;
          const hitOn = v.last ? 1 - v.last.by : -1, mine = k >= 0 ? k : 0;
          parts.push(h('h2', { class: 'center' }, status), h('p', { class: 'center muted small' }, lastTxt),
            h('p', { class: 'center small' }, k >= 0 ? 'Chez l\'adversaire' : `🚢 ${g.nameOf(v.duo[1])}`),
            bnGrid(v.shotsOn[opp], { ships: v.fleets ? v.fleets[opp] : null, onFire: myTurn ? (i) => { g.send({ type: 'fire', i }); } : null, fx: hitOn === opp ? fresh : null }),
            h('p', { class: 'center small' }, k >= 0 ? 'Ta flotte' : `🚢 ${g.nameOf(v.duo[0])}`),
            bnGrid(v.shotsOn[mine], { ships: k >= 0 ? v.myFleet : (v.fleets ? v.fleets[0] : null), small: true, fx: hitOn === mine ? fresh : null }));
          if (v.phase === 'over') {
            parts.push(h('p', { class: 'center' }, v.duo[1 - v.winner] === g.me ? `Tu prends ${sip(2)} !` : `${g.nameOf(v.duo[1 - v.winner])} prend ${sip(2)} !`),
              (g.isHost || k >= 0) ? actBtn(g, v.queue.length ? '🔁 Au suivant !' : '🔁 Revanche', 'again', 'btn-primary btn-big') : null);
          }
        }
        if (v.queue.length) parts.push(h('p', { class: 'center muted small' }, `⏳ Prochains capitaines : ${v.queue.map((p) => name(g, p)).join(', ')}`));
        if (key !== lastKey && v.last && lastKey) { v.last.res === 'miss' ? sfx.splash() : v.last.res === 'hit' ? (sfx.boom(), buzz(60)) : (sfx.boom(), buzz([100, 50, 200])); }
        if (key !== lastKey && v.phase === 'over') { v.duo[v.winner] === g.me ? sfx.fanfare() : sfx.end(); }
        lastKey = key;
        main.replaceChildren(...parts);
      },
      destroy() {},
    };
  },
};
function bnNew(s) { s.n++; s.fleets = [randomFleet(), randomFleet()]; s.shots = [{}, {}]; s.ready = [false, false]; s.turn = s.first; s.phase = 'place'; s.last = null; s.winner = null; }

// =====================================================================
// MEMORY
// =====================================================================
export const memoryOnline = {
  id: 'memory', name: 'Memory', short: 'Trouve les paires, chacun son tour', emoji: '🧩', minPlayers: 2,
  defaults: { pairs: 10 },
  settingsForm: (st, set) => h('label', { class: 'field' }, 'Nombre de paires', seg([8, 10, 12, 15].map((n) => ({ value: n, label: String(n) })), st.pairs, (v) => set({ pairs: v }))),
  init(room, st) {
    const order = activePids(room);
    return { gid: uid(), st, order, cur: order[0], deck: memDeck(st.pairs), owner: {}, flipped: [], phase: 'play', until: 0 };
  },
  action(room, s, pid, a) {
    if (a.type !== 'flip' || s.phase !== 'play' || pid !== s.cur || !Number.isInteger(a.i) || s.owner[a.i] || s.flipped.includes(a.i) || a.i < 0 || a.i >= s.deck.length || s.flipped.length >= 2) return false;
    s.flipped.push(a.i);
    if (s.flipped.length === 2) {
      const [x, y] = s.flipped;
      if (s.deck[x] === s.deck[y]) {
        s.owner[x] = s.owner[y] = pid; s.flipped = []; addScore(room, pid, 1); s.lastPair = pid;
        if (Object.keys(s.owner).length === s.deck.length) s.phase = 'end';
      } else { s.phase = 'show'; s.until = Date.now() + 1300; }
    }
    return true;
  },
  tick(room, s) {
    if (s.phase === 'show' && Date.now() >= s.until) {
      s.flipped = []; s.phase = 'play'; s.lastPair = null;
      const i = s.order.indexOf(s.cur);
      for (let k = 1; k <= s.order.length; k++) { const p = s.order[(i + k) % s.order.length]; if (room.players.some((x) => x.pid === p && x.on)) { s.cur = p; break; } }
      return true;
    }
    return false;
  },
  onJoin(room, s, pid) { if (!s.order.includes(pid)) s.order.push(pid); },
  view(room, s) {
    return { gid: s.gid, phase: s.phase, cur: s.cur, cards: s.deck.map((e, i) => (s.owner[i] || s.flipped.includes(i) ? e : null)), owners: s.owner, flipped: s.flipped.length, lastPair: s.lastPair, total: s.deck.length / 2 };
  },
  // Écran télé : le plateau en grand, les cartes se retournent en même temps que sur les téléphones.
  tv(room, s) { return this.view(room, s, TV_PID); },
  tvMount(root, g) {
    const slot = h('div', { class: 'tv-mem' });
    const turn = h('div');
    const say = tvSay();
    const pairs = h('div', { class: 'tv-pills' });
    const st = tvStage(root, tvSplit(slot, h('div', { class: 'tv-col' }, turn, say.el, pairs), 'wide-l'));
    let board = null, gid = null, lastKey = null, endT = null, ending = false;
    return {
      update(r, v) {
        if (v.phase === 'end') {
          if (ending) return;
          ending = true;
          if (board && gid === v.gid) board.update(v, false);
          endT = setTimeout(() => st.end(r, true), board ? 1300 : 0);
          return;
        }
        clearTimeout(endT); ending = false;
        st.end(r, false);
        if (!board || gid !== v.gid) {
          board = memBoard(v.cards.length, () => {}); gid = v.gid;
          const cols = v.cards.length > 16 ? 6 : 4;
          board.el.style.setProperty('--cols', cols); board.el.style.setProperty('--rows', Math.ceil(v.cards.length / cols));
          slot.replaceChildren(board.el);
        }
        board.update(v, false);
        const key = `${v.gid}:${v.cur}:${v.phase}:${Object.keys(v.owners).length}:${v.flipped}`;
        if (key === lastKey) return;
        turn.replaceChildren(tvTurn('👆', `À ${g.nameOf(v.cur)}`, 'de retourner deux cartes'));
        say.set(v.phase === 'show' ? '❌ Pas une paire…' : v.lastPair ? `✅ Paire pour ${g.nameOf(v.lastPair)} : rejoue !` : 'Une paire = un point');
        const found = {};
        for (const p of Object.values(v.owners)) found[p] = (found[p] || 0) + 0.5;
        pairs.replaceChildren(h('span', { class: 'pill' }, `🧩 ${Object.keys(v.owners).length / 2}/${v.total} paires`),
          ...r.players.filter((p) => found[p.pid]).map((p) => h('span', { class: 'pill' }, `${p.name} · ${found[p.pid]}`)));
        if (v.phase === 'show') setTimeout(() => sfx.bad(), 300); else if (v.lastPair && lastKey) setTimeout(() => sfx.ok(), 250);
        lastKey = key;
      },
      destroy() { clearTimeout(endT); },
    };
  },
  mount(root, g) {
    const head = h('div', { class: 'row' }), slot = h('div'), chips = h('div', { class: 'chips', style: { justifyContent: 'center' } }), msg = h('p', { class: 'center muted small' });
    const main = h('div', { class: 'col' }, head, slot, chips, msg);
    root.append(main);
    let lastKey = null, board = null, gid = null, endT = null;
    return {
      update(r, v) {
        if (v.phase === 'end') {
          if (lastKey === 'end') return;
          lastKey = 'end';
          // On laisse le temps de voir la dernière paire se retourner avant le classement.
          if (board && gid === v.gid) board.update(v, false);
          sfx.ok();
          endT = setTimeout(() => { main.replaceChildren(...endScreen(r, g, 'Toutes les paires sont trouvées !')); board = null; gid = null; }, board ? 1100 : 0);
          return;
        }
        clearTimeout(endT);
        if (head.parentNode !== main) main.replaceChildren(head, slot, chips, msg);
        if (!board || gid !== v.gid) { board = memBoard(v.cards.length, (i) => { buzz(8); g.send({ type: 'flip', i }); }); gid = v.gid; slot.replaceChildren(board.el); }
        const myTurn = v.cur === g.me && v.phase === 'play';
        const key = `${v.gid}:${v.cur}:${v.phase}:${Object.keys(v.owners).length}:${v.flipped}`;
        board.update(v, myTurn);
        head.replaceChildren(h('span', { class: 'pill' }, `🧩 ${Object.keys(v.owners).length / 2}/${v.total} paires`), h('div', { class: 'grow' }), h('span', { class: 'pill' }, myTurn ? '👆 ' + yourTurn(g) : `⏳ ${g.nameOf(v.cur)}`));
        chips.replaceChildren(...r.players.map((p) => h('span', { class: 'chip' + (p.pid === v.cur ? ' on' : '') }, `${name(g, p.pid)} · ${p.score}`)));
        setText(msg, v.phase === 'show' ? '❌ Pas une paire…' : v.lastPair ? (name(g, v.lastPair) === 'Toi' ? '✅ Paire trouvée : rejoue !' : `✅ Paire pour ${g.nameOf(v.lastPair)} : rejoue !`) : 'Une paire trouvée = un point, et on rejoue.');
        if (key !== lastKey) { if (v.phase === 'show') setTimeout(() => sfx.bad(), 300); else if (v.lastPair && lastKey) setTimeout(() => sfx.ok(), 250); if (myTurn && v.flipped === 0) buzz(20); }
        lastKey = key;
      },
      destroy() { clearTimeout(endT); },
    };
  },
};

// =====================================================================
// YAM'S
// =====================================================================
export const yamsOnline = {
  id: 'yams', name: 'Yam\'s', short: '5 dés, 3 lancers, 13 combinaisons', emoji: '🎲', minPlayers: 2,
  defaults: {},
  settingsForm: () => h('p', { class: 'muted small' }, 'Chacun son tour : jusqu\'à 3 lancers, tu gardes les dés que tu veux, puis tu inscris ton score dans une case. Le plus gros total gagne.'),
  init(room) {
    const order = activePids(room);
    const s = { gid: uid(), order, cur: order[0], sheets: Object.fromEntries(order.map((p) => [p, {}])), phase: 'play' };
    ysTurn(s);
    return s;
  },
  action(room, s, pid, a) {
    if (s.phase !== 'play' || pid !== s.cur) return false;
    if (a.type === 'roll' && s.rolls < 3) { s.dice = s.dice.map((v, i) => (s.held[i] && s.rolls > 0 ? v : rollDie())); s.rolls++; s.anim++; return true; }
    if (a.type === 'hold' && s.rolls > 0 && s.rolls < 3 && Number.isInteger(a.i) && a.i >= 0 && a.i < 5) { s.held[a.i] = !s.held[a.i]; return true; }
    if (a.type === 'score' && s.rolls > 0 && YAMS_CATS.some((c) => c.id === a.c) && s.sheets[pid][a.c] == null) {
      s.sheets[pid][a.c] = yamsScore(a.c, s.dice);
      const p = playerOf(room, pid); if (p) p.score = yamsTotals(s.sheets[pid]).total;
      s.last = { pid, c: a.c, v: s.sheets[pid][a.c] };
      const done = (q) => Object.keys(s.sheets[q]).length >= YAMS_CATS.length;
      const on = s.order.filter((q) => room.players.some((x) => x.pid === q && x.on));
      if (on.every(done)) {
        for (const q of s.order) { const pp = playerOf(room, q); if (pp) pp.score = yamsTotals(s.sheets[q]).total; }
        s.phase = 'end'; return true;
      }
      const i = s.order.indexOf(s.cur);
      for (let k = 1; k <= s.order.length; k++) { const q = s.order[(i + k) % s.order.length]; if (on.includes(q) && !done(q)) { s.cur = q; break; } }
      ysTurn(s);
      return true;
    }
    return false;
  },
  onLeave(room, s, pid) { if (pid === s.cur) { const on = s.order.filter((q) => q !== pid && room.players.some((x) => x.pid === q && x.on)); if (on.length) { s.cur = on[0]; ysTurn(s); } } },
  view(room, s) { return { gid: s.gid, phase: s.phase, cur: s.cur, dice: s.dice, held: s.held, rolls: s.rolls, sheets: s.sheets, anim: s.anim, last: s.last, order: s.order }; },
  // Écran télé : les 5 dés en grand (ils roulent), les dés gardés levés, et la feuille de marque de tous.
  tv(room, s) { return this.view(room, s, TV_PID); },
  tvMount(root, g) {
    const turn = h('div');
    const dice = h('div', { class: 'tv-yams-dice' });
    const say = tvSay();
    const sheet = h('div', { class: 'tv-sheet' });
    const st = tvStage(root, tvSplit(h('div', { class: 'tv-col' }, turn, dice, say.el), sheet));
    let lastAnim = null, lastCur = null;
    return {
      update(r, v) {
        const players = v.order.map((p) => playerOf(r, p) || { pid: p, name: g.nameOf(p) });
        if (st.end(r, v.phase === 'end')) { lastCur = 'end'; return; }
        if (v.cur !== lastCur) turn.replaceChildren(tvTurn('🎲', `À ${g.nameOf(v.cur)}`, 'jusqu\'à 3 lancers'));
        dice.replaceChildren(v.rolls ? diceRow(v.dice, v.held, null) : h('div', { class: 'tv-say' }, `${g.nameOf(v.cur)} va lancer les dés…`),
          h('div', { class: 'tv-pills' }, h('span', { class: 'pill' }, `Lancer ${v.rolls}/3`)));
        say.set(v.last ? `${g.nameOf(v.last.pid)} : ${YAMS_CATS.find((c) => c.id === v.last.c).name} → ${v.last.v}` : '');
        sheet.replaceChildren(yamsSheet(players, v.sheets, { cur: v.cur }));
        if (v.anim !== lastAnim && v.rolls) { dice.querySelectorAll('.ys-die:not(.held) .die').forEach((d) => tumble(d)); sfx.rattle(); }
        lastAnim = v.anim; lastCur = v.cur;
      },
      destroy() {},
    };
  },
  mount(root, g) {
    const main = h('div', { class: 'col' });
    root.append(main);
    let lastAnim = null, lastCur = null;
    return {
      update(r, v) {
        const players = v.order.map((p) => playerOf(r, p) || { pid: p, name: g.nameOf(p) });
        if (v.phase === 'end') {
          main.replaceChildren(...endScreen(r, g, 'Fin de la partie de Yam\'s !'), yamsSheet(players, v.sheets, { meLabel: g.hotseat ? null : g.me }));
          lastCur = 'end'; return;
        }
        const myTurn = v.cur === g.me;
        const parts = [
          h('div', { class: 'row' }, h('span', { class: 'pill' }, myTurn ? '🎲 ' + yourTurn(g) : `⏳ ${g.nameOf(v.cur)}`), h('div', { class: 'grow' }), h('span', { class: 'pill' }, `Lancer ${v.rolls}/3`)),
          v.rolls ? diceRow(v.dice, v.held, myTurn && v.rolls < 3 ? (i) => { g.send({ type: 'hold', i }); sfx.tick(); } : null) : h('p', { class: 'center muted' }, myTurn ? 'Lance les dés !' : `${g.nameOf(v.cur)} va lancer les dés…`),
          myTurn ? h('div', { class: 'row' },
            h('button', { class: 'btn btn-primary grow', disabled: v.rolls >= 3, onclick: () => { g.send({ type: 'roll' }); } }, v.rolls === 0 ? '🎲 Lancer' : `🎲 Relancer (${3 - v.rolls})`)) : null,
          myTurn && v.rolls > 0 ? h('p', { class: 'center muted small' }, v.rolls < 3 ? 'Touche les dés à garder, relance, ou choisis une case.' : 'Choisis une case pour inscrire ton score.') : null,
          v.last ? h('p', { class: 'center small' }, `${name(g, v.last.pid)} : ${YAMS_CATS.find((c) => c.id === v.last.c).name} → ${v.last.v}`) : null,
          yamsSheet(players, v.sheets, { cur: v.cur, dice: v.dice, canScore: myTurn && v.rolls > 0, onScore: (c) => { g.send({ type: 'score', c }); sfx.pop(); }, meLabel: g.hotseat ? null : g.me }),
        ];
        main.replaceChildren(...parts);
        if (v.anim !== lastAnim && v.rolls) { main.querySelectorAll('.ys-die:not(.held) .die').forEach((d) => tumble(d)); sfx.rattle(); buzz(20); }
        if (v.cur !== lastCur && myTurn) { sfx.go(); buzz(30); }
        lastAnim = v.anim; lastCur = v.cur;
      },
      destroy() {},
    };
  },
};
function ysTurn(s) { s.dice = [1, 1, 1, 1, 1]; s.held = [false, false, false, false, false]; s.rolls = 0; s.anim = (s.anim || 0) + 1; }
