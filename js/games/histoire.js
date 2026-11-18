// Histoire folle : on invente une histoire à tour de rôle en plaçant des mots imposés.
import { h, topbar, seg, pick, countdown, timerView, confirmBox } from '../ui.js';
import { get, set, makeDeck, sip } from '../store.js';
import { requirePlayers, playersPanel } from '../players.js';
import { sfx, buzz } from '../sfx.js';

export function start(ctx) {
  const { root, meta } = ctx;
  let timer = null;
  const opts = Object.assign({ time: 30 }, get('histoire', {}));
  const dataP = import('../data/histoire.js').then((m) => m.default);

  function setup() {
    timer && timer.stop();
    ctx.setGuard(null);
    root.replaceChildren(
      topbar(ctx),
      h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
      playersPanel(2),
      h('label', { class: 'field' }, 'Temps par joueur', seg([20, 30, 45].map((v) => ({ value: v, label: v + ' s' })), opts.time, (v) => { opts.time = v; set('histoire', opts); })),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: async () => { const pl = await requirePlayers(2); if (pl) play(pl, await dataP); } }, '📚 Commencer une histoire'));
  }

  function play(players, data) {
    ctx.setGuard('Abandonner l\'histoire en cours ?');
    const words = makeDeck('histoire', data.words);
    const starter = pick(data.starters);
    const chain = [];
    const fails = Object.fromEntries(players.map((p) => [p, 0]));
    let turn = 0;
    const top = topbar(ctx, { onBack: async () => { if (await confirmBox('Abandonner l\'histoire en cours ?')) setup(); } });
    const finishBtn = () => h('button', { class: 'btn btn-ghost btn-sm', onclick: summary }, '📜 Terminer l\'histoire');

    root.replaceChildren(top, h('div', { class: 'big-center' },
      h('div', { class: 'qcard anim', style: { minHeight: '0', width: '100%' } }, h('div', { class: 'kicker' }, 'L\'histoire commence ainsi…'), h('div', { class: 'big' }, starter)),
      h('p', { class: 'muted' }, `${players[0]} lit le début à voix haute, puis continue l'histoire !`),
      h('button', { class: 'btn btn-primary btn-big', onclick: turnScreen }, 'C\'est parti !')));

    function turnScreen() {
      timer && timer.stop();
      const p = players[turn % players.length];
      const w = words.next();
      const tv = timerView(opts.time);
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        timer.stop();
        chain.push({ p, w, ok });
        if (ok) { sfx.ok(); buzz(30); } else { fails[p]++; sfx.bad(); buzz([120, 60, 120]); }
        root.replaceChildren(top, h('div', { class: 'big-center' },
          h('div', { class: 'hero-emo' }, ok ? '✅' : '❌'),
          h('h2', null, ok ? `Bien placé, ${p} !` : `Raté ! ${p} prend ${sip(1)}.`),
          h('p', { class: 'muted' }, `Au tour de ${players[(turn + 1) % players.length]} de continuer.`),
          h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => { turn++; turnScreen(); } }, 'Continuer l\'histoire →'),
          finishBtn()));
      };
      root.replaceChildren(top,
        h('div', { class: 'row' }, h('span', { class: 'pill' }, '🗣️ ' + p), h('div', { class: 'grow' }), h('span', { class: 'pill' }, `Tour ${chain.length + 1}`)),
        tv.el,
        h('div', { class: 'word-card' }, h('div', { class: 'hint' }, `${p}, continue l'histoire en plaçant :`), h('div', { class: 'w' }, w)),
        h('div', { class: 'answer-btns' },
          h('button', { class: 'btn btn-bad btn-big', onclick: () => finish(false) }, '❌ Raté'),
          h('button', { class: 'btn btn-ok btn-big', onclick: () => finish(true) }, '✅ Placé !')),
        finishBtn());
      sfx.go();
      timer = countdown({
        seconds: opts.time,
        onTick: (l, s, ch) => { if (!root.isConnected) { timer.stop(); return; } tv.set(l, opts.time * 1000); if (ch && s <= 5 && s > 0) sfx.tick(); },
        onEnd: () => finish(false),
      });
    }

    function summary() {
      timer && timer.stop();
      ctx.setGuard(null);
      sfx.fanfare();
      root.replaceChildren(topbar(ctx, { onBack: setup }),
        h('div', { class: 'center' }, h('div', { class: 'hero-emo' }, '📜'), h('h2', null, 'Fin de l\'histoire !')),
        h('div', { class: 'panel col' }, h('p', null, h('b', null, starter)),
          h('p', { class: 'muted small' }, 'Les mots imposés, dans l\'ordre :'),
          h('div', { class: 'chips' }, chain.map((c) => h('span', { class: 'chip' + (c.ok ? ' on' : '') }, `${c.ok ? '✅' : '❌'} ${c.w} · ${c.p}`)))),
        h('div', { class: 'scoreboard' }, Object.entries(fails).sort((a, b) => b[1] - a[1]).map(([p, n]) => h('div', { class: 'score-row' }, h('span', { class: 'n' }, p), h('span', { class: 's' }, `${n} raté${n > 1 ? 's' : ''}`)))),
        h('div', { class: 'grow' }),
        h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => play(players, data) }, '📚 Nouvelle histoire'));
    }
  }

  setup();
  return () => timer && timer.stop();
}
