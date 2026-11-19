// 3 en 5 secondes.
import { h, topbar } from '../ui.js';
import { onlineBanner } from '../common.js';
import { makeDeck, sip, getPlayers } from '../store.js';
import { playersPanel } from '../players.js';
import { sfx, buzz } from '../sfx.js';

export function start(ctx) {
  const { root, meta } = ctx;
  let iv = null;
  const dataP = import('../data/cinq.js').then((m) => m.default);

  function setup() {
    clearInterval(iv);
    root.replaceChildren(
      topbar(ctx),
      onlineBanner(ctx, 'cinq', { text: 'Le chrono s\'affiche sur tous les téléphones et les autres jugent sur le leur.' }),
      h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
      playersPanel(0),
      h('p', { class: 'muted small' }, 'Avec une liste de joueurs, l\'appli désigne qui joue et compte les points.'),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => dataP.then(play) }, '▶ Commencer'));
  }

  function play(prompts) {
    const deck = makeDeck('cinq', prompts);
    const players = getPlayers();
    const scores = Object.fromEntries(players.map((p) => [p, 0]));
    let turn = Math.floor(Math.random() * Math.max(1, players.length));
    const top = topbar(ctx, { onBack: setup });

    function card() {
      clearInterval(iv);
      const p = players.length ? players[turn % players.length] : null;
      const q = deck.next();
      root.replaceChildren(top,
        h('div', { class: 'qcard anim' },
          p ? h('div', { class: 'who' }, p) : null,
          h('div', { class: 'kicker' }, 'Cite 3…'),
          h('div', { class: 'big' }, q)),
        h('div', { class: 'card-nav' },
          h('button', { class: 'btn btn-soft', 'aria-label': 'Autre consigne', onclick: card }, '🔄'),
          h('button', { class: 'btn btn-primary btn-big', onclick: () => go(p, q) }, '⏱ Go ! 5 secondes')));
      sfx.swoosh();
    }

    function go(p, q) {
      let n = 5;
      const num = h('div', { class: 'countdown-num' }, '5');
      root.replaceChildren(top, h('div', { class: 'panel center' }, h('b', null, 'Cite 3 : '), q), h('div', { class: 'big-center' }, num));
      sfx.beep();
      iv = setInterval(() => {
        if (!root.isConnected) { clearInterval(iv); return; }
        n--;
        if (n > 0) { num.textContent = String(n); num.style.animation = 'none'; void num.offsetWidth; num.style.animation = ''; sfx.beep(); return; }
        clearInterval(iv);
        sfx.bad(); buzz([200, 80, 200]);
        root.replaceChildren(top, h('div', { class: 'big-center' },
          h('div', { class: 'hero-emo' }, '⏰'), h('h2', null, 'Temps écoulé !'),
          h('p', { class: 'muted' }, p ? `${p} a-t-il réussi ?` : 'Réussi ou raté ?'),
          h('div', { class: 'answer-btns', style: { width: '100%' } },
            h('button', { class: 'btn btn-bad btn-big', onclick: () => result(p, false) }, '❌ Raté'),
            h('button', { class: 'btn btn-ok btn-big', onclick: () => result(p, true) }, '✅ Réussi'))));
      }, 1000);
    }

    function result(p, ok) {
      if (p && ok) scores[p]++;
      ok ? sfx.ok() : sfx.bad();
      root.replaceChildren(top, h('div', { class: 'big-center' },
        h('div', { class: 'hero-emo' }, ok ? '🎉' : '🍹'),
        h('h2', null, ok ? 'Bien joué !' : `Raté ! ${sip(1)} pour ${p || 'toi'}`),
        players.length ? h('div', { class: 'scoreboard', style: { width: '100%' } }, Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([n, s]) => h('div', { class: 'score-row' }, h('span', { class: 'n' }, n), h('span', { class: 's' }, String(s))))) : null,
        h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => { turn++; card(); } }, 'Suivant →')));
    }
    card();
  }

  setup();
  return () => clearInterval(iv);
}
