// Briques partagées par plusieurs jeux.
import { h, modal, chip, toast } from './ui.js';
import { settings, saveSettings } from './store.js';
import { gameColors } from './themes.js';

/** Demande la confirmation 18+ une seule fois. */
export async function ensureAdult() {
  if (settings.adult) return true;
  const ok = await modal({
    title: '🔞 Contenu pour adultes',
    content: h('div', { class: 'col' },
      h('p', null, 'Ce niveau contient des questions coquines et du contenu réservé aux adultes.'),
      h('p', { class: 'muted small' }, 'En continuant, tu confirmes que tous les joueurs ont 18 ans ou plus et sont d\'accord pour jouer à ce niveau.')),
    actions: [{ label: 'Non', value: false }, { label: "J'ai 18 ans ou +", value: true, primary: true }],
  });
  if (ok) { settings.adult = true; saveSettings(); }
  return !!ok;
}

/** Confirmation supplémentaire pour le niveau Hot++ (très explicite). */
export async function ensureExplicit() {
  if (!(await ensureAdult())) return false;
  if (settings.explicit) return true;
  const ok = await modal({
    title: '😈 Niveau Hot++',
    content: h('div', { class: 'col' },
      h('p', null, 'Questions et défis très explicites, sans filtre : sexe, fantasmes, plans à plusieurs, défis physiques…'),
      h('p', null, h('b', null, 'Règle d\'or : '), 'tout le monde doit être d\'accord pour jouer à ce niveau, et chacun peut refuser une question ou un défi sans se justifier. Les défis à deux se font uniquement avec l\'accord de l\'autre.')),
    actions: [{ label: 'Annuler', value: false }, { label: 'On est tous partants', value: true, primary: true }],
  });
  if (ok) { settings.explicit = true; saveSettings(); }
  return !!ok;
}

/**
 * Sélecteur de niveaux (multi-sélection).
 * levels: [{id, name, emoji, desc, adult}]
 */
export function levelPicker(levels, selected, onChange) {
  const wrap = h('div', { class: 'col' });
  const desc = h('p', { class: 'muted small' });
  const chips = h('div', { class: 'chips' });
  function render() {
    chips.replaceChildren(...levels.map((l) => {
      const c = chip([l.emoji + ' ' + l.name, (l.extreme ? !settings.explicit : l.adult && !settings.adult) ? h('span', { class: 'lock' }, '🔒') : null], selected.has(l.id), async () => {
        if (selected.has(l.id)) {
          if (selected.size === 1) { toast('Garde au moins un niveau'); return; }
          selected.delete(l.id);
        } else {
          if (l.extreme ? !(await ensureExplicit()) : (l.adult && !(await ensureAdult()))) return;
          selected.add(l.id);
        }
        render();
        onChange(selected);
      });
      return c;
    }));
    const sel = levels.filter((l) => selected.has(l.id));
    desc.textContent = sel.map((l) => `${l.emoji} ${l.desc}`).join('  ·  ');
  }
  render();
  wrap.append(chips, desc);
  return wrap;
}

/** Couleurs de niveau pour les badges. */
export function levelBadge(level) {
  return h('span', { class: 'badge lvl' }, `${level.emoji} ${level.name}`);
}

export const TEAM_COLORS = ['#ff4d8d', '#2ec5ff', '#ffc93c', '#22d39a', '#b07cff', '#ff7a45'];

/** Podium + classement à partir de [{name, score}] */
export function podium(list) {
  const sorted = list.slice().sort((a, b) => b.score - a.score);
  const top = sorted.slice(0, 3);
  const heights = [120, 90, 70];
  const order = top.length >= 3 ? [1, 0, 2] : top.length === 2 ? [1, 0] : [0];
  const pod = h('div', { class: 'podium' }, order.map((i) => top[i] && h('div', { class: 'st' },
    h('div', { class: 'nm' }, ['🥇', '🥈', '🥉'][i] + ' ' + top[i].name),
    h('div', { class: 'blk', style: { height: heights[i] + 'px' } }, String(top[i].score)))));
  const rest = sorted.slice(3).map((p, i) => h('div', { class: 'score-row' }, h('span', null, `${i + 4}.`), h('span', { class: 'n' }, p.name), h('span', { class: 's' }, String(p.score))));
  return h('div', { class: 'col' }, pod, rest.length ? h('div', { class: 'scoreboard' }, rest) : null);
}

// Points d'un dé (grille 3×3) pour chaque face.
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
/** Un dé dessiné en CSS. cls : 'sm', 'xs', 'hl', 'dim', 'roll'… */
export function dieFace(v, cls = '') {
  return h('div', { class: 'die ' + cls, 'aria-label': 'Dé : ' + v }, Array.from({ length: 9 }, (_, i) => h('i', { class: PIPS[v] && PIPS[v].includes(i) ? 'on' : '' })));
}

/** Bandeau « Jouer en ligne » pour les jeux qui ont aussi une version multijoueur. */
export function onlineBanner(ctx, onlineId, { title = '🌐 En ligne (recommandé)', text = 'Chacun joue sur son propre téléphone, avec les points comptés automatiquement.', colors } = {}) {
  const c = colors || (ctx.meta && ctx.meta.colors ? gameColors(ctx.meta.id, ctx.meta.colors) : null) || ['#2a7bff', '#ff4d8d'];
  return h('div', { class: 'online-banner', style: { background: `linear-gradient(135deg, ${c[0]}, ${c[1]})` } },
    h('div', { class: 'deco' }, '📱'),
    h('h2', null, title),
    h('p', null, text),
    h('div', { class: 'row' },
      h('button', { class: 'btn grow', onclick: () => ctx.open('online', { create: true, game: onlineId }) }, 'Créer une partie'),
      h('button', { class: 'btn btn-ghost grow', onclick: () => ctx.open('online', { joinPrompt: true }) }, 'Rejoindre')));
}
