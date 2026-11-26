// Mode en ligne : salon, hôte faisant autorité, clients, reconnexion.
// Architecture : l'hôte garde l'état complet du jeu. Les clients envoient des
// actions ; l'hôte les applique puis diffuse à chacun SA vue de l'état
// (filtrée : par ex. le mot à dessiner n'est envoyé qu'au dessinateur).
import { h, toast, modal, confirmBox, uid, chip, setText } from '../ui.js';
import { getName, setName, get, set } from '../store.js';
import { CONFIG } from '../config.js';
import { ONLINE_GAMES, onlineGame, localIdOf } from './games.js';
import { FILTERS, gameById } from '../games/index.js';
import { gameColors } from '../themes.js';
import { RelayHub, relayConnect } from './relay.js';
import { pack, unpack, shiftTimes, saveHost, loadHost, clearHost, saveSeat, loadSeat, clearSeat, resumeText } from './save.js';
import { sfx, buzz } from '../sfx.js';
import { createTvUi } from './tv.js';

const LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';
const makeCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
const cleanName = (n) => String(n || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'Joueur';

function loadScript(src, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => (window[globalName] ? resolve(window[globalName]) : reject(new Error(globalName)));
    s.onerror = () => reject(new Error('Chargement impossible : ' + src));
    document.head.append(s);
  });
}

function peerOptions() {
  const o = { debug: 1, config: { iceServers: CONFIG.iceServers } };
  const q = new URLSearchParams(location.search);
  const host = q.get('peerhost') || CONFIG.peerHost;
  if (host) {
    o.host = host;
    o.port = Number(q.get('peerport') || CONFIG.peerPort || 443);
    o.path = q.get('peerpath') || CONFIG.peerPath || '/';
    o.secure = q.has('peersecure') ? q.get('peersecure') !== '0' : (q.get('peerhost') ? o.port === 443 : CONFIG.peerSecure);
  }
  return o;
}

function myPid() {
  let pid = null;
  try { pid = sessionStorage.getItem('ambiance:pid'); } catch { /* ignore */ }
  if (!pid) { pid = uid(); try { sessionStorage.setItem('ambiance:pid', pid); } catch { /* ignore */ } }
  return pid;
}

/** Identifiant de l'écran télé (distinct de celui du joueur sur le même appareil). */
function tvPid() {
  let pid = null;
  try { pid = sessionStorage.getItem('ambiance:tvpid'); } catch { /* ignore */ }
  if (!pid) { pid = 'tv-' + uid(); try { sessionStorage.setItem('ambiance:tvpid', pid); } catch { /* ignore */ } }
  return pid;
}

const joinUrl = (code) => location.origin + location.pathname + location.search + '#/join/' + code;
/** Dessine le QR code d'un lien dans `el` (SVG qui suit la taille de l'élément). */
function drawQr(el, url) {
  loadScript('vendor/qrcode.js', 'qrcode').then((qrcode) => {
    const q = qrcode(0, 'M'); q.addData(url); q.make();
    el.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }).catch(() => el.remove());
}

function openPeer(Peer, id) {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, peerOptions()) : new Peer(peerOptions());
    const t = setTimeout(() => { cleanup(); try { peer.destroy(); } catch { /* */ } reject(Object.assign(new Error('timeout'), { type: 'timeout' })); }, 15000);
    const onOpen = () => { cleanup(); resolve(peer); };
    const onErr = (e) => { cleanup(); try { peer.destroy(); } catch { /* */ } reject(e); };
    function cleanup() { clearTimeout(t); peer.off('open', onOpen); peer.off('error', onErr); }
    peer.on('open', onOpen);
    peer.on('error', onErr);
  });
}

function errText(e) {
  const t = e && e.type;
  if (t === 'peer-unavailable') return 'Partie introuvable. Vérifie le code (l\'hôte doit garder l\'appli ouverte).';
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed' || t === 'timeout') return 'Impossible de joindre le serveur de connexion. Vérifie ta connexion Internet.';
  if (t === 'browser-incompatible') return 'Ce navigateur ne permet pas le jeu en ligne.';
  if (t === 'webrtc' || t === 'negotiation-failed' || t === 'relay') return 'Partie introuvable ou injoignable. Vérifie le code et ta connexion Internet (l\'hôte doit garder l\'appli ouverte).';
  return 'Erreur de connexion' + (t ? ` (${t})` : '') + '.';
}

