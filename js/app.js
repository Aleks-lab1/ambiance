// Point d'entrée : accueil, navigation, réglages, installation PWA.
import { h, mount, modal, toast, toggleRow, confirmBox, keepAwake } from './ui.js';
import { settings, saveSettings, get, set, resetSeen, getPlayers } from './store.js';
import { GAMES, FILTERS, gameById } from './games/index.js';
import { editPlayers } from './players.js';
import { ensureAdult } from './common.js';
import { getFavs, isFav, toggleFav } from './favorites.js';
import { sfx, buzz } from './sfx.js';

const ONLINE_META = {
  id: 'online', name: 'Jouer en ligne', emoji: '🌐', colors: ['#2a7bff', '#ff4d8d'],
  rules: [
    'Un joueur <b>crée la partie</b> et obtient un code de 4 lettres (et un QR code). Les autres touchent <b>Rejoindre</b> et entrent ce code : chacun joue sur son propre téléphone.',
    'L\'hôte choisit parmi 15 jeux : Je dessine tu devines, L\'Imposteur, Le Quiz, Punchlines, Téléphone dessiné, Dico bluff, Menteur !, Émojis mystères, Anagrammes, À vue de nez, Bingo de soirée, et les votes de Tu préfères, C\'est un 10 mais…, Qui de nous et Opinions impopulaires.',
    'Astuce : l\'hôte doit garder l\'appli ouverte pendant la partie. Tout le monde sur le même Wi-Fi, c\'est l\'idéal.',
  ],
  load: () => import('./online/room.js'),
};

// ---------------- Favoris ----------------
function favLabel(g, on) { return on ? `Retirer ${g.name} des favoris` : `Ajouter ${g.name} aux favoris`; }

