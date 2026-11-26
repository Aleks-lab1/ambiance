// Effets sonores synthétisés (aucun fichier audio à télécharger).
import { settings } from './store.js';

let ctx = null;
function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur = 0.12, type = 'sine', vol = 0.2, when = 0, slideTo = null) {
  if (!settings.sound) return;
  const c = ac(); if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.03);
}

/** Bruit filtré (souffle, choc, éclaboussure…). decay : vitesse à laquelle le son s'éteint. */
function noise(dur = 0.8, vol = 0.6, { type = 'lowpass', freq = 900, q = 1, when = 0, decay = 2.2 } = {}) {
  if (!settings.sound) return;
  const c = ac(); if (!c) return;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.value = vol;
  src.connect(f).connect(g).connect(c.destination);
  src.start(c.currentTime + when);
}

export const sfx = {
  unlock() { ac(); },
  tick() { tone(1250, 0.03, 'square', 0.06); },
  tock() { tone(850, 0.03, 'square', 0.06); },
  beep() { tone(880, 0.14, 'sine', 0.22); },
  go() { tone(660, 0.12, 'triangle', 0.25); tone(990, 0.28, 'triangle', 0.25, 0.12); },
  ok() { tone(784, 0.1, 'triangle', 0.22); tone(1175, 0.2, 'triangle', 0.22, 0.08); },
  bad() { tone(240, 0.28, 'sawtooth', 0.14, 0, 130); },
  pop() { tone(520, 0.07, 'sine', 0.2, 0, 980); },
  swoosh() { tone(300, 0.18, 'sine', 0.08, 0, 1200); },
  boom() { noise(1.3, 0.9); tone(110, 0.7, 'sine', 0.5, 0, 35); },
  end() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.2, i * 0.12)); },
  note(freq, dur = 0.32) { tone(freq, dur, 'triangle', 0.28); },
  fanfare() { [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'square', 0.08, i * 0.13)); },
  // Petits bruits « physiques » : jeton qui tombe, feutre, dés, cartes, eau.
  clack(v = 1) { noise(0.07, 0.5 * v, { type: 'bandpass', freq: 1900, q: 1.4, decay: 5 }); tone(210, 0.06, 'sine', 0.18 * v, 0, 120); },
  scribble() { noise(0.2, 0.22, { type: 'bandpass', freq: 3200, q: 0.8, decay: 0.6 }); },
  rattle() { for (let k = 0; k < 5; k++) noise(0.04, 0.35, { type: 'bandpass', freq: 1500 + k * 260, q: 2, decay: 4, when: k * 0.07 + Math.random() * 0.03 }); },
  card() { noise(0.12, 0.3, { type: 'highpass', freq: 2400, q: 0.7, decay: 1.6 }); },
  splash() { noise(0.55, 0.45, { type: 'bandpass', freq: 1100, q: 0.6, decay: 1.8 }); tone(420, 0.25, 'sine', 0.08, 0, 160); },
  // Dans la foule : bonhomme en gelée qu'on pousse (boing) et qui tombe par terre (pouf).
  boing() { tone(170, 0.24, 'sine', 0.28, 0, 520); tone(340, 0.12, 'triangle', 0.1, 0.02, 760); },
  thud() { noise(0.2, 0.5, { type: 'lowpass', freq: 380, q: 0.8, decay: 4 }); tone(96, 0.18, 'sine', 0.32, 0, 52); },
};

export function buzz(pattern = 40) {
  if (settings.vibrate && navigator.vibrate) { try { navigator.vibrate(pattern); } catch { /* ignore */ } }
}

// ---------- Fête du podium (js/podium.js) ----------
// Chaque son est programmé dans un contexte audio c, vers une sortie out, à l'instant t (secondes du contexte) :
// en direct (sfx.party) ou hors ligne (OfflineAudioContext, pour écouter un aperçu sans lancer de partie).