// =====================================================================
// HÔTE
// =====================================================================
class Host {
  // saved : partie enregistrée dans le téléphone (save.js) à reprendre, ou rien pour une nouvelle partie.
  // tvHost : cet appareil est la télé du TV Mode. Il fait tourner la partie mais n'est pas un joueur : le chef
  // (room.host, qui choisit les jeux et a les boutons « hôte » des jeux) est le premier téléphone arrivé.
  constructor(peer, code, me, deliver, saved, { tvHost = false } = {}) {
    this.peer = null;
    this.code = code;
    this.me = me;
    this.tvHost = !!(tvHost || (saved && saved.room && saved.room.tvHost));
    this.self = this.tvHost ? null : me.pid; // joueur de cet appareil (aucun pour la télé)
    this.deliver = deliver; // livre un message à l'interface locale de l'hôte
    this.room = this.tvHost
      ? { code, host: null, pick: null, players: [], game: null, votes: {}, tvHost: true }
      : { code, host: me.pid, pick: null, players: [{ pid: me.pid, name: me.name, score: 0, on: true }], game: null, votes: {} };
    this.conns = new Map();
    this.tvs = new Map(); // écrans télé (pid → connexion) : ni joueurs, ni secrets, juste la vue publique
    this.mod = null;
    this.gs = null;
    if (saved) this.restore(saved);
    this.iv = setInterval(() => this.tick(), 250);
    this.hb = setInterval(() => this.heartbeat(), 4000);
    if (peer) this.attachPeer(peer);
    // Les joueurs dont la connexion directe échoue arrivent par le relais.
    this.hub = new RelayHub(code, (conn) => this.attach(conn));
    // La partie est enregistrée dans le téléphone : si l'appli est fermée (téléphone verrouillé, appli
    // tuée, page rechargée…), l'hôte la reprend au même point. Enregistrement immédiat quand on quitte l'écran.
    // Les joueurs sont prévenus tout de suite (« Alice a quitté l'appli un instant… »).
    this.onHide = () => {
      if (this.dead) return;
      if (document.visibilityState === 'hidden') { this.saveNow(); this.away(false); } else this.broadcast();
    };
    this.onPageHide = () => { if (this.dead) return; this.saveNow(); this.away(true); };
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onPageHide);
    this.saveNow();
  }

  attachPeer(peer) {
    this.peer = peer;
    peer.on('connection', (conn) => this.attach(conn));
    peer.on('disconnected', () => { if (!this.dead) setTimeout(() => { try { if (!this.dead && peer.disconnected) peer.reconnect(); } catch { /* */ } }, 1500); });
    peer.on('error', (e) => console.warn('peer host error', e && e.type));
  }

  /** Reprise : l'adresse directe est encore réservée par l'ancienne session. On réessaie en fond (le relais marche déjà). */
  retryPeer(Peer, left = 12) {
    if (this.dead || this.peer || left <= 0) return;
    this.peerT = setTimeout(async () => {
      try {
        const peer = await openPeer(Peer, CONFIG.idPrefix + this.code);
        if (this.dead) { try { peer.destroy(); } catch { /* */ } return; }
        this.attachPeer(peer);
      } catch { this.retryPeer(Peer, left - 1); }
    }, 5000);
  }

  /** Reprend une partie enregistrée : joueurs, scores, jeu en cours (minuteurs décalés de la durée de la coupure). */
  restore(saved) {
    const r = unpack(saved.room);
    r.code = this.code;
    if (this.self) r.host = this.self; // en TV Mode, le chef reste celui d'avant
    r.votes = r.votes || {};
    for (const p of r.players) if (p.pid === this.self) p.on = true;
    this.room = r;
    // Les joueurs qui étaient là ont un moment pour revenir avant d'être comptés comme partis.
    this.graceUntil = Date.now() + (CONFIG.rejoinGrace || 45000);
    const mod = r.game && onlineGame(r.game.type);
    this.resumedGame = false;
    if (mod && saved.game && saved.game.gs) {
      try {
        const gs = shiftTimes(unpack(saved.game.gs), saved.at, Date.now() - saved.at);
        if (mod.restore) mod.restore(r, gs, this.api);
        this.mod = mod;
        this.gs = gs;
        this.resumedGame = true;
      } catch (e) { console.warn('reprise du jeu impossible', e); }
    }
    if (!this.resumedGame) { r.game = null; this.mod = null; this.gs = null; }
  }

  /** gone : la page se ferme (rechargement, appli tuée) ; sinon l'appli passe juste en arrière-plan. */
  away(gone) { for (const c of [...this.conns.values(), ...this.tvs.values()]) this.safeSend(c, { t: 'away', gone }); }

  scheduleSave() {
    if (this.saveT || this.dead) return;
    this.saveT = setTimeout(() => { this.saveT = null; this.saveNow(); }, 1000);
  }

  saveNow() {
    if (this.dead) return;
    clearTimeout(this.saveT); this.saveT = null;
    let game = null;
    if (this.room.game && this.mod) {
      let gs = null;
      try { gs = pack(this.gs); } catch (e) { if (!this.packWarned) { this.packWarned = true; console.warn('partie non enregistrable', e.message); } }
      game = { gs, label: `${this.mod.emoji} ${this.mod.name}` };
    }
    this.lastSave = Date.now();
    saveHost({ code: this.code, room: pack(this.room), game, n: this.room.players.length });
  }

  get api() {
    return {
      now: () => Date.now(),
      relay: (op, except) => this.relay(op, except),
      sendTo: (pid, msg) => this.sendTo(pid, msg),
      toastAll: (msg) => this.toastAll(msg),
    };
  }

  attach(conn) {
    conn._seen = Date.now();
    conn.on('data', (m) => { conn._seen = Date.now(); try { this.onData(conn, m); } catch (e) { console.error(e); } });
    conn.on('close', () => this.onClose(conn));
    conn.on('error', () => this.onClose(conn));
  }

  onData(conn, m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'ping') { this.safeSend(conn, { t: 'pong' }); return; }
    if (m.t === 'hello') {
      let pid = String(m.pid || '').slice(0, 40);
      if (!pid || pid === this.self) return;
      if (m.tv) { this.addTv(conn, pid); return; }
      let p = this.room.players.find((x) => x.pid === pid);
      if (!p) {
        // Même prénom qu'un joueur parti (appli rouverte depuis un autre onglet, Safari → appli installée…) :
        // c'est sûrement lui, il retrouve sa place et ses points.
        const nm = cleanName(m.name).toLowerCase();
        p = this.room.players.find((x) => !x.on && x.pid !== this.self && x.name.toLowerCase() === nm && !this.conns.has(x.pid)) || null;
        if (p) pid = p.pid;
      }
      if (!p) {
        if (this.room.players.length >= CONFIG.maxPlayers) {
          this.safeSend(conn, { t: 'bye', reason: 'La partie est complète.' });
          setTimeout(() => conn.close(), 400);
          return;
        }
        let name = cleanName(m.name);
        const base = name;
        let i = 2;
        while (this.room.players.some((x) => x.name.toLowerCase() === name.toLowerCase())) name = `${base} ${i++}`;
        p = { pid, name, score: 0, on: true };
        this.room.players.push(p);
        this.toastAll(`👋 ${p.name} a rejoint la partie`, pid);
        if (this.room.game && this.mod.onJoin) this.mod.onJoin(this.room, this.gs, pid, this.api);
      } else {
        if (!p.on) this.toastAll(`🔌 ${p.name} est de retour`, pid);
        p.on = true;
      }
      const old = this.conns.get(pid);
      if (old && old !== conn) { old._replaced = true; try { old.close(); } catch { /* */ } }
      conn._pid = pid;
      this.conns.set(pid, conn);
      this.ensureLeader();
      this.safeSend(conn, { t: 'welcome', pid, name: p.name });
      this.broadcast();
      if (this.room.game && this.mod.onSync) this.mod.onSync(this.room, this.gs, pid, this.api);
      return;
    }
    if (m.t === 'act' && conn._pid && this.conns.get(conn._pid) === conn) this.handle(conn._pid, m.a);
  }

  /** Un écran télé se branche : il reçoit la vue publique (jamais les secrets d'un joueur). */
  addTv(conn, pid) {
    const old = this.tvs.get(pid);
    if (old && old !== conn) { old._replaced = true; try { old.close(); } catch { /* */ } }
    conn._pid = pid;
    conn._tv = true;
    this.tvs.set(pid, conn);
    this.safeSend(conn, { t: 'welcome', pid, tv: true });
    // Le dessin en cours (seulement pour les jeux qui le montrent à la télé).
    if (this.room.game && this.mod && this.mod.tvRelay && this.mod.onSync) { try { this.mod.onSync(this.room, this.gs, pid, this.api); } catch (e) { console.error(e); } }
    this.broadcast();
  }

  onClose(conn) {
    if (conn._replaced || conn._closed) return;
    conn._closed = true;
    if (conn._tv) {
      if (this.tvs.get(conn._pid) === conn) { this.tvs.delete(conn._pid); this.broadcast(); }
      return;
    }
    const pid = conn._pid;
    if (!pid || this.conns.get(pid) !== conn) return;
    this.conns.delete(pid);
    const p = this.room.players.find((x) => x.pid === pid);
    if (p) {
      p.on = false;
      this.toastAll(`📴 ${p.name} s'est déconnecté`);
      if (this.room.game && this.mod.onLeave) this.mod.onLeave(this.room, this.gs, pid, this.api);
      this.ensureLeader();
      this.broadcast();
    }
  }

  /** TV Mode : il faut toujours un chef connecté (le premier arrivé ; s'il part, le suivant prend la relève). */
  ensureLeader() {
    if (!this.tvHost) return;
    const cur = this.room.players.find((x) => x.pid === this.room.host);
    if (cur && cur.on) return;
    const next = this.room.players.find((x) => x.on);
    if (!next || next.pid === this.room.host) return;
    this.room.host = next.pid;
    this.toastAll(`👑 ${next.name} est le chef : il choisit les jeux`);
  }

  heartbeat() {
    const now = Date.now();
    for (const conn of [...this.conns.values(), ...this.tvs.values()]) {
      if (now - conn._seen > 16000) { try { conn.close(); } catch { /* */ } this.onClose(conn); }
    }
    // Après une reprise : ceux qui ne sont pas revenus à temps sont comptés comme partis.
    if (this.graceUntil && now > this.graceUntil) {
      this.graceUntil = 0;
      let changed = false;
      for (const p of this.room.players) {
        if (p.on && p.pid !== this.self && !this.conns.has(p.pid)) {
          p.on = false; changed = true;
          if (this.room.game && this.mod && this.mod.onLeave) { try { this.mod.onLeave(this.room, this.gs, p.pid, this.api); } catch (e) { console.error(e); } }
        }
      }
      if (changed) { this.ensureLeader(); this.broadcast(); }
    }
    // TV Mode : un chef qui n'est plus connecté depuis 15 s (par ex. il n'est pas revenu après le rechargement
    // de la télé) passe la main à un joueur connecté.
    if (this.tvHost && this.room.host) {
      if (this.conns.has(this.room.host)) this.leaderGone = 0;
      else if (!this.leaderGone) this.leaderGone = now;
      else if (now - this.leaderGone > 15000) {
        const next = this.room.players.find((x) => x.on && this.conns.has(x.pid));
        if (next) {
          this.room.host = next.pid; this.leaderGone = 0;
          this.toastAll(`👑 ${next.name} est le chef : il choisit les jeux`);
          this.broadcast();
        }
      }
    }
    // Pendant un jeu, les minuteurs avancent sans forcément tout renvoyer : on enregistre régulièrement.
    if (now - (this.lastSave || 0) > (this.room.game ? 4000 : 30000)) this.saveNow();
  }

  handle(pid, a) {
    if (!a || typeof a !== 'object') return;
    const isHost = pid === this.room.host;
    switch (a.type) {
      case 'lobby:pick':
        if (isHost) { this.room.pick = a.game; this.broadcast(); }
        return;
      case 'lobby:vote': {
        // Chaque joueur vote pour le jeu qu'il veut (toucher encore = retirer son vote). Le chef décide.
        if (this.room.game || !this.room.players.some((x) => x.pid === pid)) return;
        if (!a.game || !onlineGame(a.game) || this.room.votes[pid] === a.game) delete this.room.votes[pid];
        else this.room.votes[pid] = a.game;
        this.broadcast();
        return;
      }
      case 'lobby:start':
        if (isHost) this.startGame(a.game, a.settings);
        return;
      case 'lobby:restart':
        if (isHost && this.room.game) this.startGame(this.room.game.type, this.room.game.settings);
        return;
      case 'lobby:end':
        if (isHost) { this.room.game = null; this.gs = null; this.mod = null; this.broadcast(); }
        return;
      case 'kick':
        if (isHost && a.pid && a.pid !== pid && a.pid !== this.self) {
          const c = this.conns.get(a.pid);
          if (c) { c._replaced = true; this.safeSend(c, { t: 'bye', reason: 'L\'hôte t\'a retiré de la partie.' }); setTimeout(() => { try { c.close(); } catch { /* */ } }, 400); }
          this.conns.delete(a.pid);
          this.room.players = this.room.players.filter((p) => p.pid !== a.pid);
          delete this.room.votes[a.pid];
          if (this.room.game && this.mod.onLeave) this.mod.onLeave(this.room, this.gs, a.pid, this.api);
          this.broadcast();
        }
        return;
      default: break;
    }
    if (this.room.game && this.mod) {
      try {
        if (this.mod.action(this.room, this.gs, pid, a, this.api)) this.broadcast();
      } catch (e) { console.error(e); }
    }
  }

  startGame(type, settings) {
    const mod = onlineGame(type);
    if (!mod) return;
    // Jeux réservés au TV Mode (tvOnly) : c'est la télé qui doit faire tourner la partie.
    if (mod.tvOnly && !this.room.tvHost) {
      this.sendTo(this.room.host, { t: 'toast', msg: `📺 ${mod.name} se joue en TV Mode : c'est la télé qui crée le salon.` });
      return;
    }
    const active = this.room.players.filter((p) => p.on);
    if (active.length < mod.minPlayers) {
      this.sendTo(this.room.host, { t: 'toast', msg: `Il faut au moins ${mod.minPlayers} joueurs connectés pour ce jeu.` });
      return;
    }
    // On retire les joueurs partis depuis longtemps.
    this.room.players = this.room.players.filter((p) => p.on);
    this.room.players.forEach((p) => { p.score = 0; });
    this.room.votes = {};
    this.ensureLeader();
    const s = { ...mod.defaults, ...(settings || {}) };
    this.mod = mod;
    this.room.pick = type;
    this.room.game = { type, settings: s };
    this.gs = mod.init(this.room, s, this.api);
    this.broadcast();
  }

  tick() {
    if (this.room.game && this.mod && this.mod.tick) {
      try { if (this.mod.tick(this.room, this.gs, this.api)) this.broadcast(); } catch (e) { console.error(e); }
    }
    if (this.room.game && this.mod && this.mod.frame && !this.raf) this.startFrames();
  }

  /**
   * Jeux en temps réel (mod.frame, ex. Dans la foule) : la partie avance à chaque image de l'écran, pas
   * seulement 4 fois par seconde. frame(room, s, dt, api) renvoie true quand il faut renvoyer la vue à tous.
   * La boucle s'arrête d'elle-même quand le jeu change (et se met en pause quand la page est cachée).
   */
  startFrames() {
    let last = performance.now();
    const loop = (ts) => {
      if (this.dead || !this.room.game || !this.mod || !this.mod.frame) { this.raf = 0; return; }
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000));
      last = ts;
      try { if (this.mod.frame(this.room, this.gs, dt, this.api)) this.broadcast(); } catch (e) { console.error(e); }
    };
    this.raf = requestAnimationFrame(loop);
  }

  viewFor(pid) {
    const r = this.room;
    return {
      code: r.code, host: r.host, pick: r.pick, tvs: this.tvs.size, tvHost: !!r.tvHost, votes: r.votes || {},
      players: r.players.map((p) => ({ pid: p.pid, name: p.name, score: p.score, on: p.on })),
      game: r.game ? { type: r.game.type, settings: r.game.settings, v: this.mod.view(r, this.gs, pid) } : null,
    };
  }

  /**
   * Vue de la télé : uniquement ce que tout le monde a le droit de voir. Un jeu qui a un écran télé fournit
   * tv(room, s) ; sinon la télé affiche un écran commun (jeu en cours, classement, podium à la fin).
   */
  viewForTv() {
    const r = this.room;
    let v = null;
    if (r.game && this.mod) {
      try { v = this.mod.tv ? this.mod.tv(r, this.gs) : { ended: !!this.gs && (this.gs.phase === 'end' || this.gs.over === true) }; } catch (e) { console.error(e); v = {}; }
    }
    return {
      tv: true, code: r.code, host: r.host, pick: r.pick, tvs: this.tvs.size, tvHost: !!r.tvHost, votes: r.votes || {},
      players: r.players.map((p) => ({ pid: p.pid, name: p.name, score: p.score, on: p.on })),
      game: r.game ? { type: r.game.type, special: !!(this.mod && this.mod.tv), v } : null,
    };
  }

  safeSend(conn, msg) { try { if (conn.open) conn.send(msg); } catch (e) { console.warn('send', e); } }

  broadcast() {
    const now = Date.now();
    for (const [pid, c] of this.conns) this.safeSend(c, { t: 'state', now, room: this.viewFor(pid) });
    if (this.tvs.size) { const tv = this.viewForTv(); for (const c of this.tvs.values()) this.safeSend(c, { t: 'state', now, room: tv }); }
    // Écran de cet appareil : la vue de son joueur, ou celle de la télé (TV Mode).
    this.deliver({ t: 'state', now, room: this.self ? this.viewFor(this.self) : this.viewForTv() });
    this.scheduleSave();
  }

  relay(op, except) {
    for (const [pid, c] of this.conns) if (pid !== except) this.safeSend(c, { t: 'draw', op });
    // La télé ne reçoit le dessin que des jeux où il est public (Je dessine) : pas celui du Téléphone dessiné.
    if (this.mod && this.mod.tvRelay) for (const c of this.tvs.values()) this.safeSend(c, { t: 'draw', op });
    if (this.self ? except !== this.self : this.mod && this.mod.tvRelay) this.deliver({ t: 'draw', op });
  }

  sendTo(pid, msg) {
    if (pid && pid === this.self) { this.deliver(msg); return; }
    const c = this.conns.get(pid) || this.tvs.get(pid);
    if (c) this.safeSend(c, msg);
  }

  toastAll(msg, except) {
    for (const [pid, c] of [...this.conns, ...this.tvs]) if (pid !== except) this.safeSend(c, { t: 'toast', msg });
    if (!this.self || except !== this.self) this.deliver({ t: 'toast', msg });
  }

  send(a) { if (this.self) this.handle(this.self, a); }

  // keep = garder la partie enregistrée (fermeture involontaire) ; sinon l'hôte a quitté : plus rien à reprendre.
  destroy(keep) {
    if (keep) this.saveNow(); else clearHost();
    this.dead = true;
    clearInterval(this.iv);
    clearInterval(this.hb);
    if (this.raf) cancelAnimationFrame(this.raf);
    clearTimeout(this.saveT);
    clearTimeout(this.peerT);
    document.removeEventListener('visibilitychange', this.onHide);
    window.removeEventListener('pagehide', this.onPageHide);
    for (const c of [...this.conns.values(), ...this.tvs.values()]) this.safeSend(c, { t: 'bye', reason: 'L\'hôte a fermé la partie.' });
    this.hub.destroy();
    setTimeout(() => { try { this.peer && this.peer.destroy(); } catch { /* */ } }, 400);
  }
}

