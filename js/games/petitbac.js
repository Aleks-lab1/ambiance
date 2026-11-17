// Petit bac : lettre + catégories + chrono.
import { h, topbar, seg, shuffle, pick, countdown, timerView, toggleRow } from '../ui.js';
import { get, set } from '../store.js';
import { sfx, buzz } from '../sfx.js';

const EASY = 'ABCDEFGHIJLMNOPRSTV';
const ALL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function start(ctx) {
  const { root, meta } = ctx;
  let timer = null;
  let anim = null;
  const opts = Object.assign({ count: 6, time: 120, hard: false }, get('petitbac', {}));
  const save = () => set('petitbac', opts);
  const dataP = import('../data/petitbac.js').then((m) => m.default);
  const used = [];

  function setup() {
    timer && timer.stop(); clearInterval(anim);
    root.replaceChildren(
      topbar(ctx),
      h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
      h('label', { class: 'field' }, 'Nombre de catégories', seg([4, 5, 6, 8].map((v) => ({ value: v, label: String(v) })), opts.count, (v) => { opts.count = v; save(); })),
      h('label', { class: 'field' }, 'Chrono', seg([60, 90, 120, 180].map((v) => ({ value: v, label: v < 120 ? v + ' s' : (v / 60) + ' min' })), opts.time, (v) => { opts.time = v; save(); })),
      toggleRow('Lettres difficiles', 'Inclure K, Q, U, W, X, Y, Z', opts.hard, (v) => { opts.hard = v; save(); }),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => dataP.then(round) }, '🔤 Tirer une lettre'));
  }

  function round(cats) {
    timer && timer.stop(); clearInterval(anim);
    const letters = (opts.hard ? ALL : EASY).split('');
    let avail = letters.filter((l) => !used.includes(l));
    if (!avail.length) { used.length = 0; avail = letters; }
    const letter = pick(avail);
    used.push(letter);
    const chosen = shuffle(cats.slice()).slice(0, opts.count);
    const big = h('div', { class: 'letter-big' }, '?');
    const top = topbar(ctx, { onBack: setup });
    root.replaceChildren(top, h('div', { class: 'big-center' }, big));
    let i = 0;
    anim = setInterval(() => {
      big.textContent = pick(letters);
      sfx.tick();
      if (++i > 14) {
        clearInterval(anim);
        big.textContent = letter;
        sfx.go(); buzz(60);
        setTimeout(() => play(letter, chosen, top), 500);
      }
    }, 80);
  }

  function play(letter, chosen, top) {
    const tv = timerView(opts.time);
    const stop = h('button', { class: 'btn btn-bad btn-big btn-block', onclick: () => end(true) }, '✋ STOP !');
    root.replaceChildren(top,
      h('div', { class: 'row' }, h('div', { class: 'letter-big', style: { fontSize: '84px' } }, letter), h('div', { class: 'grow' }, tv.el)),
      h('div', { class: 'cat-list' }, chosen.map((c) => h('span', null, c))),
      h('div', { class: 'grow' }),
      stop);
    timer = countdown({
      seconds: opts.time,
      onTick: (l, s, ch) => { if (!root.isConnected) { timer.stop(); return; } tv.set(l, opts.time * 1000); if (ch && s <= 5 && s > 0) sfx.tick(); },
      onEnd: () => end(false),
    });
    function end(manual) {
      timer.stop();
      sfx.bad(); buzz([200, 100, 200]);
      root.replaceChildren(top,
        h('div', { class: 'center col' }, h('div', { class: 'hero-emo' }, '✋'), h('h2', null, manual ? 'STOP ! Stylos en l\'air !' : 'Temps écoulé !')),
        h('div', { class: 'panel rules' },
          h('p', null, h('b', null, `Lettre ${letter}`), ' — Comptez les points :'),
          h('p', null, '✅ 2 points : réponse que personne d\'autre n\'a'),
          h('p', null, '🤝 1 point : réponse partagée avec un autre joueur'),
          h('p', null, '❌ 0 point : pas de réponse ou réponse refusée par le groupe')),
        h('div', { class: 'cat-list' }, chosen.map((c) => h('span', null, c))),
        h('div', { class: 'grow' }),
        h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => dataP.then(round) }, '🔤 Nouvelle lettre'));
    }
  }

  setup();
  return () => { timer && timer.stop(); clearInterval(anim); };
}