/** Tampon audio rempli par fn(données, fréquence d'échantillonnage). */
function buf(c, dur, fn) {
  const b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
  fn(b.getChannelData(0), c.sampleRate);
  return b;
}
/** Joue un tampon à travers des filtres [type, fréquence, Q], un volume et un placement gauche/droite. */
function playBuf(c, out, b, t, { vol = 1, filters = [], pan = 0 } = {}) {
  const s = c.createBufferSource();
  s.buffer = b;
  let node = s;
  for (const [type, freq, q = 0.7] of filters) {
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    node.connect(f); node = f;
  }
  const g = c.createGain();
  g.gain.value = vol;
  node.connect(g); node = g;
  if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; node.connect(p); node = p; }
  node.connect(out);
  s.start(t);
}
/** Oscillateur avec enveloppe (attaque rapide, extinction exponentielle) et glissé de fréquence facultatif. */
function osc(c, out, t, { f, type = 'sine', dur = 0.3, vol = 0.2, to = null, attack = 0.005, pan = 0 }) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o.connect(g);
  if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
  node.connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}
const rnd = (a, b) => a + Math.random() * (b - a);
function normalize(d, peak = 0.95) {
  let m = 0;
  for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
  if (m > 0) for (let i = 0; i < d.length; i++) d[i] *= peak / m;
}