// =====================================================================
// CLIENT
// =====================================================================
class Client {
  constructor(peer, code, me, deliver, onStatus) {
    this.peer = peer;
    this.code = code;
    this.me = me;
    this.deliver = deliver;
    this.onStatus = onStatus;
    this.conn = null;
    this.dead = false;
    this.attempts = 0;
    this.lastMsg = Date.now();
    this.welcomed = false;
    this.useRelay = !peer; // pas de serveur de connexion directe : on passe directement par le relais
    if (peer) {
      peer.on('error', (e) => {
        if (this.dead || this.useRelay) return;
        if (e && e.type === 'peer-unavailable') {
          // Hôte introuvable en direct (ou connexion directe impossible) : on tente le relais.
          if (!this.welcomed) this.toRelay();
          else this.retryLater();
        } else if (e && (e.type === 'network' || e.type === 'disconnected' || e.type === 'server-error')) {
          if (!this.welcomed) this.toRelay(); else this.retryLater();
        }
      });
      peer.on('disconnected', () => { if (!this.dead && !this.useRelay) setTimeout(() => { try { if (!this.dead && peer.disconnected) peer.reconnect(); } catch { /* */ } }, 1000); });
    }
    this.ping = setInterval(() => {
      if (this.dead) return;
      if (this.conn && this.conn.open) { try { this.conn.send({ t: 'ping' }); } catch { /* */ } }
      if (this.welcomed && Date.now() - this.lastMsg > 15000 && !this.rt) this.lost();
    }, 4000);
    // Retour dans l'appli (téléphone déverrouillé) : on repart pour un délai d'attente complet.
    this.onVis = () => {
      if (document.visibilityState !== 'visible' || !this.welcomed) return;
      if (this.lostAt) this.lostAt = Date.now();
      if (!(this.conn && this.conn.open)) this.lost();
    };
    document.addEventListener('visibilitychange', this.onVis);
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.firstResolve = resolve;
      this.firstReject = reject;
      this.open();
    });
  }

  // La connexion directe ne passe pas (4G, box différentes…) : on bascule sur le relais.
  toRelay() {
    if (this.dead || this.useRelay) return;
    this.useRelay = true;
    console.info('Connexion directe impossible : passage par le relais.');
    if (!this.welcomed) this.onStatus('relay');
    this.open();
  }

  open() {
    if (this.dead) return;
    if (this.conn) { this.conn._stale = true; try { this.conn.close(); } catch { /* */ } }
    this.lastMsg = Date.now();
    const relay = this.useRelay;
    const conn = relay ? relayConnect(this.code) : this.peer.connect(CONFIG.idPrefix + this.code, { reliable: true, serialization: 'json' });
    this.conn = conn;
    const onTimeout = () => {
      if (conn.open || this.conn !== conn) return;
      conn._stale = true; try { conn.close(); } catch { /* */ }
      if (!relay) this.toRelay();
      else if (this.welcomed) this.retryLater();
      else this.fail({ type: 'relay' });
    };
    const timeout = setTimeout(onTimeout, relay ? 30000 : (CONFIG.directTimeout || 8000));
    conn.on('open', () => {
      if (conn._stale || this.conn !== conn) { try { conn.close(); } catch { /* */ } return; }
      clearTimeout(timeout);
      this.lastMsg = Date.now();
      conn.send({ t: 'hello', pid: this.me.pid, name: this.me.name, ...(this.me.tv ? { tv: true } : {}) });
    });
    conn.on('data', (m) => {
      this.lastMsg = Date.now();
      if (!m || typeof m !== 'object') return;
      if (m.t === 'welcome') {
        this.welcomed = true; this.attempts = 0; this.lostAt = 0;
        this.onStatus('online');
        if (this.firstResolve) { this.firstResolve(m); this.firstResolve = null; }
      }
      if (m.t === 'bye') { this.byeReason = m.reason; }
      if (m.t === 'away') {
        this.onStatus('away');
        // La page de l'hôte se ferme : la connexion va tomber, on passe tout de suite en reconnexion.
        if (m.gone) { setTimeout(() => { if (this.conn === conn && !this.dead) { conn._stale = true; try { conn.close(); } catch { /* */ } this.lost(); } }, 300); }
        return;
      }
      this.deliver(m);
    });
    conn.on('close', () => {
      clearTimeout(timeout);
      if (conn._stale || this.conn !== conn || this.dead) return;
      if (this.byeReason) this.onStatus('closed', this.byeReason);
      else if (!this.welcomed) relay ? this.fail({ type: 'relay' }) : this.toRelay();
      else this.lost();
    });
    conn.on('error', () => { /* géré par close */ });
  }

  fail(e) {
    if (this.firstReject) { this.firstReject(e); this.firstReject = null; this.destroy(); }
  }

  lost() {
    if (this.dead) return;
    if (!this.lostAt) this.lostAt = Date.now();
    this.onStatus('reconnecting');
    this.retryLater();
  }

  // On attend l'hôte jusqu'à CONFIG.hostWait (5 min) : son téléphone peut être verrouillé, ou il reprend la partie.
  retryLater() {
    if (this.dead || !this.welcomed || this.rt) return;
    this.attempts++;
    if (!this.lostAt) this.lostAt = Date.now();
    if (Date.now() - this.lostAt > (CONFIG.hostWait || 300000)) {
      this.onStatus('closed', `L'hôte ne répond plus. S'il reprend la partie, tu pourras la rejoindre avec le code ${this.code} : tu retrouveras tes points.`, true);
      return;
    }
    // La connexion directe ne revient pas : l'hôte n'est peut-être plus joignable qu'en relais (partie reprise).
    if (!this.useRelay && this.attempts >= 2) this.useRelay = true;
    this.onStatus('reconnecting');
    this.rt = setTimeout(() => {
      this.rt = null;
      if (this.dead) return;
      try { if (this.peer && !this.useRelay && this.peer.disconnected) this.peer.reconnect(); } catch { /* */ }
      this.open();
    }, Math.min(1000 * this.attempts, 5000));
  }

  send(a) {
    if (this.conn && this.conn.open) { try { this.conn.send({ t: 'act', a }); return true; } catch { /* */ } }
    toast('Connexion en cours… réessaie dans un instant');
    return false;
  }

  destroy() {
    this.dead = true;
    clearInterval(this.ping);
    clearTimeout(this.rt);
    document.removeEventListener('visibilitychange', this.onVis);
    try { this.conn && this.conn.close(); } catch { /* */ }
    setTimeout(() => { try { this.peer && this.peer.destroy(); } catch { /* */ } }, 200);
  }
}

