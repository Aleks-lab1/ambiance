// Relais de secours pour le jeu en ligne.
//
// Normalement, les téléphones se parlent en direct (WebRTC via PeerJS). Mais en 4G/5G ou entre deux
// box différentes, les opérateurs bloquent souvent cette connexion directe. Dans ce cas, les messages
// passent par des serveurs relais publics et gratuits (MQTT sur WebSocket). Ce module fournit des
// « connexions » qui se comportent comme celles de PeerJS (send, close, on('open'|'data'|'close')),
// pour que le reste du code n'y voie aucune différence.
//
// Chiffrement : ces serveurs sont publics, n'importe qui peut écouter. Chaque connexion par le relais
// commence donc par un échange de clés (ECDH P-256) : le joueur et l'hôte calculent chacun la même clé
// secrète sans jamais l'envoyer, puis tous les messages sont chiffrés (AES-GCM). Un curieux qui écoute
// ne voit que du charabia (mots secrets, rôles, réponses…). Les connexions directes (WebRTC) sont déjà
// chiffrées par le navigateur. Ancienne version de l'appli en face : on reste en clair, comme avant.
import { CONFIG } from '../config.js';

const enc = new TextEncoder();
const dec = new TextDecoder();
const rid = () => Math.random().toString(36).slice(2, 10);

// ---------------- Chiffrement ----------------
const subtle = (typeof crypto !== 'undefined' && crypto.subtle) || null; // absent hors https
const b64 = (u8) => { let t = ''; for (let i = 0; i < u8.length; i += 0x8000) t += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(t); };
const unb64 = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));

/** Paire de clés éphémère : { kp, pub (clé publique en base64) }, ou null si le navigateur ne sait pas chiffrer. */
export async function newKeys() {
  if (!subtle) return null;
  try {
    const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    return { kp, pub: b64(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))) };
  } catch { return null; }
}

/** Clé AES commune, calculée des deux côtés à partir de sa clé privée et de la clé publique de l'autre. */
export async function sharedKey(keys, otherPub, salt) {
  const pk = await subtle.importKey('raw', unb64(otherPub), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const bits = await subtle.deriveBits({ name: 'ECDH', public: pk }, keys.kp.privateKey, 256);
  const hk = await subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode(salt), info: enc.encode('ambiance-relais-v1') },
    hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Chiffre / déchiffre dans l'ordre d'arrivée (les opérations sont asynchrones, les messages ne doivent pas se doubler). */
export function cipher(key) {
  let wq = Promise.resolve();
  let rq = Promise.resolve();
  return {
    seal(obj, out) {
      wq = wq.then(async () => {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj))));
        out(b64(iv), b64(ct));
      }).catch((e) => console.warn('chiffrement', e));
    },
    open(iv, ct, out) {
      rq = rq.then(async () => {
        const pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ct));
        out(JSON.parse(dec.decode(pt)));
      }).catch(() => { /* message illisible ou trafiqué : ignoré */ });
    },
    /** Exécute fn après les messages déjà en cours de chiffrement (fermeture). */
    after(fn) { wq = wq.then(fn, fn); },
  };
}

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
  constructor(mq, topicOut, head = {}) {
    this.mq = mq;
    this.topicOut = topicOut;
    this.head = head; // { c: id } côté joueur
    this.open = false;
    this.relay = true;
    this.cipher = null; // chiffrement négocié à l'ouverture
    this.ls = { open: [], data: [], close: [], error: [] };
  }
  on(ev, fn) { (this.ls[ev] || (this.ls[ev] = [])).push(fn); return this; }
  emit(ev, x) { for (const fn of this.ls[ev] || []) { try { fn(x); } catch (e) { console.error(e); } } }
  send(obj) {
    if (!this.open) return;
    if (this.cipher) this.cipher.seal(obj, (i, d) => this.mq && this.mq.publish(this.topicOut, JSON.stringify({ ...this.head, t: 'e', i, d })));
    else this.mq.publish(this.topicOut, JSON.stringify({ ...this.head, t: 'd', d: obj }));
  }
  /** Message reçu : en clair (t: 'd') seulement si la connexion n'est pas chiffrée, sinon chiffré (t: 'e'). */
  receive(m) {
    if (m.t === 'd' && !this.cipher) this.emit('data', m.d);
    else if (m.t === 'e' && this.cipher && typeof m.i === 'string' && typeof m.d === 'string') this.cipher.open(m.i, m.d, (x) => { if (this.open) this.emit('data', x); });
  }
  /** Après les messages en attente de chiffrement (sinon un « au revoir » pourrait arriver après la fermeture). */
  later(fn) { if (this.cipher) this.cipher.after(fn); else fn(); }
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
      const k = typeof m.k === 'string' && m.k.length < 200 ? m.k : '';
      // Le joueur répète « open » tant qu'il n'a pas de réponse, éventuellement sur un autre serveur :
      // même demande = même connexion et même réponse (mêmes clés), sur le serveur qu'il utilise maintenant.
      if (c && c.k === k && !c.closedOnce) {
        c.mq = mq;
        if (c.okMsg) mq.publish(c.topicOut, c.okMsg);
        return;
      }
      if (c) { this.conns.delete(m.c); c.closeLocal(); }
      c = new RelayConn(mq, base(this.code) + '/c/' + m.c);
      c.k = k;
      c.close = () => {
        if (this.conns.get(m.c) === c) this.conns.delete(m.c);
        c.later(() => c.mq.publish(c.topicOut, JSON.stringify({ t: 'x' })));
        c.closeLocal();
      };
      this.conns.set(m.c, c);
      (async () => {
        const ok = { t: 'ok' };
        if (k) {
          const keys = await newKeys();
          if (keys) { try { c.cipher = cipher(await sharedKey(keys, k, this.code + '/' + m.c)); ok.k = keys.pub; } catch { c.cipher = null; } }
        }
        if (this.dead || this.conns.get(m.c) !== c) return;
        c.okMsg = JSON.stringify(ok);
        c.open = true;
        c.mq.publish(c.topicOut, c.okMsg);
        this.onConnection(c);
      })();
      return;
    }
    if (!c || c.mq !== mq || !c.open) return;
    if (m.t === 'x') { this.conns.delete(m.c); c.closeLocal(); } else c.receive(m);
  }

  destroy() {
    this.dead = true;
    setTimeout(() => this.mqs.forEach((mq) => mq.close()), 500);
  }
}

