// Jeux avec un paquet de 52 cartes : Plus ou moins, Le Bus.
import { h, topbar, shuffle } from '../ui.js';
import { onlineBanner } from '../common.js';
import { get, set, getPlayers, sip, drinks } from '../store.js';
import { playersPanel } from '../players.js';
import { sfx, buzz } from '../sfx.js';

export const SUITS = [
  { s: '♥', n: 'Cœur', red: true }, { s: '♦', n: 'Carreau', red: true },
  { s: '♣', n: 'Trèfle', red: false }, { s: '♠', n: 'Pique', red: false },
];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R', 'A']; // valeur = index + 2 (As = 14)

export function newDeck() {
  const d = [];
  for (const su of SUITS) RANKS.forEach((r, i) => d.push({ r, v: i + 2, ...su }));
  return shuffle(d);
}
function makeDealer() {
  let deck = newDeck();
  return { draw() { if (!deck.length) deck = newDeck(); return deck.pop(); }, get left() { return deck.length; } };
}

/** Une carte à jouer dessinée en CSS. */
export function cardEl(c, cls = '') {
  if (!c) return h('div', { class: 'pc back ' + cls, 'aria-label': 'Carte retournée' });
  return h('div', { class: 'pc ' + (c.red ? 'red ' : '') + cls, 'aria-label': `${c.r} de ${c.n}` },
    h('span', { class: 'tl' }, c.r, h('br'), c.s), h('span', { class: 'mid' }, c.s), h('span', { class: 'br' }, c.r, h('br'), c.s));
}

/**
 * Carte qui se retourne en 3D (le dos d'abord, puis la face) : front et back sont deux cartes de même taille.
 * Utilisée pour chaque nouvelle carte tirée (Plus ou moins, Le Bus, Le Roi, en local et en ligne).
 */
export function flip3(front, back) {
  back.classList.add('f3-back');
  front.classList.add('f3-front');
  return h('div', { class: 'flip3' }, h('div', { class: 'flip3-in' }, back, front));
}
/** Nouvelle carte tirée : elle arrive face cachée et se retourne. */
export const revealCard = (c, cls = '') => flip3(cardEl(c, cls), cardEl(null, cls.replace(/\b(good|bad|next)\b/g, '')));

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const who = (players, turn) => (players.length ? players[turn % players.length] : null);

// =====================================================================
// PLUS OU MOINS
// =====================================================================
export const plusmoins = {
  start(ctx) {
    const { root, meta } = ctx;
    function setup() {
      root.replaceChildren(topbar(ctx),
        onlineBanner(ctx, 'plusmoins', { text: 'Le joueur dont c\'est le tour choisit sur son téléphone, les autres suivent la partie sur le leur.' }),
        h('div', { class: 'section-title' }, 'Ou sur un seul téléphone'),
        h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
        playersPanel(0),
        h('p', { class: 'center muted' }, `🏅 Record : ${get('pm-record', 0)} cartes d'affilée`),
        h('div', { class: 'grow' }),
        h('button', { class: 'btn btn-primary btn-big btn-block', onclick: play }, '🃏 Distribuer'));
    }
    function play() {
      const dealer = makeDealer();
      const players = getPlayers();
      let turn = 0;
      let cur = dealer.draw();
      let streak = 0;
      let busy = false;
      const status = h('h2', { class: 'center' });
      const sub = h('p', { class: 'center muted' });
      const table = h('div', { class: 'pc-table' });
      const trail = h('div', { class: 'pc-trail' });
      const btnPlus = h('button', { class: 'btn btn-ok btn-big' }, '⬆️ Plus');
      const btnMoins = h('button', { class: 'btn btn-bad btn-big' }, '⬇️ Moins');
      const passBtn = h('button', { class: 'btn btn-soft btn-block hidden' }, '');
      root.replaceChildren(topbar(ctx, { onBack: setup }), status, sub, table, trail, h('div', { class: 'grow' }), h('div', { class: 'answer-btns' }, btnMoins, btnPlus), passBtn);

      function render(next = null, ok = null) {
        const p = who(players, turn);
        status.textContent = p ? `Au tour de ${p}` : 'Plus ou moins ?';
        sub.textContent = streak ? `🔥 ${streak} d'affilée — si tu rates, tu prends ${sip(streak + 1)}` : 'La prochaine carte sera-t-elle plus haute ou plus basse ?';
        table.replaceChildren(cardEl(cur, 'big'), next ? revealCard(next, 'big ' + (ok ? 'good' : 'bad')) : cardEl(null, 'big'));
        passBtn.classList.toggle('hidden', !(players.length > 1 && streak >= 3 && !next));
        passBtn.textContent = `✋ Passer la main à ${who(players, turn + 1)} (série de ${streak} gagnée !)`;
      }
      function guess(up) {
        if (busy) return;
        busy = true;
        const next = dealer.draw();
        // Égalité = perdu (sinon ce serait trop facile !).
        const ok = up ? next.v > cur.v : next.v < cur.v;
        render(next, ok);
        sfx.card();
        // Le verdict tombe quand la carte a fini de se retourner.
        setTimeout(() => {
          if (!root.isConnected) return;
          if (ok) {
            sfx.ok(); buzz(20);
            trail.append(cardEl(cur, 'mini pop-in'));
          } else {
            sfx.bad(); buzz([150, 60, 150]);
            const p = who(players, turn);
            sub.textContent = `❌ ${next.v === cur.v ? 'Égalité, c\'est perdu !' : 'Raté !'} ${p ? p + ' ' + drinks(streak + 1) : cap(sip(streak + 1))} !`;
          }
        }, 420);
        if (ok) { streak++; if (streak > get('pm-record', 0)) set('pm-record', streak); }
        setTimeout(() => {
          if (!root.isConnected) return;
          if (!ok) { streak = 0; turn++; trail.replaceChildren(); }
          cur = next;
          busy = false;
          render();
        }, ok ? 1200 : 2400);
      }
      btnPlus.onclick = () => guess(true);
      btnMoins.onclick = () => guess(false);
      passBtn.onclick = () => { streak = 0; turn++; trail.replaceChildren(); sfx.pop(); render(); };
      render();
    }
    setup();
  },
};

