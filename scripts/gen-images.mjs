// Génère les images des cases de l'accueil : img/jeux/<id>.webp (une par jeu, fond transparent).
// La composition de chaque image est dans scripts/images/scenes.mjs.
//   node scripts/gen-images.mjs              → toutes les images
//   node scripts/gen-images.mjs quiz roi     → seulement ces jeux
// Les illustrations 3D viennent de Fluent Emoji (Microsoft, licence MIT, voir scripts/images/emoji/LICENSE),
// copiées dans scripts/images/emoji/ (une image par emoji, nommée d'après ses codes Unicode, ex. 1f3b2.webp).
// Pour un emoji qui n'y est pas encore, récupérer le paquet complet (3 400 emojis, images seulement) puis relancer
// avec EMOJI_DIR : le fichier manquant est copié dans scripts/images/emoji/.
//   mkdir -p /tmp/fluent && curl -sL https://registry.npmjs.org/@lobehub/fluent-emoji-3d/-/fluent-emoji-3d-1.1.0.tgz | tar xz -C /tmp/fluent
//   EMOJI_DIR=/tmp/fluent/package/assets node scripts/gen-images.mjs
// Le dessin se fait dans Chromium (Playwright, déjà installé dans l'environnement de test), la compression
// WebP avec Pillow (Python).
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENES } from './images/scenes.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'scripts/images/emoji');
const EXTRA = process.env.EMOJI_DIR; // paquet complet, pour ajouter des emojis
const OUT = process.env.OUT_DIR || join(root, 'img/jeux');
const W = 540, H = 360; // 3:2, assez net pour une case de ~180 px de large sur un écran « Retina » x3
// Compression WebP par Pillow (Python) : la transparence est compressée elle aussi (images 2 fois plus légères
// qu'avec l'encodeur de Chromium, utilisé en secours si Pillow manque).
const PY = `
import sys, os
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
for i in sys.argv[3:]:
    Image.open(os.path.join(src, i + '.png')).save(os.path.join(out, i + '.webp'), 'WEBP', quality=80, alpha_quality=70, method=6)
`;

/** Nom du fichier d'un emoji : codes Unicode en hexadécimal (avec ou sans le sélecteur FE0F). */
function emojiFile(ch) {
  const code = [...ch].map((c) => c.codePointAt(0).toString(16)).join('-');
  const names = [code, code.replace(/-fe0f/g, ''), code + '-fe0f'].map((c) => c + '.webp');
  for (const n of names) if (existsSync(join(SRC, n))) return n;
  for (const n of names) {
    if (EXTRA && existsSync(join(EXTRA, n))) { copyFileSync(join(EXTRA, n), join(SRC, n)); console.log('emoji ajouté :', ch, n); return n; }
  }
  throw new Error(`Emoji introuvable : ${ch} (${code}). Voir en tête de scripts/gen-images.mjs (EMOJI_DIR).`);
}

const ids = process.argv.slice(2);
const todo = ids.length ? ids : Object.keys(SCENES);
for (const id of todo) if (!SCENES[id]) throw new Error('Jeu inconnu dans scenes.mjs : ' + id);

