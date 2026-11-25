// Je dessine, tu devines : version un seul écran (+ accès au mode en ligne).
import { h, topbar, seg, confirmBox, shuffle, countdown, timerView, setText } from '../ui.js';
import { gameColors } from '../themes.js';
import { get, set } from '../store.js';
import { requirePlayers, playersPanel } from '../players.js';
import { createBoard, createTools } from '../canvas.js';
import { readyScreen } from '../turn.js';
import { podium } from '../common.js';
import { sfx, buzz } from '../sfx.js';

export function start(ctx) {
  const { root, meta } = ctx;
  let alive = true;
  let timer = null;
  const opts = Object.assign({ diff: 'mix', time: 90, rounds: 2 }, get('dessin-local', {}));
  const save = () => set('dessin-local', opts);
  const wordsP = import('../data/dessin.js').then((m) => m.default);

  function setup() {
    ctx.setGuard(null);
    timer && timer.stop();
    root.replaceChildren(
      topbar(ctx),
      h('div', { class: 'online-banner', style: { background: `linear-gradient(135deg, ${gameColors('dessin', ['#ff6b6b', '#f7a531']).join(', ')})` } },
        h('div', { class: 'deco' }, '📱'),
        h('h2', null, '🌐 En ligne (recommandé)'),
        h('p', null, 'Chacun devine sur son propre téléphone, avec points et indices.'),
        h('button', { class: 'btn btn-block', onclick: () => ctx.open('online', { create: true, game: 'dessin' }) }, 'Créer une partie en ligne')),
      h('div', { class: 'section-title' }, 'Ou sur un seul écran'),
      h('div', { class: 'panel rules' }, h('p', { html: meta.rules[2] })),
      playersPanel(2),
      h('label', { class: 'field' }, 'Difficulté', seg([{ value: 'facile', label: 'Facile' }, { value: 'moyen', label: 'Moyen' }, { value: 'difficile', label: 'Difficile' }, { value: 'mix', label: 'Mélange' }], opts.diff, (v) => { opts.diff = v; save(); })),
      h('label', { class: 'field' }, 'Temps par dessin', seg([60, 90, 120].map((v) => ({ value: v, label: v + ' s' })), opts.time, (v) => { opts.time = v; save(); })),
      h('label', { class: 'field' }, 'Manches (chacun dessine une fois par manche)', seg([1, 2, 3, 4].map((v) => ({ value: v, label: String(v) })), opts.rounds, (v) => { opts.rounds = v; save(); })),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: async () => { const pl = await requirePlayers(2); if (pl) game(pl, await wordsP); } }, '▶ Jouer sur ce téléphone'));
  }

  async function game(players, words) {
    ctx.setGuard('Quitter la partie en cours ?');
    const pool = shuffle((opts.diff === 'mix' ? [...words.facile, ...words.moyen, ...words.difficile] : words[opts.diff]).slice());
    const scores = Object.fromEntries(players.map((p) => [p, 0]));
    const top = topbar(ctx, { onBack: async () => { if (await confirmBox('Quitter la partie en cours ?')) setup(); } });
    for (let r = 0; r < opts.rounds; r++) {
      for (const drawer of players) {
        if (!alive || !root.isConnected) return;
        await readyScreen(root, { top, title: drawer, kicker: `Manche ${r + 1}/${opts.rounds} — au tour de`, emoji: '🎨', subtitle: 'Prends le téléphone. Les autres, ne regardez pas l\'écran pendant que le mot s\'affiche !', button: 'Voir mes mots' });
        if (!alive) return;
        if (pool.length < 3) pool.push(...shuffle((opts.diff === 'mix' ? [...words.facile, ...words.moyen, ...words.difficile] : words[opts.diff]).slice()));
        const choices = pool.splice(0, 3);
        const word = await new Promise((res) => {
          root.replaceChildren(top, h('div', { class: 'big-center' },
            h('h2', null, 'Choisis ton mot 🤫'),
            h('div', { class: 'choices' }, choices.map((w) => h('button', { class: 'btn btn-primary btn-big', onclick: () => res(w) }, w)))));
        });
        const finder = await drawTurn(top, drawer, word, players);
        if (!alive || !root.isConnected) return;
        if (finder) { scores[finder]++; scores[drawer]++; }
        await new Promise((res) => {
          root.replaceChildren(top, h('div', { class: 'big-center' },
            h('div', { class: 'hero-emo' }, finder ? '🎉' : '😅'),
            h('p', { class: 'muted' }, 'Le mot était'),
            h('div', { class: 'reveal-word' }, word),
            h('p', null, finder ? `${finder} et ${drawer} gagnent 1 point !` : 'Personne n\'a trouvé.'),
            h('div', { class: 'scoreboard', style: { width: '100%' } }, Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([n, s]) => h('div', { class: 'score-row' }, h('span', { class: 'n' }, n), h('span', { class: 's' }, String(s))))),
            h('button', { class: 'btn btn-primary btn-big btn-block', onclick: res }, 'Suivant →')));
        });
      }
    }
    ctx.setGuard(null);
    sfx.fanfare();
    root.replaceChildren(topbar(ctx),
      h('div', { class: 'center' }, h('div', { class: 'hero-emo' }, '🏆'), h('h2', null, 'Fin de la partie !')),
      podium(Object.entries(scores).map(([name, score]) => ({ name, score }))),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: setup }, '🔁 Rejouer'));
  }

  function drawTurn(top, drawer, word, players) {
    return new Promise((resolve) => {
      const board = createBoard({ editable: true });
      const tools = createTools(board);
      const tv = timerView(opts.time);
      const wordBtn = h('button', { class: 'btn btn-soft btn-sm' }, '👁 Maintenir pour voir le mot');
      const showWord = (on) => { setText(wordBtn, on ? word : '👁 Maintenir pour voir le mot'); };
      wordBtn.addEventListener('pointerdown', () => showWord(true));
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => wordBtn.addEventListener(ev, () => showWord(false)));
      const found = h('button', { class: 'btn btn-ok btn-big grow', onclick: pickFinder }, '✅ Trouvé !');
      root.replaceChildren(
        h('div', { class: 'row' }, h('span', { class: 'pill' }, '✏️ ' + drawer), h('div', { class: 'grow' }), wordBtn),
        tv.el, board.el, tools,
        h('div', { class: 'row' }, h('button', { class: 'btn btn-soft', onclick: () => { timer.stop(); resolve(null); } }, 'Abandonner'), found));
      timer = countdown({
        seconds: opts.time,
        onTick: (left, s, ch) => { if (!root.isConnected) { timer.stop(); return; } tv.set(left, opts.time * 1000); if (ch && s <= 5 && s > 0) sfx.tick(); },
        onEnd: () => { sfx.bad(); buzz([200, 100, 200]); resolve(null); },
      });
      async function pickFinder() {
        timer.pause();
        const others = players.filter((p) => p !== drawer);
        const who = await new Promise((res) => {
          const overlay = h('div', { class: 'modal-overlay' }, h('div', { class: 'modal' },
            h('h2', null, 'Qui a trouvé ?'),
            h('div', { class: 'plist-sel' }, others.map((p) => h('button', { onclick: () => { overlay.remove(); res(p); } }, '🙋 ' + p))),
            h('button', { class: 'btn btn-ghost', onclick: () => { overlay.remove(); res(null); } }, 'Annuler')));
          document.body.append(overlay);
        });
        if (who) { timer.stop(); sfx.ok(); buzz(40); resolve(who); } else timer.resume();
      }
    });
  }

  if (ctx.opts.online) ctx.open('online', { create: true, game: 'dessin' });
  else setup();
  return () => { alive = false; timer && timer.stop(); };
}
