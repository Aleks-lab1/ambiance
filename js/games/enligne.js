// Écran d'accueil des jeux qui se jouent uniquement en ligne (chacun sur son téléphone).
import { h, topbar } from '../ui.js';
import { onlineBanner } from '../common.js';

export function launcher(onlineId) {
  return {
    start(ctx) {
      const { root, meta } = ctx;
      root.replaceChildren(
        topbar(ctx),
        h('div', { class: 'center col', style: { gap: '6px', margin: '6px 0' } }, h('div', { class: 'hero-emo' }, meta.emoji), h('h2', null, meta.name), h('p', { class: 'muted' }, meta.desc)),
        onlineBanner(ctx, onlineId, { title: '🌐 Se joue en ligne', text: 'Chacun sur son téléphone : un joueur crée la partie, les autres la rejoignent avec le code.' }),
        h('div', { class: 'panel rules' }, h('h3', null, 'Comment on joue ?'), (meta.rules || []).map((r) => h('p', { html: r }))),
      );
    },
  };
}
