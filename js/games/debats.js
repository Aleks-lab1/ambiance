// Pour ou contre : débats absurdes chronométrés.
import { h, topbar, shuffle, countdown, timerView, seg } from '../ui.js';
import { get, set, makeDeck, drinks } from '../store.js';
import { requirePlayers, playersPanel } from '../players.js';
import { sfx, buzz } from '../sfx.js';

export function start(ctx) {
  const { root, meta } = ctx;
  let timer = null;
  const opts = Object.assign({ time: 45 }, get('debats', {}));
  const dataP = import('../data/debats.js').then((m) => m.default);

  function setup() {
    timer && timer.stop();
    root.replaceChildren(
      topbar(ctx),
      h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
      playersPanel(2),
      h('label', { class: 'field' }, 'Temps de parole', seg([30, 45, 60, 90].map((v) => ({ value: v, label: v + ' s' })), opts.time, (v) => { opts.time = v; set('debats', opts); })),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: async () => { const pl = await requirePlayers(2); if (pl) play(pl, await dataP); } }, '▶ Commencer'));
  }

  function play(players, topics) {
    const deck = makeDeck('debats', topics);
    const top = topbar(ctx, { onBack: setup });

    function newDebate() {
      timer && timer.stop();
      const topic = deck.next();
      const [pour, contre] = shuffle(players.slice());
      root.replaceChildren(top,
        h('div', { class: 'qcard anim', style: { minHeight: '220px' } }, h('div', { class: 'kicker' }, 'Le sujet'), h('div', { class: 'big' }, topic)),
        h('div', { class: 'answer-btns' },
          h('div', { class: 'panel center' }, h('div', { class: 'muted small' }, '👍 POUR'), h('h3', null, pour)),
          h('div', { class: 'panel center' }, h('div', { class: 'muted small' }, '👎 CONTRE'), h('h3', null, contre))),
        h('div', { class: 'grow' }),
        h('button', { class: 'btn btn-soft btn-block', onclick: newDebate }, '🔄 Autre sujet'),
        h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => speak(topic, pour, contre, 0) }, `🎤 ${pour} commence (POUR)`));
      sfx.swoosh();
    }

    function speak(topic, pour, contre, step) {
      const who = step === 0 ? pour : contre;
      const tv = timerView(opts.time);
      const nextBtn = h('button', { class: 'btn btn-primary btn-big btn-block' }, step === 0 ? `Au tour de ${contre} (CONTRE) →` : 'Passer au vote →');
      nextBtn.onclick = () => { timer.stop(); step === 0 ? speak(topic, pour, contre, 1) : vote(topic, pour, contre); };
      root.replaceChildren(top,
        h('div', { class: 'panel small' }, topic),
        h('div', { class: 'big-center' }, h('p', { class: 'muted' }, step === 0 ? '👍 POUR' : '👎 CONTRE'), h('h2', { style: { fontSize: '40px' } }, who), tv.el),
        nextBtn);
      sfx.go();
      timer = countdown({ seconds: opts.time, onTick: (l, s, ch) => { if (!root.isConnected) { timer.stop(); return; } tv.set(l, opts.time * 1000); if (ch && s <= 5 && s > 0) sfx.tick(); }, onEnd: () => { sfx.bad(); buzz([150, 80, 150]); } });
    }

    function vote(topic, pour, contre) {
      root.replaceChildren(top,
        h('div', { class: 'big-center' },
          h('div', { class: 'hero-emo' }, '🗳️'),
          h('h2', null, 'Qui a été le plus convaincant ?'),
          h('p', { class: 'muted' }, 'Votez à main levée !'),
          h('div', { class: 'col', style: { width: '100%' } },
            [pour, contre].map((w) => h('button', {
              class: 'btn btn-primary btn-big',
              onclick: () => {
                const loser = w === pour ? contre : pour;
                sfx.fanfare();
                root.replaceChildren(top, h('div', { class: 'big-center' },
                  h('div', { class: 'hero-emo' }, '🏆'), h('h2', null, `${w} remporte le débat !`),
                  h('p', null, `${loser} ${drinks(2)}.`),
                  h('button', { class: 'btn btn-primary btn-big btn-block', onclick: newDebate }, 'Débat suivant →')));
              },
            }, w)))));
    }
    newDebate();
  }

  setup();
  return () => timer && timer.stop();
}
