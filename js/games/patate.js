// Patate chaude : on répond et on passe avant l'explosion.
import { h, topbar, seg, rand } from '../ui.js';
import { get, set, makeDeck, sip } from '../store.js';
import { sfx, buzz } from '../sfx.js';

const DURATIONS = { court: [10, 25], normal: [20, 45], long: [35, 70] };

export function start(ctx) {
  const { root, meta } = ctx;
  let timers = [];
  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  const opts = Object.assign({ mode: 'categories', dur: 'normal' }, get('patate', {}));
  const dataP = import('../data/patate.js').then((m) => m.default);

  function setup() {
    clear();
    root.replaceChildren(
      topbar(ctx),
      h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
      h('label', { class: 'field' }, 'Type de thème', seg([
        { value: 'categories', label: 'Catégories' }, { value: 'syllabes', label: 'Syllabes' }, { value: 'lettres', label: 'Lettres' }, { value: 'mix', label: 'Mélange' },
      ], opts.mode, (v) => { opts.mode = v; set('patate', opts); })),
      h('label', { class: 'field' }, 'Durée de la mèche', seg([
        { value: 'court', label: 'Courte' }, { value: 'normal', label: 'Normale' }, { value: 'long', label: 'Longue' },
      ], opts.dur, (v) => { opts.dur = v; set('patate', opts); })),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => dataP.then(play) }, '💣 Allumer la mèche'));
  }

  function themeOf(data) {
    const mode = opts.mode === 'mix' ? ['categories', 'syllabes', 'lettres'][Math.floor(Math.random() * 3)] : opts.mode;
    if (mode === 'categories') return { kicker: 'Cite…', text: decks.categories.next() };
    if (mode === 'syllabes') return { kicker: 'Un mot qui contient', text: `« ${decks.syllabes.next()} »` };
    return { kicker: 'Un mot qui commence par', text: decks.lettres.next() };
  }
  let decks = null;

  function play(data) {
    decks = decks || {
      categories: makeDeck('patate:c', data.categories),
      syllabes: makeDeck('patate:s', data.syllabes),
      lettres: makeDeck('patate:l', data.lettres),
    };
    clear();
    const theme = themeOf(data);
    const bomb = h('div', { class: 'bomb' }, '💣');
    root.replaceChildren(topbar(ctx, { onBack: setup }),
      h('div', { class: 'qcard anim', style: { minHeight: '200px', flex: 'none' } }, h('div', { class: 'kicker' }, theme.kicker), h('div', { class: 'big' }, theme.text)),
      h('div', { class: 'big-center' }, bomb, h('p', { class: 'muted' }, 'Réponds puis passe le téléphone à ton voisin !')));
    sfx.go();
    const [a, b] = DURATIONS[opts.dur];
    const total = rand(a, b) * 1000;
    const t0 = Date.now();
    bomb.classList.add('shake');
    const loop = () => {
      if (!root.isConnected) return;
      const f = (Date.now() - t0) / total;
      if (f >= 1) return explode(theme);
      if (f > 0.65) bomb.classList.add('fast');
      Math.floor((Date.now() - t0) / 100) % 2 ? sfx.tick() : sfx.tock();
      timers.push(setTimeout(loop, Math.max(110, 620 - 520 * f)));
    };
    loop();
  }

  function explode() {
    clear();
    sfx.boom();
    buzz([400, 100, 400, 100, 600]);
    root.classList.add('flash-bg');
    timers.push(setTimeout(() => root.classList.remove('flash-bg'), 1900));
    root.replaceChildren(topbar(ctx, { onBack: setup }), h('div', { class: 'big-center' },
      h('div', { class: 'bomb', style: { animation: 'pop .5s ease' } }, '💥'),
      h('h2', { style: { fontSize: '44px' } }, 'BOUM !'),
      h('p', null, `Celui qui tient le téléphone a perdu et prend ${sip(2)} !`),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => dataP.then(play) }, '💣 Nouvelle manche')));
  }

  setup();
  return clear;
}
