// Écran télé : la partie en grand sur un ordinateur ou une télé, les téléphones servent de manettes.
// La télé rejoint la partie comme un écran (pas comme un joueur) et ne reçoit que la vue publique
// (Host.viewForTv dans room.js) : jamais le mot secret, le rôle ou la réponse d'un joueur.
// Un jeu peut fournir son propre écran : tv(room, s) chez l'hôte + tvMount(root, g) ici (voir race.js).
// Sinon : écran commun (jeu en cours, « regardez vos téléphones », podium à la fin).
import { h } from '../ui.js';
import { sfx } from '../sfx.js';
import { gameColors } from '../themes.js';
import { onlineGame } from './games.js';
import { tvEnd } from './kit.js';

/**
 * g : { now(), joinUrl(code), qr(el, url) }.
 * Renvoie { render(room), onDraw(op), destroy() }.
 */
export function createTvUi(root, g) {
  document.body.classList.add('tv-mode');
  const title = h('div', { class: 'tv-title' });
  const code = h('div', { class: 'tv-code' });
  const qr = h('div', { class: 'tv-qr', 'aria-hidden': 'true' });
  const fs = h('button', { class: 'icon-btn tv-fs', 'aria-label': 'Plein écran', title: 'Plein écran', onclick: toggleFullscreen }, '⛶');
  const quit = h('button', { class: 'icon-btn tv-fs', 'aria-label': g.host ? 'Fermer la télé' : 'Quitter l\'écran télé', title: 'Quitter', onclick: () => g.leave && g.leave() }, '✕');
  const sideTitle = h('div', { class: 'section-title' });
  const board = h('div', { class: 'tv-board' });
  const stage = h('div', { class: 'tv-stage' });
  root.replaceChildren(h('div', { class: 'tv' },
    h('header', { class: 'tv-head' },
      h('div', { class: 'logo' }, 'Ambiance'), title,
      h('div', { class: 'tv-join' }, h('div', { class: 'tv-join-txt' }, h('span', null, 'Pour jouer'), code), qr), fs, quit),
    h('div', { class: 'tv-main' }, stage, h('aside', { class: 'tv-side' }, sideTitle, board))));

  let room = null;
  let qrFor = null;
  let mode = null;      // 'lobby' | 'generic' | 'special'
  let gameView = null;  // écran spécial monté (tvMount)
  let gameType = null;
  let lobby = null;
  let generic = null;
  const shownScore = {}; // dernier score affiché, pour animer les points gagnés
  const pending = [];    // traits de dessin reçus avant le montage de l'écran

  const nameOf = (pid) => (room && room.players.find((p) => p.pid === pid)?.name) || '?';
  const tvCtx = { now: () => g.now(), nameOf, get room() { return room; }, tv: true };

  function setMode(m, type = null) {
    if (mode === m && gameType === type) return false;
    if (gameView && gameView.destroy) { try { gameView.destroy(); } catch (e) { console.error(e); } }
    gameView = null; lobby = null; generic = null;
    mode = m; gameType = type;
    stage.replaceChildren();
    stage.className = 'tv-stage tv-' + m;
    return true;
  }

  // ---------- Salon : on invite à rejoindre ----------
  function renderLobby() {
    if (setMode('lobby') || !lobby) {
      const bigQr = h('div', { class: 'tv-bigqr' });
      const url = g.joinUrl(room.code);
      g.qr(bigQr, url);
      lobby = { players: h('div', { class: 'tv-bubbles' }), next: h('div', { class: 'tv-next' }), votes: h('div', { class: 'tv-votes' }), seen: new Set() };
      stage.append(
        h('div', { class: 'tv-invite' },
          h('div', { class: 'col' },
            h('h1', null, 'Rejoignez la partie !'),
            h('p', null, '📱 Scannez le QR code avec l\'appareil photo, ou ouvrez ', h('b', null, shortUrl()), ' → Online → Rejoindre le salon, et tapez le code :'),
            h('div', { class: 'tv-bigcode' }, room.code)),
          bigQr),
        lobby.next, lobby.players, lobby.votes);
    }
    const pl = room.players;
    lobby.players.replaceChildren(...pl.map((p) => {
      const fresh = !lobby.seen.has(p.pid);
      lobby.seen.add(p.pid);
      return h('span', { class: 'tv-bubble' + (p.on ? '' : ' off') + (fresh ? ' pop-in' : '') }, (p.pid === room.host ? '👑 ' : '') + p.name);
    }));
    const next = room.pick && onlineGame(room.pick);
    const chef = pl.find((p) => p.pid === room.host);
    lobby.next.replaceChildren(...(next
      ? [h('span', { class: 'muted' }, 'Prochain jeu'), h('b', null, `${next.emoji} ${next.name}`), h('span', { class: 'muted' }, next.short || '')]
      : chef ? [h('span', null, `👑 ${chef.name} choisit le jeu, les autres votent sur leur téléphone`)]
        : [h('span', { class: 'muted' }, '👑 Le premier joueur arrivé sera le chef : il choisira les jeux.')]));
    // Votes des joueurs : barres qui grandissent.
    const counts = {};
    for (const [pid, gid] of Object.entries(room.votes || {})) if (pl.some((p) => p.pid === pid && p.on)) counts[gid] = (counts[gid] || 0) + 1;
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = ranked.length ? ranked[0][1] : 1;
    lobby.votes.replaceChildren(...(ranked.length ? [h('div', { class: 'section-title' }, '🗳️ Les votes'), ...ranked.map(([gid, n]) => {
      const gm = onlineGame(gid);
      return h('div', { class: 'tv-vote' }, h('span', { class: 'nm' }, gm ? `${gm.emoji} ${gm.name}` : gid),
        h('span', { class: 'bar' }, h('span', { style: { width: Math.round((n / max) * 100) + '%' } })), h('b', null, String(n)));
    })] : []));
  }

  // ---------- Écran commun (jeux sans écran télé spécial) ----------
  function renderGeneric(mod, v) {
    setMode('generic', mod.id);
    if (!generic) { generic = h('div', { class: 'tv-generic' }); stage.append(generic); generic.dataset.k = ''; }
    const ended = !!(v && v.ended);
    const k = mod.id + ':' + ended;
    if (generic.dataset.k === k) return;
    generic.dataset.k = k;
    if (ended) { generic.replaceChildren(...tvEnd(room)); sfx.fanfare(); return; }
    generic.replaceChildren(
      h('div', { class: 'tv-hero' }, mod.emoji),
      h('h1', null, mod.name),
      h('p', { class: 'tv-sub' }, mod.short || ''),
      h('p', { class: 'tv-phones' }, '📱 À vous de jouer sur vos téléphones !'));
  }

  // ---------- Classement (à droite) ----------
  function renderBoard() {
    const inGame = !!room.game;
    sideTitle.textContent = inGame ? '🏆 Classement' : `👥 ${room.players.length} joueur${room.players.length > 1 ? 's' : ''}`;
    const list = room.players.slice().sort((a, b) => (inGame ? b.score - a.score : 0));
    board.replaceChildren(...list.map((p, i) => {
      const before = shownScore[p.pid];
      const gain = inGame && before != null && p.score > before ? p.score - before : 0;
      shownScore[p.pid] = p.score;
      return h('div', { class: 'tv-row' + (p.on ? '' : ' off') },
        h('span', { class: 'rk' }, inGame ? String(i + 1) : (p.pid === room.host ? '👑' : '•')),
        h('span', { class: 'nm' }, p.name),
        inGame ? h('span', { class: 'sc' }, String(p.score)) : null,
        gain ? h('span', { class: 'gain' }, '+' + gain) : null);
    }));
  }

  function shortUrl() { return (location.host + location.pathname).replace(/\/(index\.html)?$/, ''); }

  return {
    render(r) {
      room = r;
      code.textContent = r.code;
      if (qrFor !== r.code) { qrFor = r.code; g.qr(qr, g.joinUrl(r.code)); }
      if (!r.tv) {
        // Hôte avec une ancienne version de l'appli : il nous prend pour un joueur.
        setMode('old');
        stage.replaceChildren(h('div', { class: 'tv-generic' }, h('div', { class: 'tv-hero' }, '📺'), h('h1', null, 'Mettez à jour l\'appli de l\'hôte'),
          h('p', { class: 'tv-sub' }, 'Son téléphone a une ancienne version d\'Ambiance, sans écran télé. Il suffit de rouvrir l\'appli.')));
        return;
      }
      const mod = r.game && onlineGame(r.game.type);
      title.replaceChildren(...(mod ? [h('span', null, mod.emoji), ' ', mod.name] : [h('span', { class: 'muted' }, `${r.tvHost ? '📺 TV Mode · ' : ''}Salon ${r.code}`)]));
      if (!r.game || !mod) renderLobby();
      else if (r.game.special && mod.tvMount) {
        if (setMode('special', mod.id) || !gameView) {
          const [c1, c2] = gameColors(mod.id, mod.colors || ['#ff4d8d', '#7c5cff']);
          stage.style.setProperty('--g1', c1); stage.style.setProperty('--g2', c2);
          gameView = mod.tvMount(stage, tvCtx);
          sfx.go();
          while (pending.length && gameView.onDraw) gameView.onDraw(pending.shift());
          pending.length = 0;
        }
        gameView.update(r, r.game.v);
      } else renderGeneric(mod, r.game.v);
      renderBoard();
    },
    onDraw(op) {
      if (gameView && gameView.onDraw) gameView.onDraw(op);
      else if (pending.length < 500) pending.push(op);
    },
    destroy() {
      setMode(null);
      document.body.classList.remove('tv-mode');
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    },
  };
}

function toggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  } catch { /* pas de plein écran (iPhone…) */ }
}
