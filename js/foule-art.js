// Dans la foule : dessin de la place et des bonshommes (écran télé, avatar du téléphone).
// Les bonshommes sont faits des formes dessinées pour l'appli (tête, corps, bras, jambe, yeux : repère
// 100 × 100, pieds vers y = 97), animées morceau par morceau : la tête et les bras suivent avec un temps de
// retard (ressorts peu amortis = effet gélatine), le corps s'écrase à chaque pas, ils tombent comme des
// poupées de chiffon. Rien ici ne touche l'état de la partie : on ne fait que le lire.
// Ce module ne crée rien au chargement (scripts/gen-images.mjs importe SHAPE_D et EYE_D dans Node).
import { W, H, FOUNTAINS, SPEED, PUSH_TIME } from './foule-core.js';

export const SHAPE_D = {
  head: 'M 27 23.5 A 23 22 0 1 0 73 23.5 A 23 22 0 1 0 27 23.5 Z',
  headHi1: 'M 35 14 C 37 9.5, 43 7.5, 47 9 C 48.5 9.5, 47.5 12, 44.5 13 C 41 14, 38 16, 36.5 16.5 C 35 17, 34 15.8, 35 14 Z',
  headHi2: 'M 31.7 19.5 A 1.8 1.8 0 1 0 35.3 19.5 A 1.8 1.8 0 1 0 31.7 19.5 Z',
  body: 'M 35 45 C 35 41, 65 41, 65 45 C 69 54, 73 66, 70 76 C 67 84, 58 86, 50 86 C 42 86, 33 84, 30 76 C 27 66, 31 54, 35 45 Z',
  bodyHi: 'M 37 56 C 38.5 51.5, 42 49.5, 44.5 51 C 46 52, 44.5 55, 42.5 57.5 C 40.5 60, 38.5 61.5, 37.5 60.5 C 36.5 59.5, 36.2 58, 37 56 Z',
  arm: 'M 33 47 C 37 47, 38.5 51, 36.5 56 C 34.5 61, 32.5 67, 32 72 C 33.5 74.5, 32.5 79, 28.5 79.5 C 24.5 80, 22 76.5, 23 72.5 C 24 67, 25.5 59, 27.5 53 C 29 48.5, 30.5 47, 33 47 Z',
  armHi: 'M 27.9 54 A 1.6 3.2 0 1 0 31.1 54 A 1.6 3.2 0 1 0 27.9 54 Z',
  leg: 'M 36 78 C 36 75, 47 75, 47 79 L 47 91 C 49.5 92.5, 50.5 96, 48 97.8 C 45.5 99.2, 38.5 99.2, 35.5 97.5 C 33 96, 33.5 92.5, 35.5 91 Z',
};
// Yeux, centrés sur (0, 0) : contents (et clignement), sonnés, en colère (œil gauche ; le droit est retourné).
export const EYE_D = {
  happy: 'M -3.2 0 Q 0 3, 3.2 0',
  ko: 'M -2.7 -2.7 L 2.7 2.7 M 2.7 -2.7 L -2.7 2.7',
  angry: 'M -2.8 -1.7 L 2.8 -0.3 C 2.8 2.1, 1.5 3.5, -0.2 3.5 C -2 3.5, -3 1.7, -2.8 -1.7 Z',
};
export const INK = '#2A1D2B';

function mix(a, b, k) {
  const p = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
}
const tint = (base) => ({ base, light: mix(base, '#ffffff', 0.6), dark: mix(base, '#3a1a2e', 0.4), line: mix(base, '#2a0f1f', 0.66) });
/** Couleur des bonshommes, une par manche (tout le monde a la même pendant une manche). */
export const PALETTES = [
  { name: 'roses', base: '#FF8FB4', light: '#FFD3E2', dark: '#C2577D', line: '#7A3350' },
  { name: 'bleus', ...tint('#6cb8ff') },
  { name: 'verts', ...tint('#4fd39c') },
  { name: 'jaunes', ...tint('#ffc94d') },
  { name: 'violets', ...tint('#b59bff') },
  { name: 'orange', ...tint('#ffa066') },
];

let P = null; // Path2D, créés au premier dessin
function paths() {
  if (P) return P;
  P = {};
  for (const [k, d] of Object.entries(SHAPE_D)) P[k] = new Path2D(d);
  for (const [k, d] of Object.entries(EYE_D)) P['eye_' + k] = new Path2D(d);
  return P;
}

