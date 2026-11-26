// Jeux de cartes à jouer en ligne, chacun son tour : Le Roi, Plus ou moins, Le Bus.
// Le joueur dont c'est le tour joue sur son téléphone (l'hôte peut jouer à sa place), les autres regardent.
import { h, uid, shuffle, seg } from '../ui.js';
import { settings, sip } from '../store.js';
import { sfx, buzz } from '../sfx.js';
import { activePids, addScore, nextOn, endScreen, TV_PID, tvTurn, tvSplit, tvSay, tvStage } from './kit.js';
import { rule, RANKS as ROI_RANKS, SUITS as ROI_SUITS } from '../games/roi.js';
import { cardEl, newDeck, STEPS, stepOk, flip3, revealCard } from '../games/paquet.js';

const tourSeg = (st, set, label = 'Tours par joueur') => h('label', { class: 'field' }, label, seg([1, 2, 3].map((n) => ({ value: n, label: String(n) })), st.rounds, (v) => set({ rounds: v })));
const drawFrom = (s) => { if (!s.deck.length) s.deck = newDeck(); return s.deck.pop(); };
const head = (g, v, extra) => h('div', { class: 'row' }, h('span', { class: 'pill' }, `🎯 ${v.who === g.me ? 'À toi' : g.nameOf(v.who)}`), h('div', { class: 'grow' }), extra || null,
  v.total ? h('span', { class: 'pill' }, `Tour ${Math.min(v.turn, v.total)}/${v.total}`) : null);

// =====================================================================
// LE ROI
// =====================================================================
function roiCard(c) {
  const x = rule(c.r);
  return h('div', { class: 'playing-card' + (c.red ? ' red' : '') },
    h('div', { class: 'corner tl' }, c.r, h('br'), c.s), h('div', { class: 'mid' }, x.emoji), h('div', { class: 'corner br' }, c.r, h('br'), c.s));
}

