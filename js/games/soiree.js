// Versions « un seul téléphone » : Le Curseur, Dans l'ordre !, Chifoumi (contre le téléphone).
import { h, topbar, pick, rand } from '../ui.js';
import { get, set, sip } from '../store.js';
import { onlineBanner } from '../common.js';
import { sfx, buzz } from '../sfx.js';
import { scaleEl, scaleRange, cursorPoints, ordreQuestion, ORDRE_EDGES, CHI, beats, chiArena } from '../online/soiree.js';
import { sortList } from '../sortable.js';
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
        const range = scaleRange(50);
        root.replaceChildren(top, h('div', { class: 'col' }, h('h2', { class: 'center' }, 'Dis ton indice à voix haute !'),
          h('p', { class: 'muted center' }, 'Le groupe se met d\'accord et fait glisser le curseur sur l\'échelle :'), scaleEl(pair, { input: range }),
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
      const top = topbar(ctx, { onBack: setup });
      const list = sortList(items.map((e) => e[0]), ORDRE_EDGES);
      const title = h('h2', { class: 'center' }, 'Remets-les dans l\'ordre !');
      const hint = h('p', { class: 'center muted small' }, 'Fais glisser les cartes, du plus ancien (en haut) au plus récent (en bas).');
      const foot = h('div', { class: 'col' }, h('button', { class: 'btn btn-primary btn-big btn-block', onclick: reveal }, '👀 Vérifier'));
      root.replaceChildren(top, h('div', { class: 'row' }, h('span', { class: 'pill' }, `📅 Question ${n + 1}`), h('div', { class: 'grow' }), h('span', { class: 'pill' }, `⭐ ${total}`)),
        title, hint, list.el, h('div', { class: 'grow' }), foot);
      function reveal() {
        const ok = list.check(sol);
        foot.replaceChildren();
        hint.textContent = '';
        buzz(30);
        ok === 4 ? sfx.fanfare() : ok ? sfx.ok() : sfx.bad();
        title.textContent = ok === 4 ? '🎉 Parfait !' : `${ok}/4 bien placé${ok > 1 ? 's' : ''}`;
        // Les cartes mal placées glissent ensuite à leur vraie place, et les dates apparaissent.
        setTimeout(() => {
          if (!root.isConnected) return;
          list.settle(sol, items.map((e) => fmtYear(e[1])));
          if (ok < 4) sfx.swoosh();
          foot.replaceChildren(ok < 2 ? h('p', { class: 'center muted' }, `Moins de 2 bons : ${sip(1)} !`) : null,
            h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => question(n + 1, total + ok) }, 'Question suivante →'));
        }, ok === 4 ? 250 : 750);
      }
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
      const score = h('h2', { class: 'center' }, `Toi ${me} – ${cpu} Téléphone`);
      const msg = h('p', { class: 'center muted' }, 'Premier à 3 points !');
      const arena = chiArena('Toi', 'Téléphone');
      let busy = false;
      const btns = h('div', { class: 'chi-btns' }, CHI.map((c) => h('button', { class: 'chi-btn', onclick: () => go(c.id) }, h('span', { class: 'e' }, c.e), h('span', null, c.n))));
      root.replaceChildren(top, score, msg, arena.el, h('div', { class: 'grow' }), btns);
      async function go(choice) {
        if (busy) return;
        busy = true;
        btns.classList.add('wait');
        const bot = pick(CHI).id;
        await arena.count();
        if (!root.isConnected) return;
        const w = beats(choice, bot) ? 1 : beats(bot, choice) ? -1 : 0;
        arena.show(choice, bot, w);
        me += w > 0; cpu += w < 0;
        w > 0 ? sfx.ok() : w < 0 ? sfx.bad() : sfx.pop();
        buzz(20);
        score.textContent = `Toi ${me} – ${cpu} Téléphone`;
        msg.textContent = w > 0 ? 'Gagné !' : w < 0 ? 'Perdu !' : 'Égalité, on rejoue !';
        if (me >= 3 || cpu >= 3) {
          const won = me >= 3;
          const st = won ? streak + 1 : 0;
          if (st > get('chi-record', 0)) set('chi-record', st);
          setTimeout(() => {
            if (!root.isConnected) return;
            won ? sfx.fanfare() : sfx.bad();
            root.replaceChildren(top, h('div', { class: 'big-center' }, h('div', { class: 'hero-emo' }, won ? '🏆' : '📱'), h('h2', null, won ? 'Tu as gagné !' : `Le téléphone gagne… ${sip(1)} !`),
              h('p', null, `${me} – ${cpu}`), h('button', { class: 'btn btn-primary btn-big', onclick: () => play(0, 0, st) }, '🔁 Revanche')));
          }, 1100);
          return;
        }
        busy = false;
        btns.classList.remove('wait');
      }
    }
    setup();
  },
};