// =====================================================================
// LE BUS
// =====================================================================
export const STEPS = [
  { q: 'Rouge ou noir ?', opts: [{ id: 'rouge', label: '🟥 Rouge' }, { id: 'noir', label: '⬛ Noir' }] },
  { q: 'Plus ou moins que la 1re carte ?', opts: [{ id: 'plus', label: '⬆️ Plus' }, { id: 'moins', label: '⬇️ Moins' }] },
  { q: 'Entre les deux ou à l\'extérieur ?', opts: [{ id: 'entre', label: '↔️ Entre' }, { id: 'dehors', label: '⬅️➡️ Dehors' }] },
  { q: 'Quelle couleur ?', opts: SUITS.map((su) => ({ id: su.s, label: `${su.s} ${su.n}` })) },
];

export function stepOk(step, cards, c) {
  if (step === 0) return the(c.red ? 'rouge' : 'noir');
  if (step === 1) return (choice) => (choice === 'plus' ? c.v > cards[0].v : c.v < cards[0].v);
  if (step === 2) {
    const lo = Math.min(cards[0].v, cards[1].v), hi = Math.max(cards[0].v, cards[1].v);
    return (choice) => (choice === 'entre' ? c.v > lo && c.v < hi : c.v < lo || c.v > hi);
  }
  return the(c.s);
}
function the(v) { return (choice) => choice === v; }

export const bus = {
  start(ctx) {
    const { root, meta } = ctx;
    function setup() {
      root.replaceChildren(topbar(ctx),
        onlineBanner(ctx, 'bus', { text: 'Chacun monte dans le bus à son tour et répond sur son téléphone, les autres regardent.' }),
        h('div', { class: 'section-title' }, 'Ou sur un seul téléphone'),
        h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
        playersPanel(0),
        h('div', { class: 'grow' }),
        h('button', { class: 'btn btn-primary btn-big btn-block', onclick: play }, '🚌 Monter dans le bus'));
    }
    function play() {
      const dealer = makeDealer();
      const players = getPlayers();
      let turn = 0;
      let step = 0;
      let cards = [];
      let tries = 1;
      let busy = false;
      const status = h('h2', { class: 'center' });
      const sub = h('p', { class: 'center muted' });
      const prog = h('div', { class: 'bus-steps' });
      const table = h('div', { class: 'pc-table four' });
      const btns = h('div', { class: 'col' });
      root.replaceChildren(topbar(ctx, { onBack: setup }), status, prog, table, sub, h('div', { class: 'grow' }), btns);

      function render(fresh = -1) {
        const p = who(players, turn);
        status.textContent = p ? `${p} est dans le bus 🚌` : 'Dans le bus 🚌';
        prog.replaceChildren(STEPS.map((s, i) => h('span', { class: 'bus-step' + (i < step ? ' done' : i === step ? ' cur' : '') }, String(i + 1))));
        table.replaceChildren(...[0, 1, 2, 3].map((i) => (cards[i] ? (i === fresh ? revealCard(cards[i], 'mid-size') : cardEl(cards[i], 'mid-size')) : cardEl(null, 'mid-size' + (i === step ? ' next' : '')))));
        sub.textContent = `Étape ${step + 1}/4 : ${STEPS[step].q}${tries > 1 ? ` · essai n°${tries}` : ''}`;
        btns.replaceChildren(h('div', { class: 'answer-btns' + (step === 3 ? ' four-opts' : '') },
          STEPS[step].opts.map((o) => h('button', { class: 'btn btn-big ' + (o.id === 'rouge' || o.id === '♥' || o.id === '♦' ? 'btn-bad' : 'btn-soft'), onclick: () => answer(o.id) }, o.label))));
      }
      function answer(choice) {
        if (busy) return;
        busy = true;
        const c = dealer.draw();
        cards[step] = c;
        const ok = stepOk(step, cards, c)(choice);
        render(step);
        btns.replaceChildren();
        sfx.card();
        setTimeout(() => { if (root.isConnected) { if (ok) { sfx.ok(); buzz(20); } else { sfx.bad(); buzz([150, 60, 150]); } } }, 420);
        if (ok) {
          if (step === 3) {
            setTimeout(() => { sfx.fanfare(); buzz([40, 30, 40, 30, 120]); }, 600);
            const p = who(players, turn);
            sub.textContent = `🎉 ${p ? p + ' descend' : 'Tu descends'} du bus en ${tries} essai${tries > 1 ? 's' : ''} ! ${players.length ? 'Il ou elle distribue ' + sip(4) + '.' : ''}`;
            btns.replaceChildren(h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => { turn++; step = 0; cards = []; tries = 1; busy = false; render(); } },
              players.length > 1 ? `Au tour de ${who(players, turn + 1)} →` : '🚌 Remonter dans le bus'));
            return;
          }
          step++;
          setTimeout(() => { if (root.isConnected) { busy = false; render(); } }, 1000);
        } else {
          const p = who(players, turn);
          sub.textContent = `❌ Raté ! ${p ? p + ' ' + drinks(step + 1) : cap(sip(step + 1))} et on repart de zéro…`;
          setTimeout(() => { if (!root.isConnected) return; step = 0; cards = []; tries++; busy = false; render(); }, 2600);
        }
      }
      render();
    }
    setup();
  },
};