export const roiOnline = {
  id: 'roi', name: 'Le Roi', short: 'Chacun pioche : une carte, une règle', emoji: '👑', minPlayers: 2,
  defaults: {},
  settingsForm() {
    return h('div', { class: 'col' },
      h('p', { class: 'muted small' }, 'Chacun pioche une carte sur son téléphone, à son tour. Celui qui tire le 4e Roi a perdu !'),
      h('details', null, h('summary', null, '📜 Les règles des cartes'),
        h('div', { class: 'col small' }, ROI_RANKS.map((r) => { const x = rule(r); return h('div', null, h('b', null, `${r} · ${x.emoji} ${x.t} : `), h('span', { class: 'muted' }, x.d)); }))));
  },
  init(room, st) {
    const order = shuffle(activePids(room));
    const deck = shuffle(ROI_RANKS.flatMap((r) => ROI_SUITS.map(([s, red]) => ({ r, s, red }))));
    return { gid: uid(), st, order, who: order[0], deck, kings: 0, card: null, by: null, n: 0, phase: 'draw' };
  },
  action(room, s, pid, a) {
    if (a.type !== 'draw' || s.phase !== 'draw' || (pid !== s.who && pid !== room.host)) return false;
    s.card = s.deck.pop();
    s.by = s.who;
    s.n++;
    if (s.card.r === 'R') s.kings++;
    if (s.kings >= 4 || !s.deck.length) { s.phase = 'end'; return true; }
    s.who = nextOn(room, s.order, s.who);
    return true;
  },
  onJoin(room, s, pid) { if (!s.order.includes(pid)) s.order.push(pid); },
  onLeave(room, s, pid) { if (pid === s.who) s.who = nextOn(room, s.order, s.who); },
  view(room, s) { return { gid: s.gid, n: s.n, phase: s.phase, who: s.who, card: s.card, by: s.by, kings: s.kings, left: s.deck.length }; },
  // Écran télé : la carte piochée se retourne en grand, sa règle à côté, les rois déjà sortis.
  tv(room, s) { return this.view(room, s, TV_PID); },
  tvMount(root, g) {
    const bar = h('div', { class: 'tv-bar' });
    const cardSlot = h('div', { class: 'tv-col', style: { alignItems: 'center' } });
    const info = h('div', { class: 'tv-col' });
    root.append(bar, tvSplit(cardSlot, info));
    let lastN = -1;
    return {
      update(r, v) {
        const fresh = v.n !== lastN;
        lastN = v.n;
        bar.replaceChildren(h('span', { class: 'pill' }, `🃏 ${v.left} cartes`), h('div', { class: 'grow' }),
          h('div', { class: 'tv-kings' }, [0, 1, 2, 3].map((i) => h('span', { class: i < v.kings ? 'on' : '' }, '👑'))));
        if (!fresh) return;
        const x = v.card ? rule(v.card.r) : null;
        cardSlot.replaceChildren(v.card ? flip3(roiCard(v.card), h('div', { class: 'playing-card back' })) : h('div', { class: 'playing-card back' }),
          v.card ? h('p', { class: 'tv-status' }, `Carte de ${g.nameOf(v.by)}`) : h('p', { class: 'tv-status' }, 'Le paquet est mélangé…'));
        if (v.phase === 'end') {
          info.replaceChildren(h('div', { class: 'tv-big-emo' }, '👑'), h('div', { class: 'tv-say' }, v.kings >= 4 ? 'LE 4e ROI !' : 'Plus de cartes !'),
            v.kings >= 4 ? h('p', { class: 'tv-status' }, settings.drink ? `${g.nameOf(v.by)} doit boire le verre du milieu ! 🍹` : `${g.nameOf(v.by)} doit réaliser le gage du Roi au complet !`) : null);
          sfx.boom();
          return;
        }
        info.replaceChildren(
          x ? h('div', { class: 'tv-card anim-late' }, h('div', { class: 'kicker' }, `${v.card.r} · ${x.emoji}`), h('div', { class: 'q' }, x.t), h('div', { class: 'foot' }, x.d)) : null,
          tvTurn('🎯', `Au tour de ${g.nameOf(v.who)}`, 'de piocher une carte'));
        if (v.card) { sfx.swoosh(); if (v.card.r === 'R') sfx.fanfare(); }
      },
      destroy() {},
    };
  },
  mount(root, g) {
    const main = h('div', { class: 'col' });
    root.append(main);
    let lastN = -1;
    return {
      update(r, v) {
        const fresh = v.n !== lastN;
        lastN = v.n;
        const byMe = v.by === g.me;
        const byName = g.nameOf(v.by);
        if (v.phase === 'end') {
          main.replaceChildren(h('div', { class: 'big-center' },
            h('div', { class: 'hero-emo' }, '👑'), h('h2', null, v.kings >= 4 ? 'LE 4e ROI !' : 'Plus de cartes !'),
            v.card ? roiCard(v.card) : null,
            v.kings >= 4 ? h('p', null, settings.drink
              ? (byMe ? 'Tu dois boire le verre du milieu ! 🍹' : `${byName} doit boire le verre du milieu ! 🍹`)
              : (byMe ? 'Tu dois réaliser le gage du Roi au complet !' : `${byName} doit réaliser le gage du Roi au complet !`)) : null),
          g.hostBar());
          if (fresh) { sfx.boom(); buzz(byMe ? [300, 100, 300, 100, 500] : [200, 100, 200]); }
          return;
        }
        const me = v.who === g.me;
        const x = v.card ? rule(v.card.r) : null;
        main.replaceChildren(
          h('div', { class: 'spread' }, h('span', { class: 'pill' }, `🃏 ${v.left} cartes`),
            h('div', { class: 'row', style: { gap: '6px', fontSize: '22px' } }, [0, 1, 2, 3].map((i) => h('span', { style: { opacity: i < v.kings ? 1 : 0.25 } }, '👑')))),
          v.card ? h('p', { class: 'center' }, byMe ? 'Ta carte' : ['Carte de ', h('b', null, byName)]) : h('p', { class: 'center muted' }, 'Le paquet est mélangé…'),
          v.card ? (fresh ? flip3(roiCard(v.card), h('div', { class: 'playing-card back' })) : roiCard(v.card)) : h('div', { class: 'playing-card back' }),
          x ? h('div', { class: 'panel center col' + (fresh ? ' anim-late' : '') }, h('h3', null, `${x.emoji} ${x.t}`), h('p', null, x.d)) : null,
          me || g.isHost
            ? h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => g.send({ type: 'draw' }) }, me ? '🃏 À toi : piocher une carte' : `🃏 Piocher pour ${g.nameOf(v.who)}`)
            : h('p', { class: 'status-line' }, `⏳ Au tour de ${g.nameOf(v.who)} de piocher`));
        if (fresh && v.card) {
          sfx.swoosh();
          if (v.card.r === 'R') { sfx.fanfare(); buzz(60); }
        }
        if (fresh && me) buzz([30, 30, 30]);
      },
      destroy() {},
    };
  },
};