/** Bascule le favori d'un jeu et met à jour le bouton étoile. */
function flipFav(g, btn) {
  const on = toggleFav(g.id);
  btn.textContent = on ? '★' : '☆';
  btn.classList.toggle('on', on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.setAttribute('aria-label', favLabel(g, on));
  btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
  sfx.pop(); buzz(15);
  toast(on ? `⭐ ${g.name} ajouté aux favoris` : `${g.name} retiré des favoris`, 1800);
  return on;
}

function starButton(g, cls) {
  const on = isFav(g.id);
  const btn = h('button', { class: cls + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', 'aria-label': favLabel(g, on), title: 'Favori' }, on ? '★' : '☆');
  btn.addEventListener('click', (e) => { e.stopPropagation(); flipFav(g, btn); });
  return btn;
}

// ---------------- Navigation ----------------
let current = null;      // { cleanup, guard, state, url }
let navToken = 0;
let bypassGuard = false;

function teardown() {
  if (current?.cleanup) { try { current.cleanup(); } catch (e) { console.error(e); } }
  current = null;
  keepAwake(false);
  document.body.classList.remove('in-game');
}

function urlFor(id, opts) {
  if (id === 'online') return opts?.join ? '#/join/' + opts.join : '#/online';
  return '#/' + id + (opts?.online ? '/online' : '');
}

async function openScreen(id, opts = {}, push = true) {
  const meta = id === 'online' ? ONLINE_META : gameById(id);
  if (!meta) { renderHome(); return; }
  teardown();
  const state = { screen: id, opts };
  const url = urlFor(id, opts);
  if (push) history.pushState(state, '', url);
  const token = ++navToken;
  const root = h('div', { class: 'screen game-screen', style: { '--g1': meta.colors[0], '--g2': meta.colors[1] } });
  mount(root);
  document.title = `${meta.name} — Ambiance`;
  document.body.classList.add('in-game');
  let mod;
  try { mod = await meta.load(); } catch (e) {
    console.error(e);
    root.replaceChildren(h('div', { class: 'big-center' }, h('div', { class: 'hero-emo' }, '😵'), h('p', null, 'Impossible de charger le jeu.'), h('button', { class: 'btn', onclick: goHome }, 'Retour')));
    return;
  }
  if (token !== navToken) return;
  current = { cleanup: null, guard: null, state, url };
  const ctx = {
    root, meta, opts,
    exit: () => { bypassGuard = true; goHome(); },
    setGuard: (msg) => { if (current) current.guard = msg; },
    open: (gid, o) => openScreen(gid, o, true),
    favButton: id === 'online' ? null : () => starButton(meta, 'icon-btn fav-top'),
  };
  keepAwake(true);
  try {
    current.cleanup = mod.start(ctx) || null;
  } catch (e) {
    console.error(e);
    toast('Oups, une erreur est survenue');
  }
}

function goHome() {
  if (history.state && history.state.screen && history.state.screen !== 'home') history.back();
  else { teardown(); renderHome(); }
}

window.addEventListener('popstate', async (e) => {
  let st = e.state;
  if (!st) {
    // Navigation par changement d'ancre (lien #/jeu ouvert alors que l'appli tourne déjà).
    const t = parseHash();
    st = t ? { screen: t.id, opts: t.opts } : { screen: 'home' };
    history.replaceState(st, '', location.href);
  }
  if (current && current.guard && !bypassGuard) {
    const { state, url, guard } = current;
    history.pushState(state, '', url);
    const ok = await confirmBox(guard, { ok: 'Quitter', cancel: 'Rester' });
    if (ok) { bypassGuard = true; history.back(); }
    return;
  }
  bypassGuard = false;
  if (st.screen === 'home') { teardown(); renderHome(); }
  else openScreen(st.screen, st.opts || {}, false);
});

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  if (!raw) return null;
  const [a, b] = raw.split('/');
  if (a === 'join') return { id: 'online', opts: { join: (b || '').toUpperCase().slice(0, 4) } };
  if (a === 'online') return { id: 'online', opts: {} };
  if (gameById(a)) return { id: a, opts: b === 'online' ? { online: true } : {} };
  return null;
}

// ---------------- Accueil ----------------
let deferredInstall = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function renderHome() {
  document.title = 'Ambiance — jeux de soirée';
  let filter = get('filter', 'all');
  const grid = h('div', { class: 'grid' });
  const filters = h('div', { class: 'scroll-x', role: 'tablist' });

  function renderFilters() {
    filters.replaceChildren(...FILTERS.map((f) => h('button', {
      class: 'chip' + (filter === f.id ? ' on' : ''), role: 'tab', 'aria-selected': filter === f.id ? 'true' : 'false',
      onclick: () => { filter = f.id; set('filter', filter); renderFilters(); renderGrid(); renderFavs(); },
    }, f.label)));
  }
  const favGames = () => getFavs().map((id) => gameById(id)).filter(Boolean);

  function renderGrid() {
    const list = filter === 'fav'
      ? favGames()
      : GAMES.filter((g) => filter === 'all' || (filter === 'new' ? g.new : g.tags.includes(filter)));
    if (filter === 'fav' && !list.length) {
      grid.replaceChildren(h('div', { class: 'panel center col', style: { gridColumn: '1 / -1' } },
        h('div', { class: 'hero-emo', style: { fontSize: '48px' } }, '⭐'),
        h('b', null, 'Aucun favori pour l\'instant'),
        h('p', { class: 'muted small' }, 'Touche l\'étoile ☆ en bas d\'un jeu pour le retrouver ici et en haut de l\'accueil.')));
      return;
    }
    grid.replaceChildren(...list.map((g) => {
      const star = starButton(g, 'fav-btn');
      star.addEventListener('click', () => { renderFavs(); if (filter === 'fav') renderGrid(); });
      return h('div', { class: 'tile-wrap' },
        h('button', {
          class: 'tile', style: { '--g1': g.colors[0], '--g2': g.colors[1] },
          onclick: () => { sfx.unlock(); openScreen(g.id); },
        },
          h('div', { class: 'badges' }, (g.badges || []).slice(0, 1).map((b) => h('span', { class: 'badge' + (b === 'Nouveau' ? ' new' : '') }, b)), h('span', { class: 'badge' }, '👤 ' + g.players)),
          h('div', { class: 'emo' }, g.emoji),
          h('div', { class: 'name' }, g.name),
          h('div', { class: 'desc' }, g.desc)),
        star);
    }));
  }

  const favSlot = h('div', { class: 'col', style: { gap: '8px' } });
  function renderFavs() {
    const favs = favGames();
    if (!favs.length || filter === 'fav') { favSlot.replaceChildren(); favSlot.classList.add('hidden'); return; }
    favSlot.classList.remove('hidden');
    favSlot.replaceChildren(
      h('div', { class: 'section-title' }, '⭐ Mes favoris'),
      h('div', { class: 'scroll-x fav-row' }, favs.map((g) => h('button', {
        class: 'mini-tile', style: { '--g1': g.colors[0], '--g2': g.colors[1] },
        onclick: () => { sfx.unlock(); openScreen(g.id); },
      }, h('span', { class: 'emo' }, g.emoji), h('span', { class: 'nm' }, g.name)))));
  }

  const playersBar = h('button', { class: 'players-bar', onclick: async () => { await editPlayers(); renderPlayers(); } });
  function renderPlayers() {
    const l = getPlayers();
    playersBar.replaceChildren(
      h('span', { style: { fontSize: '22px' } }, '👥'),
      h('span', { class: 'names' }, l.length ? [h('b', null, `${l.length} joueurs`), ' · ' + l.join(', ')] : [h('b', null, 'Ajouter les joueurs'), ' — pour personnaliser les jeux']),
      h('span', { class: 'chip' }, l.length ? 'Modifier' : 'Ajouter'));
  }
  renderPlayers();

  const installSlot = h('div');
  function renderInstall() {
    installSlot.replaceChildren();
    if (isStandalone() || get('installDismissed', false)) return;
    if (deferredInstall) {
      installSlot.append(h('div', { class: 'panel install-card' },
        h('span', { class: 'emo' }, '📲'),
        h('div', { class: 'grow' }, h('b', null, 'Installer Ambiance'), h('p', { class: 'muted small' }, 'Sur l\'écran d\'accueil, en plein écran et même hors ligne.')),
        h('button', { class: 'btn btn-primary btn-sm', onclick: async () => { deferredInstall.prompt(); await deferredInstall.userChoice.catch(() => {}); deferredInstall = null; renderInstall(); } }, 'Installer'),
        h('button', { class: 'icon-btn', 'aria-label': 'Masquer', onclick: () => { set('installDismissed', true); renderInstall(); } }, '×')));
    } else if (isIOS) {
      installSlot.append(h('div', { class: 'panel install-card' },
        h('span', { class: 'emo' }, '📲'),
        h('div', { class: 'grow' }, h('b', null, 'Installer sur iPhone'), h('p', { class: 'muted small' }, 'Touche « Partager » ⬆️ puis « Sur l\'écran d\'accueil ».')),
        h('button', { class: 'icon-btn', 'aria-label': 'Masquer', onclick: () => { set('installDismissed', true); renderInstall(); } }, '×')));
    }
  }
  renderInstall();
  homeInstallRefresh = renderInstall;

  const screen = h('div', { class: 'screen home' },
    h('div', { class: 'home-head' },
      h('div', null, h('div', { class: 'logo' }, 'Ambiance'), h('div', { class: 'tagline' }, `${GAMES.length} jeux pour mettre le feu à ta soirée 🎉`)),
      h('button', { class: 'icon-btn', 'aria-label': 'Réglages', onclick: openSettings }, '⚙️')),
    playersBar,
    favSlot,
    h('div', { class: 'online-banner' },
      h('div', { class: 'deco' }, '📱'),
      h('h2', null, '🌐 Jouer en ligne'),
      h('p', null, '15 jeux où chacun joue sur son téléphone : quiz, dessin, bluff…'),
      h('div', { class: 'row' },
        h('button', { class: 'btn grow', onclick: () => openScreen('online', { create: true }) }, 'Créer une partie'),
        h('button', { class: 'btn btn-ghost grow', onclick: () => openScreen('online', { joinPrompt: true }) }, 'Rejoindre'))),
    installSlot,
    filters,
    grid,
    h('p', { class: 'footer' }, settings.drink ? '🍻 Mode soirée : les pénalités se boivent. Avec modération !' : '🧃 Mode sans alcool : les pénalités sont des points de gage.',
      h('br'), h('button', { class: 'btn btn-ghost btn-sm', style: { marginTop: '8px' }, onclick: openSettings }, 'Changer dans les réglages')),
  );
  renderFilters();
  renderGrid();
  renderFavs();
  mount(screen);
}
let homeInstallRefresh = null;

async function openSettings() {
  const content = h('div', { class: 'col' },
    toggleRow('🍻 Pénalités en gorgées', 'Désactivé : mode sans alcool, les pénalités deviennent des points de gage.', settings.drink, (v) => { settings.drink = v; saveSettings(); }),
    toggleRow('🔊 Sons', null, settings.sound, (v) => { settings.sound = v; saveSettings(); }),
    toggleRow('📳 Vibrations', null, settings.vibrate, (v) => { settings.vibrate = v; saveSettings(); }),
    toggleRow('🔞 Contenu 18+', 'Débloque les niveaux « Hot » et « Hot++ » des jeux de questions.', settings.adult, async (v, input) => {
      if (v) { const ok = await ensureAdult(); if (!ok) input.checked = false; }
      else { settings.adult = false; settings.explicit = false; saveSettings(); }
    }),
    h('div', { class: 'sep' }),
    h('button', { class: 'btn btn-soft', onclick: () => { resetSeen(); toast('Les cartes déjà vues pourront revenir'); } }, '🔄 Revoir toutes les cartes'),
    h('p', { class: 'muted tiny' }, 'Ambiance mémorise les cartes déjà tirées pour ne pas les répéter d\'une soirée à l\'autre.'),
    h('p', { class: 'muted tiny center' }, 'Ambiance · fonctionne hors ligne une fois installé · le jeu en ligne utilise une connexion directe entre téléphones (WebRTC).'),
  );
  await modal({ title: '⚙️ Réglages', content, actions: [{ label: 'Fermer', value: true, primary: true }] });
  if (!current) renderHome();
}

// ---------------- PWA ----------------
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  homeInstallRefresh && !current && homeInstallRefresh();
});
window.addEventListener('appinstalled', () => { deferredInstall = null; toast('Ambiance est installée 🎉'); });

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      const notify = (worker) => {
        const t = toast(h('span', null, '✨ Nouvelle version disponible ', h('button', { class: 'btn btn-sm btn-primary', onclick: () => worker.postMessage('skipWaiting') }, 'Mettre à jour')), 12000);
        t.style.pointerEvents = 'auto';
      };
      if (reg.waiting && navigator.serviceWorker.controller) notify(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) notify(nw); });
      });
      // Recharge uniquement lors d'une mise à jour (pas lors de la toute première installation).
      const hadController = !!navigator.serviceWorker.controller;
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
    } catch (e) { console.warn('SW', e); }
  });
}

// ---------------- Démarrage ----------------
document.addEventListener('pointerdown', () => sfx.unlock(), { once: true });
const target = parseHash();
history.replaceState({ screen: 'home' }, '', location.pathname + location.search);
renderHome();
if (target) openScreen(target.id, target.opts, true);
