// Ni oui ni non : tenir sans dire « oui » ni « non ».
import { h, topbar, seg, countdown, timerView } from '../ui.js';
import { onlineBanner } from '../common.js';
import { get, set, makeDeck, getPlayers, sip } from '../store.js';
import { playersPanel } from '../players.js';
import { sfx, buzz } from '../sfx.js';

export function start(ctx) {
  const { root, meta } = ctx;
  let timer = null;
  const opts = Object.assign({ time: 60 }, get('nioui', {}));
  const dataP = import('../data/nioui.js').then((m) => m.default);

  function setup() {
    timer && timer.stop();
    root.replaceChildren(
      topbar(ctx),
      onlineBanner(ctx, 'nioui', { text: 'Les questions arrivent sur le téléphone de celui qui interroge, et tous les autres ont un buzzer.' }),
      h('div', { class: 'section-title' }, 'Ou sur un seul téléphone'),
      h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r })), h('p', null, 'Mots interdits : oui, non, ouais, nan, si, ok… et les hochements de tête !')),
      playersPanel(0),
      h('label', { class: 'field' }, 'Temps à tenir', seg([30, 45, 60, 90].map((v) => ({ value: v, label: v + ' s' })), opts.time, (v) => { opts.time = v; set('nioui', opts); })),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => dataP.then(play) }, '▶ Commencer'));
  }

  function play(questions) {
    const deck = makeDeck('nioui', questions);
    const players = getPlayers();
    const scores = Object.fromEntries(players.map((p) => [p, 0]));
    let turn = 0;
    const top = topbar(ctx, { onBack: setup });

    function intro() {
      const victim = players.length ? players[turn % players.length] : null;
      const asker = players.length > 1 ? players[(turn + 1) % players.length] : null;
      root.replaceChildren(top, h('div', { class: 'big-center' },
        h('div', { class: 'hero-emo' }, '🙅'),
        h('p', { class: 'muted' }, 'Au tour de'),
        h('h2', { style: { fontSize: '40px' } }, victim || 'Joueur suivant'),
        h('p', { class: 'muted', style: { maxWidth: '32ch' } }, `${asker || 'Un autre joueur'} prend le téléphone et pose les questions, très vite ! Tiens ${opts.time} secondes sans dire oui ni non.`),
        h('button', { class: 'btn btn-primary btn-big', onclick: () => round(victim) }, 'C\'est parti !')));
    }

    function round(victim) {
      const tv = timerView(opts.time);
      const qEl = h('div', { class: 'big' }, deck.next());
      let n = 1;
      const countEl = h('span', { class: 'pill' }, '1 question');
      const card = h('div', { class: 'qcard anim', style: { minHeight: '0', cursor: 'pointer' } },
        h('div', { class: 'kicker' }, 'Pose cette question'), qEl, h('div', { class: 'foot' }, '👆 Touche la carte pour la question suivante'));
      card.onclick = () => {
        qEl.textContent = deck.next();
        n++;
        countEl.textContent = `${n} questions`;
        sfx.pop();
        card.classList.remove('anim'); void card.offsetWidth; card.classList.add('anim');
      };
      root.replaceChildren(
        h('div', { class: 'row' }, h('span', { class: 'pill' }, '🙅 ' + (victim || 'Joueur')), h('div', { class: 'grow' }), countEl),
        tv.el, card, h('div', { class: 'grow' }),
        h('button', { class: 'btn btn-bad btn-big btn-block', onclick: () => end(false) }, '😱 Oui ou non entendu !'));
      sfx.go();
      timer = countdown({
        seconds: opts.time,
        onTick: (l, s, ch) => { if (!root.isConnected) { timer.stop(); return; } tv.set(l, opts.time * 1000); if (ch && s <= 5 && s > 0) sfx.tick(); },
        onEnd: () => end(true),
      });
      let done = false;
      function end(won) {
        if (done) return;
        done = true;
        timer.stop();
        if (won) { sfx.fanfare(); buzz([60, 40, 100]); if (victim) scores[victim]++; } else { sfx.bad(); buzz([150, 80, 150]); }
        root.replaceChildren(top, h('div', { class: 'big-center' },
          h('div', { class: 'hero-emo' }, won ? '🏆' : '😱'),
          h('h2', null, won ? `${victim || 'Bravo'} a tenu ${opts.time} secondes !` : 'Perdu !'),
          h('p', null, won ? 'Imbattable ! +1 point.' : `${victim || 'Le joueur'} prend ${sip(2)}. Il a craqué après ${n} question${n > 1 ? 's' : ''}.`),
          players.length ? h('div', { class: 'scoreboard', style: { width: '100%' } }, Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([p, sc]) => h('div', { class: 'score-row' }, h('span', { class: 'n' }, p), h('span', { class: 's' }, String(sc))))) : null,
          h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => { turn++; intro(); } }, 'Joueur suivant →')));
      }
    }
    intro();
  }

  setup();
  return () => timer && timer.stop();
}