/** Dégradés d'une couleur (dans le repère 100 × 100 du bonhomme). */
export function palette(ctx, idx) {
  const c = PALETTES[((idx % PALETTES.length) + PALETTES.length) % PALETTES.length];
  const lin = (x0, y0, x1, y1, mid = 0.55) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, c.light); g.addColorStop(mid, c.base); g.addColorStop(1, c.dark); return g;
  };
  const head = ctx.createRadialGradient(43, 14.5, 0, 43, 14.5, 34);
  head.addColorStop(0, c.light); head.addColorStop(0.55, c.base); head.addColorStop(1, c.dark);
  // Bras et jambe de droite = dessin retourné : dégradé retourné aussi, la lumière reste en haut à gauche.
  return { ...c, head, body: lin(34.6, 46.4, 65.4, 82.5, 0.5), arm: lin(24, 47, 37, 80), armR: lin(37, 47, 24, 80), leg: lin(35, 75, 49, 99), legR: lin(50, 75, 36, 99) };
}

/**
 * Dessine un bonhomme, les pieds à l'origine du repère courant (1 unité = 1/100 de sa taille).
 * p : { sp (0…1 vitesse), ph (phase de marche), dirX, lookX, lookY, lean, leanV, head, sq, hsq, fall, fallDir,
 *       push (0…1 bras tendus), f (±1 côté où il pousse), flail (0…1 il bat des bras), mood, t, seed }
 */
