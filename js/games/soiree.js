// Versions « un seul téléphone » : Le Curseur, Dans l'ordre !, Chifoumi (contre le téléphone).
import { h, topbar, pick, rand } from '../ui.js';
import { get, set, sip } from '../store.js';
import { onlineBanner } from '../common.js';
import { sfx, buzz } from '../sfx.js';
import { rankList, scaleEl, cursorPoints, ordreQuestion, CHI, beats } from '../online/soiree.js';
import { fmtYear } from '../data/ordre.js';
import CURSEUR from '../data/curseur.js';

const rulesPanel = (meta) => h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r })));

// ---------------- Le Curseur ----------------
export const curseur = {
  start(ctx) {
    const { root, meta } = ctx;
    const setup = () => root.replaceChildren(topbar(ctx),
      onlineBanner(ctx, 'curseur', { text: 'Celui qui donne l\'indice voit la cible sur son téléphone, chacun place son propre curseur sur le sien.' }),
      h('div', { class: 'section-title' }, 'Ou sur un seul téléphone'), rulesPanel(meta), h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: round }, '🎚️ Jouer'));
    function round() {
      const pair = pick(CURSEUR);
      const target = Math.round(rand(6, 94));
      const top = topbar(ctx, { onBack: setup });
      root.replaceChildren(top, h('div', { class: 'big-center' }, h('div', { class: 'hero-emo' }, '🙈'), h('h2', null, 'Seul celui qui donne l\'indice regarde !'),
        h('p', { class: 'muted' }, 'Les autres détournent les yeux.'),
        h('button', { class: 'btn btn-primary btn-big', onclick: () => {
          root.replaceChildren(top, h('div', { class: 'col' }, h('h2', { class: 'center' }, 'Ta cible secrète'), scaleEl(pair, { target }),
            h('p', { class: 'muted center' }, 'Trouve un indice qui se place à peu près là. Puis cache l\'écran !'),
            h('button', { class: 'btn btn-primary btn-big btn-block', onclick: guess }, '🙈 J\'ai mon indice, cacher')));
        } }, '👀 Voir la cible')));
      function guess() {
        const range = h('input', { type: 'range', min: '0', max: '100', value: '50', class: 'scale-range' });
        root.replaceChildren(top, h('div', { class: 'col' }, h('h2', { class: 'center' }, 'Dis ton indice à voix haute !'), scaleEl(pair),
          h('p', { class: 'muted center' }, 'Le groupe se met d\'accord et place le curseur :'), range,
          h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => reveal(Number(range.value)) }, '👀 Révéler')));
      }
      function reveal(v) {
        const pts = cursorPoints(Math.abs(v - target));
        pts >= 3 ? sfx.fanfare() : pts ? sfx.ok() : sfx.bad();
        root.replaceChildren(top, h('div', { class: 'col' }, scaleEl(pair, { target, marks: [{ v, label: 'Vous', me: true }] }),
          h('h2', { class: 'center' }, pts === 4 ? '🎯 Dans le mille ! 4 points' : pts ? `${pts} point${pts > 1 ? 's' : ''}` : `Raté ! Tout le monde prend ${sip(1)}`),
          h('button', { class: 'btn btn-primary btn-big btn-block', onclick: round }, 'Tour suivant →')));
      }
    }
    setup();
  },
};

