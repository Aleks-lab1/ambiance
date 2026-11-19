// Paranoïa : question secrète, réponse à voix haute, pile ou face pour révéler.
import { h, topbar } from '../ui.js';
import { get, set, makeDeck } from '../store.js';
import { levelPicker, onlineBanner } from '../common.js';
import { requirePlayers, playersPanel } from '../players.js';
import { sfx, buzz } from '../sfx.js';

export const LEVELS = [
  { id: 'soft', name: 'Tranquille', emoji: '😇', desc: 'Des questions drôles et gentilles.' },
  { id: 'epice', name: 'Épicé', emoji: '🌶️', desc: 'Ça risque de vexer…' },
  { id: 'hot', name: 'Hot', emoji: '🔥', desc: 'Coquin, réservé aux adultes.', adult: true },
  { id: 'hotpp', name: 'Hot++', emoji: '😈', desc: 'Très explicite, sans filtre. Adultes consentants uniquement : chacun peut refuser sans se justifier.', adult: true, extreme: true },
];

export function start(ctx) {
  const { root, meta } = ctx;
  const selected = new Set(get('lv:paranoia', ['soft', 'epice']).filter((id) => LEVELS.some((l) => l.id === id)));
  if (!selected.size) selected.add('soft');
  const dataP = import('../data/paranoia.js').then((m) => m.default);

  function setup() {
    root.replaceChildren(
      topbar(ctx),
      onlineBanner(ctx, 'paranoia', { text: 'La question secrète arrive sur le téléphone du joueur, et tout le monde voit le pile ou face.' }),
      h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
      playersPanel(3),
      h('div', { class: 'section-title' }, 'Niveaux'),
      levelPicker(LEVELS, selected, (s) => set('lv:paranoia', [...s])),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: async () => { const pl = await requirePlayers(3); if (pl) play(pl, await dataP); } }, '▶ Commencer'));
  }

  function play(players, data) {
    const items = [...selected].flatMap((l) => data[l] || []);
    const deck = makeDeck('paranoia:' + [...selected].sort(), items);
    let turn = Math.floor(Math.random() * players.length);
    const top = topbar(ctx, { onBack: setup });

    function pass() {
      const p = players[turn % players.length];
      root.replaceChildren(top, h('div', { class: 'big-center' },
        h('p', { class: 'muted' }, 'Passe le téléphone à'),
        h('h2', { style: { fontSize: '40px' } }, p),
        h('button', { class: 'secret-btn', style: { width: '100%' }, onclick: () => secret(p) }, h('div', { class: 'emo' }, '🤫'), 'Lire la question en secret')));
    }
    function secret(p) {
      const q = deck.next();
      sfx.pop();
      root.replaceChildren(top, h('div', { class: 'big-center' },
        h('div', { class: 'qcard anim', style: { width: '100%', minHeight: '240px' } }, h('div', { class: 'kicker' }, 'Question secrète'), h('div', { class: 'big' }, q)),
        h('p', { class: 'muted' }, `${p}, réponds à voix haute en donnant le nom d'un joueur. Ne montre pas l'écran !`),
        h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => coin(q) }, 'J\'ai répondu → pile ou face')));
    }
    function coin(q) {
      const c = h('div', { class: 'coin spin' }, '?');
      root.replaceChildren(top, h('div', { class: 'big-center' }, h('h2', null, 'Pile ou face…'), c));
      sfx.swoosh();
      const reveal = Math.random() < 0.5;
      setTimeout(() => {
        c.textContent = reveal ? 'RÉVÉLÉ' : 'SECRET';
        buzz(reveal ? [60, 40, 60] : 40);
        reveal ? sfx.fanfare() : sfx.pop();
        setTimeout(() => {
          root.replaceChildren(top, h('div', { class: 'big-center' },
            reveal
              ? [h('div', { class: 'hero-emo' }, '😱'), h('h2', null, 'La question était…'), h('div', { class: 'qcard anim', style: { width: '100%', minHeight: '200px' } }, h('div', { class: 'big' }, q))]
              : [h('div', { class: 'hero-emo' }, '🤫'), h('h2', null, 'Le secret est bien gardé !'), h('p', { class: 'muted' }, 'Personne ne saura jamais quelle était la question…')],
            h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => { turn++; pass(); } }, 'Joueur suivant →')));
        }, 900);
      }, 1000);
    }
    pass();
  }

  setup();
}