// Images sources (en data: URL pour les passer au navigateur).
const files = new Map();
for (const id of todo) {
  for (const it of SCENES[id]) {
    if (it.k !== 'e') continue;
    const f = emojiFile(it.ch);
    it.file = f;
    if (!files.has(f)) files.set(f, 'data:image/webp;base64,' + readFileSync(join(SRC, f)).toString('base64'));
  }
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<!doctype html><html><body></body></html>');
await page.evaluate(async (srcs) => {
  window.IMGS = {};
  await Promise.all(Object.entries(srcs).map(([k, v]) => new Promise((ok, ko) => {
    const im = new Image();
    im.onload = () => { window.IMGS[k] = im; ok(); };
    im.onerror = () => ko(new Error('image ' + k));
    im.src = v;
  })));
  await document.fonts.load('900 40px Inter');
  await document.fonts.load('800 40px Inter');
}, Object.fromEntries(files));

mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'ambiance-img-'));
for (const id of todo) {
  const url = await page.evaluate(draw, { id, items: SCENES[id], W, H, fmt: 'image/png' });
  writeFileSync(join(tmp, id + '.png'), Buffer.from(url.split(',')[1], 'base64'));
}
const py = spawnSync('python3', ['-I', '-c', PY, tmp, OUT, ...todo], { encoding: 'utf8' });
if (py.status !== 0) {
  console.warn('⚠️ Pillow indisponible (pip install pillow) : encodage par Chromium, images plus lourdes.\n' + (py.stderr || py.error || ''));
  for (const id of todo) {
    const url = await page.evaluate(draw, { id, items: SCENES[id], W, H, fmt: 'image/webp', q: 0.8 });
    writeFileSync(join(OUT, id + '.webp'), Buffer.from(url.split(',')[1], 'base64'));
  }
}
await browser.close();
rmSync(tmp, { recursive: true, force: true });
const total = todo.reduce((n, id) => n + statSync(join(OUT, id + '.webp')).size, 0);
console.log(`${todo.length} image(s) dans ${OUT} (${Math.round(total / 1024)} Ko au total).`);

