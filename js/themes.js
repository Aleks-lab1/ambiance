// Thèmes de l'appli : couleurs, fond (éventuellement animé), particules et police.
import { h } from './ui.js';
import { settings, saveSettings } from './store.js';

export const THEME_CATS = [
  { id: 'classique', label: '✨ Classiques' },
  { id: 'couleur', label: '🎨 Couleurs' },
  { id: 'style', label: '😎 Stylés' },
  { id: 'anime', label: '🌀 Animés' },
  { id: 'marrant', label: '🤪 Marrants' },
];

// Raccourcis pour les fonds
const rad = (c, x, y, s = '120vmax 80vmax', end = '60%') => `radial-gradient(${s} at ${x} ${y}, ${c}, transparent ${end})`;
const lin = (...c) => `linear-gradient(160deg, ${c.join(', ')})`;
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Courier New", monospace';
const COMIC = '"Comic Sans MS", "Comic Neue", "Chalkboard SE", "Marker Felt", cursive';

/**
 * base : couleur unie (barre du téléphone) · bg : fond de page · g1/g2 : boutons et accents
 * anim : 'shift' (dégradé qui bouge), 'hue' (couleurs qui tournent), 'pulse' · fx : particules
 * font : police · logo : dégradé du logo
 */
export const THEMES = [
  // ---------- Classiques ----------
  {
    id: 'ambiance', name: 'Ambiance', emoji: '🎉', cat: 'classique', base: '#4b2f9e', g1: '#ff4d8d', g2: '#7c5cff',
    bg: [rad('rgba(124,92,255,.9)', '0%', '0%'), rad('rgba(255,77,141,.75)', '100%', '10%', '110vmax 80vmax', '55%'), rad('rgba(46,197,255,.55)', '50%', '110%', '120vmax 90vmax'), lin('#4b2f9e', '#6a2c8f 55%', '#2f3b9e')].join(','),
  },
  {
    id: 'nuit', name: 'Nuit étoilée', emoji: '🌌', cat: 'classique', base: '#1d2a6b', g1: '#5b8cff', g2: '#b06bff',
    bg: [rad('rgba(91,140,255,.55)', '20%', '0%'), rad('rgba(176,107,255,.45)', '100%', '100%'), lin('#1d2a6b', '#2c2373 60%', '#3a1f6e')].join(','),
    fx: { type: 'twinkle', items: ['✦', '✧', '⋆', '·'], count: 34, color: '#fff' },
  },
  {
    id: 'ocean', name: 'Océan', emoji: '🌊', cat: 'classique', base: '#0f5d8c', g1: '#00c6ff', g2: '#0072ff',
    bg: [rad('rgba(0,198,255,.6)', '10%', '0%'), rad('rgba(0,255,200,.35)', '100%', '90%'), lin('#0f5d8c', '#14498f 55%', '#1b2f7a')].join(','),
    fx: { type: 'rise', items: ['○', '◦', '°'], count: 22, color: 'rgba(255,255,255,.7)' },
  },
  {
    id: 'sunset', name: 'Coucher de soleil', emoji: '🌅', cat: 'classique', base: '#c2416b', g1: '#ff9a3c', g2: '#ff3c7a',
    bg: [rad('rgba(255,200,80,.85)', '50%', '110%', '130vmax 70vmax'), rad('rgba(255,90,120,.7)', '0%', '40%'), lin('#5b2a86', '#b0397a 50%', '#f06a4a')].join(','),
  },
  {
    id: 'foret', name: 'Forêt', emoji: '🌲', cat: 'classique', base: '#1f6b4a', g1: '#7ed957', g2: '#1fa874',
    bg: [rad('rgba(126,217,87,.45)', '0%', '0%'), rad('rgba(255,220,120,.25)', '100%', '0%'), lin('#1f6b4a', '#1c5a48 55%', '#173f3a')].join(','),
    fx: { type: 'fall', items: ['🍃', '🍂', '🌿'], count: 14 },
  },

  // ---------- Couleurs ----------
  { id: 'fraise', name: 'Fraise', emoji: '🍓', cat: 'couleur', base: '#c2185b', g1: '#ff5e7e', g2: '#ff2d55', bg: [rad('rgba(255,140,170,.6)', '0%', '0%'), lin('#c2185b', '#a3154f 55%', '#7a1145')].join(',') },
  { id: 'menthe', name: 'Menthe', emoji: '🌿', cat: 'couleur', base: '#0f8a74', g1: '#3ef2b8', g2: '#11998e', bg: [rad('rgba(80,255,200,.45)', '100%', '0%'), lin('#0f8a74', '#0d6e6a 55%', '#0c4f5c')].join(',') },
  { id: 'lagon', name: 'Lagon', emoji: '🐬', cat: 'couleur', base: '#0288b5', g1: '#4fe3ff', g2: '#1e90ff', bg: [rad('rgba(120,240,255,.55)', '0%', '100%'), lin('#0288b5', '#0a6fb0 55%', '#1650a0')].join(',') },
  { id: 'lavande', name: 'Lavande', emoji: '💜', cat: 'couleur', base: '#7a52c7', g1: '#d18cff', g2: '#8f6bff', bg: [rad('rgba(230,170,255,.5)', '100%', '0%'), lin('#7a52c7', '#6644b0 55%', '#4f3796')].join(',') },
  { id: 'agrume', name: 'Agrumes', emoji: '🍊', cat: 'couleur', base: '#e0622a', g1: '#ffd23f', g2: '#ff7a1a', bg: [rad('rgba(255,220,80,.6)', '0%', '0%'), lin('#e0622a', '#d1451f 55%', '#b0302a')].join(',') },
  { id: 'cerise', name: 'Cerise noire', emoji: '🍒', cat: 'couleur', base: '#5e1230', g1: '#ff3d6e', g2: '#b3124a', bg: [rad('rgba(255,61,110,.45)', '50%', '0%'), lin('#5e1230', '#4a1030 55%', '#2e0c26')].join(',') },
  { id: 'avocat', name: 'Avocat', emoji: '🥑', cat: 'couleur', base: '#4f7a28', g1: '#c6e86b', g2: '#7cb342', bg: [rad('rgba(220,240,120,.45)', '50%', '50%', '90vmax 90vmax'), lin('#4f7a28', '#3f6a24 55%', '#5a3e1e')].join(',') },

  // ---------- Stylés ----------
  {
    id: 'neon', name: 'Néon Tokyo', emoji: '🏙️', cat: 'style', base: '#1a0f3a', g1: '#ff2bd6', g2: '#00e5ff',
    bg: [rad('rgba(255,43,214,.45)', '0%', '0%'), rad('rgba(0,229,255,.4)', '100%', '100%'), lin('#1a0f3a', '#24104a 55%', '#0f1a40')].join(','),
    logo: 'linear-gradient(90deg, #00e5ff, #ff2bd6)', extra: 'neon',
  },
  {
    id: 'synthwave', name: 'Synthwave', emoji: '🕶️', cat: 'style', base: '#2b1155', g1: '#ff6ec7', g2: '#7b5cff',
    bg: ['repeating-linear-gradient(0deg, transparent 0 38px, rgba(255,110,199,.18) 38px 40px)', 'repeating-linear-gradient(90deg, transparent 0 38px, rgba(255,110,199,.12) 38px 40px)', rad('rgba(255,180,60,.75)', '50%', '35%', '45vmax 45vmax', '70%'), lin('#2b1155', '#5a1a7a 55%', '#c2306e')].join(','),
    logo: 'linear-gradient(180deg, #ffe66d, #ff6ec7 60%, #7b5cff)',
  },
  {
    id: 'terminal', name: 'Terminal', emoji: '💻', cat: 'style', base: '#06210f', g1: '#22ff88', g2: '#0fa958', font: MONO,
    bg: [rad('rgba(34,255,136,.18)', '50%', '0%'), lin('#06210f', '#04170b 60%', '#031008')].join(','),
    logo: 'linear-gradient(90deg, #22ff88, #b6ffd6)', fx: { type: 'code', count: 18 },
  },
  {
    id: 'arcade', name: 'Arcade 8-bit', emoji: '👾', cat: 'style', base: '#2a1f6e', g1: '#ffcc00', g2: '#ff3d7f', font: MONO,
    bg: ['repeating-linear-gradient(0deg, rgba(0,0,0,.12) 0 2px, transparent 2px 4px)', rad('rgba(255,61,127,.4)', '0%', '100%'), lin('#2a1f6e', '#3b1f7a 55%', '#1f2a7a')].join(','),
    logo: 'linear-gradient(90deg, #ffcc00, #ff3d7f)', fx: { type: 'drift', items: ['👾', '🕹️', '⭐', '🍒'], count: 9 },
  },
  { id: 'luxe', name: 'Luxe', emoji: '🥂', cat: 'style', base: '#1e1a14', g1: '#f5c86a', g2: '#b8862b', bg: [rad('rgba(245,200,106,.3)', '50%', '0%'), lin('#2a241a', '#1e1a14 55%', '#14110d')].join(','), logo: 'linear-gradient(90deg, #fff1c1, #f5c86a 50%, #b8862b)' },
  { id: 'minimal', name: 'Minimal', emoji: '🖤', cat: 'style', base: '#26262e', g1: '#ffffff', g2: '#9aa0ff', bg: lin('#30303a', '#26262e 55%', '#1d1d24'), logo: 'linear-gradient(90deg, #fff, #c8c8d8)', extra: 'minimal' },
  {
    id: 'vapor', name: 'Vaporwave', emoji: '🌴', cat: 'style', base: '#5b3fa8', g1: '#ff71ce', g2: '#01cdfe',
    bg: [rad('rgba(1,205,254,.5)', '0%', '0%'), rad('rgba(255,113,206,.6)', '100%', '100%'), lin('#5b3fa8', '#7a49b5 55%', '#b967ff')].join(','),
    fx: { type: 'drift', items: ['🌴', '🐬', '💾', '🗿'], count: 8 },
  },

  // ---------- Animés ----------
  { id: 'aurore', name: 'Aurore boréale', emoji: '🌠', cat: 'anime', base: '#123d5c', g1: '#4dffb5', g2: '#8a5cff', anim: 'shift', bg: lin('#0f3b5a', '#127a6a', '#3d2f8f', '#0f3b5a', '#5b2d8f', '#127a6a') },
  { id: 'feu', name: 'En feu', emoji: '🔥', cat: 'anime', base: '#a3221a', g1: '#ffb347', g2: '#ff3b1f', anim: 'shift', bg: lin('#7a1010', '#c73a12', '#e8701a', '#a3221a', '#5e0d16', '#c73a12'), fx: { type: 'rise', items: ['•', '·', '✦'], count: 26, color: '#ffcf70' } },
  { id: 'disco', name: 'Boule à facettes', emoji: '🪩', cat: 'anime', base: '#6a1fb0', g1: '#ff3df2', g2: '#3dd8ff', anim: 'hue', bg: [rad('rgba(255,61,242,.7)', '0%', '0%'), rad('rgba(61,216,255,.7)', '100%', '100%'), lin('#6a1fb0', '#2a2fb5')].join(','), fx: { type: 'twinkle', items: ['✨', '✦', '🪩'], count: 22 } },
  { id: 'rainbow', name: 'Arc-en-ciel', emoji: '🌈', cat: 'anime', base: '#7b3fb5', g1: '#ffd23f', g2: '#ff4d8d', anim: 'shift', bg: lin('#d9334f', '#e8822a', '#c9a227', '#2fa86a', '#2a7bd9', '#7b3fb5', '#d9334f') },
  { id: 'holo', name: 'Holographique', emoji: '💿', cat: 'anime', base: '#6c6fc9', g1: '#ff9de2', g2: '#7ee0ff', anim: 'shift', bg: lin('#7b6fd6', '#c46fc9', '#5fa8d9', '#8fd0c4', '#b07fd9', '#7b6fd6') },
  { id: 'lave', name: 'Lampe à lave', emoji: '🫧', cat: 'anime', base: '#7a1fa2', g1: '#ff6b6b', g2: '#ffb36b', anim: 'pulse', bg: [rad('rgba(255,107,107,.9)', '20%', '30%', '60vmax 60vmax'), rad('rgba(255,179,107,.85)', '80%', '70%', '55vmax 55vmax'), rad('rgba(255,61,180,.7)', '70%', '10%', '45vmax 45vmax'), lin('#7a1fa2', '#4a1880')].join(',') },
  { id: 'galaxie', name: 'Galaxie', emoji: '🪐', cat: 'anime', base: '#231a5e', g1: '#ff7ad9', g2: '#6b8bff', anim: 'hue', bg: [rad('rgba(255,122,217,.5)', '30%', '30%', '70vmax 50vmax'), rad('rgba(107,139,255,.55)', '70%', '70%', '80vmax 60vmax'), lin('#231a5e', '#140f3d')].join(','), fx: { type: 'drift', items: ['🚀', '🪐', '🛸', '☄️', '⭐'], count: 10 } },

  // ---------- Marrants ----------
  { id: 'bonbon', name: 'Bonbons', emoji: '🍭', cat: 'marrant', base: '#d6448f', g1: '#ffe14d', g2: '#2ec5ff', bg: ['repeating-linear-gradient(135deg, rgba(255,255,255,.1) 0 22px, transparent 22px 44px)', lin('#d6448f', '#b53fb5 55%', '#7d4bd6')].join(','), fx: { type: 'fall', items: ['🍬', '🍭', '🧁', '🍩'], count: 14 } },
  { id: 'pizza', name: 'Pizza party', emoji: '🍕', cat: 'marrant', base: '#c4361f', g1: '#ffd23f', g2: '#3fae4a', bg: [rad('rgba(255,210,63,.4)', '50%', '0%'), lin('#c4361f', '#a82c22 55%', '#7d2420')].join(','), fx: { type: 'fall', items: ['🍕', '🍕', '🧀', '🍅'], count: 14 } },
  { id: 'licorne', name: 'Licorne', emoji: '🦄', cat: 'marrant', base: '#a35bd6', g1: '#ff8ad8', g2: '#7ad7ff', anim: 'shift', bg: lin('#b45bd6', '#e06aa8', '#6a8ee0', '#5fc4c4', '#b45bd6'), fx: { type: 'drift', items: ['🦄', '🌈', '✨', '💖'], count: 10 } },
  { id: 'chats', name: 'Pluie de chats', emoji: '🐱', cat: 'marrant', base: '#d97a2b', g1: '#ffd38a', g2: '#ff7a45', bg: ['radial-gradient(circle, rgba(255,255,255,.12) 2px, transparent 3px) 0 0 / 26px 26px', lin('#d97a2b', '#c25a2f 55%', '#9c3f3a')].join(','), fx: { type: 'fall', items: ['🐱', '😺', '🐈', '😹', '🐾'], count: 15 } },
  { id: 'canards', name: 'Coin-coin', emoji: '🦆', cat: 'marrant', base: '#1f7fb8', g1: '#ffd23f', g2: '#ff9f1c', bg: [rad('rgba(255,255,255,.25)', '50%', '0%'), lin('#2a9bd9', '#1f7fb8 55%', '#1a5f99')].join(','), fx: { type: 'drift', items: ['🦆', '🐤', '🦆', '🛁'], count: 10 } },
  { id: 'apero', name: 'Apéro', emoji: '🍻', cat: 'marrant', base: '#b8661a', g1: '#ffd23f', g2: '#ff7a1a', bg: [rad('rgba(255,220,100,.55)', '50%', '0%'), lin('#c47a1f', '#b8661a 55%', '#8a4316')].join(','), fx: { type: 'rise', items: ['🍺', '🍷', '🍹', '🥂', '🫧'], count: 14 } },
  { id: 'love', name: 'Love', emoji: '💘', cat: 'marrant', base: '#d6336c', g1: '#ffb3c7', g2: '#ff2d6f', bg: [rad('rgba(255,180,200,.55)', '0%', '0%'), lin('#e04a7f', '#d6336c 55%', '#a6205a')].join(','), fx: { type: 'rise', items: ['💖', '💘', '💕', '😍', '💋'], count: 16 } },
  { id: 'bd', name: 'Bande dessinée', emoji: '💥', cat: 'marrant', base: '#e8462a', g1: '#ffe14d', g2: '#2a6fe8', font: COMIC, bg: ['radial-gradient(circle, rgba(0,0,0,.18) 2px, transparent 2.5px) 0 0 / 14px 14px', lin('#e8462a', '#d9342a 55%', '#b8282f')].join(','), logo: 'linear-gradient(90deg, #ffe14d, #fff)', fx: { type: 'drift', items: ['💥', 'BAM!', 'POW!', '💬', 'ZOK!'], count: 8, color: '#ffe14d' } },
  { id: 'hiver', name: 'Neige', emoji: '❄️', cat: 'marrant', base: '#3a6fb0', g1: '#bfe6ff', g2: '#6aa8ff', bg: [rad('rgba(255,255,255,.35)', '50%', '0%'), lin('#4a86c7', '#3a6fb0 55%', '#2b4f8f')].join(','), fx: { type: 'fall', items: ['❄️', '❅', '❆', '•'], count: 30, color: '#fff' } },
  { id: 'halloween', name: 'Halloween', emoji: '🎃', cat: 'marrant', base: '#2a1438', g1: '#ff8a1f', g2: '#9b3fd6', bg: [rad('rgba(255,138,31,.45)', '50%', '100%'), lin('#3a1a4a', '#2a1438 55%', '#1a0e24')].join(','), fx: { type: 'drift', items: ['🎃', '👻', '🦇', '🕷️', '💀'], count: 12 } },
  { id: 'plage', name: 'Plage', emoji: '🏖️', cat: 'marrant', base: '#1b8fb0', g1: '#ffd27a', g2: '#ff7a59', bg: [rad('rgba(255,220,120,.75)', '100%', '0%', '60vmax 60vmax', '70%'), lin('#2ab0d0', '#1b8fb0 55%', '#c79a4a')].join(','), fx: { type: 'drift', items: ['🌴', '🐚', '🦀', '🏄', '⛱️'], count: 9 } },
  { id: 'patate', name: 'Patate', emoji: '🥔', cat: 'marrant', base: '#9a6a32', g1: '#ffd27a', g2: '#e0a040', bg: ['radial-gradient(circle, rgba(60,30,0,.18) 3px, transparent 4px) 0 0 / 34px 34px', lin('#b08040', '#9a6a32 55%', '#7a4f22')].join(','), fx: { type: 'fall', items: ['🥔', '🍟', '🥔'], count: 12 } },
];