export function drawGuy(ctx, pal, p) {
  const S = paths();
  const part = (path, fill) => { ctx.fillStyle = fill; ctx.fill(path); ctx.strokeStyle = pal.line; ctx.lineWidth = 2.5; ctx.stroke(path); };
  const sp = p.sp || 0, ph = p.ph || 0, push = p.push || 0, flail = p.flail || 0, t = p.t || 0, seed = p.seed || 0;
  const fl = Math.max(0, p.fall || 0), sq = 1 + Math.sin(ph * 2) * 0.045 * sp + (p.sq || 0);
  ctx.save();
  ctx.translate(0, -fl * 8);
  ctx.rotate((p.lean || 0) * 0.55 + (p.fall || 0) * (p.fallDir || 1) * 1.48 + push * (p.f || 1) * 0.12);
  ctx.translate(-50, -97);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // Jambes (derrière le corps) : elles se lèvent et basculent à chaque pas, gigotent quand il tombe.
  for (const s of [-1, 1]) {
    const off = s < 0 ? 0 : Math.PI;
    const kick = flail * Math.sin(t * 16 + seed + s * 2) * 0.55;
    const aw = Math.sin(ph + off) * 0.4 * sp * (p.dirX || 0) + kick - push * (p.f || 1) * s * 0.12;
    const lift = Math.max(0, Math.cos(ph + off)) * 6 * sp;
    ctx.save();
    if (s > 0) { ctx.translate(100, 0); ctx.scale(-1, 1); }
    ctx.translate(41.5, 77 - lift); ctx.rotate(s > 0 ? -aw : aw); ctx.translate(-41.5, -77);
    part(S.leg, s > 0 ? pal.legR : pal.leg);
    ctx.restore();
  }
  // Haut du corps : il rebondit à chaque pas et s'écrase comme de la gelée.
  ctx.translate(0, -Math.abs(Math.sin(ph)) * 2.8 * sp);
  ctx.save(); ctx.translate(50, 86); ctx.scale(1 / sq, sq); ctx.translate(-50, -86);
  part(S.body, pal.body);
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fill(S.bodyHi);
  ctx.restore();
  // Bras : ils ballottent, suivent le corps avec retard, se tendent pour pousser, battent l'air en tombant.
  const shY = 86 - 37 * sq, shX = 50 - 17 / sq;
  for (const s of [-1, 1]) {
    const off = s < 0 ? Math.PI : 0;
    const aw = Math.sin(ph + off) * 0.42 * sp * (p.dirX || 0) - (p.leanV || 0) * 0.22;
    let a = (s > 0 ? -aw : aw) + 0.06 + Math.sin(t * 1.7 + seed + s) * 0.05;
    a += (Math.sin(t * 18 + seed * s) * 0.8 + 1.1) * flail;
    a += ((s === (p.f || 1) ? 1.5 : -1.45) - a) * push;
    ctx.save();
    if (s > 0) { ctx.translate(100, 0); ctx.scale(-1, 1); }
    ctx.translate(shX, shY); ctx.rotate(a); ctx.translate(-33, -49);
    part(S.arm, s > 0 ? pal.armR : pal.arm);
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fill(S.armHi);
    ctx.restore();
  }
  // Grosse tête : elle suit avec du retard et tremblote. Yeux cachés quand on le voit de dos.
  const head = p.head || 0, hsq = p.hsq || 0, lookX = p.lookX || 0, lookY = p.lookY ?? 0.3;
  ctx.save();
  ctx.translate(50 + head * 6, 86 - 44 * sq); ctx.rotate(head * 0.45); ctx.scale(1 / (1 + hsq), 1 + hsq); ctx.translate(-50, -42);
  part(S.head, pal.head);
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fill(S.headHi1);
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fill(S.headHi2);
  const back = Math.max(0, Math.min(1, -lookY * 1.8 - 0.55));
  if (back < 1) {
    ctx.globalAlpha *= 1 - back;
    const ex = lookX * 7, ey = 25.5 + Math.max(-2, lookY * 2.2), gap = 6.75 * (1 - 0.22 * Math.abs(lookX));
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(50 + ex + s * gap, ey);
      if (p.mood === 'angry') { if (s > 0) ctx.scale(-1, 1); ctx.fillStyle = INK; ctx.fill(S.eye_angry); }
      else if (p.mood === 'ko' || p.mood === 'happy') { ctx.strokeStyle = INK; ctx.lineWidth = p.mood === 'ko' ? 2.3 : 2.4; ctx.stroke(p.mood === 'ko' ? S.eye_ko : S.eye_happy); }
      else {
        ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, 0, 2.6, 3.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(-0.9, -1.3, 0.9, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }
  ctx.restore();
  ctx.restore();
}

/** Petit bonhomme immobile (téléphone : « cette manche, tout le monde est rose »). */
export function drawAvatar(cv, idx = 0, mood = 'open') {
  const ctx = cv.getContext('2d');
  const s = Math.min(cv.width, cv.height) / 106;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save(); ctx.translate(cv.width / 2, cv.height - 3 * s); ctx.scale(s, s);
  drawGuy(ctx, palette(ctx, idx), { mood, lookY: 0.4 });
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------
// La place (écran télé)
const K = 0.9; // taille d'un bonhomme : 90 unités de la place
// Partie de la place montrée à l'écran (on coupe un peu l'herbe autour pour voir la foule en plus grand).
const VIEW = { x: 80, y: 40, w: 1440, h: 850 };
const ell = (c, x, y, rx, ry) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); };
const TREES = [];
for (let x = 190; x <= 1410; x += 203) TREES.push({ x, y: 104 });
for (const y of [330, 560, 790]) TREES.push({ x: 58, y }, { x: 1542, y });

function drawBg(c) {
  let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  c.fillStyle = '#c4e4a6'; c.fillRect(-W, -H, W * 3, H * 3);
  for (let i = 0; i < 70; i++) { c.fillStyle = 'rgba(255,255,255,.16)'; ell(c, r() * W, r() * H, 20 + r() * 40, 8 + r() * 14); }
  c.save();
  c.beginPath(); c.roundRect(110, 140, 1380, 738, 46); c.fillStyle = '#e4d6be'; c.fill();
  c.beginPath(); c.roundRect(118, 148, 1364, 722, 40); c.fillStyle = '#f8f0e3'; c.fill(); c.clip();
  c.strokeStyle = 'rgba(190,165,130,.25)'; c.lineWidth = 2;
  for (let y = 148, row = 0; y < 880; y += 46, row++) {
    c.beginPath(); c.moveTo(110, y); c.lineTo(1490, y); c.stroke();
    for (let x = 118 + (row % 2) * 35; x < 1490; x += 70) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 46); c.stroke(); }
  }
  for (const f of FOUNTAINS) { c.fillStyle = 'rgba(225,205,170,.5)'; ell(c, f.x, f.y + 6, 128, 66); }
  c.restore();
  for (let x = 140; x < 1480; x += 34) {
    const col = ['#ff9db8', '#ffd45c', '#ffffff', '#b9a4ff'][(r() * 4) | 0];
    c.fillStyle = '#7fc46a'; ell(c, x, 889, 15, 8);
    c.fillStyle = col; ell(c, x - 4 + r() * 8, 885, 3.5, 3.5);
  }
}

