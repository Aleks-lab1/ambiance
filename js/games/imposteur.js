// L'Imposteur : version un seul téléphone (on se le passe), + accès au mode en ligne.
import { h, topbar, seg, shuffle, confirmBox, toggleRow, countdown, timerView } from '../ui.js';
import { get, set, makeDeck } from '../store.js';
import { requirePlayers, playersPanel } from '../players.js';
import { sfx, buzz } from '../sfx.js';

export function start(ctx) {
  const { root, meta } = ctx;
  let alive = true;
  let timer = null;
  const opts = Object.assign({ impostors: 1, blank: false }, get('imposteur', {}));
  const save = () => set('imposteur', opts);
  const pairsP = import('../data/imposteur.js').then((m) => m.default);

  function setup() {
    ctx.setGuard(null);
    timer && timer.stop();
    root.replaceChildren(
      topbar(ctx),
      h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
      playersPanel(3),
      h('label', { class: 'field' }, 'Nombre d\'imposteurs', seg([1, 2, 3].map((v) => ({ value: v, label: String(v) })), opts.impostors, (v) => { opts.impostors = v; save(); })),
      toggleRow('🤐 Mode « Sans mot »', 'L\'imposteur ne reçoit aucun mot et le sait : il doit bluffer.', opts.blank, (v) => { opts.blank = v; save(); }),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: async () => { const pl = await requirePlayers(3); if (pl) round(pl, await pairsP); } }, '▶ Jouer en se passant le téléphone'),
      h('button', { class: 'btn btn-soft btn-block', onclick: () => ctx.open('online', { create: true, game: 'imposteur' }) }, '🌐 Jouer en ligne — chacun son téléphone'));
  }

  let deck = null;
  async function round(players, pairs) {
    ctx.setGuard('Quitter la partie en cours ?');
    deck = deck || makeDeck('imposteur', pairs);
    const pair = deck.next();
    const flip = Math.random() < 0.5;
    const civ = flip ? pair[0] : pair[1];
    const imp = flip ? pair[1] : pair[0];
    const n = Math.max(1, Math.min(opts.impostors, Math.floor((players.length - 1) / 2)));
    const imps = new Set(shuffle(players.slice()).slice(0, n));
    const order = shuffle(players.slice());
    const top = topbar(ctx, { onBack: async () => { if (await confirmBox('Quitter la partie en cours ?')) setup(); } });

    for (const p of order) {
      if (!alive) return;
      const w = imps.has(p) ? (opts.blank ? null : imp) : civ;
      await new Promise((res) => {
        const reveal = h('button', { class: 'secret-btn' }, h('div', { class: 'emo' }, '🔒'), `Je suis ${p}`, h('span', { class: 'muted small' }, 'Touche pour voir ton mot'));
        reveal.onclick = () => {
          sfx.pop();
          reveal.replaceWith(h('div', { class: 'col' },
            h('div', { class: 'secret-btn', style: { borderStyle: 'solid' } },
              w ? [h('span', { class: 'muted small' }, 'Ton mot secret'), h('div', { class: 'reveal-word' }, w)]
                : [h('div', { class: 'emo' }, '🤐'), h('b', null, 'Tu n\'as pas de mot !'), h('span', { class: 'muted small' }, 'Tu es l\'imposteur. Bluffe !')]),
            h('button', { class: 'btn btn-primary btn-big btn-block', onclick: res }, 'Cacher et passer le téléphone')));
        };
        root.replaceChildren(top, h('div', { class: 'big-center' },
          h('p', { class: 'muted' }, 'Passe le téléphone à'),
          h('h2', null, p),
          reveal));
      });
    }

    let starter = order.find((p) => !(opts.blank && imps.has(p))) || order[0];
    const tv = timerView(180);
    const timerBtn = h('button', { class: 'btn btn-soft' }, '⏱ Lancer un chrono de 3 min');
    timerBtn.onclick = () => {
      timerBtn.replaceWith(tv.el);
      timer = countdown({ seconds: 180, onTick: (l, s, ch) => { if (!root.isConnected) { timer.stop(); return; } tv.set(l, 180000); if (ch && s <= 5 && s > 0) sfx.tick(); }, onEnd: () => { sfx.bad(); buzz([200, 100, 200]); } });
    };
    root.replaceChildren(top,
      h('div', { class: 'center col' }, h('div', { class: 'hero-emo' }, '🗣️'), h('h2', null, 'Tout le monde a son mot !')),
      h('div', { class: 'panel rules' },
        h('p', null, h('b', null, starter), ' commence. Chacun à son tour dit ', h('b', null, 'un seul mot'), ' en rapport avec son mot secret.'),
        h('p', null, 'Faites 2 ou 3 tours, puis votez tous ensemble en pointant du doigt l\'imposteur.')),
      timerBtn,
      h('div', { class: 'grow' }),
      h('button', {
        class: 'btn btn-primary btn-big btn-block',
        onclick: async () => {
          if (!(await confirmBox('Vous avez voté ? On révèle tout ?', { ok: 'Révéler' }))) return;
          timer && timer.stop();
          sfx.end();
          root.replaceChildren(top,
            h('div', { class: 'role-card', style: { '--g1': '#3a3f8f', '--g2': '#9b3fd6' } },
              h('div', { class: 'emo' }, '🕵️'),
              h('p', null, `Imposteur${imps.size > 1 ? 's' : ''}`),
              h('h2', null, [...imps].join(', '))),
            h('div', { class: 'panel col' },
              h('div', { class: 'spread' }, h('span', null, '👥 Mot des civils'), h('b', null, civ)),
              h('div', { class: 'spread' }, h('span', null, '🕵️ Mot de l\'imposteur'), h('b', null, opts.blank ? '(aucun)' : imp))),
            h('p', { class: 'muted center small' }, 'Si l\'imposteur a été démasqué, il peut encore gagner en devinant le mot des civils !'),
            h('div', { class: 'grow' }),
            h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => round(players, pairs) }, '🔁 Nouvelle manche'),
            h('button', { class: 'btn btn-ghost btn-block', onclick: setup }, 'Réglages'));
        },
      }, '👀 Révéler l\'imposteur'));
  }

  if (ctx.opts.online) ctx.open('online', { create: true, game: 'imposteur' });
  else setup();
  return () => { alive = false; timer && timer.stop(); };
}
