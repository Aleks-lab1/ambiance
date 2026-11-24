// Mode en ligne : salon, hôte faisant autorité, clients, reconnexion.
// Architecture : l'hôte garde l'état complet du jeu. Les clients envoient des
// actions ; l'hôte les applique puis diffuse à chacun SA vue de l'état
// (filtrée : par ex. le mot à dessiner n'est envoyé qu'au dessinateur).
import { h, toast, modal, confirmBox, uid, chip } from '../ui.js';
import { getName, setName, get, set } from '../store.js';
import { CONFIG } from '../config.js';
import { ONLINE_GAMES, onlineGame } from './games.js';
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
  constructor(peer, code, me, deliver, saved) {
    this.peer = null;
    this.code = code;
    this.me = me;
    this.deliver = deliver; // livre un message à l'interface locale de l'hôte
    this.room = { code, host: me.pid, pick: null, players: [{ pid: me.pid, name: me.name, score: 0, on: true }], game: null };
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
    r.host = this.me.pid;
    for (const p of r.players) if (p.pid === r.host) p.on = true;
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
      if (!pid || pid === this.room.host) return;
      if (m.tv) { this.addTv(conn, pid); return; }
      let p = this.room.players.find((x) => x.pid === pid);
      if (!p) {
        // Même prénom qu'un joueur parti (appli rouverte depuis un autre onglet, Safari → appli installée…) :
        // c'est sûrement lui, il retrouve sa place et ses points.
        const nm = cleanName(m.name).toLowerCase();
        p = this.room.players.find((x) => !x.on && x.pid !== this.room.host && x.name.toLowerCase() === nm && !this.conns.has(x.pid)) || null;
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
      this.broadcast();
    }
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
        if (p.on && p.pid !== this.room.host && !this.conns.has(p.pid)) {
          p.on = false; changed = true;
          if (this.room.game && this.mod && this.mod.onLeave) { try { this.mod.onLeave(this.room, this.gs, p.pid, this.api); } catch (e) { console.error(e); } }
        }
      }
      if (changed) this.broadcast();
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
        if (isHost && a.pid && a.pid !== this.room.host) {
          const c = this.conns.get(a.pid);
          if (c) { c._replaced = true; this.safeSend(c, { t: 'bye', reason: 'L\'hôte t\'a retiré de la partie.' }); setTimeout(() => { try { c.close(); } catch { /* */ } }, 400); }
          this.conns.delete(a.pid);
          this.room.players = this.room.players.filter((p) => p.pid !== a.pid);
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
    const active = this.room.players.filter((p) => p.on);
    if (active.length < mod.minPlayers) {
      this.sendTo(this.room.host, { t: 'toast', msg: `Il faut au moins ${mod.minPlayers} joueurs connectés pour ce jeu.` });
      return;
    }
    // On retire les joueurs partis depuis longtemps.
    this.room.players = this.room.players.filter((p) => p.on);
    this.room.players.forEach((p) => { p.score = 0; });
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
  }

  viewFor(pid) {
    const r = this.room;
    return {
      code: r.code, host: r.host, pick: r.pick, tvs: this.tvs.size,
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
      tv: true, code: r.code, host: r.host, pick: r.pick, tvs: this.tvs.size,
      players: r.players.map((p) => ({ pid: p.pid, name: p.name, score: p.score, on: p.on })),
      game: r.game ? { type: r.game.type, special: !!(this.mod && this.mod.tv), v } : null,
    };
  }

  safeSend(conn, msg) { try { if (conn.open) conn.send(msg); } catch (e) { console.warn('send', e); } }

  broadcast() {
    const now = Date.now();
    for (const [pid, c] of this.conns) this.safeSend(c, { t: 'state', now, room: this.viewFor(pid) });
    if (this.tvs.size) { const tv = this.viewForTv(); for (const c of this.tvs.values()) this.safeSend(c, { t: 'state', now, room: tv }); }
    this.deliver({ t: 'state', now, room: this.viewFor(this.room.host) });
    this.scheduleSave();
  }

  relay(op, except) {
    for (const [pid, c] of this.conns) if (pid !== except) this.safeSend(c, { t: 'draw', op });
    // La télé ne reçoit le dessin que des jeux où il est public (Je dessine) : pas celui du Téléphone dessiné.
    if (this.mod && this.mod.tvRelay) for (const c of this.tvs.values()) this.safeSend(c, { t: 'draw', op });
    if (except !== this.room.host) this.deliver({ t: 'draw', op });
  }

  sendTo(pid, msg) {
    if (pid === this.room.host) { this.deliver(msg); return; }
    const c = this.conns.get(pid) || this.tvs.get(pid);
    if (c) this.safeSend(c, msg);
  }

  toastAll(msg, except) {
    for (const [pid, c] of [...this.conns, ...this.tvs]) if (pid !== except) this.safeSend(c, { t: 'toast', msg });
    if (except !== this.room.host) this.deliver({ t: 'toast', msg });
  }

  send(a) { this.handle(this.room.host, a); }

  // keep = garder la partie enregistrée (fermeture involontaire) ; sinon l'hôte a quitté : plus rien à reprendre.
  destroy(keep) {
    if (keep) this.saveNow(); else clearHost();
    this.dead = true;
    clearInterval(this.iv);
    clearInterval(this.hb);
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
    const nameIn = h('input', { class: 'input', placeholder: 'Ton prénom', maxlength: '16', value: me.name, autocomplete: 'nickname', enterkeyhint: 'next' });
    const codeIn = h('input', {
      class: 'input code-input', placeholder: 'CODE', maxlength: '4', value: opts.join || '', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', enterkeyhint: 'go',
      oninput: (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); },
      onkeydown: (e) => { if (e.key === 'Enter') doJoin(); },
    });
    const getNameOk = () => {
      const n = cleanName(nameIn.value);
      if (!nameIn.value.trim()) { toast('Entre ton prénom'); nameIn.focus(); return null; }
      me.name = n; setName(n);
      return n;
    };
    const doCreate = () => { if (getNameOk()) createRoom(); };
    const doJoin = () => {
      if (!getNameOk()) return;
      const code = codeIn.value.trim().toUpperCase();
      if (code.length !== 4) { toast('Le code fait 4 lettres'); codeIn.focus(); return; }
      joinRoom(code);
    };
    const joinFirst = !!opts.join || opts.joinPrompt;
    const saved = loadHost();
    const resumePanel = saved ? h('div', { class: 'panel col resume-card' },
      h('h3', null, `🔁 Reprendre ta partie ${saved.code}`),
      h('p', { class: 'muted small' }, resumeText(saved)),
      h('button', { class: 'btn btn-primary btn-block', onclick: () => resumeRoom(saved) }, 'Reprendre la partie'),
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { clearHost(); resumePanel.remove(); } }, 'Non merci, l\'oublier')) : null;
    const createPanel = h('div', { class: 'panel col' },
      h('h3', null, '🎉 Créer une partie'),
      h('p', { class: 'muted small' }, 'Tu seras l\'hôte : tu choisis les jeux et tu partages le code aux autres.'),
      h('button', { class: 'btn btn-primary btn-block', onclick: doCreate }, 'Créer la partie'));
    const joinPanel = h('div', { class: 'panel col' },
      h('h3', null, '🔑 Rejoindre une partie'),
      codeIn,
      h('button', { class: joinFirst ? 'btn btn-primary btn-block' : 'btn btn-soft btn-block', onclick: doJoin }, 'Rejoindre'));
    const tvIn = h('input', {
      class: 'input code-input', placeholder: 'CODE', maxlength: '4', value: opts.tv && opts.tv !== true ? opts.tv : '', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', enterkeyhint: 'go',
      'aria-label': 'Code de la partie à afficher',
      oninput: (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); },
      onkeydown: (e) => { if (e.key === 'Enter') doTv(); },
    });
    const doTv = () => {
      const code = tvIn.value.trim().toUpperCase();
      if (code.length !== 4) { toast('Le code fait 4 lettres'); tvIn.focus(); return; }
      sfx.unlock();
      ctx.open('online', { tv: code });
    };
    const tvPanel = h('div', { class: 'panel col' },
      h('h3', null, '📺 Écran télé'),
      h('p', { class: 'muted small' }, 'Sur un ordinateur ou une télé : la partie s\'affiche en grand pour tout le monde (questions, dessins, votes, classement) et les téléphones servent de manettes.'),
      h('div', { class: 'row' }, tvIn, h('button', { class: 'btn btn-soft', style: { flex: 'none' }, onclick: doTv }, 'Afficher')));
    if (tvMode) {
      // Écran télé : seulement le code de la partie à afficher.
      root.replaceChildren(header(), msg ? h('div', { class: 'conn-banner' }, msg) : null, tvPanel,
        h('div', { class: 'panel rules' }, h('p', null, '1. Sur un téléphone, crée la partie (ou rejoins-la) : le code s\'affiche en haut.'),
          h('p', null, '2. Tape ce code ici : la partie s\'affiche en grand. Astuce : ⛶ en haut à droite pour le plein écran.')));
      setTimeout(() => tvIn.focus(), 50);
      return;
    }
    root.replaceChildren(
      header(),
      msg ? h('div', { class: 'conn-banner' }, msg) : null,
      resumePanel,
      h('label', { class: 'field' }, 'Ton prénom', nameIn),
      ...(joinFirst ? [joinPanel, createPanel] : [createPanel, joinPanel]),
      tvPanel,
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
      h('h1', null, room ? 'Partie ' : tvMode ? 'Écran télé' : 'Jouer en ligne', room ? h('span', { class: 'code' }, room.code) : null),
      extra || null);
  }

  function busy(text) {
    root.replaceChildren(header(), h('div', { class: 'big-center' }, h('div', { class: 'hero-emo' }, '📡'), h('h2', null, text), h('p', { class: 'muted' }, 'Quelques secondes…')));
  }

  async function getPeer() {
    return loadScript('vendor/peerjs.min.js', 'Peer');
  }

  async function createRoom() {
    busy('Création de la partie…');
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
      net = new Host(peer, code, me, hostDeliver);
      ctx.setGuard('Quitter la partie ? Elle sera fermée pour tout le monde.');
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
    const hostP = (saved.room.players || []).find((p) => p.pid === saved.room.host);
    me.pid = saved.room.host;
    if (hostP) me.name = hostP.name;
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
    ctx.setGuard('Quitter la partie ? Elle sera fermée pour tout le monde.');
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
      if (banner) banner.textContent = text;
      else if (room && tvMode) root.prepend(h('div', { class: 'conn-banner live' }, text));
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
        if (tvMode) { if (tvUi) tvUi.onDraw(m.op); break; }
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
    get isHost() { return isHost; },
    send,
    now: () => Date.now() + offset,
    get room() { return room; },
    nameOf: (pid) => (room && room.players.find((p) => p.pid === pid)?.name) || '?',
    hostBar: () => hostBar(),
  };

  function hostBar() {
    if (!isHost) return h('p', { class: 'status-line' }, '⏳ En attente de l\'hôte…');
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
    if (tvMode) {
      room = r;
      if (!tvUi || !root.querySelector('.tv')) {
        if (tvUi) tvUi.destroy();
        tvUi = createTvUi(root, { now: () => Date.now() + offset, joinUrl, qr: drawQr });
      }
      tvUi.render(r);
      return;
    }
    const prevPlayers = room ? room.players.length : 0;
    room = r;
    ensureShell();
    headCount.textContent = `👤 ${r.players.filter((p) => p.on).length}`;
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
  let lobbyPick = null;
  let lobbyArmed = null; // jeu déjà touché une fois par l'hôte : un 2e appui le lance
  const lobbySettings = {};
  function renderLobby(prevCount) {
    if (!lobby) {
      body.replaceChildren();
      const shareUrl = joinUrl(room.code);
      const qr = h('div', { class: 'qr', 'aria-label': 'QR code pour rejoindre' });
      drawQr(qr, shareUrl);
      const tvLine = h('p', { class: 'muted small center tv-hint' });
      const players = h('div', { class: 'lobby-players' });
      const pickWrap = h('div', { class: 'col' });
      const waiting = h('div', { class: 'panel center col' });
      const codeCard = h('div', { class: 'panel col center' },
        h('p', { class: 'muted small' }, 'Code de la partie'),
        h('div', { class: 'room-code' }, room.code),
        qr,
        h('button', {
          class: 'btn btn-soft', onclick: async () => {
            try {
              if (navigator.share) await navigator.share({ title: 'Ambiance', text: `Rejoins ma partie sur Ambiance ! Code : ${room.code}`, url: shareUrl });
              else { await navigator.clipboard.writeText(shareUrl); toast('Lien copié 📋'); }
            } catch { /* annulé */ }
          },
        }, '🔗 Partager le lien'),
        tvLine);
      body.append(...[
        isHost ? codeCard : null,
        h('div', { class: 'col' }, h('div', { class: 'section-title' }, 'Joueurs'), players),
        isHost ? pickWrap : waiting,
      ].filter(Boolean));
      lobby = { players, pickWrap, waiting, codeCard, tvLine };
      lobbyArmed = null;
      if (isHost) renderPicker();
    }
    // Écran télé : comment l'afficher, et combien sont branchés.
    lobby.tvLine.replaceChildren(...(room.tvs
      ? [`📺 ${room.tvs} écran${room.tvs > 1 ? 's' : ''} télé branché${room.tvs > 1 ? 's' : ''}`]
      : ['📺 Sur une télé ou un ordi : Ambiance → Jouer en ligne → ', h('b', null, 'Écran télé'), ` → code ${room.code}`]));
    // joueurs
    lobby.players.replaceChildren(...room.players.map((p) => h('span', { class: 'lp' + (p.on ? '' : ' off') },
      (p.pid === room.host ? '👑 ' : '') + p.name + (p.pid === me.pid ? ' (toi)' : ''),
      isHost && p.pid !== me.pid ? h('button', {
        class: 'kick', 'aria-label': 'Retirer ' + p.name,
        onclick: async () => { if (await confirmBox(`Retirer ${p.name} de la partie ?`)) send({ type: 'kick', pid: p.pid }); },
      }, '✕') : null)));
    if (room.players.length > prevCount && prevCount) { sfx.pop(); buzz(20); }
    if (!isHost) {
      const g = room.pick && onlineGame(room.pick);
      lobby.waiting.replaceChildren(
        h('div', { class: 'hero-emo' }, g ? g.emoji : '⏳'),
        h('h3', null, g ? `Prochain jeu : ${g.name}` : 'En attente de l\'hôte'),
        h('p', { class: 'muted small' }, `${room.players.find((p) => p.pid === room.host)?.name || 'L\'hôte'} choisit le jeu et lance la partie.`));
    }
  }

  function renderPicker() {
    const wrap = lobby.pickWrap;
    if (!lobbyPick) lobbyPick = room.pick || ONLINE_GAMES[0].id;
    const mod = onlineGame(lobbyPick);
    const st = lobbySettings[lobbyPick] || (lobbySettings[lobbyPick] = { ...mod.defaults });
    const launch = () => send({ type: 'lobby:start', game: lobbyPick, settings: st });
    // 1er appui : on choisit le jeu (et ses réglages s'affichent) ; 2e appui sur le même jeu : il se lance.
    const grid = h('div', { class: 'game-pick' }, ONLINE_GAMES.map((g) => {
      const armed = g.id === lobbyPick && lobbyArmed === g.id;
      return h('button', {
        class: (g.id === lobbyPick ? 'on' : '') + (armed ? ' armed' : ''),
        onclick: () => {
          if (armed) { sfx.go(); launch(); return; }
          lobbyPick = g.id; lobbyArmed = g.id;
          send({ type: 'lobby:pick', game: g.id });
          sfx.pop();
          renderPicker();
        },
      }, h('span', { class: 'emo' }, g.emoji), h('span', { class: 'nm' }, g.name), h('span', { class: 'muted tiny' }, g.short),
      armed ? h('span', { class: 'go' }, '▶ Touche encore pour lancer') : null);
    }));
    wrap.replaceChildren(
      h('div', { class: 'section-title' }, 'Choisis le jeu'),
      h('p', { class: 'muted small' }, '👆👆 Touche deux fois un jeu pour le lancer directement.'),
      grid,
      h('div', { class: 'panel col' }, h('h3', null, `${mod.emoji} Réglages`), mod.settingsForm(st, (ns) => { Object.assign(st, ns); })),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: launch }, `▶ Lancer ${mod.name}`),
      h('p', { class: 'muted small center' }, `Minimum ${mod.minPlayers} joueurs connectés.`));
  }

  async function roomMenu() {
    const actions = [];
    if (isHost && room && room.game) actions.push({ label: '🎮 Retour au salon', value: 'lobby' });
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
      const ok = await confirmBox(isHost ? 'Quitter ? La partie sera fermée pour tout le monde.' : 'Quitter la partie ?', { ok: 'Quitter', cancel: 'Rester' });
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

