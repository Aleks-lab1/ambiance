// Relais de secours pour le jeu en ligne.
//
// Normalement, les téléphones se parlent en direct (WebRTC via PeerJS). Mais en 4G/5G ou entre deux
// box différentes, les opérateurs bloquent souvent cette connexion directe. Dans ce cas, les messages
// passent par des serveurs relais publics et gratuits (MQTT sur WebSocket). Ce module fournit des
// « connexions » qui se comportent comme celles de PeerJS (send, close, on('open'|'data'|'close')),
// pour que le reste du code n'y voie aucune différence.
import { CONFIG } from '../config.js';

const enc = new TextEncoder();
const dec = new TextDecoder();
const rid = () => Math.random().toString(36).slice(2, 10);

// ---------------- Mini client MQTT 3.1.1 (QoS 0) ----------------
function str(s) {
  const b = enc.encode(s);
  return [b.length >> 8, b.length & 255, ...b];
}
function packet(type, body) {
  const len = [];
  let n = body.length;
  do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; len.push(d); } while (n > 0);
  const out = new Uint8Array(1 + len.length + body.length);
  out[0] = type; out.set(len, 1); out.set(body, 1 + len.length);
  return out;
}

export class Mqtt {
  // url : 'wss://…' ou { url, user, pass } pour les serveurs qui demandent un identifiant
  constructor(server) {
    this.url = typeof server === 'string' ? server : server.url;
    this.user = typeof server === 'string' ? null : server.user;
    this.pass = typeof server === 'string' ? null : server.pass;
    this.subs = new Map();
    this.buf = new Uint8Array(0);
    this.pid = 1;
    this.closed = false;
    this.onclose = null;
  }

  connect(timeout = 6000) {
    return new Promise((resolve, reject) => {
      let ws;
      const fail = (e) => { clearTimeout(t); try { ws && ws.close(); } catch { /* */ } reject(e || new Error('mqtt')); };
      const t = setTimeout(() => fail(new Error('mqtt timeout')), timeout);
      try { ws = new WebSocket(this.url, 'mqtt'); } catch (e) { fail(e); return; }
      ws.binaryType = 'arraybuffer';
      this.ws = ws;
      this.onConnack = (ok) => { clearTimeout(t); if (ok) { this.ready = true; resolve(this); } else fail(new Error('refusé')); };
      ws.onopen = () => {
        const flags = 0x02 | (this.user ? 0x80 : 0) | (this.user && this.pass ? 0x40 : 0);
        const body = [...str('MQTT'), 4, flags, 0, 60, ...str('amb-' + rid() + rid())];
        if (this.user) body.push(...str(this.user));
        if (this.user && this.pass) body.push(...str(this.pass));
        ws.send(packet(0x10, body));
      };
      ws.onmessage = (e) => this.feed(new Uint8Array(e.data));
      ws.onerror = () => { if (!this.ready) fail(new Error('ws')); };
      ws.onclose = () => {
        clearInterval(this.ka);
        if (!this.ready) { fail(new Error('ws fermé')); return; }
        if (!this.closed) { this.closed = true; this.onclose && this.onclose(); }
      };
      this.ka = setInterval(() => { try { if (ws.readyState === 1) ws.send(new Uint8Array([0xc0, 0])); } catch { /* */ } }, 25000);
    });
  }

  feed(chunk) {
    const b = new Uint8Array(this.buf.length + chunk.length);
    b.set(this.buf); b.set(chunk, this.buf.length);
    let i = 0;
    while (i + 2 <= b.length) {
      let mul = 1, len = 0, j = i + 1, d;
      do { if (j >= b.length) { this.buf = b.slice(i); return; } d = b[j++]; len += (d & 127) * mul; mul *= 128; } while (d & 128);
      if (j + len > b.length) break;
      this.onPacket(b[i], b.subarray(j, j + len));
      i = j + len;
    }
    this.buf = b.slice(i);
  }

  onPacket(head, body) {
    const type = head >> 4;
    if (type === 2) this.onConnack && this.onConnack(body[1] === 0);
    else if (type === 3) {
      const tl = (body[0] << 8) | body[1];
      const topic = dec.decode(body.subarray(2, 2 + tl));
      let p = 2 + tl;
      if ((head >> 1) & 3) p += 2; // identifiant de paquet (QoS > 0)
      const cb = this.subs.get(topic);
      if (cb) { try { cb(dec.decode(body.subarray(p))); } catch (e) { console.error(e); } }
    }
  }

  subscribe(topic, cb) {
    this.subs.set(topic, cb);
    const id = this.pid++ & 0xffff || 1;
    this.ws.send(packet(0x82, [id >> 8, id & 255, ...str(topic), 0]));
  }

  publish(topic, text) {
    if (!this.ws || this.ws.readyState !== 1) return false;
    const payload = enc.encode(text);
    const t = str(topic);
    const body = new Uint8Array(t.length + payload.length);
    body.set(t); body.set(payload, t.length);
    this.ws.send(packet(0x30, body));
    return true;
  }

