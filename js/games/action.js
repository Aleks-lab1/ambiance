// Action ou vérité.
import { h, topbar, pick, toast } from '../ui.js';
import { get, set, makeDeck, sip, getPlayers } from '../store.js';
import { levelPicker, onlineBanner } from '../common.js';
import { requirePlayers, playersPanel } from '../players.js';
import { sfx, buzz } from '../sfx.js';

export const LEVELS = [
  { id: 'soft', name: 'Tranquille', emoji: '😇', desc: 'Gentil, pour tous.' },
  { id: 'fun', name: 'Fun', emoji: '🤪', desc: 'Gênant et drôle.' },
  { id: 'hot', name: 'Hot', emoji: '🔥', desc: 'Coquin, réservé aux adultes.', adult: true },
  { id: 'hotpp', name: 'Hot++', emoji: '😈', desc: 'Très explicite, sans filtre. Adultes consentants uniquement : chacun peut refuser sans se justifier.', adult: true, extreme: true },
];

export function start(ctx) {
  const { root, meta } = ctx;
  const selected = new Set(get('lv:action', ['soft', 'fun']).filter((id) => LEVELS.some((l) => l.id === id)));
  if (!selected.size) selected.add('soft');
  const dataP = import('../data/action.js').then((m) => m.default);

  function setup() {
    root.replaceChildren(
      topbar(ctx),
      onlineBanner(ctx, 'action', { text: 'Le joueur désigné choisit Action ou Vérité sur son téléphone, et la carte s\'affiche chez tout le monde.' }),
      h('div', { class: 'section-title' }, 'Ou sur un seul téléphone'),
      h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
      playersPanel(2),
      h('div', { class: 'section-title' }, 'Niveaux'),
      levelPicker(LEVELS, selected, (s) => set('lv:action', [...s])),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: async () => { const pl = await requirePlayers(2); if (pl) play(pl, await dataP); } }, '▶ Commencer'));
  }

  function play(players, data) {
    const build = (kind) => [...selected].flatMap((l) => (data[kind][l] || []).map((t) => ({ l, t })));
    const decks = { action: makeDeck('action:a:' + [...selected].sort(), build('action')), verite: makeDeck('action:v:' + [...selected].sort(), build('verite')) };
    let turn = Math.floor(Math.random() * players.length);
    const top = topbar(ctx, { onBack: setup });

    function choose() {
      const p = players[turn % players.length];
      root.replaceChildren(top, h('div', { class: 'big-center' },
        h('p', { class: 'muted' }, 'À toi de jouer'),
        h('h2', { style: { fontSize: '40px' } }, p),
        h('div', { class: 'col', style: { width: '100%' } },
          h('button', { class: 'btn btn-primary btn-big', style: { '--g1': '#ff512f', '--g2': '#dd2476' }, onclick: () => card('action') }, '🎯 Action'),
          h('button', { class: 'btn btn-primary btn-big', style: { '--g1': '#2ec5ff', '--g2': '#7c5cff' }, onclick: () => card('verite') }, '💬 Vérité'),
          h('button', { class: 'btn btn-soft', onclick: () => card(Math.random() < 0.5 ? 'action' : 'verite') }, '🎲 Laisser le hasard choisir'))));
    }

    function card(kind) {
      const p = players[turn % players.length];
      const e = decks[kind].next();
      const others = players.filter((x) => x !== p);
      const text = e.t.replace(/\{joueur\}/g, () => (others.length ? pick(others) : 'quelqu\'un'));
      const lvl = LEVELS.find((l) => l.id === e.l);
      sfx.swoosh();
      root.replaceChildren(top,
        h('div', { class: 'qcard anim', style: lvl.extreme ? { '--g1': '#b0123f', '--g2': '#1c0614' } : kind === 'action' ? { '--g1': '#ff512f', '--g2': '#dd2476' } : { '--g1': '#2ec5ff', '--g2': '#7c5cff' } },
          h('span', { class: 'badge lvl' }, `${lvl.emoji} ${lvl.name}`),
          h('div', { class: 'who' }, p),
          h('div', { class: 'kicker' }, kind === 'action' ? '🎯 Action' : '💬 Vérité'),
          h('div', { class: 'big' }, text)),
        h('div', { class: 'answer-btns' },
          h('button', { class: 'btn btn-bad btn-big', onclick: () => { sfx.bad(); buzz(60); toast(`🙅 ${p} refuse : ${sip(2)} !`, 3000); next(); } }, '🙅 Je refuse'),
          h('button', { class: 'btn btn-ok btn-big', onclick: () => { sfx.ok(); next(); } }, kind === 'action' ? '✅ Fait !' : '✅ Répondu')));
    }

    function next() { turn++; choose(); }
    choose();
  }

  setup();
}