export const DEFAULT_THEME = 'ambiance';
export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

let fxEl = null;
const rnd = (a, b) => a + Math.random() * (b - a);

function buildFx(t) {
  if (fxEl) { fxEl.remove(); fxEl = null; }
  if (!t.fx || settings.themeFx === false) return;
  fxEl = h('div', { id: 'theme-fx', 'aria-hidden': 'true', class: 'fx-' + t.fx.type });
  const n = t.fx.count || 14;
  const code = t.fx.type === 'code';
  for (let i = 0; i < n; i++) {
    let txt;
    if (t.fx.type === 'code') txt = Array.from({ length: 14 }, () => (Math.random() < .5 ? '0' : '1')).join('\n');
    else txt = t.fx.items[i % t.fx.items.length];
    const dur = t.fx.type === 'twinkle' ? rnd(2, 5) : t.fx.type === 'drift' ? rnd(16, 30) : rnd(9, 20);
    fxEl.append(h('span', {
      style: {
        '--x': rnd(0, 100).toFixed(1) + 'vw', '--y': rnd(0, 100).toFixed(1) + 'vh',
        '--s': (t.fx.type === 'twinkle' || t.fx.type === 'code' ? rnd(10, 22) : rnd(18, 34)).toFixed(0) + 'px',
        '--d': dur.toFixed(1) + 's', '--delay': (-rnd(0, dur)).toFixed(1) + 's',
        '--r': code ? '0deg' : (rnd(-1, 1) * 360).toFixed(0) + 'deg',
        '--o': (t.fx.type === 'twinkle' ? rnd(.45, .9) : code ? rnd(.2, .45) : rnd(.3, .6)).toFixed(2),
        '--sway': code ? '0vw' : rnd(-12, 12).toFixed(0) + 'vw',
        color: t.fx.color || null,
      },
    }, txt));
  }
  document.body.prepend(fxEl);
}

