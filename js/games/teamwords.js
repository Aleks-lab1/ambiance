// Mots interdits & Mime express : jeux de mots en équipes.
import { h, topbar, seg, confirmBox } from '../ui.js';
import { get, set, makeDeck } from '../store.js';
import { teamsSetup, readyScreen, playTurn, reviewTurn, scoresScreen, finalScreen } from '../turn.js';

function teamWordGame(cfg) {
  return {
    start(ctx) {
      const { root, meta } = ctx;
      let alive = true;
      const opts = Object.assign({ duration: cfg.duration, turns: 3 }, get('tw:' + meta.id, {}));
      const dataP = cfg.data().then((m) => m.default);

      function setup() {
        ctx.setGuard(null);
        const ts = teamsSetup();
        root.replaceChildren(
          topbar(ctx),
          h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
          h('div', { class: 'section-title' }, 'Équipes'), ts.el,
          h('div', { class: 'section-title' }, 'Durée d\'un tour'),
          seg([45, 60, 90].map((v) => ({ value: v, label: v + ' s' })), opts.duration, (v) => { opts.duration = v; set('tw:' + meta.id, opts); }),
          h('div', { class: 'section-title' }, 'Tours par équipe'),
          seg([2, 3, 4, 5, 6].map((v) => ({ value: v, label: String(v) })), opts.turns, (v) => { opts.turns = v; set('tw:' + meta.id, opts); }),
          h('div', { class: 'grow' }),
          h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => dataP.then((words) => game(ts.teams, words)) }, '▶ Commencer'));
      }

      async function game(teams, words) {
        ctx.setGuard('Quitter la partie en cours ?');
        const deck = makeDeck(meta.id, words);
        const scores = teams.map(() => 0);
        const top = topbar(ctx, { onBack: async () => { if (await confirmBox('Quitter la partie en cours ?')) setup(); } });
        for (let r = 0; r < opts.turns; r++) {
          for (let ti = 0; ti < teams.length; ti++) {
            if (!alive || !root.isConnected) return;
            const team = teams[ti];
            const who = team.members.length ? team.members[r % team.members.length] : null;
            await readyScreen(root, {
              top, title: team.name, color: team.color, emoji: meta.emoji,
              subtitle: who ? `${who} ${cfg.verb} à son équipe. Les autres, ne regardez pas l'écran !` : cfg.readySub,
            });
            if (!alive) return;
            const { results } = await playTurn(root, {
              label: team.name, color: team.color, duration: opts.duration,
              draw: () => deck.next(), render: cfg.render, buttons: cfg.buttons,
            });
            if (!alive || !root.isConnected) return;
            scores[ti] += await reviewTurn(root, { top, results, title: 'Temps écoulé !', labelOf: cfg.labelOf });
            const last = r === opts.turns - 1 && ti === teams.length - 1;
            if (!last) await scoresScreen(root, { top, teams, scores, info: `Tour ${r + 1} sur ${opts.turns}`, next: teams[(ti + 1) % teams.length] });
          }
        }
        ctx.setGuard(null);
        finalScreen(root, { top: topbar(ctx), teams, scores, onReplay: setup });
      }

      setup();
      return () => { alive = false; };
    },
  };
}

export const motsinterdits = teamWordGame({
  duration: 60,
  data: () => import('../data/motsinterdits.js'),
  verb: 'fait deviner',
  readySub: 'Le joueur qui fait deviner prend le téléphone. Une équipe adverse surveille les mots interdits !',
  render: ([w, ...f]) => h('div', { class: 'word-card' },
    h('div', { class: 'hint' }, 'Fais deviner'),
    h('div', { class: 'w' }, w),
    h('div', { class: 'hint', style: { color: '#c21d3b' } }, 'Mots interdits'),
    h('div', { class: 'forbid' }, f.map((x) => h('span', null, x)))),
  labelOf: (it) => it[0],
  buttons: [
    { label: '🚫 Interdit', cls: 'btn-bad', r: 'buzz' },
    { label: '⏭ Passer', cls: 'btn-soft', r: 'pass' },
    { label: '✅ Trouvé', cls: 'btn-ok', r: 'ok' },
  ],
});

export const mime = teamWordGame({
  duration: 60,
  data: () => import('../data/mime.js'),
  verb: 'mime',
  readySub: 'Le mimeur prend le téléphone. Interdit de parler ou de faire du bruit !',
  render: (w) => h('div', { class: 'word-card' }, h('div', { class: 'hint' }, '🤫 Mime'), h('div', { class: 'w' }, w)),
  labelOf: (it) => it,
  buttons: [
    { label: '⏭ Passer', cls: 'btn-soft', r: 'pass' },
    { label: '✅ Trouvé', cls: 'btn-ok', r: 'ok' },
  ],
});