// =====================================================================
// PLUS OU MOINS
// =====================================================================
export const plusmoinsOnline = {
  id: 'plusmoins', name: 'Plus ou moins', short: 'La carte suivante : plus haute ou plus basse ?', emoji: '🃏', minPlayers: 1,
  defaults: { rounds: 2 },
  settingsForm(st, set) {
    return h('div', { class: 'col' },
      h('p', { class: 'muted small' }, 'Chaque bonne réponse allonge ta série. Dès 3, tu peux encaisser ta série en points et passer la main. Si tu rates, tu perds la série et tu prends autant de pénalités que ta série + 1.'),
      tourSeg(st, set));
  },
  init(room, st) {
    const order = shuffle(activePids(room));
    const s = { gid: uid(), st, order, who: order[0], deck: newDeck(), streak: 0, trail: [], turn: 1, total: (st.rounds || 2) * order.length, n: 0, phase: 'guess', last: null };
    s.cur = drawFrom(s);
    return s;
  },
  action(room, s, pid, a) {
    if (pid !== s.who && pid !== room.host) return false;
    if (a.type === 'guess' && s.phase === 'guess') {
      const next = drawFrom(s);
      // Égalité = perdu (sinon ce serait trop facile !).
      const ok = a.up ? next.v > s.cur.v : next.v < s.cur.v;
      s.last = { next, ok, up: !!a.up };
      s.phase = 'show';
      s.until = Date.now() + (ok ? 900 : 2400);
      s.n++;
      if (ok) s.streak++;
      return true;
    }
    if (a.type === 'bank' && s.phase === 'guess' && s.streak >= 3) {
      addScore(room, s.who, s.streak);
      s.banked = { who: s.who, pts: s.streak };
      pmEndTurn(room, s);
      return true;
    }
    return false;
  },
  tick(room, s) {
    if (s.phase !== 'show' || Date.now() < s.until) return false;
    const ok = s.last.ok;
    if (ok) s.trail.push(s.cur);
    s.cur = s.last.next;
    s.last = null;
    s.banked = null;
    if (ok) s.phase = 'guess'; else pmEndTurn(room, s);
    return true;
  },
  onJoin(room, s, pid) { if (!s.order.includes(pid)) s.order.push(pid); },
  onLeave(room, s, pid) { if (pid === s.who && s.phase === 'guess') pmEndTurn(room, s); },
  view(room, s) { return { gid: s.gid, n: s.n, phase: s.phase, who: s.who, cur: s.cur, last: s.last, streak: s.streak, trail: s.trail, turn: s.turn, total: s.total, banked: s.banked }; },
  // Écran télé : les deux cartes en grand, la série en cours, la carte suivante qui se retourne.
  tv(room, s) { return this.view(room, s, TV_PID); },
  tvMount(root, g) {
    const bar = h('div', { class: 'tv-bar' });
    const turn = h('div');
    const table = h('div', { class: 'pc-table tv-table' });
    const trail = h('div', { class: 'pc-trail tv-trail' });
    const say = tvSay();
    const st = tvStage(root, bar, turn, h('div', { class: 'tv-fill' }, table, trail, say.el));
    let lastKey = null, whoKey = null;
    return {
      update(r, v) {
        if (st.end(r, v.phase === 'end')) { lastKey = whoKey = null; return; }
        const key = `${v.gid}:${v.n}:${v.phase}:${v.turn}`;
        if (key === lastKey) return;
        const N = g.nameOf(v.who);
        bar.replaceChildren(h('span', { class: 'pill' }, `🃏 Tour ${Math.min(v.turn, v.total)}/${v.total}`), h('div', { class: 'grow' }), v.streak ? h('span', { class: 'pill' }, `🔥 Série : ${v.streak}`) : null);
        if (whoKey !== v.who + ':' + v.turn) { whoKey = v.who + ':' + v.turn; turn.replaceChildren(tvTurn('🎯', `${N} joue`, 'Plus haute ou plus basse ?')); }
        const L = v.last;
        table.replaceChildren(cardEl(v.cur, 'tvc'), L ? revealCard(L.next, 'tvc ' + (L.ok ? 'good' : 'bad')) : cardEl(null, 'tvc'));
        trail.replaceChildren(...v.trail.map((c) => cardEl(c, 'tvc-mini')));
        if (L && !L.ok) say.set(`❌ ${L.next.v === v.cur.v ? 'Égalité, c\'est perdu !' : 'Raté !'} ${N} prend ${sip(v.streak + 1)}.`);
        else if (L) say.set(L.up ? '⬆️ Plus… ✅ Bien vu !' : '⬇️ Moins… ✅ Bien vu !');
        else if (v.banked) say.set(`💰 ${g.nameOf(v.banked.who)} a encaissé ${v.banked.pts} points !`);
        else say.set(v.streak ? `🔥 ${v.streak} d'affilée ! En cas d'erreur : ${sip(v.streak + 1)}` : '⬆️ Plus ou moins ? ⬇️');
        if (L) { sfx.card(); setTimeout(() => (L.ok ? sfx.ok() : sfx.bad()), 420); }
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
        if (v.phase === 'end') { main.replaceChildren(...endScreen(r, g, 'Fin de la partie !', h('p', { class: 'center muted' }, 'Points = séries encaissées.'))); lastKey = 'end'; return; }
        const key = `${v.gid}:${v.n}:${v.phase}:${v.turn}`;
        const me = v.who === g.me;
        const N = g.nameOf(v.who);
        const can = me || g.isHost;
        const L = v.last;
        let sub;
        if (L && !L.ok) sub = `❌ ${L.next.v === v.cur.v ? 'Égalité, c\'est perdu !' : 'Raté !'} ${me ? 'Tu prends' : N + ' prend'} ${sip(v.streak + 1)}.`;
        else if (L && L.ok) sub = '✅ Bien vu !';
        else if (v.banked && v.phase === 'guess') sub = `💰 ${v.banked.who === g.me ? 'Tu as encaissé' : g.nameOf(v.banked.who) + ' a encaissé'} ${v.banked.pts} points !`;
        else sub = v.streak ? `🔥 ${v.streak} d'affilée — en cas d'erreur : ${sip(v.streak + 1)}` : 'La prochaine carte sera-t-elle plus haute ou plus basse ?';
        const parts = [head(g, v),
          h('h2', { class: 'center' }, me ? 'À toi : plus ou moins ?' : `${N} joue`),
          h('p', { class: 'center muted' }, sub),
          h('div', { class: 'pc-table' }, cardEl(v.cur, 'big'), L ? (key !== lastKey ? revealCard(L.next, 'big ' + (L.ok ? 'good' : 'bad')) : cardEl(L.next, 'big ' + (L.ok ? 'good' : 'bad'))) : cardEl(null, 'big')),
          h('div', { class: 'pc-trail' }, v.trail.map((c) => cardEl(c, 'mini')))];
        if (v.phase === 'guess') {
          if (can) {
            parts.push(h('div', { class: 'answer-btns' },
              h('button', { class: 'btn btn-bad btn-big', onclick: () => { g.send({ type: 'guess', up: false }); sfx.pop(); } }, '⬇️ Moins'),
              h('button', { class: 'btn btn-ok btn-big', onclick: () => { g.send({ type: 'guess', up: true }); sfx.pop(); } }, '⬆️ Plus')));
            if (v.streak >= 3) parts.push(h('button', { class: 'btn btn-soft btn-block', onclick: () => g.send({ type: 'bank' }) }, `✋ Encaisser ${v.streak} points et passer la main`));
          } else parts.push(h('p', { class: 'status-line' }, `👀 ${N} choisit : plus ou moins ?`));
        }
        if (key !== lastKey) {
          if (L) { sfx.card(); setTimeout(() => { L.ok ? (sfx.ok(), buzz(20)) : (sfx.bad(), me && buzz([150, 60, 150])); }, 420); }
          else if (v.phase === 'guess' && me && v.streak === 0) { sfx.go(); buzz([30, 30, 30]); }
        }
        lastKey = key;
        main.replaceChildren(...parts);
      },
      destroy() {},
    };
  },
};
function pmEndTurn(room, s) {
  s.streak = 0;
  s.trail = [];
  s.turn++;
  if (s.turn > s.total) { s.phase = 'end'; return; }
  s.who = nextOn(room, s.order, s.who);
  s.phase = 'guess';
  s.n++;
}