/** Applique un thème à toute l'appli. */
export function applyTheme(id = settings.theme) {
  const t = themeById(id);
  const root = document.documentElement;
  root.style.setProperty('--page-bg', t.bg);
  root.style.setProperty('--bg', t.base);
  root.style.setProperty('--bg2', `color-mix(in srgb, ${t.base} 82%, #fff)`);
  root.style.setProperty('--g1', t.g1);
  root.style.setProperty('--g2', t.g2);
  root.style.setProperty('--accent', t.g1);
  root.style.setProperty('--accent2', t.g2);
  if (t.logo) root.style.setProperty('--logo', t.logo); else root.style.removeProperty('--logo');
  if (t.font) root.style.setProperty('--font', t.font); else root.style.removeProperty('--font');
  root.dataset.theme = t.id;
  root.dataset.anim = settings.themeFx === false ? '' : (t.anim || '');
  root.dataset.extra = t.extra || '';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t.base);
  buildFx(t);
}

export function setTheme(id) {
  settings.theme = id;
  saveSettings();
  applyTheme(id);
}

/** Petite vignette d'aperçu d'un thème. */
export function themeSwatch(t, on, onclick) {
  return h('button', {
    class: 'theme-sw' + (on ? ' on' : ''), onclick, 'aria-pressed': on ? 'true' : 'false', 'aria-label': 'Thème ' + t.name,
    style: { background: t.bg, fontFamily: t.font || null },
  },
  h('span', { class: 'theme-emo' }, t.emoji),
  h('span', { class: 'theme-dots' }, h('i', { style: { background: t.g1 } }), h('i', { style: { background: t.g2 } })),
  h('span', { class: 'theme-name' }, t.name),
  t.anim || t.fx ? h('span', { class: 'theme-tag' }, t.anim ? '🌀' : '✨') : null);
}