// ---------------------------------------------------------------------------------------------------
// Dessin d'une image (exécuté dans le navigateur).
function draw({ id, items, W, H, fmt, q }) {
  const U = W / 300; // une unité du repère 300 × 200
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // Tirage pseudo-aléatoire fixe pour chaque jeu (les images ne changent pas d'une génération à l'autre).
  let seed = 0;
  for (const c of id) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const R = (a, b) => a + rnd() * (b - a);

  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  const shadow = (s, on = true) => {
    if (!on) { ctx.shadowColor = 'transparent'; return; }
    ctx.shadowColor = 'rgba(25, 5, 45, .38)';
    ctx.shadowBlur = s * 0.16 * U;
    ctx.shadowOffsetY = s * 0.07 * U;
    ctx.shadowOffsetX = 0;
  };

  // ---------- Décor ----------
  // Bulles de lumière.
  for (let i = 0; i < 7; i++) {
    const x = R(0, 300) * U, y = R(0, 200) * U, r = R(4, 17) * U, a = R(0.05, 0.12);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.75, `rgba(255,255,255,${a * 0.8})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // (Le halo de lumière derrière l'élément principal est dessiné par la case elle-même, en CSS : image plus légère.)
  // Étincelles.
  const sparkle = (x, y, s, a) => {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath(); ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(0, 0, s, 0); ctx.quadraticCurveTo(0, 0, 0, s); ctx.quadraticCurveTo(0, 0, -s, 0); ctx.quadraticCurveTo(0, 0, 0, -s);
    ctx.fill(); ctx.restore();
  };
  for (let i = 0; i < 3; i++) sparkle(R(70, 290) * U, R(18, 120) * U, R(3, 6.5) * U, R(0.55, 0.9));

  // ---------- Éléments ----------
  const COLS = {
    creme: { t1: '#fffaf0', t2: '#f4dfb2', edge: '#c49a5a', ink: '#3b2614' },
    vert: { t1: '#8fdc7c', t2: '#4fae47', edge: '#2f7a2c', ink: '#ffffff' },
    jaune: { t1: '#ffe27a', t2: '#e8b928', edge: '#a87f10', ink: '#ffffff' },
    gris: { t1: '#b8bec6', t2: '#7d848d', edge: '#555b63', ink: '#ffffff' },
  };
  const shade = (hex, k) => { // éclaircit (k > 0) ou assombrit (k < 0) une couleur
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k));
    return `rgb(${f(n >> 16 & 255)},${f(n >> 8 & 255)},${f(n & 255)})`;
  };

  function drawTile(it, s) {
    const c = COLS[it.c || 'creme'];
    const w = s, h = s, r = s * 0.2, d = s * 0.09;
    shadow(it.s, it.sh !== false);
    ctx.fillStyle = c.edge; rr(-w / 2, -h / 2 + d, w, h, r); ctx.fill();
    shadow(0, false);
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, c.t1); g.addColorStop(1, c.t2);
    ctx.fillStyle = g; rr(-w / 2, -h / 2, w, h, r); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = s * 0.03; rr(-w / 2 + s * 0.04, -h / 2 + s * 0.04, w - s * 0.08, h - s * 0.08, r * 0.8); ctx.stroke();
    ctx.fillStyle = c.ink; ctx.font = `900 ${s * 0.62}px Inter`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(it.t, 0, s * 0.04);
  }

  function drawCard(it, s) {
    const h = s, w = s * 0.7, r = s * 0.09;
    shadow(it.s, it.sh !== false);
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e9ebf3');
    ctx.fillStyle = g; rr(-w / 2, -h / 2, w, h, r); ctx.fill();
    shadow(0, false);
    ctx.strokeStyle = 'rgba(30,20,60,.12)'; ctx.lineWidth = s * 0.012; ctx.stroke();
    const red = it.suit === '♥' || it.suit === '♦';
    ctx.fillStyle = red ? '#e3264f' : '#1f1b33';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const corner = (sx) => {
      ctx.save(); ctx.scale(sx, sx);
      ctx.font = `900 ${h * 0.19}px Inter`; ctx.fillText(it.rank, -w / 2 + w * 0.17, -h / 2 + h * 0.14);
      ctx.font = `${h * 0.15}px "DejaVu Sans"`; ctx.fillText(it.suit, -w / 2 + w * 0.17, -h / 2 + h * 0.3);
      ctx.restore();
    };
    corner(1); corner(-1);
    ctx.font = `${h * 0.46}px "DejaVu Sans"`; ctx.fillText(it.suit, 0, h * 0.03);
  }

  function drawBall(it, s) {
    const r = s / 2, c = it.c || '#ff4d6d';
    shadow(it.s, it.sh !== false);
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, shade(c, 0.55)); g.addColorStop(0.55, c); g.addColorStop(1, shade(c, -0.45));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    shadow(0, false);
    const g2 = ctx.createRadialGradient(-r * 0.12, -r * 0.15, r * 0.05, 0, 0, r * 0.5);
    g2.addColorStop(0, '#ffffff'); g2.addColorStop(1, '#e6e8f0');
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1f1b33'; ctx.font = `900 ${r * 0.52}px Inter`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(it.n), 0, r * 0.03);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-r * 0.42, -r * 0.5, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2); ctx.fill();
  }

  function drawWheel(it, s) {
    const R0 = s / 2;
    const cols = ['#ff4d6d', '#ffc21a', '#2ec5ff', '#7c5cff', '#2ee59d', '#ff8a3d', '#ff5ec4', '#3e6bff'];
    shadow(it.s, it.sh !== false);
    const rim = ctx.createLinearGradient(0, -R0, 0, R0);
    rim.addColorStop(0, '#fff3c4'); rim.addColorStop(1, '#d9a531');
    ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(0, 0, R0, 0, Math.PI * 2); ctx.fill();
    shadow(0, false);
    const r1 = R0 * 0.86, n = cols.length;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r1);
      g.addColorStop(0, shade(cols[i], 0.25)); g.addColorStop(1, cols[i]);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r1, a0, a1); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = s * 0.018;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke(); }
    for (let i = 0; i < 16; i++) { // ampoules
      const a = (i / 16) * Math.PI * 2;
      ctx.fillStyle = i % 2 ? '#fffbe6' : '#ffe08a';
      ctx.beginPath(); ctx.arc(Math.cos(a) * R0 * 0.93, Math.sin(a) * R0 * 0.93, s * 0.025, 0, Math.PI * 2); ctx.fill();
    }
    const hub = ctx.createRadialGradient(-s * 0.03, -s * 0.03, 0, 0, 0, s * 0.11);
    hub.addColorStop(0, '#fff8d8'); hub.addColorStop(1, '#c98a1c');
    ctx.fillStyle = hub; ctx.beginPath(); ctx.arc(0, 0, s * 0.11, 0, Math.PI * 2); ctx.fill();
    const gl = ctx.createLinearGradient(-R0, -R0, R0 * 0.2, R0 * 0.2); // reflet
    gl.addColorStop(0, 'rgba(255,255,255,.35)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, r1, 0, Math.PI * 2); ctx.fill();
    // Flèche (en haut).
    ctx.rotate(-it.r * Math.PI / 180);
    shadow(it.s * 0.5);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(-s * 0.08, -R0 - s * 0.06); ctx.lineTo(s * 0.08, -R0 - s * 0.06); ctx.lineTo(0, -R0 + s * 0.1); ctx.closePath(); ctx.fill();
  }

  function drawWord(it, s) {
    const c = it.c || '#2f7bff';
    ctx.font = `900 ${s}px "Inter Display", Inter`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    shadow(it.s * 1.6, it.sh !== false);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = s * 0.26; ctx.strokeText(it.t, 0, s * 0.08);
    shadow(0, false);
    for (let i = 6; i > 0; i--) { ctx.fillStyle = shade(c, -0.45); ctx.fillText(it.t, 0, i * s * 0.014); }
    const g = ctx.createLinearGradient(0, -s / 2, 0, s / 2);
    g.addColorStop(0, shade(c, 0.3)); g.addColorStop(1, c);
    ctx.fillStyle = g; ctx.fillText(it.t, 0, 0);
  }

  function drawRing(it, s) { // anneau épais en relief, même style que drawWord
    const c = it.c || '#2f7bff', r = s * 0.36, lw = s * 0.24;
    const ringPath = (dy) => { ctx.beginPath(); ctx.arc(0, dy, r, 0, Math.PI * 2); };
    shadow(it.s * 1.2, it.sh !== false);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = lw + s * 0.14; ringPath(s * 0.05); ctx.stroke();
    shadow(0, false);
    ctx.lineWidth = lw;
    for (let i = 6; i > 0; i--) { ctx.strokeStyle = shade(c, -0.45); ringPath(i * s * 0.012); ctx.stroke(); }
    const g = ctx.createLinearGradient(0, -r - lw / 2, 0, r + lw / 2);
    g.addColorStop(0, shade(c, 0.3)); g.addColorStop(1, c);
    ctx.strokeStyle = g; ringPath(0); ctx.stroke();
  }

  function drawArcs(it, s) {
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineCap = 'round';
    for (const [k, a0, a1, lw] of [[1, -2.5, -1.3, 0.075], [1, 0.6, 1.8, 0.075], [1.2, -2.3, -1.6, 0.045], [1.2, 0.8, 1.5, 0.045]]) {
      ctx.lineWidth = s * lw; ctx.beginPath(); ctx.arc(0, 0, s * k, a0, a1); ctx.stroke();
    }
  }

  for (const it of items) {
    if (it.o === 0) continue;
    const s = it.s * U;
    ctx.save();
    ctx.translate(it.x * U, it.y * U);
    ctx.rotate((it.r || 0) * Math.PI / 180);
    if (it.f) ctx.scale(-1, 1);
    ctx.globalAlpha = it.o ?? 1;
    if (it.b) ctx.filter = `blur(${it.b * U}px)`;
    if (it.k === 'e') {
      shadow(it.s, it.sh !== false && !it.b);
      ctx.drawImage(window.IMGS[it.file], -s / 2, -s / 2, s, s);
    } else if (it.k === 'tile') drawTile(it, s);
    else if (it.k === 'card') drawCard(it, s);
    else if (it.k === 'ball') drawBall(it, s);
    else if (it.k === 'wheel') drawWheel(it, s);
    else if (it.k === 'word') drawWord(it, s);
    else if (it.k === 'ring') drawRing(it, s);
    else if (it.k === 'arcs') drawArcs(it, s);
    ctx.restore();
  }
  return cv.toDataURL(fmt, q);
}