// =====================================================================
// LE BUS
// =====================================================================
export const busOnline = {
  id: 'bus', name: 'Le Bus', short: '4 cartes à deviner pour descendre du bus', emoji: '🚌', minPlayers: 1,
  defaults: { rounds: 1 },
  settingsForm(st, set) {
    return h('div', { class: 'col' },
      h('p', { class: 'muted small' }, 'Devine 4 cartes d\'affilée pour descendre du bus. Une erreur = pénalité et retour au début. Moins tu fais d\'essais, plus tu marques (4 points du premier coup).'),
      tourSeg(st, set, 'Passages par joueur'));
  },
  init(room, st) {
    const order = shuffle(activePids(room));
    return { gid: uid(), st, order, who: order[0], deck: newDeck(), step: 0, cards: [], tries: 1, turn: 1, total: (st.rounds || 1) * order.length, n: 0, phase: 'play', last: null };
  },
  action(room, s, pid, a) {
    if (pid !== s.who && pid !== room.host) return false;
    if (a.type === 'answer' && s.phase === 'play' && STEPS[s.step].opts.some((o) => o.id === a.choice)) {
      const c = drawFrom(s);
      s.cards[s.step] = c;
      const ok = stepOk(s.step, s.cards, c)(a.choice);
      s.last = { ok, step: s.step };
      s.n++;
      if (ok && s.step === 3) {
        s.pts = Math.max(1, 5 - s.tries);
        addScore(room, s.who, s.pts);
        s.phase = 'won';
      } else if (ok) s.step++;
      else { s.phase = 'show'; s.until = Date.now() + 2400; }
      return true;
    }
    if (a.type === 'next' && s.phase === 'won') {
      s.turn++;
      if (s.turn > s.total) { s.phase = 'end'; return true; }
      s.who = nextOn(room, s.order, s.who);
      busReset(s);
      s.tries = 1;
      return true;
    }
    return false;
  },
  tick(room, s) {
    if (s.phase === 'show' && Date.now() >= s.until) { busReset(s); s.tries++; return true; }
    return false;
  },
  onJoin(room, s, pid) { if (!s.order.includes(pid)) s.order.push(pid); },
  onLeave(room, s, pid) {
    if (pid !== s.who || s.phase === 'end') return;
    s.who = nextOn(room, s.order, s.who);
    busReset(s);
    s.tries = 1;
  },
  view(room, s) { return { gid: s.gid, n: s.n, phase: s.phase, who: s.who, step: s.step, cards: s.cards, tries: s.tries, last: s.last, pts: s.pts, turn: s.turn, total: s.total }; },
  // Écran télé : les 4 cartes du bus en grand, l'étape en cours et la question posée.
  tv(room, s) { return this.view(room, s, TV_PID); },
  tvMount(root, g) {
    const bar = h('div', { class: 'tv-bar' });
    const turn = h('div');
    const steps = h('div', { class: 'bus-steps tv-steps' });
    const table = h('div', { class: 'pc-table four tv-table' });
    const say = tvSay();
    const st = tvStage(root, bar, turn, h('div', { class: 'tv-fill' }, steps, table, say.el));
    let lastKey = null, whoKey = null;
    return {
      update(r, v) {
        if (st.end(r, v.phase === 'end')) { lastKey = whoKey = null; return; }
        const key = `${v.gid}:${v.n}:${v.phase}`;
        if (key === lastKey) return;
        const N = g.nameOf(v.who);
        const shownStep = v.phase === 'show' ? v.last.step : v.step;
        const fresh = v.last && lastKey ? v.last.step : -1;
        bar.replaceChildren(h('span', { class: 'pill' }, `🚌 Passage ${Math.min(v.turn, v.total)}/${v.total}`), h('div', { class: 'grow' }), h('span', { class: 'pill' }, `Essai n°${v.tries}`));
        if (whoKey !== v.who + ':' + v.turn) { whoKey = v.who + ':' + v.turn; turn.replaceChildren(tvTurn('🚌', `${N} est dans le bus`, '4 cartes d\'affilée pour descendre')); }
        steps.replaceChildren(...STEPS.map((x, i) => h('span', { class: 'bus-step' + (i < v.step || v.phase === 'won' ? ' done' : i === v.step ? ' cur' : '') }, String(i + 1))));
        table.replaceChildren(...[0, 1, 2, 3].map((i) => (v.cards[i] ? (i === fresh ? revealCard(v.cards[i], 'tvc') : cardEl(v.cards[i], 'tvc')) : cardEl(null, 'tvc' + (i === v.step && v.phase === 'play' ? ' next' : '')))));
        if (v.phase === 'show') say.set(`❌ Raté ! ${N} prend ${sip(v.last.step + 1)} et repart de zéro…`);
        else if (v.phase === 'won') say.set(`🎉 ${N} descend du bus en ${v.tries} essai${v.tries > 1 ? 's' : ''} ! +${v.pts} point${v.pts > 1 ? 's' : ''}`);
        else say.set(`Étape ${shownStep + 1} : ${STEPS[shownStep].q}`);
        if (v.last && lastKey) {
          sfx.card();
          const ph = v.phase, ok = v.last.ok;
          setTimeout(() => { if (ph === 'won') sfx.fanfare(); else if (ph === 'show') sfx.bad(); else if (ok) sfx.ok(); }, 420);
        }
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
        if (v.phase === 'end') { main.replaceChildren(...endScreen(r, g, 'Tout le monde est descendu !', h('p', { class: 'center muted' }, '4 points pour une descente du premier coup, puis 3, 2, 1.'))); lastKey = 'end'; return; }
        const key = `${v.gid}:${v.n}:${v.phase}`;
        const me = v.who === g.me;
        const N = g.nameOf(v.who);
        const can = me || g.isHost;
        const shownStep = v.phase === 'show' ? v.last.step : v.step;
        const fresh = key !== lastKey && v.last ? v.last.step : -1; // carte qui vient d'être tirée : elle se retourne
        let sub = `Étape ${shownStep + 1}/4 : ${STEPS[shownStep].q}${v.tries > 1 ? ` · essai n°${v.tries}` : ''}`;
        if (v.phase === 'show') sub = `❌ Raté ! ${me ? 'Tu prends' : N + ' prend'} ${sip(v.last.step + 1)} et on repart de zéro…`;
        if (v.phase === 'won') sub = `🎉 ${me ? 'Tu descends' : N + ' descend'} du bus en ${v.tries} essai${v.tries > 1 ? 's' : ''} ! +${v.pts} point${v.pts > 1 ? 's' : ''}, et ${sip(4)} à distribuer.`;
        const parts = [head(g, v),
          h('h2', { class: 'center' }, me ? 'Tu es dans le bus 🚌' : `${N} est dans le bus 🚌`),
          h('div', { class: 'bus-steps' }, STEPS.map((x, i) => h('span', { class: 'bus-step' + (i < v.step || v.phase === 'won' ? ' done' : i === v.step ? ' cur' : '') }, String(i + 1)))),
          h('div', { class: 'pc-table four' }, [0, 1, 2, 3].map((i) => (v.cards[i] ? (i === fresh ? revealCard(v.cards[i], 'mid-size') : cardEl(v.cards[i], 'mid-size')) : cardEl(null, 'mid-size' + (i === v.step && v.phase === 'play' ? ' next' : ''))))),
          h('p', { class: 'center muted' }, sub)];
        if (v.phase === 'play') {
          if (can) {
            parts.push(h('div', { class: 'answer-btns' + (v.step === 3 ? ' four-opts' : '') },
              STEPS[v.step].opts.map((o) => h('button', { class: 'btn btn-big ' + (o.id === 'rouge' || o.id === '♥' || o.id === '♦' ? 'btn-bad' : 'btn-soft'), onclick: () => { g.send({ type: 'answer', choice: o.id }); sfx.pop(); } }, o.label))));
          } else parts.push(h('p', { class: 'status-line' }, `👀 ${N} réfléchit…`));
        }
        if (v.phase === 'won') {
          parts.push(can ? h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => g.send({ type: 'next' }) }, 'Joueur suivant →') : h('p', { class: 'status-line' }, `⏳ ${N} passe au joueur suivant…`));
        }
        if (key !== lastKey && v.last && v.n) {
          sfx.card();
          const ph = v.phase, ok = v.last.ok;
          setTimeout(() => { if (ph === 'won') { sfx.fanfare(); buzz([40, 30, 40, 30, 120]); } else if (ph === 'show') { sfx.bad(); if (me) buzz([150, 60, 150]); } else if (ok) { sfx.ok(); buzz(20); } }, 420);
        }
        lastKey = key;
        main.replaceChildren(...parts);
      },
      destroy() {},
    };
  },
};
function busReset(s) { s.step = 0; s.cards = []; s.last = null; s.phase = 'play'; s.n++; }