/** Clochette (une marche du podium qui arrive). */
function bell(c, out, t, f, vol = 0.2) {
  osc(c, out, t, { f, dur: 1.5, vol });
  osc(c, out, t, { f: f * 2, dur: 0.8, vol: vol * 0.45 });
  osc(c, out, t, { f: f * 3, dur: 0.4, vol: vol * 0.22 });
  osc(c, out, t, { f: f * 4.16, dur: 0.18, vol: vol * 0.14 });
}
/** Souffle qui monte (une marche qui sort du sol). */
function whoosh(c, out, t, dur = 0.5, vol = 0.32) {
  const s = c.createBufferSource();
  s.buffer = buf(c, dur, (d) => { for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; });
  const f = c.createBiquadFilter();
  f.type = 'bandpass'; f.Q.value = 1.4;
  f.frequency.setValueAtTime(260, t);
  f.frequency.exponentialRampToValueAtTime(2600, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(out);
  s.start(t);
}
/** Roulement de caisse claire qui enfle (crescendo) pendant dur secondes. */
function snareRoll(c, out, t, dur, vol = 0.4) {
  const b = buf(c, dur + 0.12, (d, sr) => {
    let x = 0, k = 0;
    while (x < dur) {
      const p = x / dur;
      const amp = (0.16 + 0.84 * p * p) * rnd(0.85, 1.15) * (k % 2 ? 0.86 : 1);
      const i0 = Math.floor(x * sr), len = Math.floor(0.09 * sr);
      for (let i = 0; i < len && i0 + i < d.length; i++) {
        const s = i / sr;
        d[i0 + i] += amp * ((Math.random() * 2 - 1) * Math.exp(-s / 0.018) + Math.sin(2 * Math.PI * 200 * s) * Math.exp(-s / 0.02) * 0.14);
      }
      x += (1 / (22 + 10 * p)) * rnd(0.9, 1.1);
      k++;
    }
    normalize(d);
  });
  playBuf(c, out, b, t, { vol, filters: [['highpass', 160], ['lowpass', 10000]] });
}
/** Coup de grosse caisse + cymbale. */
function crash(c, out, t, vol = 0.5) {
  osc(c, out, t, { f: 150, to: 42, dur: 0.4, vol: 0.85, attack: 0.002 });
  const b = buf(c, 2.8, (d, sr) => {
    for (let i = 0; i < d.length; i++) { const s = i / sr; d[i] = (Math.random() * 2 - 1) * (Math.exp(-s / 0.6) * 0.8 + Math.exp(-s / 0.04) * 0.7); }
  });
  playBuf(c, out, b, t, { vol, filters: [['highpass', 3200, 0.5], ['lowpass', 12000]] });
}
/** Timbale (fond de la fanfare). */
function timpani(c, out, t, f, vol = 0.26) {
  osc(c, out, t, { f: f * 1.12, to: f, dur: 1.2, vol, attack: 0.004 });
  osc(c, out, t, { f: f * 1.5, to: f * 1.42, dur: 0.5, vol: vol * 0.3, attack: 0.004 });
}
/** Note de cuivre : 3 dents de scie légèrement désaccordées, filtre qui s'ouvre (« attaque » des cuivres), vibrato. */
function brass(c, out, t, f, dur, vol = 0.05) {
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.Q.value = 2;
  lp.frequency.setValueAtTime(f * 1.3, t);
  lp.frequency.exponentialRampToValueAtTime(Math.min(f * 7, 9000), t + 0.05);
  lp.frequency.exponentialRampToValueAtTime(Math.min(f * 4, 7000), t + 0.25);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
  g.gain.exponentialRampToValueAtTime(vol * 0.65, t + Math.min(0.2, dur));
  if (dur > 0.2) g.gain.setValueAtTime(vol * 0.65, t + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.14);
  const vib = c.createOscillator();
  const vg = c.createGain();
  vib.frequency.value = 5.5;
  vg.gain.setValueAtTime(0, t);
  vg.gain.linearRampToValueAtTime(dur > 0.3 ? f * 0.007 : 0, t + Math.min(0.4, dur + 0.01));
  vib.connect(vg);
  for (const det of [-9, 0, 8]) {
    const o = c.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
    vg.connect(o.frequency);
    o.connect(lp);
    o.start(t); o.stop(t + dur + 0.2);
  }
  vib.start(t); vib.stop(t + dur + 0.2);
  lp.connect(g).connect(out);
}
/** Fanfare de victoire (do majeur) : ta-ta-ta-taaa, ta-ta-ta-taaa, accord final. */
function fanfare(c, out, t) {
  const N = { C3: 130.81, G2: 98, C4: 261.63, E4: 329.63, G4: 392, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, C6: 1046.5 };
  const v = 0.075;
  const short = 0.1, step = 0.125;
  [0, 1, 2].forEach((i) => brass(c, out, t + i * step, N.G4, short, v));
  brass(c, out, t + 3 * step, N.C5, 0.45, v);
  [N.E4, N.G4].forEach((f) => brass(c, out, t + 3 * step, f, 0.45, v * 0.6));
  timpani(c, out, t + 3 * step, N.C3);
  const t2 = t + 0.88;
  [0, 1, 2].forEach((i) => brass(c, out, t2 + i * step, N.E5, short, v));
  brass(c, out, t2 + 3 * step, N.G5, 0.45, v);
  [N.B4, N.D5].forEach((f) => brass(c, out, t2 + 3 * step, f, 0.45, v * 0.6));
  timpani(c, out, t2 + 3 * step, N.G2);
  const t3 = t2 + 0.9;
  [N.C6, N.G5, N.E5, N.C5, N.C4].forEach((f, i) => brass(c, out, t3, f, 1.3, v * (i ? 0.62 : 1)));
  timpani(c, out, t3, N.C3, 0.32);
  crash(c, out, t3, 0.32);
}
/** Applaudissements : une vingtaine de personnes qui tapent dans leurs mains, chacune à son rythme. */
function applause(c, out, t, dur = 5, vol = 0.5) {
  const b = buf(c, dur, (d, sr) => {
    const fade = (x) => Math.min(1, x / 0.3) * (x > dur * 0.45 ? Math.exp(-(x - dur * 0.45) / (dur * 0.2)) : 1);
    for (let k = 0; k < 22; k++) {
      const rate = rnd(3.4, 6.2), loud = rnd(0.45, 1), tau = rnd(0.003, 0.007);
      for (let x = rnd(0, 0.3); x < dur - 0.05; x += (1 / rate) * rnd(0.9, 1.1)) {
        const i0 = Math.floor(x * sr), len = Math.floor(tau * 6 * sr), a = loud * rnd(0.6, 1) * fade(x);
        for (let i = 0; i < len && i0 + i < d.length; i++) d[i0 + i] += a * (Math.random() * 2 - 1) * Math.exp(-i / (tau * sr));
      }
    }
    normalize(d);
  });
  playBuf(c, out, b, t, { vol, filters: [['bandpass', 1500, 0.55], ['highpass', 400]] });
}
/** Clameur de la foule (« ouaaais ») : souffle filtré qui enfle puis retombe. */
function crowd(c, out, t, dur = 4.5, vol = 0.32) {
  const b = buf(c, dur, (d, sr) => {
    const ph = [rnd(0, 6), rnd(0, 6), rnd(0, 6)];
    for (let i = 0; i < d.length; i++) {
      const x = i / sr;
      const env = Math.min(1, x / 0.35) * (x < 0.6 ? 1 : 0.35 + 0.65 * Math.exp(-(x - 0.6) / 0.7)) * Math.min(1, (dur - x) / 1.2);
      const am = 1 + 0.18 * Math.sin(2 * Math.PI * 3.1 * x + ph[0]) + 0.12 * Math.sin(2 * Math.PI * 5.3 * x + ph[1]) + 0.1 * Math.sin(2 * Math.PI * 1.7 * x + ph[2]);
      d[i] = (Math.random() * 2 - 1) * env * am;
    }
    normalize(d);
  });
  playBuf(c, out, b, t, { vol, filters: [['bandpass', 850, 0.6], ['lowpass', 2600]] });
}
/** Sifflet admiratif (fiou-fiouuu). */
function whistle(c, out, t, pan = 0) {
  osc(c, out, t, { f: 1250, to: 2700, dur: 0.17, vol: 0.07, attack: 0.02, pan });
  osc(c, out, t + 0.26, { f: 2500, to: 1150, dur: 0.42, vol: 0.07, attack: 0.03, pan });
}
/** Canon à confettis : claquement sec + petit « pouf ». */
function popper(c, out, t, pan = 0) {
  const b = buf(c, 0.25, (d, sr) => { for (let i = 0; i < d.length; i++) { const s = i / sr; d[i] = (Math.random() * 2 - 1) * (Math.exp(-s / 0.003) + 0.25 * Math.exp(-s / 0.05)); } });
  playBuf(c, out, b, t, { vol: 0.55, filters: [['highpass', 1200]], pan });
  osc(c, out, t, { f: 130, to: 55, dur: 0.12, vol: 0.35, attack: 0.002, pan });
}

/**
 * Programme toute la fête du podium. plan (secondes après t0) :
 * { rises: [{ at, rank }] (marches qui montent), roll: { at, dur } (roulement), reveal (gagnant dévoilé) }.
 */
export function partySounds(c, out, t0, plan) {
  for (const r of plan.rises || []) {
    whoosh(c, out, t0 + r.at, 0.45);
    bell(c, out, t0 + r.at + 0.42, r.rank >= 3 ? 523.25 : 659.25);
  }
  if (plan.roll) snareRoll(c, out, t0 + plan.roll.at, plan.roll.dur);
  const T = t0 + plan.reveal;
  crash(c, out, T);
  popper(c, out, T + 0.01, -0.7);
  popper(c, out, T + 0.08, 0.7);
  fanfare(c, out, T + 0.15);
  crowd(c, out, T + 0.05);
  applause(c, out, T + 0.3, 5.2);
  whistle(c, out, T + 1.0, -0.4);
  whistle(c, out, T + 2.3, 0.5);
}

/** Sortie commune des sons de fête : un compresseur pour que tout tienne sans saturer. */
export function partyBus(c) {
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.25;
  const g = c.createGain();
  g.gain.value = 0.95;
  g.connect(comp).connect(c.destination);
  return g;
}

/** Joue la fête du podium. Renvoie une fonction qui la coupe (en fondu), par exemple si on quitte l'écran. */
sfx.party = (plan) => {
  if (!settings.sound) return () => {};
  const c = ac();
  if (!c) return () => {};
  const bus = partyBus(c);
  partySounds(c, bus, c.currentTime + 0.03, plan);
  return () => {
    const t = c.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(0, t + 0.3);
    setTimeout(() => { try { bus.disconnect(); } catch { /* déjà débranché */ } }, 400);
  };
};