// =====================================================================
// INTERFACE
// =====================================================================
export function start(ctx) {
  const { root, opts } = ctx;
  // Écran télé : rejoint la partie comme un écran (pas comme un joueur), affiche la vue publique en grand.
  const tvMode = !!opts.tv;
  const me = tvMode ? { pid: tvPid(), name: 'Écran télé', tv: true } : { pid: myPid(), name: getName() };
  let tvUi = null;
  let tvHostMode = false; // cet appareil est la télé du TV Mode et fait tourner la partie
  const asTv = () => { tvHostMode = true; Object.assign(me, { pid: tvPid(), name: 'Écran télé', tv: true }); };
  const isLeader = () => !!room && !!me.pid && room.host === me.pid; // le chef : choisit les jeux, a les boutons « hôte »
  let net = null;
  let isHost = false;
  let room = null;
  let offset = 0;
  let view = null;       // vue du jeu montée
  let viewType = null;
  let lobby = null;      // éléments du salon
  let status = 'online';
  let hostAway = false; // l'hôte a prévenu qu'il quittait l'appli
  const pendingDraw = [];
  const pendingMsgs = [];

  // ---------- Écran d'entrée ----------
  function entry(msg) {
    ctx.setGuard(null);
    const nameIn = h('input', { class: 'input', placeholder: 'Ton prénom', maxlength: '16', value: tvMode ? '' : me.name, autocomplete: 'nickname', enterkeyhint: 'next' });
    const getNameOk = () => {
      const n = cleanName(nameIn.value);
      if (!nameIn.value.trim()) { toast('Entre ton prénom'); nameIn.focus(); return null; }
      me.name = n; setName(n);
      return n;
    };
    const doCreate = () => { if (getNameOk()) createRoom(); };
    const joinFirst = !!opts.join || opts.joinPrompt;
    const saved = loadHost();
    // Partie enregistrée sur cet appareil : proposée dans le bon mode (télé du TV Mode, ou salon Online).
    const resumePanel = saved && !!saved.room.tvHost === tvMode ? h('div', { class: 'panel col resume-card' },
      h('h3', null, `🔁 Reprendre ${saved.room.tvHost ? 'la télé' : 'ta partie'} ${saved.code}`),
      h('p', { class: 'muted small' }, resumeText(saved)),
      h('button', { class: 'btn btn-primary btn-block', onclick: () => resumeRoom(saved) }, 'Reprendre la partie'),
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { clearHost(); resumePanel.remove(); } }, 'Non merci, l\'oublier')) : null;
    const codeBox = (value, onGo, label) => {
      const el = h('input', {
        class: 'input code-input', placeholder: 'CODE', maxlength: '4', value: value || '', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', enterkeyhint: 'go',
        'aria-label': label,
        oninput: (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); },
        onkeydown: (e) => { if (e.key === 'Enter') onGo(); },
      });
      return el;
    };
    const readCode = (el) => {
      const code = el.value.trim().toUpperCase();
      if (code.length !== 4) { toast('Le code fait 4 lettres'); el.focus(); return null; }
      return code;
    };
    const banner = msg ? h('div', { class: 'conn-banner' }, msg) : null;

    if (tvMode) {
      // ---------- TV Mode : la télé crée le salon, les téléphones scannent le QR code ----------
      const showIn = codeBox(opts.tv && opts.tv !== true ? opts.tv : '', () => doShow(), 'Code du salon à afficher');
      const doShow = () => { const c = readCode(showIn); if (c) { sfx.unlock(); ctx.open('online', { tv: c }); } };
      const playIn = codeBox('', () => doPlay(), 'Code affiché sur la télé');
      const doPlay = () => { const c = readCode(playIn); if (c) ctx.open('online', { join: c }); };
      const narrow = matchMedia('(max-width: 700px)').matches;
      root.replaceChildren(header(), banner, resumePanel,
        narrow ? h('p', { class: 'conn-banner soft' }, '📱 Tu es sur un téléphone ? Lance la télé depuis l\'ordinateur ou la télé, ou rejoins comme joueur plus bas.') : null,
        h('div', { class: 'tvmode-hero' },
          h('div', { class: 'tvmode-emo' }, '📺'),
          h('h2', null, 'Cet écran est la télé'),
          h('p', null, 'La partie s\'affiche ici en grand. Chacun rejoint avec son téléphone en scannant le QR code : rien à installer.'),
          h('button', { class: 'btn btn-big tvmode-go', onclick: () => { sfx.unlock(); createRoom({ tvHost: true }); } }, '▶ Lancer la télé')),
        h('ol', { class: 'panel tvmode-steps' },
          h('li', null, h('b', null, 'Lance la télé'), ' sur l\'ordinateur ou la télé (navigateur), ou sur un téléphone envoyé sur la télé (AirPlay, Chromecast).'),
          h('li', null, h('b', null, 'Chacun scanne le QR code'), ' affiché à l\'écran et tape son prénom.'),
          h('li', null, 'Le premier arrivé est le ', h('b', null, 'chef 👑'), ' : il lance les jeux, les autres votent pour ceux qu\'ils veulent.')),
        h('div', { class: 'panel col' },
          h('h3', null, '📱 Je suis un joueur'),
          h('p', { class: 'muted small' }, 'Scanne le QR code de la télé avec l\'appareil photo, ou tape le code affiché.'),
          h('div', { class: 'row' }, playIn, h('button', { class: 'btn btn-soft', style: { flex: 'none' }, onclick: doPlay }, 'Rejoindre'))),
        h('div', { class: 'panel col' },
          h('h3', null, '🔗 Afficher un salon déjà créé'),
          h('p', { class: 'muted small' }, 'Un téléphone a déjà créé le salon (mode Online) ? Affiche-le ici en grand avec son code.'),
          h('div', { class: 'row' }, showIn, h('button', { class: 'btn btn-soft', style: { flex: 'none' }, onclick: doShow }, 'Afficher'))));
      return;
    }

    // ---------- Online : créer ou rejoindre un salon ----------
    const codeIn = codeBox(opts.join || '', () => doJoin(), 'Code du salon');
    const doJoin = () => {
      if (!getNameOk()) return;
      const code = readCode(codeIn);
      if (code) joinRoom(code);
    };
    const createCard = h('div', { class: 'online-choice create' },
      h('div', { class: 'oc-head' }, h('span', { class: 'oc-emo' }, '🎉'), h('div', null, h('h2', null, 'Créer le salon'), h('p', null, 'Tu lances les jeux, les autres votent pour ceux qu\'ils veulent.'))),
      h('button', { class: 'btn btn-big btn-block', onclick: doCreate }, 'Créer le salon'));
    const joinCard = h('div', { class: 'online-choice join' },
      h('div', { class: 'oc-head' }, h('span', { class: 'oc-emo' }, '🔑'), h('div', null, h('h2', null, 'Rejoindre le salon'), h('p', null, 'Tape le code, ou scanne le QR code de celui qui a créé le salon.'))),
      codeIn, h('button', { class: 'btn btn-big btn-block', onclick: doJoin }, 'Rejoindre le salon'));
    root.replaceChildren(
      header(),
      banner,
      resumePanel,
      h('label', { class: 'field' }, 'Ton prénom', nameIn),
      ...(joinFirst ? [joinCard, createCard] : [createCard, joinCard]),
      h('div', { class: 'panel rules' },
        h('p', null, '📱 Chacun joue sur son téléphone. Pas besoin d\'installer l\'appli : le lien ou le QR code suffit.'),
        h('p', null, '📶 Marche en Wi-Fi comme en 4G/5G, même si vous n\'êtes pas au même endroit.'),
        h('p', null, '🔁 Appli fermée ou téléphone verrouillé ? L\'hôte reprend la partie là où elle en était, et chacun retrouve sa place et ses points.')),
    );
    if (opts.join && me.name) setTimeout(() => codeIn.value.length === 4 ? null : codeIn.focus(), 50);
    else if (!me.name) setTimeout(() => nameIn.focus(), 50);
    else if (joinFirst) setTimeout(() => codeIn.focus(), 50);
  }

  function header(extra) {
    return h('div', { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': 'Retour', onclick: leave }, '←'),
      h('span', { class: 'emo' }, tvMode ? '📺' : '🌐'),
      h('h1', null, room ? 'Salon ' : tvMode ? 'TV Mode' : 'Online', room ? h('span', { class: 'code' }, room.code) : null),
      extra || null);
  }

  function busy(text) {
    root.replaceChildren(header(), h('div', { class: 'big-center' }, h('div', { class: 'hero-emo' }, '📡'), h('h2', null, text), h('p', { class: 'muted' }, 'Quelques secondes…')));
  }

  async function getPeer() {
    return loadScript('vendor/peerjs.min.js', 'Peer');
  }

  // tvHost : la télé du TV Mode crée le salon (elle n'est pas un joueur, le premier téléphone arrivé est le chef).
  async function createRoom({ tvHost = false } = {}) {
    if (tvHost) asTv();
    busy(tvHost ? 'Préparation de la télé…' : 'Création du salon…');
    try {
      const Peer = await getPeer();
      let peer = null, code = null;
      let direct = true;
      for (let i = 0; i < 4 && !peer && direct; i++) {
        code = makeCode();
        try { peer = await openPeer(Peer, CONFIG.idPrefix + code); } catch (e) {
          // Serveur de connexion directe injoignable : la partie fonctionnera uniquement par le relais.
          if (e.type !== 'unavailable-id') { console.warn('PeerJS indisponible, relais seul', e && e.type); direct = false; }
        }
      }
      isHost = true;
      net = new Host(peer, code, me, hostDeliver, null, { tvHost });
      ctx.setGuard(tvHost ? 'Fermer la télé ? La partie sera fermée pour tout le monde.' : 'Quitter la partie ? Elle sera fermée pour tout le monde.');
      net.broadcast();
      if (opts.game) {
        lobbyPick = opts.game;
        lobbySettings[opts.game] = { ...(onlineGame(opts.game)?.defaults || {}), ...(opts.levels ? { levels: opts.levels } : {}) };
        net.send({ type: 'lobby:pick', game: opts.game });
      }
    } catch (e) {
      console.warn(e);
      entry(errText(e));
    }
  }

  // L'hôte revient (appli rouverte, page rechargée…) : même code, mêmes joueurs, mêmes scores, jeu en cours.
  async function resumeRoom(saved) {
    busy(`Reprise de la partie ${saved.code}…`);
    const code = saved.code;
    if (saved.room.tvHost) asTv();
    else {
      const hostP = (saved.room.players || []).find((p) => p.pid === saved.room.host);
      me.pid = saved.room.host;
      if (hostP) me.name = hostP.name;
    }
    let Peer = null, peer = null;
    try {
      Peer = await getPeer();
      // L'adresse directe peut rester réservée quelques instants par l'ancienne session.
      for (let i = 0; i < 2 && !peer; i++) {
        try { peer = await openPeer(Peer, CONFIG.idPrefix + code); } catch (e) {
          if (e.type !== 'unavailable-id') break;
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    } catch (e) { console.warn('PeerJS indisponible, relais seul', e && e.type); }
    isHost = true;
    net = new Host(peer, code, me, hostDeliver, saved);
    if (!peer && Peer) net.retryPeer(Peer);
    ctx.setGuard(tvHostMode ? 'Fermer la télé ? La partie sera fermée pour tout le monde.' : 'Quitter la partie ? Elle sera fermée pour tout le monde.');
    lobbyPick = net.room.pick;
    net.broadcast();
    toast(net.resumedGame ? '🔁 Partie reprise ! Les joueurs reviennent automatiquement.' : '🔁 Partie reprise au salon : les joueurs reviennent automatiquement.', 3500);
  }

  async function joinRoom(code) {
    busy(`Connexion à la partie ${code}…`);
    // Déjà venu dans cette partie avec ce téléphone : même identifiant, l'hôte nous rend notre place.
    const seat = !tvMode && loadSeat(code);
    if (seat) me.pid = seat.pid;
    try {
      let peer = null;
      try { peer = await openPeer(await getPeer(), null); } catch (e) { console.warn('PeerJS indisponible, relais seul', e && e.type); }
      isHost = false;
      net = new Client(peer, code, me, (m) => onMessage(m), onStatus);
      await net.connect();
      ctx.setGuard(tvMode ? 'Quitter l\'écran télé ?' : 'Quitter la partie ?');
    } catch (e) {
      console.warn(e);
      net = null;
      entry(errText(e));
    }
  }

  // keepSeat : la partie existe peut-être encore (hôte injoignable) → on garde sa place pour revenir.
  function onStatus(s, reason, keepSeat) {
    if (s === 'relay') { if (!room) busy('Connexion directe impossible : passage par le relais…'); return; }
    status = s;
    if (s === 'away') hostAway = true; else if (s !== 'reconnecting') hostAway = false;
    const banner = root.querySelector('.conn-banner.live');
    if (s === 'reconnecting' || s === 'away') {
      const hostName = room && room.players.find((p) => p.pid === room.host)?.name;
      const text = hostAway
        ? `⏸️ ${hostName || 'L\'hôte'} a quitté l'appli un instant… La partie reprendra à son retour.`
        : '📶 Connexion à l\'hôte perdue… on réessaie. La partie reprendra toute seule.';
      if (banner) setText(banner, text);
      else if (room && (tvMode || tvHostMode)) root.prepend(h('div', { class: 'conn-banner live' }, text));
      else if (room) root.insertBefore(h('div', { class: 'conn-banner live' }, text), root.children[1] || null);
    } else if (banner) banner.remove();
    if (s === 'closed') {
      if (!keepSeat) clearSeat();
      if (net) { net.destroy(); net = null; }
      room = null;
      destroyView();
      lobby = null;
      ctx.setGuard(null);
      modal({ title: 'Partie terminée', content: h('p', null, reason || 'La connexion a été perdue.'), actions: [{ label: 'OK', value: true, primary: true }] });
      entry();
    }
  }

  // ---------- Messages ----------
  function onMessage(m) {
    if (!m) return;
    switch (m.t) {
      case 'state':
        offset = m.now - Date.now();
        if (!isHost && !tvMode && Date.now() - seatAt > 60000) { seatAt = Date.now(); saveSeat(m.room.code, me.pid); }
        if (status === 'away') onStatus('online');
        render(m.room);
        break;
      case 'draw':
        if (tvMode || tvHostMode) { if (tvUi) tvUi.onDraw(m.op); break; }
        if (view && view.onDraw) view.onDraw(m.op); else if (pendingDraw.length < 500) pendingDraw.push(m.op);
        break;
      case 'toast':
        toast(m.msg);
        break;
      case 'bye':
        onStatus('closed', m.reason);
        break;
      case 'welcome':
        if (m.name && m.name !== me.name) me.name = m.name;
        // L'hôte peut nous rendre l'identifiant d'un joueur parti du même prénom (= nous, depuis un autre onglet).
        if (tvMode) break;
        if (m.pid && m.pid !== me.pid) { me.pid = m.pid; try { sessionStorage.setItem('ambiance:pid', m.pid); } catch { /* */ } }
        if (net && net.code) { seatAt = Date.now(); saveSeat(net.code, me.pid); }
        break;
      case 'pong':
        break;
      default:
        // Message propre à un jeu : livré à la vue, ou mis de côté si elle n'est pas encore montée.
        if (view && view.onMessage) view.onMessage(m);
        else if (pendingMsgs.length < 50) pendingMsgs.push(m);
    }
  }

  const hostDeliver = (m) => queueMicrotask(() => onMessage(m));
  let seatAt = 0;
  const send = (a) => { if (net) net.send(a); };
  const gctx = {
    get me() { return me.pid; },
    get isHost() { return isLeader(); }, // le chef a les boutons « hôte » des jeux (en TV Mode, ce n'est pas l'appareil hôte)
    send,
    now: () => Date.now() + offset,
    get room() { return room; },
    nameOf: (pid) => (room && room.players.find((p) => p.pid === pid)?.name) || '?',
    hostBar: () => hostBar(),
  };

  function hostBar() {
    if (!isLeader()) return h('p', { class: 'status-line' }, `⏳ ${room && room.tvHost ? 'En attente du chef 👑' : 'En attente de l\'hôte'}…`);
    return h('div', { class: 'row' },
      h('button', { class: 'btn btn-soft grow', onclick: () => send({ type: 'lobby:end' }) }, '🎮 Changer de jeu'),
      h('button', { class: 'btn btn-primary grow', onclick: () => send({ type: 'lobby:restart' }) }, '🔁 Rejouer'));
  }

  // ---------- Rendu ----------
  let shell = null;
  let body = null;
  let headCount = null;
  function ensureShell() {
    if (body && body.isConnected) return;
    // Nouvelle coquille : on oublie l'ancien salon / la vue de jeu.
    destroyView();
    lobby = null;
    headCount = h('span', { class: 'pill' });
    const menu = h('button', { class: 'icon-btn', 'aria-label': 'Menu de la partie', onclick: roomMenu }, '⋯');
    body = h('div', { class: 'col grow', style: { gap: '14px' } });
    shell = [header(h('div', { class: 'row' }, headCount, menu)), body];
    root.replaceChildren(...shell);
  }

  function render(r) {
    if (tvMode || tvHostMode) {
      room = r;
      if (!tvUi || !root.querySelector('.tv')) {
        if (tvUi) tvUi.destroy();
        tvUi = createTvUi(root, { now: () => Date.now() + offset, joinUrl, qr: drawQr, host: tvHostMode, leave });
      }
      tvUi.render(r);
      return;
    }
    const prevPlayers = room ? room.players.length : 0;
    room = r;
    ensureShell();
    setText(headCount, `👤 ${r.players.filter((p) => p.on).length}`);
    if (!r.game) {
      destroyView();
      renderLobby(prevPlayers);
    } else {
      lobby = null;
      if (viewType !== r.game.type || !view) {
        destroyView();
        const mod = onlineGame(r.game.type);
        body.replaceChildren();
        view = mod.mount(body, gctx);
        viewType = r.game.type;
        sfx.go();
        if (view.onDraw) while (pendingDraw.length) view.onDraw(pendingDraw.shift());
        else pendingDraw.length = 0;
        view.update(r, r.game.v);
        const msgs = pendingMsgs.splice(0);
        if (view.onMessage) msgs.forEach((x) => view.onMessage(x));
        return;
      }
      view.update(r, r.game.v);
    }
  }

  function destroyView() {
    if (view && view.destroy) { try { view.destroy(); } catch (e) { console.error(e); } }
    view = null; viewType = null;
  }

  // ---------- Salon ----------
  // Tout le monde voit les jeux en ligne (avec leur image) : le chef en touche un pour le choisir, une 2e fois
  // pour le lancer ; les autres touchent celui qu'ils veulent pour voter. Les votes s'affichent chez tous.
  let lobbyPick = null;
  let lobbyArmed = null; // jeu déjà touché une fois par le chef : un 2e appui le lance
  let pickFilter = 'all';
  const lobbySettings = {};
  const PICK_FILTERS = [{ id: 'all', label: '✨ Tous' }, { id: 'votes', label: '🗳️ Votés' }, ...FILTERS.filter((f) => !['all', 'fav', 'new'].includes(f.id))];
  const metaOf = (g) => gameById(localIdOf(g.id)) || { id: g.id, colors: ['#7c5cff', '#ff4d8d'], tags: [] };
  const onCount = () => room.players.filter((p) => p.on).length;
  /** Votes des joueurs connectés : { jeu: [pid…] }. */
  function voteMap() {
    const out = {};
    for (const [pid, gid] of Object.entries(room.votes || {})) {
      if (!room.players.some((p) => p.pid === pid && p.on)) continue;
      (out[gid] || (out[gid] = [])).push(pid);
    }
    return out;
  }

  function renderLobby(prevCount) {
    const lead = isLeader();
    if (!lobby || lobby.lead !== lead) {
      body.replaceChildren();
      const shareUrl = joinUrl(room.code);
      const qr = h('div', { class: 'qr', 'aria-label': 'QR code pour rejoindre' });
      drawQr(qr, shareUrl);
      const tvLine = h('p', { class: 'muted small center tv-hint' });
      const codeCard = h('div', { class: 'panel col center' },
        h('p', { class: 'muted small' }, 'Code du salon'),
        h('div', { class: 'room-code' }, room.code),
        qr,
        h('button', {
          class: 'btn btn-soft', onclick: async () => {
            try {
              if (navigator.share) await navigator.share({ title: 'Ambiance', text: `Rejoins mon salon sur Ambiance ! Code : ${room.code}`, url: shareUrl });
              else { await navigator.clipboard.writeText(shareUrl); toast('Lien copié 📋'); }
            } catch { /* annulé */ }
          },
        }, '🔗 Partager le lien'),
        tvLine);
      const players = h('div', { class: 'lobby-players' });
      const info = h('p', { class: 'pick-info' });
      const top = h('div', { class: 'col', style: { gap: '8px' } });
      const chips = h('div', { class: 'scroll-x' });
      const grid = h('div', { class: 'game-pick' });
      const bar = h('div', { class: 'lobby-bar' });
      const tiles = new Map();
      // Jeux réservés au TV Mode : seulement dans le salon créé par la télé, en premier.
      const list = room.tvHost ? [...ONLINE_GAMES.filter((g) => g.tvOnly), ...ONLINE_GAMES.filter((g) => !g.tvOnly)] : ONLINE_GAMES.filter((g) => !g.tvOnly);
      for (const g of list) {
        const m = metaOf(g);
        const [c1, c2] = gameColors(m.id, m.colors);
        const img = h('img', { class: 'tile-art', src: `img/jeux/${m.id}.webp`, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' });
        img.addEventListener('error', () => img.replaceWith(h('span', { class: 'tile-emo', 'aria-hidden': 'true' }, g.emoji)), { once: true });
        const votes = h('span', { class: 'vote-badge hidden' });
        const lock = h('span', { class: 'badge lock hidden' });
        const go = h('span', { class: 'go hidden' }, '▶ Touche encore pour lancer');
        const el = h('button', { class: 'pick-tile', style: { '--g1': c1, '--g2': c2 }, onclick: () => onTile(g) },
          img, h('span', { class: 'badges' }, g.tvOnly ? h('span', { class: 'badge tvonly' }, '📺 Spécial télé') : null, lock), votes, h('span', { class: 'nm' }, g.name), go);
        tiles.set(g.id, { el, votes, lock, go, g, m });
        grid.append(el);
      }
      const inTv = !!room.tvHost;
      body.append(...[
        isHost && !inTv ? codeCard : null,
        inTv ? h('p', { class: 'conn-banner soft' }, '📺 Le code, les votes et les jeux s\'affichent en grand sur la télé.') : null,
        h('div', { class: 'col' }, h('div', { class: 'section-title' }, 'Joueurs'), players),
        h('div', { class: 'section-title' }, lead ? '🎮 Choisis le jeu' : '🗳️ Vote pour ton jeu'),
        info, top, chips, grid, bar,
      ].filter(Boolean));
      lobby = { lead, players, info, top, chips, grid, bar, tiles, tvLine };
      lobbyArmed = null;
      renderChips();
    }
    // Écran télé (mode Online) : comment l'afficher, et combien sont branchés.
    lobby.tvLine.replaceChildren(...(room.tvs
      ? [`📺 ${room.tvs} écran${room.tvs > 1 ? 's' : ''} télé branché${room.tvs > 1 ? 's' : ''}`]
      : ['📺 Une télé ? Ambiance → ', h('b', null, 'TV Mode'), ' → Afficher un salon déjà créé → code ', h('b', null, room.code)]));
    // joueurs
    lobby.players.replaceChildren(...room.players.map((p) => h('span', { class: 'lp' + (p.on ? '' : ' off') },
      (p.pid === room.host ? '👑 ' : '') + p.name + (p.pid === me.pid ? ' (toi)' : ''),
      lead && p.pid !== me.pid ? h('button', {
        class: 'kick', 'aria-label': 'Retirer ' + p.name,
        onclick: async () => { if (await confirmBox(`Retirer ${p.name} de la partie ?`)) send({ type: 'kick', pid: p.pid }); },
      }, '✕') : null)));
    if (room.players.length > prevCount && prevCount) { sfx.pop(); buzz(20); }
    updatePicker();
  }

  function renderChips() {
    lobby.chips.replaceChildren(...PICK_FILTERS.map((f) => h('button', {
      class: 'chip' + (pickFilter === f.id ? ' on' : ''),
      onclick: () => { pickFilter = f.id; renderChips(); updatePicker(); },
    }, f.label)));
  }

  function onTile(g) {
    if (!isLeader()) {
      // Vote (toucher encore = retirer son vote).
      send({ type: 'lobby:vote', game: g.id });
      sfx.pop(); buzz(15);
      return;
    }
    const armed = lobbyPick === g.id && lobbyArmed === g.id;
    if (armed) { sfx.go(); launch(); return; }
    lobbyPick = g.id; lobbyArmed = g.id;
    send({ type: 'lobby:pick', game: g.id });
    sfx.pop();
    updatePicker();
  }

  // skipChoose : lancé depuis la fenêtre des réglages (le choix y est déjà). Un jeu avec choose(st, set) (ex. le Quiz :
  // choix du thème) demande d'abord au chef ; annulé = pas de lancement.
  async function launch(skipChoose = false) {
    const id = lobbyPick;
    const mod = onlineGame(id);
    if (!mod) return;
    const st = lobbySettings[id] || (lobbySettings[id] = { ...mod.defaults });
    if (mod.choose && !skipChoose && !(await mod.choose(st, (ns) => Object.assign(st, ns)))) return;
    send({ type: 'lobby:start', game: id, settings: st });
  }

  async function openSettings() {
    const mod = onlineGame(lobbyPick);
    if (!mod) return;
    const st = lobbySettings[lobbyPick] || (lobbySettings[lobbyPick] = { ...mod.defaults });
    const ok = await modal({
      title: `${mod.emoji} ${mod.name}`,
      content: h('div', { class: 'col' }, h('p', { class: 'muted small' }, mod.short || ''), mod.settingsForm(st, (ns) => { Object.assign(st, ns); }),
        h('p', { class: 'muted small' }, `Minimum ${mod.minPlayers} joueurs connectés.`)),
      actions: [{ label: 'Fermer', value: false }, { label: `▶ Lancer`, value: true, primary: true }],
    });
    if (ok) launch(true);
  }

  function updatePicker() {
    if (!lobby) return;
    const lead = lobby.lead;
    const votes = voteMap();
    const n = onCount();
    const myVote = room.votes && room.votes[me.pid];
    if (lead && !lobbyPick) lobbyPick = room.pick || null;
    for (const t of lobby.tiles.values()) {
      const id = t.g.id;
      const nv = (votes[id] || []).length;
      const tooFew = t.g.minPlayers > n;
      const show = pickFilter === 'all' || (pickFilter === 'votes' ? nv > 0 : (t.m.tags || []).includes(pickFilter));
      t.el.classList.toggle('hidden', !show);
      t.el.classList.toggle('on', lead ? id === lobbyPick : id === myVote);
      t.el.classList.toggle('armed', lead && id === lobbyPick && lobbyArmed === id);
      t.el.classList.toggle('few', tooFew);
      t.go.classList.toggle('hidden', !(lead && id === lobbyPick && lobbyArmed === id));
      t.votes.classList.toggle('hidden', !nv);
      if (nv) setText(t.votes, `🗳️ ${nv}`);
      t.lock.classList.toggle('hidden', !tooFew);
      if (tooFew) setText(t.lock, `👥 ${t.g.minPlayers}+`);
    }
    // Les plus demandés (touche = choisir pour le chef, voter pour les autres).
    const ranked = Object.entries(votes).sort((a, b) => b[1].length - a[1].length).slice(0, 4);
    lobby.top.replaceChildren(...(ranked.length ? [h('div', { class: 'scroll-x vote-strip' },
      h('span', { class: 'count-label' }, '🗳️ Demandés'),
      ranked.map(([gid, pids]) => { const g = onlineGame(gid); return g ? h('button', { class: 'chip' + (lead ? (gid === lobbyPick ? ' on' : '') : (gid === myVote ? ' on' : '')), onclick: () => onTile(g) }, `${g.emoji} ${g.name} · ${pids.length}`) : null; }))] : []));
    const chef = room.players.find((p) => p.pid === room.host);
    const picked = room.pick && onlineGame(room.pick);
    if (lead) {
      setText(lobby.info, '👆 Touche un jeu pour le choisir, une 2e fois pour le lancer. 🗳️ = votes des joueurs.');
      const mod = lobbyPick && onlineGame(lobbyPick);
      lobby.bar.replaceChildren(...(mod
        ? [h('span', { class: 'lb-name' }, h('span', null, mod.emoji), ' ', mod.name, mod.minPlayers > n ? h('small', null, ` · ${mod.minPlayers} joueurs min.`) : null),
          h('button', { class: 'icon-btn', 'aria-label': 'Réglages du jeu', onclick: openSettings }, '⚙️'),
          h('button', { class: 'btn btn-primary', onclick: () => { sfx.go(); launch(); } }, `▶ Lancer ${mod.name}`)]
        : [h('span', { class: 'lb-name muted' }, 'Choisis un jeu pour le lancer')]));
    } else {
      setText(lobby.info, `👑 ${chef ? chef.name : 'Le chef'} lance le jeu.${picked ? ` Il a choisi : ${picked.emoji} ${picked.name}.` : ''} Touche un jeu pour voter !`);
      const mine = myVote && onlineGame(myVote);
      lobby.bar.replaceChildren(h('span', { class: 'lb-name' }, mine ? `🗳️ Ton vote : ${mine.emoji} ${mine.name}` : '🗳️ Touche le jeu que tu veux pour voter'));
    }
  }

  async function roomMenu() {
    const actions = [];
    if (isLeader() && room && room.game) actions.push({ label: '🎮 Retour au salon', value: 'lobby' });
    actions.push({ label: '🚪 Quitter', value: 'leave', cls: 'btn-bad' });
    const share = room ? location.origin + location.pathname + location.search + '#/join/' + room.code : '';
    const v = await modal({
      title: `Partie ${room ? room.code : ''}`,
      content: h('div', { class: 'col' },
        h('p', { class: 'muted small' }, 'Pour inviter : code ', h('b', null, room ? room.code : ''), ' ou lien :'),
        h('input', { class: 'input', value: share, readonly: true, onclick: (e) => e.target.select() }),
        room ? h('div', { class: 'scoreboard' }, room.players.map((p) => h('div', { class: 'score-row' }, h('span', { class: 'n' }, (p.on ? '🟢 ' : '⚪ ') + p.name), h('span', { class: 's' }, String(p.score))))) : null),
      actions: [...actions, { label: 'Fermer', value: null }],
    });
    if (v === 'lobby') send({ type: 'lobby:end' });
    if (v === 'leave') leave();
  }

  async function leave() {
    if (net) {
      const ok = await confirmBox(isHost ? `${tvHostMode ? 'Fermer la télé' : 'Quitter'} ? La partie sera fermée pour tout le monde.` : tvMode ? 'Quitter l\'écran télé ?' : 'Quitter la partie ?', { ok: 'Quitter', cancel: 'Rester' });
      if (!ok) return;
    }
    ctx.exit();
  }

  // ---------- Démarrage ----------
  const toResume = opts.resume && loadHost();
  if (tvMode && typeof opts.tv === 'string' && opts.tv.length === 4) joinRoom(opts.tv);
  else if (toResume) resumeRoom(toResume);
  else if (opts.create && me.name) createRoom();
  else if (opts.join && opts.join.length === 4 && me.name) joinRoom(opts.join);
  else entry();

  return () => {
    if (tvUi) { tvUi.destroy(); tvUi = null; }
    destroyView();
    // On quitte l'écran de la partie (bouton retour confirmé) : rien à reprendre.
    if (net && !isHost) clearSeat();
    if (net) { net.destroy(); net = null; }
  };
}