// ---------------- Dans l'ordre ! ----------------
export const ordre = {
  start(ctx) {
    const { root, meta } = ctx;
    const setup = () => root.replaceChildren(topbar(ctx),
      onlineBanner(ctx, 'ordre', { text: 'Chacun classe les événements sur son téléphone, le plus rapide sans faute gagne un bonus.' }),
      h('div', { class: 'section-title' }, 'Ou sur un seul téléphone'), rulesPanel(meta), h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => question(0, 0) }, '📅 Jouer'));
    function question(n, total) {
      const items = ordreQuestion();
      const sol = items.map((e, i) => [e[1], i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
      let order = [];
      const top = topbar(ctx, { onBack: setup });
      const draw = () => root.replaceChildren(top, h('div', { class: 'row' }, h('span', { class: 'pill' }, `📅 Question ${n + 1}`), h('div', { class: 'grow' }), h('span', { class: 'pill' }, `⭐ ${total}`)),
        h('p', { class: 'center' }, h('b', null, 'Du plus ancien au plus récent :')),
        rankList(items.map((e) => e[0]), order, (o) => { order = o; draw(); }),
        h('div', { class: 'grow' }),
        h('button', { class: 'btn btn-primary btn-big btn-block', disabled: order.length < 4, onclick: reveal }, '👀 Vérifier'));
      function reveal() {
        const ok = order.filter((x, k) => sol[k] === x).length;
        ok === 4 ? sfx.fanfare() : ok ? sfx.ok() : sfx.bad();
        buzz(30);
        root.replaceChildren(top, h('h2', { class: 'center' }, ok === 4 ? '🎉 Parfait !' : `${ok}/4 bien placés`),
          rankList(sol.map((i) => items[i][0]), [0, 1, 2, 3], () => {}, { disabled: true, labels: sol.map((i) => fmtYear(items[i][1])) }),
          ok < 2 ? h('p', { class: 'center muted' }, `Moins de 2 bons : ${sip(1)} !`) : null,
          h('div', { class: 'grow' }),
          h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => question(n + 1, total + ok) }, 'Question suivante →'));
      }
      draw();
    }
    setup();
  },
};

// ---------------- Chifoumi contre le téléphone ----------------
export const chifoumi = {
  start(ctx) {
    const { root, meta } = ctx;
    const setup = () => root.replaceChildren(topbar(ctx),
      onlineBanner(ctx, 'chifoumi', { text: 'Tout le monde joue en même temps, chacun contre tous : 1 point par joueur battu.' }),
      h('div', { class: 'section-title' }, 'Ou contre le téléphone'), rulesPanel(meta),
      h('p', { class: 'center muted' }, `🏅 Record de victoires d'affilée : ${get('chi-record', 0)}`), h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => play(0, 0, 0) }, '✂️ Jouer'));
    function play(me, cpu, streak) {
      const top = topbar(ctx, { onBack: setup });
      const res = h('div', { class: 'col center' });
      root.replaceChildren(top, h('h2', { class: 'center' }, `Toi ${me} – ${cpu} Téléphone`), h('p', { class: 'center muted' }, 'Premier à 3 points !'), res, h('div', { class: 'grow' }),
        h('div', { class: 'chi-btns' }, CHI.map((c) => h('button', { class: 'chi-btn', onclick: () => go(c.id) }, h('span', { class: 'e' }, c.e), h('span', null, c.n)))));
      function go(choice) {
        const bot = pick(CHI).id;
        const w = beats(choice, bot) ? 1 : beats(bot, choice) ? -1 : 0;
        const e = (id) => CHI.find((x) => x.id === id).e;
        const m2 = me + (w > 0), c2 = cpu + (w < 0);
        w > 0 ? sfx.ok() : w < 0 ? sfx.bad() : sfx.pop();
        buzz(20);
        if (m2 >= 3 || c2 >= 3) {
          const won = m2 >= 3;
          const st = won ? streak + 1 : 0;
          if (st > get('chi-record', 0)) set('chi-record', st);
          won ? sfx.fanfare() : sfx.bad();
          root.replaceChildren(top, h('div', { class: 'big-center' }, h('div', { class: 'hero-emo' }, won ? '🏆' : '📱'), h('h2', null, won ? 'Tu as gagné !' : `Le téléphone gagne… ${sip(1)} !`),
            h('p', null, `${e(choice)} contre ${e(bot)} · ${m2} – ${c2}`), h('button', { class: 'btn btn-primary btn-big', onclick: () => play(0, 0, st) }, '🔁 Revanche')));
          return;
        }
        play(m2, c2, streak);
        root.querySelector('.col.center').replaceChildren(h('div', { style: { fontSize: '64px' } }, `${e(choice)} ${w > 0 ? '>' : w < 0 ? '<' : '='} ${e(bot)}`), h('b', null, w > 0 ? 'Gagné !' : w < 0 ? 'Perdu !' : 'Égalité !'));
      }
    }
    setup();
  },
};
