// Menteur ! : dés de bluff. Chacun voit ses dés en secret, on surenchérit sur le total de la table.
import { h, uid, shuffle, seg, toggleRow, randInt } from '../ui.js';
import { dieFace } from '../common.js';
import { sfx, buzz } from '../sfx.js';

const player = (room, pid) => room.players.find((p) => p.pid === pid);
const aliveList = (s) => s.order.filter((p) => s.dice[p] > 0);
const totalDice = (s) => aliveList(s).reduce((t, p) => t + s.dice[p], 0);

function nextAlive(s, pid) {
  const n = s.order.length;
  const i = s.order.indexOf(pid);
  for (let k = 1; k <= n; k++) { const q = s.order[(i + k) % n]; if (s.dice[q] > 0) return q; }
  return pid;
}

function skipOffline(room, s) {
  for (let k = 0; k < s.order.length; k++) {
    const p = player(room, s.turn);
    if (p && p.on && s.dice[s.turn] > 0) return false;
    s.turn = nextAlive(s, s.turn);
  }
  return true;
}

function startRound(room, s, starter) {
  s.round++;
  for (const p of s.order) s.rolls[p] = Array.from({ length: s.dice[p] }, () => randInt(1, 6)).sort((a, b) => a - b);
  s.bid = null;
  s.history = [];
  s.result = null;
  s.phase = 'bid';
  s.turn = starter;
  skipOffline(room, s);
}

export function validBid(bid, q, f, total, jokers) {
  if (!Number.isInteger(q) || !Number.isInteger(f)) return false;
  if (f < (jokers ? 2 : 1) || f > 6 || q < 1 || q > total) return false;
  if (!bid) return true;
  return q > bid.q || (q === bid.q && f > bid.f);
}

function resolve(room, s, caller) {
  const { q, f, pid: bidder } = s.bid;
  let count = 0;
  for (const p of aliveList(s)) for (const d of s.rolls[p]) if (d === f || (s.st.jokers && d === 1)) count++;
  const bidOk = count >= q;
  const loser = bidOk ? caller : bidder;
  s.dice[loser]--;
  s.result = { caller, bidder, q, f, count, bidOk, loser, rolls: { ...s.rolls }, eliminated: s.dice[loser] === 0 };
  const left = aliveList(s);
  if (left.length <= 1) {
    s.phase = 'end';
    s.winner = left[0] || null;
    const w = player(room, s.winner);
    if (w) w.score += 1;
  } else {
    s.phase = 'reveal';
    s.nextStarter = s.dice[loser] > 0 ? loser : nextAlive(s, loser);
  }
}

