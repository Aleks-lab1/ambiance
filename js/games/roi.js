// Le Roi : jeu de cartes de soirée, une règle par valeur.
import { h, topbar, shuffle } from '../ui.js';
import { onlineBanner } from '../common.js';
import { settings, getPlayers, sip } from '../store.js';
import { playersPanel } from '../players.js';
import { flip3 } from './paquet.js';
import { sfx, buzz } from '../sfx.js';

export const SUITS = [['♠', false], ['♥', true], ['♦', true], ['♣', false]];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R'];

export function rule(rank) {
  const d = settings.drink;
  switch (rank) {
    case 'A': return { t: 'Cascade', emoji: '🌊', d: d ? 'Tout le monde commence à boire en même temps. Personne ne peut s\'arrêter avant son voisin de gauche, en commençant par celui qui a tiré la carte.' : 'Tout le monde se lève et fait une ola, en commençant par celui qui a tiré la carte. Le dernier à réagir prend 1 point de gage.' };
    case '2': return { t: 'Je donne', emoji: '👉', d: `Tu distribues ${sip(2)} à qui tu veux.` };
    case '3': return { t: 'Pour moi', emoji: '🫵', d: `Tu prends ${sip(3)}.` };
    case '4': return { t: 'Le sol', emoji: '👇', d: `Tout le monde touche le sol ! Le dernier prend ${sip(1)}.` };
    case '5': return { t: 'Le pouce', emoji: '👍', d: `Tu deviens maître du pouce : quand tu poses discrètement ton pouce sur la table, tout le monde doit t'imiter. Le dernier prend ${sip(1)}. Valable jusqu'au prochain 5.` };
    case '6': return { t: 'Le ciel', emoji: '☝️', d: `Tout le monde lève le doigt vers le ciel ! Le dernier prend ${sip(1)}.` };
    case '7': return { t: 'Le 7 interdit', emoji: '🔢', d: `Comptez à tour de rôle à partir de 1. Interdit de dire un nombre contenant 7 ou multiple de 7 : on dit « BIP » à la place. Le premier qui se trompe prend ${sip(2)}.` };
    case '8': return { t: 'Compagnon', emoji: '🤝', d: `Choisis un compagnon : à chaque fois que tu prends une pénalité, il la prend aussi. Jusqu'au prochain 8.` };
    case '9': return { t: 'Les rimes', emoji: '🎵', d: `Dis un mot. À tour de rôle, chacun doit trouver une rime. Le premier qui sèche prend ${sip(2)}.` };
    case '10': return { t: 'Catégories', emoji: '📋', d: `Choisis une catégorie (marques de bière, pays, Pokémon…). Chacun cite un élément à tour de rôle. Le premier qui sèche ou répète prend ${sip(2)}.` };
    case 'V': return { t: 'La règle', emoji: '📜', d: `Invente une règle qui s'applique à tous jusqu'à la fin de la partie (ex. interdit de dire « oui »). Chaque infraction : ${sip(1)}.` };
    case 'D': return { t: 'Maître des questions', emoji: '❓', d: `Jusqu'à la prochaine Dame, quiconque répond à une de tes questions prend ${sip(1)}. Sauf s'il répond par « Ta gueule la Dame ! ».` };
    case 'R': return { t: 'Le Roi', emoji: '👑', d: d ? 'Verse un peu de ta boisson dans le verre du milieu. Le joueur qui tire le 4e Roi devra le boire !' : 'Ajoute un ingrédient au gage du Roi (une contrainte). Celui qui tire le 4e Roi devra réaliser le gage complet !' };
    default: return { t: '', emoji: '', d: '' };
  }
}

export function start(ctx) {
  const { root, meta } = ctx;

  function setup() {
    root.replaceChildren(
      topbar(ctx),
      onlineBanner(ctx, 'roi', { text: 'Chacun pioche sa carte sur son téléphone, et tout le monde voit la règle.' }),
      h('div', { class: 'section-title' }, 'Ou sur un seul téléphone'),
      h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
      playersPanel(0),
      h('details', { class: 'panel' }, h('summary', null, '📜 Voir toutes les règles des cartes'),
        h('div', { class: 'col small' }, RANKS.map((r) => { const x = rule(r); return h('div', null, h('b', null, `${r} · ${x.emoji} ${x.t} : `), h('span', { class: 'muted' }, x.d)); }))),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: play }, '🃏 Mélanger et jouer'));
  }

  function play() {
    const deck = shuffle(RANKS.flatMap((r) => SUITS.map(([s, red]) => ({ r, s, red }))));
    const players = getPlayers();
    let turn = 0;
    let kings = 0;
    const top = topbar(ctx, { onBack: setup });
    const back = () => h('div', { class: 'playing-card back' });

    function show(card) {
      const x = card ? rule(card.r) : null;
      const p = players.length ? players[turn % players.length] : null;
      const kingsLine = h('div', { class: 'row', style: { justifyContent: 'center', gap: '6px', fontSize: '22px' } },
        [0, 1, 2, 3].map((i) => h('span', { style: { opacity: i < kings ? 1 : 0.25 } }, '👑')));
      root.replaceChildren(top,
        h('div', { class: 'spread' }, h('span', { class: 'pill' }, `🃏 ${deck.length} cartes`), kingsLine),
        p ? h('p', { class: 'center' }, card ? 'Carte de ' : 'À ', h('b', null, card ? players[(turn - 1 + players.length) % players.length] : p), card ? '' : ' de piocher !') : null,
        card
          ? flip3(h('div', { class: 'playing-card' + (card.red ? ' red' : '') },
            h('div', { class: 'corner tl' }, card.r, h('br'), card.s),
            h('div', { class: 'mid' }, x.emoji),
            h('div', { class: 'corner br' }, card.r, h('br'), card.s)), back())
          : back(),
        card ? h('div', { class: 'panel center col anim-late' }, h('h3', null, `${x.emoji} ${x.t}`), h('p', null, x.d)) : null,
        h('div', { class: 'grow' }),
        deck.length && kings < 4
          ? h('button', { class: 'btn btn-primary btn-big btn-block', onclick: draw }, card && p ? `Au tour de ${p} → piocher` : 'Piocher une carte')
          : h('button', { class: 'btn btn-primary btn-big btn-block', onclick: play }, '🔁 Nouveau paquet'));
    }

    function draw() {
      const card = deck.pop();
      turn++;
      sfx.card();
      if (card.r === 'R') {
        kings++;
        buzz(kings === 4 ? [300, 100, 300, 100, 500] : 60);
        if (kings === 4) {
          sfx.boom();
          const who = players.length ? players[(turn - 1) % players.length] : 'Celui qui a pioché';
          root.replaceChildren(top, h('div', { class: 'big-center' },
            h('div', { class: 'hero-emo' }, '👑'), h('h2', null, 'LE 4e ROI !'),
            h('p', null, settings.drink ? `${who} doit boire le verre du milieu ! 🍹` : `${who} doit réaliser le gage du Roi au complet !`),
            h('button', { class: 'btn btn-primary btn-big btn-block', onclick: play }, '🔁 Nouvelle partie')));
          return;
        }
        sfx.fanfare();
      }
      show(card);
    }
    show(null);
  }

  setup();
}