  close() {
    this.closed = true;
    clearInterval(this.ka);
    try { if (this.ws.readyState === 1) this.ws.send(new Uint8Array([0xe0, 0])); } catch { /* */ }
    try { this.ws.close(); } catch { /* */ }
  }
}

const brokers = () => (CONFIG.relayBrokers || []);
const base = (code) => `${CONFIG.relayPrefix || 'ambiance-soiree-v1'}/${code}`;

// ---------------- Connexion « façon PeerJS » ----------------
class RelayConn {
  constructor(mq, topicOut) {
    this.mq = mq;
    this.topicOut = topicOut;
    this.open = false;
    this.relay = true;
    this.ls = { open: [], data: [], close: [], error: [] };
  }
  on(ev, fn) { (this.ls[ev] || (this.ls[ev] = [])).push(fn); return this; }
  emit(ev, x) { for (const fn of this.ls[ev] || []) { try { fn(x); } catch (e) { console.error(e); } } }
  send(obj) { if (!this.open) return; this.mq.publish(this.topicOut, JSON.stringify(this.wrap(obj))); }
  wrap(obj) { return { t: 'd', d: obj }; }
  closeLocal() { if (this.closedOnce) return; this.closedOnce = true; this.open = false; this.emit('close'); }
}

// Côté hôte : écoute les joueurs qui passent par le relais, sur tous les serveurs joignables.
export class RelayHub {
  constructor(code, onConnection) {
    this.code = code;
    this.onConnection = onConnection;
    this.conns = new Map(); // cid -> conn
    this.mqs = [];
    this.dead = false;
    for (const url of brokers()) this.join(url, 0);
  }

  join(url, attempt) {
    if (this.dead) return;
    const mq = new Mqtt(url);
    mq.connect().then(() => {
      if (this.dead) { mq.close(); return; }
      this.mqs.push(mq);
      mq.subscribe(base(this.code) + '/h', (txt) => this.onMsg(mq, txt));
      mq.onclose = () => {
        this.mqs = this.mqs.filter((x) => x !== mq);
        for (const [cid, c] of this.conns) if (c.mq === mq) { this.conns.delete(cid); c.closeLocal(); }
        setTimeout(() => this.join(url, 0), 2000);
      };
    }).catch(() => { if (attempt < 3) setTimeout(() => this.join(url, attempt + 1), 3000 * (attempt + 1)); });
  }

  onMsg(mq, txt) {
    let m; try { m = JSON.parse(txt); } catch { return; }
    if (!m || typeof m.c !== 'string' || m.c.length > 40) return;
    let c = this.conns.get(m.c);
    if (m.t === 'open') {
      if (c) { this.conns.delete(m.c); c.closeLocal(); }
      c = new RelayConn(mq, base(this.code) + '/c/' + m.c);
      c.close = () => { if (this.conns.get(m.c) === c) this.conns.delete(m.c); mq.publish(c.topicOut, JSON.stringify({ t: 'x' })); c.closeLocal(); };
      this.conns.set(m.c, c);
      c.open = true;
      mq.publish(c.topicOut, JSON.stringify({ t: 'ok' }));
      this.onConnection(c);
      return;
    }
    if (!c || c.mq !== mq) return;
    if (m.t === 'd') c.emit('data', m.d);
    else if (m.t === 'x') { this.conns.delete(m.c); c.closeLocal(); }
  }

  destroy() {
    this.dead = true;
    setTimeout(() => this.mqs.forEach((mq) => mq.close()), 500);
  }
}

// Côté joueur : se connecte à l'hôte par le relais (premier serveur où l'hôte répond).
export function relayConnect(code) {
  const conn = new RelayConn(null, null);
  const cid = rid() + rid();
  conn.wrap = (obj) => ({ c: cid, t: 'd', d: obj });
  conn.close = () => {
    if (conn.mq) { conn.mq.publish(base(code) + '/h', JSON.stringify({ c: cid, t: 'x' })); setTimeout(() => conn.mq.close(), 300); }
    conn.closeLocal();
  };
  (async () => {
    for (const url of brokers()) {
      if (conn.closedOnce) return;
      const mq = new Mqtt(url);
      try { await mq.connect(5000); } catch { continue; }
      const ok = await new Promise((resolve) => {
        const t = setTimeout(() => resolve(false), 6000);
        mq.subscribe(base(code) + '/c/' + cid, (txt) => {
          let m; try { m = JSON.parse(txt); } catch { return; }
          if (m.t === 'ok') { clearTimeout(t); resolve(true); return; }
          if (!conn.open) return;
          if (m.t === 'd') conn.emit('data', m.d);
          else if (m.t === 'x') conn.closeLocal();
        });
        // Laisse le temps à l'abonnement d'être pris en compte avant de frapper à la porte.
        setTimeout(() => mq.publish(base(code) + '/h', JSON.stringify({ c: cid, t: 'open' })), 250);
      });
      if (!ok || conn.closedOnce) { mq.close(); continue; }
      conn.mq = mq;
      conn.topicOut = base(code) + '/h';
      mq.onclose = () => conn.closeLocal();
      conn.open = true;
      conn.emit('open');
      return;
    }
    conn.emit('error', { type: 'relay' });
    conn.closeLocal();
  })();
  return conn;
}
