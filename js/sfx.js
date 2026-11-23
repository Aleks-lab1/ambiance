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
};

export function buzz(pattern = 40) {
  if (settings.vibrate && navigator.vibrate) { try { navigator.vibrate(pattern); } catch { /* ignore */ } }
}
