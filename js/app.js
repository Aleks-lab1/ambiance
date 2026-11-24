// Point d'entrée : accueil, navigation, réglages, installation PWA.
import { h, mount, modal, toast, toggleRow, confirmBox, keepAwake } from './ui.js';
import { settings, saveSettings, get, set, resetSeen, getPlayers } from './store.js';
import { GAMES, LOCAL_GAMES, FILTERS, gameById } from './games/index.js';
import { editPlayers } from './players.js';
import { ensureAdult } from './common.js';
import { getFavs, isFav, toggleFav } from './favorites.js';
import { sfx, buzz } from './sfx.js';
import { THEMES, THEME_CATS, themeById, applyTheme, setTheme, themeSwatch, gameColors } from './themes.js';
import { COUNTS, countLabel, fitsCount, matchSearch, getCount, setCount, getRecent, pushRecent, pickGame } from './finder.js';
import { loadHost, clearHost, loadSeat, clearSeat, resumeText } from './online/save.js';

const ONLINE_META = {
  id: 'online', name: 'Online', emoji: '🌐', colors: ['#2a7bff', '#ff4d8d'],
  rules: [
    'Un joueur <b>crée le salon</b> et obtient un code de 4 lettres (et un QR code). Les autres touchent <b>Rejoindre le salon</b> et entrent ce code : chacun joue sur son propre téléphone.',
    `Tous les jeux d'Ambiance se jouent en ligne : celui qui a créé le salon lance les jeux parmi les ${GAMES.length}, les autres votent pour ceux qu'ils veulent (dessin, quiz, bluff, jeux en équipes, Loup-garou, Bataille navale, Yam's…).`,
    'Dans certains jeux, un seul joueur agit à la fois (celui dont c\'est le tour, ou l\'hôte) : les autres suivent la partie en direct sur leur téléphone.',
    'Ça marche en Wi-Fi comme en 4G/5G, même si vous n\'êtes pas au même endroit. Si l\'hôte ferme l\'appli (ou si son téléphone se verrouille), il reprend la partie là où elle en était : les autres patientent et reviennent tout seuls, avec leurs points.',
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

/** Image d'un jeu (img/jeux/<id>.webp, générée par scripts/gen-images.mjs). En secours : l'emoji du jeu. */
function gameArt(g) {
  const img = h('img', { class: 'tile-art', src: `img/jeux/${g.id}.webp`, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' });
  img.addEventListener('error', () => img.replaceWith(h('span', { class: 'tile-emo', 'aria-hidden': 'true' }, g.emoji)), { once: true });
  return img;
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
  if (id === 'local') return '#/local';
  if (id === 'online') return opts?.join ? '#/join/' + opts.join : opts?.tv ? '#/tv' + (typeof opts.tv === 'string' ? '/' + opts.tv : '') : '#/online';
  return '#/' + id + (opts?.online ? '/online' : '');
}

async function openScreen(id, opts = {}, push = true) {
  const menu = id === 'online' || id === 'local'; // écrans de mode, pas des jeux
  const meta = id === 'online' ? ONLINE_META : id === 'local' ? LOCAL_META : gameById(id);
  if (!meta) { renderHome(); return; }
  if (!menu) pushRecent(id);
  teardown();
  const state = { screen: id, opts };
  const url = urlFor(id, opts);
  if (push) history.pushState(state, '', url);
  const token = ++navToken;
  const gc = gameColors(id, meta.colors);
  const root = h('div', { class: 'screen game-screen', style: { '--g1': gc[0], '--g2': gc[1] } });
  mount(root);
  document.title = `${meta.name} — Ambiance`;
  if (id !== 'local') document.body.classList.add('in-game');
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
    favButton: menu ? null : () => starButton(meta, 'icon-btn fav-top'),
  };
  if (id !== 'local') keepAwake(true);
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
  if (a === 'local') return { id: 'local', opts: {} };
  if (a === 'tv') return { id: 'online', opts: { tv: (b || '').toUpperCase().slice(0, 4) || true } };
  if (gameById(a)) return { id: a, opts: b === 'online' ? { online: true } : {} };
  return null;
}

// ---------------- Accueil ----------------
let deferredInstall = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// ---------------- Local : les jeux sur un seul téléphone (#/local) ----------------
const LOCAL_META = {
  id: 'local', name: 'Local', emoji: '📱', colors: ['#ff7a59', '#ff4d8d'],
  load: () => Promise.resolve({ start: (ctx) => renderLocal(ctx) }),
};
const isLocal = (g) => g && !g.onlineOnly;

function renderLocal(ctx) {
  document.title = 'Local — Ambiance';
  let filter = get('filter', 'all');
  if (!FILTERS.some((f) => f.id === filter)) filter = 'all'; // ancien filtre supprimé (ex. « En ligne »)
  let count = getCount(); // « On est combien ? » (0 = peu importe)
  let query = '';
  const grid = h('div', { class: 'grid' });
  const filters = h('div', { class: 'scroll-x', role: 'tablist' });

  function renderFilters() {
    filters.replaceChildren(...FILTERS.map((f) => h('button', {
      class: 'chip' + (filter === f.id ? ' on' : ''), role: 'tab', 'aria-selected': filter === f.id ? 'true' : 'false',
      onclick: () => { filter = f.id; set('filter', filter); renderFilters(); renderGrid(); renderFavs(); },
    }, f.label)));
  }
  const favGames = () => getFavs().map((id) => gameById(id)).filter(isLocal);

  // ---- Recherche ----
  const searchIn = h('input', {
    class: 'input', type: 'search', placeholder: 'Chercher un jeu…', 'aria-label': 'Chercher un jeu', enterkeyhint: 'search',
    autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
    oninput: () => onSearch(),
    onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
  });
  const searchBox = h('div', { class: 'search-box' },
    h('span', { class: 'search-ico', 'aria-hidden': 'true' }, '🔎'), searchIn,
    h('button', { class: 'search-clear', 'aria-label': 'Effacer la recherche', onclick: () => { searchIn.value = ''; onSearch(); searchIn.focus(); } }, '×'));
  function onSearch() {
    query = searchIn.value;
    searchBox.classList.toggle('has-text', !!query.trim());
    // On cherche dans tous les jeux, pas seulement dans la catégorie choisie.
    if (query.trim() && filter !== 'all') { filter = 'all'; set('filter', filter); renderFilters(); renderFavs(); }
    renderGrid();
  }

  // ---- On est combien ? ----
  const counts = h('div', { class: 'scroll-x count-row', role: 'group', 'aria-label': 'Nombre de joueurs' });
  function renderCounts() {
    counts.replaceChildren(h('span', { class: 'count-label' }, '👥 On est'), ...COUNTS.map((n) => h('button', {
      class: 'chip chip-n' + (count === n ? ' on' : ''), 'aria-pressed': count === n ? 'true' : 'false',
      'aria-label': n >= 10 ? '10 joueurs ou plus' : `${n} joueurs`,
      onclick: () => { count = count === n ? 0 : n; setCount(count); renderCounts(); renderGrid(); sfx.pop(); },
    }, countLabel(n))));
  }

  const resultBar = h('div', { class: 'result-bar' });
  const tagWords = (g) => g.tags.map((t) => FILTERS.find((f) => f.id === t)?.label || '').join(' ');
  function currentList() {
    const base = filter === 'fav'
      ? favGames()
      : LOCAL_GAMES.filter((g) => filter === 'all' || (filter === 'new' ? g.new : g.tags.includes(filter)));
    return base.filter((g) => fitsCount(g, count) && matchSearch(g, query, tagWords(g)));
  }
  function resetFilters() {
    query = ''; searchIn.value = ''; searchBox.classList.remove('has-text');
    count = 0; setCount(0);
    filter = 'all'; set('filter', filter);
    renderFilters(); renderCounts(); renderFavs(); renderGrid();
  }

  function renderGrid() {
    const list = currentList();
    const n = list.length;
    resultBar.replaceChildren(
      h('span', { class: 'section-title' }, `${n} jeu${n > 1 ? 'x' : ''}${count ? ` · ${countLabel(count)} joueurs` : ''}`),
      n > 1 ? h('button', { class: 'btn btn-soft btn-sm dice-btn', onclick: () => surprise(list) }, '🎲 Au hasard') : null);
    if (filter === 'fav' && !getFavs().length) {
      grid.replaceChildren(h('div', { class: 'panel center col', style: { gridColumn: '1 / -1' } },
        h('div', { class: 'hero-emo', style: { fontSize: '48px' } }, '⭐'),
        h('b', null, 'Aucun favori pour l\'instant'),
        h('p', { class: 'muted small' }, 'Touche l\'étoile ☆ en bas d\'un jeu pour le retrouver ici et en haut de l\'accueil.')));
      return;
    }
    if (!n) {
      const q = query.trim();
      // Le jeu cherché existe, mais pas pour ce nombre de joueurs (« loup » à 4 : Loup-garou se joue à 6+).
      const otherCount = count && q && LOCAL_GAMES.filter((g) => matchSearch(g, query, tagWords(g)));
      const title = q ? `Aucun jeu ne correspond à « ${q} »${count ? ` pour ${countLabel(count)} joueurs` : ''}` : `Aucun jeu ici${count ? ` pour ${countLabel(count)} joueurs` : ''}`;
      grid.replaceChildren(h('div', { class: 'panel center col empty-find', style: { gridColumn: '1 / -1' } },
        h('div', { class: 'hero-emo', style: { fontSize: '44px' } }, '🤷'),
        h('b', null, title),
        otherCount && otherCount.length
          ? h('p', { class: 'muted small' }, `${otherCount.map((g) => `${g.name} (${g.players} joueurs)`).slice(0, 3).join(', ')} : pas pour ${countLabel(count)} joueurs.`)
          : h('p', { class: 'muted small' }, 'Essaie un autre mot ou un autre nombre de joueurs.'),
        otherCount && otherCount.length
          ? h('button', { class: 'btn btn-soft btn-sm', onclick: () => { count = 0; setCount(0); renderCounts(); renderGrid(); } }, 'Voir sans le nombre de joueurs')
          : h('button', { class: 'btn btn-soft btn-sm', onclick: resetFilters }, 'Tout afficher')));
      return;
    }
    grid.replaceChildren(...list.map((g) => {
      const star = starButton(g, 'fav-btn');
      star.addEventListener('click', () => { renderFavs(); renderRecent(); if (filter === 'fav') renderGrid(); });
      const [c1, c2] = gameColors(g.id, g.colors);
      return h('div', { class: 'tile-wrap' },
        h('button', {
          class: 'tile', style: { '--g1': c1, '--g2': c2 },
          onclick: () => { sfx.unlock(); openScreen(g.id); },
        },
          gameArt(g),
          h('div', { class: 'badges' }, (g.badges || []).slice(0, 1).map((b) => h('span', { class: 'badge' + (b === 'Nouveau' ? ' new' : '') }, b)), h('span', { class: 'badge' }, '👤 ' + g.players)),
          h('div', { class: 'name' }, g.name)),
        star);
    }));
  }

  const miniTile = (g) => h('button', {
    class: 'mini-tile', style: { '--g1': gameColors(g.id, g.colors)[0], '--g2': gameColors(g.id, g.colors)[1] },
    onclick: () => { sfx.unlock(); openScreen(g.id); },
  }, gameArt(g), h('span', { class: 'nm' }, g.name));
  const favSlot = h('div', { class: 'col', style: { gap: '8px' } });
  function renderFavs() {
    const favs = favGames();
    if (!favs.length || filter === 'fav') { favSlot.replaceChildren(); favSlot.classList.add('hidden'); return; }
    favSlot.classList.remove('hidden');
    favSlot.replaceChildren(
      h('div', { class: 'section-title' }, '⭐ Mes favoris'),
      h('div', { class: 'scroll-x fav-row' }, favs.map(miniTile)));
  }
  // Joués récemment (une touche pour rejouer), sans répéter les favoris déjà affichés juste au-dessus.
  const recentSlot = h('div', { class: 'col', style: { gap: '8px' } });
  function renderRecent() {
    const favs = getFavs();
    const list = getRecent().filter((id) => !favs.includes(id)).map((id) => gameById(id)).filter(isLocal).slice(0, 6);
    if (!list.length) { recentSlot.replaceChildren(); recentSlot.classList.add('hidden'); return; }
    recentSlot.classList.remove('hidden');
    recentSlot.replaceChildren(
      h('div', { class: 'section-title' }, '🕘 Joués récemment'),
      h('div', { class: 'scroll-x recent-row' }, list.map(miniTile)));
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


  ctx.root.replaceChildren(
    h('div', { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': 'Retour', onclick: () => ctx.exit() }, '←'),
      h('span', { class: 'emo' }, '📱'),
      h('h1', null, 'Local'),
      h('span', { class: 'pill' }, `${LOCAL_GAMES.length} jeux`)),
    h('p', { class: 'muted small local-sub' }, 'Un seul téléphone, qu\'on se passe ou qu\'on pose au milieu de la table.'),
    playersBar,
    favSlot,
    recentSlot,
    searchBox,
    filters,
    counts,
    resultBar,
    grid,
    h('p', { class: 'footer' }, settings.drink ? '🍻 Mode soirée : les pénalités se boivent. Avec modération !' : '🧃 Mode sans alcool : les pénalités sont des points de gage.',
      h('br'), h('button', { class: 'btn btn-ghost btn-sm', style: { marginTop: '8px' }, onclick: openSettings }, 'Changer dans les réglages')),
  );
  ctx.root.classList.add('local-screen');
  renderFilters();
  renderCounts();
  renderGrid();
  renderFavs();
  renderRecent();
}

// ---------------- Accueil : 3 grandes cases Local / Online / TV Mode ----------------
const MODES = [
  { id: 'local', name: 'Local', sub: 'Un seul téléphone qu\'on se passe', more: `${LOCAL_GAMES.length} jeux`, colors: ['#ff8a4c', '#ff4d8d'], go: () => openScreen('local') },
  { id: 'online', name: 'Online', sub: 'Chacun joue sur son téléphone', more: 'Créer ou rejoindre un salon', colors: ['#2a7bff', '#7c5cff'], go: () => openScreen('online') },
  { id: 'tv', name: 'TV Mode', sub: 'La télé affiche, les téléphones jouent', more: 'On scanne le QR code', colors: ['#7c3aed', '#14b8a6'], go: () => openScreen('online', { tv: true }) },
];

function renderHome() {
  document.title = 'Ambiance — jeux de soirée';
  // Partie en ligne coupée (appli fermée, téléphone verrouillé…) : on propose de la reprendre.
  const resumeSlot = h('div');
  function renderResume() {
    const saved = loadHost();
    const seat = !saved && loadSeat();
    const forget = (fn) => () => { fn(); renderResume(); };
    const card = (emo, title, sub, label, go, clear) => h('div', { class: 'panel resume-card' },
      h('span', { class: 'emo' }, emo),
      h('div', { class: 'txt' }, h('b', null, title), h('p', { class: 'muted small' }, sub)),
      h('button', { class: 'icon-btn', 'aria-label': 'Oublier cette partie', onclick: forget(clear) }, '×'),
      h('button', { class: 'btn btn-primary go', onclick: () => { sfx.unlock(); go(); } }, label));
    if (saved) {
      resumeSlot.replaceChildren(card('🔁', `Ta partie ${saved.code} n'est pas finie`, resumeText(saved), '▶ Reprendre la partie',
        () => openScreen('online', { resume: true }), clearHost));
    } else if (seat) {
      resumeSlot.replaceChildren(card('🔌', `Tu étais dans la partie ${seat.code}`, 'Reviens : tu retrouveras ta place et tes points.', '▶ Revenir dans la partie',
        () => openScreen('online', { join: seat.code }), clearSeat));
    } else resumeSlot.replaceChildren();
  }
  renderResume();
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
  const cards = MODES.map((m) => {
    const [c1, c2] = gameColors('mode-' + m.id, m.colors);
    const img = h('img', { class: 'mode-art', src: `img/ui/mode-${m.id}.webp`, alt: '', decoding: 'async', draggable: 'false' });
    img.addEventListener('error', () => img.remove(), { once: true });
    return h('button', { class: 'mode-card mode-' + m.id, style: { '--g1': c1, '--g2': c2 }, onclick: () => { sfx.unlock(); sfx.pop(); m.go(); } },
      img,
      h('span', { class: 'mode-txt' }, h('b', { class: 'mode-name' }, m.name), h('span', { class: 'mode-sub' }, m.sub), h('span', { class: 'mode-more' }, m.more)));
  });
  const screen = h('div', { class: 'screen home' },
    h('div', { class: 'home-head' },
      h('div', null, h('div', { class: 'logo' }, 'Ambiance'), h('div', { class: 'tagline' }, `${GAMES.length} jeux pour mettre le feu à ta soirée 🎉`)),
      h('button', { class: 'icon-btn', 'aria-label': 'Réglages', onclick: openSettings }, '⚙️')),
    resumeSlot,
    h('div', { class: 'modes' }, cards),
    installSlot,
  );
  mount(screen);
}

// ---------------- Tirage au hasard (« Je ne sais pas quoi jouer ») ----------------
/** Les jeux défilent comme une machine à sous, ralentissent et s'arrêtent sur l'un d'eux. */
function surprise(list) {
  if (!list.length) return;
  const reel = h('div', { class: 'tile reel', 'aria-live': 'polite' });
  const desc = h('p', { class: 'muted small center reel-desc' });
  const again = h('button', { class: 'btn btn-soft grow' }, '🎲 Un autre');
  const play = h('button', { class: 'btn btn-primary grow' }, '▶ Jouer');
  let chosen = null;
  let timer = null;
  const show = (g, cls) => {
    const [c1, c2] = gameColors(g.id, g.colors);
    reel.style.setProperty('--g1', c1); reel.style.setProperty('--g2', c2);
    reel.replaceChildren(h('div', { class: 'reel-face ' + cls }, gameArt(g), h('div', { class: 'name' }, g.name)));
  };
  const spin = () => {
    clearTimeout(timer);
    const prev = chosen;
    chosen = pickGame(list.length > 1 && prev ? list.filter((g) => g.id !== prev.id) : list);
    again.disabled = true; play.disabled = true; desc.textContent = ' ';
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Délais croissants : ça ralentit comme une vraie roue.
    const delays = reduce ? [] : [55, 60, 65, 70, 80, 90, 105, 120, 140, 165, 195, 235, 285];
    let k = 0;
    const step = () => {
      if (k < delays.length) {
        const others = list.filter((g) => g !== chosen);
        show(others.length ? others[Math.floor(Math.random() * others.length)] : chosen, 'spin');
        sfx.tick();
        timer = setTimeout(step, delays[k++]);
        return;
      }
      show(chosen, 'land');
      desc.textContent = chosen.desc || '';
      sfx.go(); buzz(25);
      again.disabled = list.length < 2; play.disabled = false;
    };
    step();
  };
  modal({
    title: '🎲 Et si on jouait à…',
    content: h('div', { class: 'col reel-wrap' }, reel, desc, h('div', { class: 'row' }, again, play)),
    actions: [],
    onOpen: (close) => {
      again.onclick = () => spin();
      play.onclick = () => { close(null); clearTimeout(timer); if (chosen) openScreen(chosen.id); };
      spin();
    },
  }).then(() => clearTimeout(timer));
}
let homeInstallRefresh = null;

// ---------------- Thèmes ----------------
async function openThemes() {
  const initial = settings.theme || 'ambiance';
  const wrap = h('div', { class: 'col' });
  function render() {
    const cur = settings.theme || 'ambiance';
    wrap.replaceChildren(
      toggleRow('✨ Animations et particules', 'Fonds qui bougent, flocons, emojis qui tombent… (désactive si le téléphone rame)', settings.themeFx !== false, (v) => { settings.themeFx = v; saveSettings(); applyTheme(); }),
      h('button', { class: 'btn btn-soft', onclick: () => { const pool = THEMES.filter((t) => t.id !== cur); setTheme(pool[Math.floor(Math.random() * pool.length)].id); sfx.pop(); render(); } }, '🎲 Thème au hasard'),
      THEME_CATS.map((c) => [
        h('div', { class: 'theme-cat' }, c.label),
        h('div', { class: 'theme-grid' }, THEMES.filter((t) => t.cat === c.id).map((t) => themeSwatch(t, t.id === cur, () => { setTheme(t.id); sfx.pop(); buzz(10); render(); }))),
      ]));
  }
  render();
  const v = await modal({ title: '🎨 Thème', content: wrap, actions: [{ label: 'Annuler', value: 'cancel' }, { label: 'Choisir', value: true, primary: true }] });
  if (v === 'cancel') setTheme(initial);
  else toast(`${themeById(settings.theme).emoji} Thème « ${themeById(settings.theme).name} » appliqué`, 1800);
}

async function openSettings() {
  const t = themeById(settings.theme);
  const themeBtn = h('button', { class: 'btn btn-soft theme-btn', onclick: async () => {
    await openThemes();
    const nt = themeById(settings.theme);
    themeBtn.replaceChildren(h('span', { class: 'sw-mini', style: { background: nt.bg } }, nt.emoji), h('span', { class: 'grow' }, h('b', null, '🎨 Thème'), h('div', { class: 'muted small' }, nt.name)), h('span', null, '›'));
  } }, h('span', { class: 'sw-mini', style: { background: t.bg } }, t.emoji), h('span', { class: 'grow' }, h('b', null, '🎨 Thème'), h('div', { class: 'muted small' }, `${t.name} · ${THEMES.length} au choix`)), h('span', null, '›'));
  const content = h('div', { class: 'col' },
    themeBtn,
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
    h('p', { class: 'muted tiny center' }, 'Ambiance · fonctionne hors ligne une fois installé · le jeu en ligne utilise une connexion directe entre téléphones (WebRTC) ou, à défaut, un relais public avec messages chiffrés.'),
    h('p', { class: 'muted tiny center' }, 'Illustrations des jeux : Fluent Emoji de Microsoft (licence MIT).'),
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
      const reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
      if (reg.waiting) reg.waiting.postMessage('skipWaiting');
      // Cherche une nouvelle version à chaque retour dans l'appli.
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
      // Nouvelle version active : on recharge tout de suite sur l'accueil, sinon on propose (pour ne pas couper une partie).
      const hadController = !!navigator.serviceWorker.controller;
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloaded) return;
        if (!current) { reloaded = true; location.reload(); return; }
        const t = toast(h('span', null, '✨ Nouvelle version prête ', h('button', { class: 'btn btn-sm btn-primary', onclick: () => { reloaded = true; location.reload(); } }, 'Recharger')), 60000);
        t.style.pointerEvents = 'auto';
      });
    } catch (e) { console.warn('SW', e); }
  });
}

// ---------------- Démarrage ----------------
applyTheme();
// Changement de thème depuis les réglages : l'accueil se recolore aussitôt.
document.addEventListener('theme-changed', () => { if (!current && document.querySelector('.home')) renderHome(); });
document.addEventListener('pointerdown', () => sfx.unlock(), { once: true });
const target = parseHash();
history.replaceState({ screen: 'home' }, '', location.pathname + location.search);
renderHome();
if (target) openScreen(target.id, target.opts, true);