function drawTree(ctx, { x, y }) {
  ctx.fillStyle = 'rgba(60,80,30,.2)'; ell(ctx, x + 8, y + 2, 48, 13);
  ctx.fillStyle = '#a77b55'; ctx.beginPath(); ctx.roundRect(x - 7, y - 40, 14, 42, 5); ctx.fill();
  for (const [dx, dy, r, c] of [[-24, -60, 30, '#62b152'], [24, -62, 30, '#62b152'], [0, -84, 34, '#6dbb5c'], [-12, -94, 16, '#93d47e'], [14, -70, 12, '#86cc71']]) {
    ctx.fillStyle = c; ell(ctx, x + dx, y + dy, r, r);
  }
}

function drawFountain(ctx, f, t) {
  ctx.save(); ctx.translate(f.x, f.y);
  ctx.fillStyle = 'rgba(70,50,30,.15)'; ell(ctx, 5, 12, 84, 40);
  ctx.fillStyle = '#d6c8b2'; ell(ctx, 0, 9, 78, 37);
  ctx.fillStyle = '#efe6d8'; ell(ctx, 0, 0, 78, 37);
  const light = mix(f.c, '#ffffff', 0.55);
  const wg = ctx.createLinearGradient(0, -28, 0, 28); wg.addColorStop(0, light); wg.addColorStop(1, f.c);
  ctx.fillStyle = wg; ell(ctx, 0, 1, 64, 28);
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const r = (t * 0.45 + i / 3) % 1;
    ctx.strokeStyle = `rgba(255,255,255,${(1 - r) * 0.7})`;
    ctx.beginPath(); ctx.ellipse(0, -1, 12 + r * 48, 5 + r * 20, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = '#e2d6c3'; ctx.beginPath(); ctx.roundRect(-7, -40, 14, 40, 5); ctx.fill();
  ctx.fillStyle = '#d6c8b2'; ell(ctx, 0, -37, 20, 8.5);
  ctx.fillStyle = '#efe6d8'; ell(ctx, 0, -40, 20, 8);
  ctx.fillStyle = light; ell(ctx, 0, -40.5, 15, 5);
  for (let i = 0; i < 16; i++) {
    const k = (t * 0.9 + i / 16) % 1, a = i * 2.4;
    const x = Math.cos(a) * 36 * k, y = -46 - 18 * k + 62 * k * k + Math.sin(a) * 14 * k;
    ctx.fillStyle = light; ell(ctx, x, y, 2.4, 2.4);
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ell(ctx, x - 0.6, y - 0.6, 1, 1);
  }
  ctx.restore();
}

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
}

/**
 * Scène de la place sur un <canvas> : draw(monde, { color, reveal, dt }) à chaque image.
 * Chaque bonhomme garde ses ressorts d'animation d'une image à l'autre (remis à zéro quand le monde change).
 * sound : { push(), hit(), thud() } facultatif.
 */