export default {
  id: 'menteur',
  name: 'Menteur !',
  short: 'Dés de bluff',
  emoji: '🎲',
  minPlayers: 2,
  defaults: { dice: 5, jokers: true },

  settingsForm(st, set) {
    return h('div', { class: 'col' },
      h('label', { class: 'field' }, 'Dés par joueur', seg([3, 4, 5].map((n) => ({ value: n, label: String(n) })), st.dice, (v) => set({ dice: v }))),
      toggleRow('🃏 Les 1 sont des jokers', 'Ils comptent comme n\'importe quelle valeur (on ne peut alors pas annoncer de 1).', st.jokers, (v) => set({ jokers: v })));
  },

  init(room, st) {
    const order = shuffle(room.players.filter((p) => p.on).map((p) => p.pid));
    const s = { gid: uid(), st, order, dice: Object.fromEntries(order.map((p) => [p, st.dice])), rolls: {}, round: 0, winner: null };
    startRound(room, s, order[0]);
    return s;
  },

  action(room, s, pid, a) {
    if (a.type === 'bid' && s.phase === 'bid' && pid === s.turn) {
      const q = Number(a.q), f = Number(a.f);
      if (!validBid(s.bid, q, f, totalDice(s), s.st.jokers)) return false;
      s.bid = { q, f, pid };
      s.history.push(s.bid);
      s.turn = nextAlive(s, pid);
      skipOffline(room, s);
      return true;
    }
    if (a.type === 'call' && s.phase === 'bid' && pid === s.turn && s.bid) { resolve(room, s, pid); return true; }
    if (a.type === 'next' && pid === room.host && s.phase === 'reveal') { startRound(room, s, s.nextStarter); return true; }
    return false;
  },

  tick(room, s) {
    if (s.phase !== 'bid') return false;
    const p = player(room, s.turn);
    if (!p || !p.on) { skipOffline(room, s); return true; }
    return false;
  },

  view(room, s, pid) {
    return {
      gid: s.gid, phase: s.phase, round: s.round,
      myDice: s.rolls[pid] || [], dice: s.dice, order: s.order, turn: s.turn,
      bid: s.bid, history: s.history.slice(-6), total: totalDice(s), jokers: s.st.jokers,
      result: s.phase !== 'bid' ? s.result : null, winner: s.winner,
    };
  },

  mount(root, g) {
    const box = h('div', { class: 'col' });
    root.append(box);
    let pick = { q: 1, f: 2 };
    let pickKey = null;
    let lastKey = null;

    const bidText = (b) => h('span', { class: 'bid-txt' }, `${b.q} ×`, dieFace(b.f, 'xs'));

    return {
      update(room, v) {
        const key = v.gid + ':' + v.round + ':' + v.phase + ':' + (v.bid ? v.bid.q + '-' + v.bid.f : '') + ':' + v.turn;
        if (key !== lastKey) {
          if (v.phase === 'bid' && v.turn === g.me) { sfx.go(); buzz([50, 30, 50]); }
          if (v.phase === 'reveal' || v.phase === 'end') { v.result && v.result.loser === g.me ? sfx.bad() : sfx.end(); }
        }
        lastKey = key;
        const minFace = v.jokers ? 2 : 1;
        // Proposition par défaut : juste au-dessus de l'annonce en cours.
        const pk = v.gid + ':' + v.round + ':' + (v.bid ? v.bid.q + '-' + v.bid.f : '0');
        if (pk !== pickKey) {
          pickKey = pk;
          if (!v.bid) pick = { q: 1, f: minFace };
          else if (v.bid.f < 6) pick = { q: v.bid.q, f: v.bid.f + 1 };
          else pick = { q: v.bid.q + 1, f: minFace };
        }
        const players = h('div', { class: 'liar-players' }, v.order.map((pid) => h('div', {
          class: 'liar-p' + (pid === v.turn && v.phase === 'bid' ? ' turn' : '') + (v.dice[pid] === 0 ? ' out' : '') + (pid === g.me ? ' me' : ''),
        }, h('b', null, g.nameOf(pid)), h('span', null, v.dice[pid] ? `🎲 ${v.dice[pid]}` : '☠️'))));

        const parts = [
          h('div', { class: 'row' }, h('span', { class: 'pill' }, `Manche ${v.round}`), h('div', { class: 'grow' }), h('span', { class: 'pill' }, `🎲 ${v.total} dés en jeu${v.jokers ? ' · 1 = joker' : ''}`)),
          players,
        ];

        if (v.phase === 'end') {
          parts.push(h('div', { class: 'big-center' }, h('div', { class: 'hero-emo' }, '🏆'), h('h2', null, `${g.nameOf(v.winner)} gagne la partie !`), h('p', { class: 'muted' }, 'Le roi (ou la reine) du bluff.')));
          if (v.result) parts.push(revealBox(v));
          parts.push(g.hostBar());
          box.replaceChildren(...parts);
          return;
        }

        parts.push(h('div', { class: 'panel col' },
          h('p', { class: 'muted small' }, v.myDice.length ? 'Tes dés (secrets !)' : 'Tu n\'as plus de dés : regarde la fin de la partie.'),
          h('div', { class: 'dice-row' }, v.myDice.map((d) => dieFace(d, 'md' + (v.phase !== 'bid' && v.result && (d === v.result.f || (v.jokers && d === 1)) ? ' hl' : ''))))));

        if (v.phase === 'bid') {
          parts.push(h('div', { class: 'panel center col' },
            v.bid ? h('p', null, h('b', null, g.nameOf(v.bid.pid)), ' annonce : ', bidText(v.bid)) : h('p', { class: 'muted' }, 'Personne n\'a encore annoncé.'),
            v.history.length > 1 ? h('p', { class: 'muted tiny' }, 'Avant : ' + v.history.slice(0, -1).map((b) => `${g.nameOf(b.pid)} ${b.q}×${b.f}`).join(' · ')) : null));
          if (v.turn === g.me) {
            const faces = h('div', { class: 'face-pick' });
            const qty = h('b', { class: 'qty' });
            const go = h('button', { class: 'btn btn-primary btn-big grow' });
            const refresh = () => {
              qty.textContent = String(pick.q);
              faces.replaceChildren(...Array.from({ length: 7 - minFace }, (_, i) => i + minFace).map((f) => {
                const b = h('button', { class: 'face-btn' + (pick.f === f ? ' on' : ''), 'aria-label': 'Valeur ' + f, onclick: () => { pick.f = f; refresh(); } }, dieFace(f, 'xs'));
                return b;
              }));
              const ok = validBid(v.bid, pick.q, pick.f, v.total, v.jokers);
              go.disabled = !ok;
              go.replaceChildren(...(ok ? ['Annoncer ', `${pick.q} ×`, dieFace(pick.f, 'xs')] : ['Annonce trop basse']));
            };
            go.onclick = () => { g.send({ type: 'bid', q: pick.q, f: pick.f }); sfx.pop(); };
            refresh();
            parts.push(h('div', { class: 'panel col' },
              h('p', { class: 'center' }, h('b', null, 'À toi ! '), 'Combien de dés de cette valeur y a-t-il sur toute la table ?'),
              h('div', { class: 'row', style: { justifyContent: 'center' } },
                h('button', { class: 'icon-btn', 'aria-label': 'Moins', onclick: () => { pick.q = Math.max(1, pick.q - 1); refresh(); } }, '−'),
                qty,
                h('button', { class: 'icon-btn', 'aria-label': 'Plus', onclick: () => { pick.q = Math.min(v.total, pick.q + 1); refresh(); } }, '+')),
              faces,
              h('div', { class: 'row' }, go),
              v.bid ? h('button', { class: 'btn btn-bad btn-big btn-block', onclick: () => { g.send({ type: 'call' }); buzz([60, 40, 100]); } }, `🤥 Menteur ! (contre ${g.nameOf(v.bid.pid)})`) : null));
          } else {
            parts.push(h('p', { class: 'status-line' }, `⏳ ${g.nameOf(v.turn)} réfléchit…`));
          }
        } else if (v.phase === 'reveal') {
          parts.push(revealBox(v));
          parts.push(g.isHost ? h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => g.send({ type: 'next' }) }, 'Manche suivante →') : h('p', { class: 'status-line' }, '⏳ L\'hôte lance la manche suivante…'));
        }
        box.replaceChildren(...parts);
      },
      destroy() {},
    };

    function revealBox(v) {
      const r = v.result;
      if (!r) return null;
      const match = (d) => d === r.f || (v.jokers && d === 1);
      return h('div', { class: 'panel col' },
        h('p', { class: 'center' }, h('b', null, g.nameOf(r.caller)), ' a crié « Menteur ! » à ', h('b', null, g.nameOf(r.bidder)), ' qui annonçait ', bidText(r)),
        h('h3', { class: 'center' }, `Il y avait ${r.count} ×`, dieFace(r.f, 'xs'), v.jokers ? ' (jokers compris)' : ''),
        h('p', { class: 'center', style: { color: r.bidOk ? 'var(--ok)' : 'var(--bad)', fontWeight: '800' } },
          r.bidOk ? `L'annonce était juste : ${g.nameOf(r.loser)} perd un dé` : `L'annonce était fausse : ${g.nameOf(r.loser)} perd un dé`, r.eliminated ? ' et il est éliminé ☠️' : ''),
        ...Object.entries(r.rolls).filter(([, d]) => d.length).map(([pid, d]) => h('div', { class: 'liar-roll' }, h('b', null, g.nameOf(pid)),
          h('div', { class: 'dice-row', style: { justifyContent: 'flex-start', gap: '6px' } }, d.map((x) => dieFace(x, 'xs' + (match(x) ? ' hl' : ' dim')))))));
    }
  },
};
