// Écran d'accueil des jeux qui se jouent uniquement en ligne (chacun sur son téléphone).
import { h, topbar } from '../ui.js';
import { onlineBanner } from '../common.js';
import { gameColors } from '../themes.js';

// tv : jeu réservé au TV Mode (la télé crée le salon, les téléphones servent de manettes).
export function launcher(onlineId, { tv = false } = {}) {
  return {
    start(ctx) {
      const { root, meta } = ctx;
      root.replaceChildren(
        topbar(ctx),
        h('div', { class: 'center col', style: { gap: '6px', margin: '6px 0' } }, h('div', { class: 'hero-emo' }, meta.emoji), h('h2', null, meta.name), h('p', { class: 'muted' }, meta.desc)),
        tv ? tvBanner(ctx)
          : onlineBanner(ctx, onlineId, { title: '🌐 Se joue en ligne', text: 'Chacun sur son téléphone : un joueur crée la partie, les autres la rejoignent avec le code.' }),
        h('div', { class: 'panel rules' }, h('h3', null, 'Comment on joue ?'), (meta.rules || []).map((r) => h('p', { html: r }))),
      );
    },
  };
}

/** Bandeau des jeux réservés au TV Mode : on lance la télé, ou on la rejoint comme joueur. */
function tvBanner(ctx) {
  const c = gameColors(ctx.meta.id, ctx.meta.colors);
  return h('div', { class: 'online-banner', style: { background: `linear-gradient(135deg, ${c[0]}, ${c[1]})` } },
    h('div', { class: 'deco' }, '📺'),
    h('h2', null, '📺 Se joue en TV Mode'),
    h('p', null, 'La télé (ou un ordinateur) affiche la partie en grand, chaque téléphone devient une manette. Choisis le jeu dans le salon de la télé.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn grow', onclick: () => ctx.open('online', { tv: true }) }, '▶ Lancer la télé'),
      h('button', { class: 'btn btn-ghost grow', onclick: () => ctx.open('online', { joinPrompt: true }) }, 'Je suis un joueur')));
}