// Côté joueur : se connecte à l'hôte par le relais (premier serveur où l'hôte répond).
export function relayConnect(code) {
  const cid = rid() + rid();
  const conn = new RelayConn(null, null, { c: cid });
  conn.close = () => {
    const mq = conn.mq;
    if (mq) conn.later(() => { mq.publish(base(code) + '/h', JSON.stringify({ c: cid, t: 'x' })); setTimeout(() => mq.close(), 300); });
    conn.closeLocal();
  };
  (async () => {
    const keys = await newKeys();
    for (const url of brokers()) {
      if (conn.closedOnce) return;
      const mq = new Mqtt(url);
      try { await mq.connect(5000); } catch { continue; }
      let knock = null;
      const ok = await new Promise((resolve) => {
        const t = setTimeout(() => resolve(false), 6000);
        let answered = false;
        mq.subscribe(base(code) + '/c/' + cid, async (txt) => {
          let m; try { m = JSON.parse(txt); } catch { return; }
          if (m.t === 'ok') {
            if (answered) return; // réponse répétée (on a frappé plusieurs fois)
            answered = true;
            clearTimeout(t);
            if (keys && typeof m.k === 'string') {
              try { conn.cipher = cipher(await sharedKey(keys, m.k, code + '/' + cid)); } catch { resolve(false); return; }
            }
            resolve(true);
            return;
          }
          if (!conn.open) return;
          if (m.t === 'x') conn.closeLocal(); else conn.receive(m);
        });
        // On frappe à la porte (après la prise en compte de l'abonnement), puis toutes les 2 s : un hôte qui
        // revient (partie reprise) n'entend que les demandes faites après son retour.
        const hello = JSON.stringify({ c: cid, t: 'open', ...(keys ? { k: keys.pub } : {}) });
        setTimeout(() => { if (!answered) mq.publish(base(code) + '/h', hello); }, 250);
        knock = setInterval(() => { if (!answered) mq.publish(base(code) + '/h', hello); }, 2000);
      });
      clearInterval(knock);
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