export function createScene(cv, { sound = {} } = {}) {
  const ctx = cv.getContext('2d');
  const bg = document.createElement('canvas');
  let dpr = 1, vs = 1, ox = 0, oy = 0, cw = 0, chh = 0;
  let world = null, anim = [], pal = null, palIdx = -1;
  const puffs = [], bursts = [], stars = [];

  function resize() {
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = r.width; chh = r.height;
    cv.width = Math.round(cw * dpr); cv.height = Math.round(chh * dpr);
    vs = Math.min(cw / VIEW.w, chh / VIEW.h); ox = (cw - VIEW.w * vs) / 2 - VIEW.x * vs; oy = (chh - VIEW.h * vs) / 2 - VIEW.y * vs;
    bg.width = cv.width; bg.height = cv.height;
    const b = bg.getContext('2d');
    b.setTransform(vs * dpr, 0, 0, vs * dpr, ox * dpr, oy * dpr); drawBg(b);
  }

  function puff(x, y, n, size) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      puffs.push({ x, y, vx: Math.cos(a) * 55, vy: Math.sin(a) * 18 - 8, r: (4 + Math.random() * 4) * size, life: 0.5, max: 0.5 });
    }
  }

  function newAnim(c, i) {
    return { lean: 0, leanV: 0, head: 0, headV: 0, sq: 0, sqV: 0, hsq: 0, hsqV: 0, fall: c.m === 'up' ? 0 : 1, fallV: 0, ph: (i * 1.7) % 6,
      lookX: c.f * 0.5, lookY: 0.3, lookTx: c.f * 0.5, lookT: (i * 0.37) % 2, dirX: c.f, m: c.m, push: c.push, alpha: 1, seed: (i * 7.31) % 100 };
  }

  /** Met à jour les ressorts d'un bonhomme et détecte ce qui vient de lui arriver (poussé, il pousse…). */
  function animate(c, a, i, dt, t) {
    if (a.push !== c.push) { a.push = c.push; a.leanV += c.f * 3; a.hsqV = -2; if (sound.push) sound.push(); }
    if (a.m !== c.m) {
      if (a.m === 'up' && c.m !== 'up') { // il vient d'être poussé
        a.hsqV = 4;
        bursts.push({ x: c.x - c.fd * 12 * K, y: c.y - 44 * K, life: 0.3, rot: Math.random() });
        if (sound.hit) sound.hit();
      }
      if (c.m === 'up') { a.sqV = 2.2; a.hsqV = 3; }
      a.m = c.m;
    }
    const down = c.m !== 'up';
    a.fallV += (((down ? 1 : 0) - a.fall) * (down ? 90 : 42) - a.fallV * (down ? 5 : 6.5)) * dt;
    a.fall += a.fallV * dt;
    if (a.fall > 1) {
      if (a.fallV > 1.5) { puff(c.x + c.fd * 62 * K, c.y - 4, 6, 0.55); a.sqV = -3.2; a.hsqV = -4; if (sound.thud) sound.thud(); }
      a.fall = 1; a.fallV = -a.fallV * 0.3;
    }
    if (a.fall < -0.12) { a.fall = -0.12; a.fallV = 0; }
    const v = Math.hypot(c.vx, c.vy);
    a.sp = Math.min(1, v / SPEED);
    if (v > 8) a.dirX = c.vx / v;
    if (v <= 8) { a.lookT -= dt; if (a.lookT < 0) { a.lookTx = (Math.random() * 2 - 1) * 0.9; a.lookT = 1 + Math.random() * 2; } }
    const ltx = v > 8 ? c.vx / v : (t - c.push < PUSH_TIME ? c.f : a.lookTx), lty = v > 8 ? c.vy / v : 0.3;
    const lk = Math.min(1, dt * 7); a.lookX += (ltx - a.lookX) * lk; a.lookY += (lty - a.lookY) * lk;
    a.ph += dt * 10 * a.sp;
    a.leanV += (((c.vx / SPEED) * 0.12 - a.lean) * 55 - a.leanV * 5) * dt; a.lean += a.leanV * dt;
    a.headV += ((a.lean * 1.6 - a.head) * 38 - a.headV * 4) * dt; a.head += a.headV * dt;
    a.sqV += (-a.sq * 240 - a.sqV * 8) * dt; a.sq += a.sqV * dt;
    a.hsqV += (-a.hsq * 300 - a.hsqV * 9) * dt; a.hsq += a.hsqV * dt;
    // Un joueur éliminé s'efface au bout de quelques secondes.
    const target = c.m === 'out' && t - c.down > 3.5 ? 0 : 1;
    a.alpha += (target - a.alpha) * Math.min(1, dt * 2.5);
  }

  function drawChar(c, a, t, dim) {
    if (a.alpha < 0.02) return;
    const pk = t - c.push;
    const pp = pk < PUSH_TIME ? pk / PUSH_TIME : 1;
    const push = pk < PUSH_TIME ? (pp < 0.3 ? pp / 0.3 : 1 - Math.max(0, pp - 0.55) / 0.45) : 0;
    const down = c.m !== 'up';
    const mood = down && a.fall > 0.5 ? 'ko' : pk < PUSH_TIME ? 'angry' : t - c.happy < 1.4 || (t + a.seed) % 4 < 0.14 ? 'happy' : 'open';
    const fl = Math.max(0, a.fall);
    ctx.save();
    ctx.globalAlpha = a.alpha * (dim ? 0.38 : 1);
    ctx.translate(c.x, c.y);
    ctx.fillStyle = 'rgba(110,50,80,.17)';
    ctx.beginPath(); ctx.ellipse(c.fd * fl * 34 * K, 0, (24 + fl * 30) * K, 6.5 * K, 0, 0, Math.PI * 2); ctx.fill();
    ctx.scale(K, K);
    drawGuy(ctx, pal, { sp: a.sp, ph: a.ph, dirX: a.dirX, lookX: a.lookX, lookY: a.lookY, lean: a.lean, leanV: a.leanV, head: a.head,
      sq: a.sq, hsq: a.hsq, fall: a.fall, fallDir: c.fd, push, f: c.f, flail: down ? Math.max(0, 1 - (t - c.down) * 0.7) : 0, mood, t, seed: a.seed });
    ctx.restore();
    if (down && a.fall > 0.7 && a.alpha > 0.5) {
      const R = a.fall * c.fd * 1.48;
      stars.push({ x: c.x + 73.5 * Math.sin(R) * K, y: c.y + (-fl * 8 - 73.5 * Math.cos(R)) * K - 28 * K, t: t + a.seed });
    }
  }

  function label(c, text, out) {
    ctx.save();
    ctx.font = '700 30px Fredoka, system-ui, sans-serif';
    const w = ctx.measureText(text).width + 32, x = c.x, y = c.y - (c.m === 'up' ? 112 : 70) * K;
    ctx.globalAlpha = out ? 0.75 : 1;
    ctx.shadowColor = 'rgba(40,10,60,.3)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 50, w, 44, 22); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 10, y - 7); ctx.lineTo(x + 10, y - 7); ctx.lineTo(x, y + 6); ctx.closePath(); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = pal.line; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 50, w, 44, 22); ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y - 27);
    ctx.restore();
  }

  function draw(w, { color = 0, reveal = null, dt = 0.016 } = {}) {
    if (!cw) resize();
    if (!cw) return;
    if (w !== world) { world = w; anim = []; }
    if (palIdx !== color) { palIdx = color; pal = palette(ctx, color); }
    const t = w ? w.t : 0;
    const chars = w ? w.chars : [];
    chars.forEach((c, i) => { if (!anim[i]) anim[i] = newAnim(c, i); animate(c, anim[i], i, dt, t); });
    for (const p of puffs) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.r += dt * 18; }
    for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i].life <= 0) puffs.splice(i, 1);
    for (const b of bursts) b.life -= dt;
    for (let i = bursts.length - 1; i >= 0; i--) if (bursts[i].life <= 0) bursts.splice(i, 1);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg, 0, 0);
    ctx.setTransform(vs * dpr, 0, 0, vs * dpr, ox * dpr, oy * dpr);
    const shown = reveal ? new Set(reveal.map((r) => r.i)) : null;
    const list = [];
    chars.forEach((c, i) => list.push([c.y, () => drawChar(c, anim[i], t, shown && !shown.has(i))]));
    for (const f of FOUNTAINS) list.push([f.y, () => drawFountain(ctx, f, t)]);
    for (const tr of TREES) list.push([tr.y, () => drawTree(ctx, tr)]);
    list.sort((a, b) => a[0] - b[0]);
    stars.length = 0;
    for (const [, d] of list) d();
    ctx.lineWidth = 1.2;
    for (const p of puffs) {
      const k = p.life / p.max;
      ctx.fillStyle = `rgba(255,255,255,${k * 0.8})`; ell(ctx, p.x, p.y, p.r, p.r * 0.8);
      ctx.strokeStyle = `rgba(190,170,150,${k * 0.5})`; ctx.stroke();
    }
    for (const b of bursts) {
      const k = 1 - b.life / 0.3, r = 9 + k * 9;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.globalAlpha = Math.min(1, b.life / 0.12);
      ctx.beginPath();
      for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8, rr = i % 2 ? r * 0.5 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fillStyle = '#fff6c4'; ctx.fill(); ctx.strokeStyle = '#ffb703'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
    }
    for (const s of stars) for (let i = 0; i < 3; i++) { const a = s.t * 5 + i * 2.09; star(ctx, s.x + Math.cos(a) * 20, s.y + Math.sin(a) * 6, 5); }
    if (reveal) for (const r of reveal) { const c = chars[r.i]; if (c) label(c, r.name, r.out); }
  }

  return { draw, resize };
}
