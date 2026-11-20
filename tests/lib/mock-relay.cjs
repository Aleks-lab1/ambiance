// Faux serveur relais MQTT 3.1.1 (dans le test, via routeWebSocket de Playwright) + PeerJS bloqué.
// Ça force l'appli à passer par le relais, comme deux téléphones qui ne sont pas sur le même Wi-Fi.
// Dépendance : npm install (dans tests/) pour mqtt-packet.
const { chromium, devices } = require('playwright');
const mqtt = require('mqtt-packet');
const { serveRepo, collectErrors, SETTINGS } = require('./pw-helper.cjs');

// Toutes les adresses de CONFIG.relayBrokers (js/config.js) : shiftr.io et les « …/mqtt ».
const BROKER_RE = /shiftr\.io|\/mqtt$/;

function makeBroker({ down } = {}) {
  const subs = new Map(); // sujet -> Set(ws)
  const stats = { published: 0, hits: {} };
  function handle(ws) {
    const url = ws.url();
    stats.hits[url] = (stats.hits[url] || 0) + 1;
    if (down && url.includes(down)) { ws.close(); return; } // simule un serveur en panne
    const parser = mqtt.parser({ protocolVersion: 4 });
    const send = (p) => ws.send(mqtt.generate(p));
    parser.on('packet', (p) => {
      if (p.cmd === 'connect') send({ cmd: 'connack', returnCode: 0 });
      else if (p.cmd === 'subscribe') {
        for (const s of p.subscriptions) { if (!subs.has(s.topic)) subs.set(s.topic, new Set()); subs.get(s.topic).add(ws); }
        send({ cmd: 'suback', messageId: p.messageId, granted: p.subscriptions.map(() => 0) });
      } else if (p.cmd === 'publish') {
        stats.published++;
        for (const w of subs.get(p.topic) || []) if (!w._closed) w.send(mqtt.generate({ cmd: 'publish', topic: p.topic, payload: p.payload, qos: 0 }));
      } else if (p.cmd === 'pingreq') send({ cmd: 'pingresp' });
    });
    ws.onMessage((m) => parser.parse(Buffer.isBuffer(m) ? m : Buffer.from(m)));
    ws.onClose(() => { ws._closed = true; });
  }
  return { handle, stats };
}

/** Navigateur + fabrique de « téléphones » reliés au faux relais. */
async function relayWorld(opts = {}) {
  const browser = await chromium.launch();
  const broker = makeBroker(opts);
  const errors = [];
  async function phone() {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
    await serveRepo(ctx);
    await ctx.route(/peerjs\.com/, (r) => r.abort());
    await ctx.routeWebSocket(/peerjs\.com/, (ws) => ws.close());
    await ctx.routeWebSocket(BROKER_RE, broker.handle);
    const page = await ctx.newPage();
    collectErrors(page, errors);
    await page.addInitScript((s) => { try { localStorage.setItem('ambiance:settings', JSON.stringify(s)); } catch {} }, SETTINGS);
    return page;
  }
  return { browser, phone, broker, errors };
}

module.exports = { makeBroker, relayWorld, BROKER_RE };
