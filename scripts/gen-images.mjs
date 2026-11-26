// Génère les images des cases des jeux : img/jeux/<id>.webp (une par jeu, fond transparent).
// La composition de chaque image est dans scripts/images/scenes.mjs.
//   node scripts/gen-images.mjs              → toutes les images
//   node scripts/gen-images.mjs quiz roi     → seulement ces jeux
//   node scripts/gen-images.mjs modes        → illustrations des 3 cases de l'accueil, découpées dans la maquette
//                                              (scripts/images/maquette-accueil.webp, MODE_CROPS) → img/ui/mode-<id>.webp
// Style « autocollant » : des dessins colorés (dégradé), entourés d'un épais liseré blanc, avec une ombre douce,
// posés sur le dégradé de la case (le dégradé, la trame de points et la lumière sont faits en CSS : .tile dans css/style.css).
// Les silhouettes viennent de game-icons.net (licence CC BY 3.0, voir scripts/images/icons/CREDITS.md),
// copiées dans scripts/images/icons/<nom>.svg. Pour en ajouter une : récupérer le paquet (images seulement,
// aucun code exécuté) puis relancer avec ICONS_JSON : le dessin manquant est copié dans scripts/images/icons/.
//   mkdir -p /tmp/gi && curl -sL https://registry.npmjs.org/@iconify-json/game-icons/-/game-icons-1.2.4.tgz | tar xz -C /tmp/gi
//   ICONS_JSON=/tmp/gi/package/icons.json node scripts/gen-images.mjs <id>
// Le dessin se fait dans Chromium (Playwright, déjà installé dans l'environnement de test), la compression
// WebP avec Pillow (Python).
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENES, MODE_CROPS } from './images/scenes.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'scripts/images/icons');
const EXTRA = process.env.ICONS_JSON; // paquet complet, pour ajouter des silhouettes
const OUT = process.env.OUT_DIR || join(root, 'img/jeux');
const W = 540, H = 360; // 3:2, assez net pour une case de ~180 px de large sur un écran « Retina » x3
// Compression WebP par Pillow (Python) : la transparence est compressée elle aussi.
const PY = `
import sys, os
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
for i in sys.argv[3:]:
    Image.open(os.path.join(src, i + '.png')).save(os.path.join(out, i + '.webp'), 'WEBP', quality=82, alpha_quality=80, method=6)
`;

/** Dessin d'une silhouette : scripts/images/icons/<nom>.svg (copié depuis ICONS_JSON s'il manque). */
let extra = null;
function iconSvg(name) {
  const f = join(SRC, name + '.svg');
  if (!existsSync(f)) {
    if (!EXTRA) throw new Error(`Silhouette introuvable : ${name}. Voir en tête de scripts/gen-images.mjs (ICONS_JSON).`);
    extra ||= JSON.parse(readFileSync(EXTRA, 'utf8'));
    const ic = extra.icons[name];
    if (!ic) throw new Error(`Silhouette inconnue dans ${EXTRA} : ${name}`);
    const w = ic.width || extra.width || 512, h = ic.height || extra.height || 512;
    mkdirSync(SRC, { recursive: true });
    writeFileSync(f, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${ic.body}</svg>\n`);
    console.log('silhouette ajoutée :', name);
  }
  return readFileSync(f, 'utf8').replace(/currentColor/g, '#fff');
}

// Illustrations des 3 cases de l'accueil : découpées dans la maquette (Pillow + numpy). Les bouts de lettres de la
// maquette qui dépassent dans la découpe sont effacés (couleurs du dessus et du dessous fondues, puis lissées) :
// le vrai texte est refait en HTML (js/modes-art.js).
if (process.argv[2] === 'modes') {
  const CROP = `
import sys, json
import numpy as np
from PIL import Image, ImageFilter
src, out, spec = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
im = Image.open(src).convert('RGB')
for id, m in spec.items():
    a = np.asarray(im).astype(float).copy()
    for (x0, y0, x1, y1) in m['erase']:
        top, bot = a[y0 - 2, x0:x1], a[y1 + 2, x0:x1]
        for y in range(y0, y1):
            t = (y - y0) / (y1 - y0)
            a[y, x0:x1] = top * (1 - t) + bot * t
    fixed = Image.fromarray(a.clip(0, 255).astype('uint8'))
    for (x0, y0, x1, y1) in m['erase']:
        box = (x0 - 4, y0 - 4, x1 + 4, y1 + 4)
        fixed.paste(fixed.crop(box).filter(ImageFilter.GaussianBlur(3)), box[:2])
    fixed.crop(tuple(m['box'])).save(f'{out}/mode-{id}.webp', 'WEBP', quality=84, method=6)
    print(id, 'ok')
`;
  const py = spawnSync('python3', ['-I', '-c', CROP, join(root, 'scripts/images/maquette-accueil.webp'), join(root, 'img/ui'), JSON.stringify(MODE_CROPS)], { encoding: 'utf8' });
  process.stdout.write(py.stdout || ''); if (py.status !== 0) { console.error(py.stderr); process.exit(1); }
  process.exit(0);
}

const ids = process.argv.slice(2);
const todo = ids.length ? ids : Object.keys(SCENES);
for (const id of todo) if (!SCENES[id]) throw new Error('Jeu inconnu dans scenes.mjs : ' + id);

// Silhouettes utilisées (en data: URL pour les passer au navigateur) et police des mots (Fredoka, celle de l'appli).
const icons = {};
for (const id of todo) for (const it of SCENES[id]) if (it.k === 'i' && !icons[it.n]) icons[it.n] = 'data:image/svg+xml;base64,' + Buffer.from(iconSvg(it.n)).toString('base64');
const font = 'data:font/woff2;base64,' + readFileSync(join(root, 'fonts/fredoka-700.woff2')).toString('base64');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<!doctype html><html><body></body></html>');
await page.evaluate(async ({ srcs, font }) => {
  window.IMGS = {};
  await Promise.all(Object.entries(srcs).map(([k, v]) => new Promise((ok, ko) => {
    const im = new Image(512, 512);
    im.onload = () => { window.IMGS[k] = im; ok(); };
    im.onerror = () => ko(new Error('silhouette ' + k));
    im.src = v;
  })));
  const f = new FontFace('Fredoka', `url(${font})`, { weight: '700' });
  document.fonts.add(await f.load());
}, { srcs: icons, font });

const tmp = mkdtempSync(join(tmpdir(), 'ambiance-img-'));
for (const id of todo) {
  const url = await page.evaluate(draw, { items: SCENES[id], W, H });
  writeFileSync(join(tmp, id + '.png'), Buffer.from(url.split(',')[1], 'base64'));
}
mkdirSync(OUT, { recursive: true });
const py = spawnSync('python3', ['-I', '-c', PY, tmp, OUT, ...todo], { encoding: 'utf8' });
if (py.status !== 0) throw new Error('Compression WebP impossible (pip install pillow) :\n' + (py.stderr || py.error || ''));
await browser.close();
rmSync(tmp, { recursive: true, force: true });
const total = todo.reduce((n, id) => n + statSync(join(OUT, id + '.webp')).size, 0);
console.log(`${todo.length} image(s) (${Math.round(total / 1024)} Ko au total).`);

// ---------------------------------------------------------------------------------------------------
// Dessin d'une image (exécuté dans le navigateur), style « autocollant » : chaque élément est une forme
// colorée (dégradé clair → couleur), entourée d'un épais liseré blanc, avec ses détails par-dessus
// (lettre d'une tuile, valeur d'une carte…) et une ombre douce.
function draw({ items, W, H }) {
  const U = W / 300; // une unité du repère 300 × 200
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  const canvas = (n) => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };
  const shade = (hex, k) => { // éclaircit (k > 0) ou assombrit (k < 0) une couleur #rrggbb
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k));
    return `rgb(${f(n >> 16 & 255)},${f(n >> 8 & 255)},${f(n & 255)})`;
  };
  const text = (x, t, size, dy = 0, font = 'Fredoka') => { x.font = `700 ${size}px ${font}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, 0, dy); };
  const rr = (x, a, b, w, h, r) => { x.beginPath(); x.roundRect(a, b, w, h, r); };
  const INK = '#2b1f45';

  // shape : la silhouette (dessinée d'une seule couleur) ; detail : ce qui se dessine par-dessus la couleur.
  const KINDS = {
    i: { shape: (x, S, it) => x.drawImage(window.IMGS[it.n], -S / 2, -S / 2, S, S) },
    tile: {
      shape: (x, S) => { rr(x, -S / 2, -S / 2, S, S, S * 0.2); x.fill(); },
      detail: (x, S, it) => { x.fillStyle = it.ink || INK; text(x, it.t, S * 0.66, S * 0.04); },
    },
    card: {
      shape: (x, S) => { rr(x, -S * 0.36, -S / 2, S * 0.72, S, S * 0.09); x.fill(); },
      detail: (x, S, it) => {
        x.fillStyle = it.suit === '♥' || it.suit === '♦' ? '#e0283f' : INK;
        x.font = `700 ${S * 0.17}px Fredoka`; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(it.rank, -S * 0.24, -S * 0.37); x.fillText(it.suit, -S * 0.24, -S * 0.22);
        x.font = `700 ${S * 0.48}px Fredoka`; x.fillText(it.suit, 0, S * 0.07);
      },
    },
    ball: {
      shape: (x, S) => { x.beginPath(); x.arc(0, 0, S / 2, 0, Math.PI * 2); x.fill(); },
      detail: (x, S, it) => {
        x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, S * 0.29, 0, Math.PI * 2); x.fill();
        x.fillStyle = INK; text(x, String(it.t), S * 0.3, S * 0.02);
        const g = x.createRadialGradient(-S * 0.18, -S * 0.2, 0, -S * 0.18, -S * 0.2, S * 0.3);
        g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.beginPath(); x.arc(0, 0, S / 2, 0, Math.PI * 2); x.fill();
      },
    },
    word: { shape: (x, S, it) => text(x, it.t, S) },
    ring: { shape: (x, S) => { x.lineWidth = S * 0.2; x.beginPath(); x.arc(0, 0, S * 0.38, 0, Math.PI * 2); x.stroke(); } },
    wheel: {
      shape: (x, S) => { x.beginPath(); x.arc(0, 0, S / 2, 0, Math.PI * 2); x.fill(); },
      detail: (x, S) => {
        const cols = ['#ff4d6d', '#ffd23f', '#3a86ff', '#2ec27e', '#ff9f1c', '#9b5de5', '#4cc9f0', '#ff5d8f'];
        for (let k = 0; k < 8; k++) {
          x.fillStyle = cols[k]; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, S * 0.44, (k / 8) * Math.PI * 2, ((k + 1) / 8) * Math.PI * 2); x.closePath(); x.fill();
        }
        x.strokeStyle = '#fff'; x.lineWidth = S * 0.02;
        for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * S * 0.44, Math.sin(a) * S * 0.44); x.stroke(); }
        x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, S * 0.1, 0, Math.PI * 2); x.fill();
        x.fillStyle = INK; x.beginPath(); x.arc(0, 0, S * 0.05, 0, Math.PI * 2); x.fill();
      },
    },
    gallows: {
      shape: (x, S) => {
        x.lineWidth = S * 0.085; x.lineCap = 'round'; x.lineJoin = 'round';
        x.beginPath(); x.moveTo(-S * 0.42, S * 0.45); x.lineTo(S * 0.05, S * 0.45);
        x.moveTo(-S * 0.25, S * 0.45); x.lineTo(-S * 0.25, -S * 0.45); x.lineTo(S * 0.22, -S * 0.45); x.lineTo(S * 0.22, -S * 0.3);
        x.moveTo(-S * 0.25, -S * 0.22); x.lineTo(-S * 0.05, -S * 0.45); x.stroke();
      },
      detail: (x, S) => {
        x.strokeStyle = INK; x.lineWidth = S * 0.05; x.lineCap = 'round';
        x.beginPath(); x.arc(S * 0.22, -S * 0.17, S * 0.11, 0, Math.PI * 2); x.stroke();
        x.beginPath(); x.moveTo(S * 0.22, -S * 0.06); x.lineTo(S * 0.22, S * 0.17); x.moveTo(S * 0.22, S * 0.02); x.lineTo(S * 0.1, S * 0.1); x.moveTo(S * 0.22, S * 0.02); x.lineTo(S * 0.34, S * 0.1);
        x.moveTo(S * 0.22, S * 0.17); x.lineTo(S * 0.12, S * 0.3); x.moveTo(S * 0.22, S * 0.17); x.lineTo(S * 0.32, S * 0.3); x.stroke();
      },
    },
    pads: {
      shape: (x, S) => { const g = S * 0.07, w = (S - g) / 2; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { rr(x, a < 0 ? -S / 2 : g / 2, b < 0 ? -S / 2 : g / 2, w, w, S * 0.12); x.fill(); }); },
      detail: (x, S) => {
        const g = S * 0.07, w = (S - g) / 2;
        [[-1, -1, '#ff4d6d'], [1, -1, '#2ec27e'], [-1, 1, '#3a86ff'], [1, 1, '#ffd23f']].forEach(([a, b, c]) => {
          const gr = x.createLinearGradient(0, b < 0 ? -S / 2 : g / 2, 0, (b < 0 ? -S / 2 : g / 2) + w);
          gr.addColorStop(0, shade(c, 0.3)); gr.addColorStop(1, c);
          x.fillStyle = gr; rr(x, a < 0 ? -S / 2 : g / 2, b < 0 ? -S / 2 : g / 2, w, w, S * 0.12); x.fill();
        });
      },
    },
    arrow: { shape: (x, S) => { x.lineJoin = 'round'; x.lineWidth = S * 0.16; x.beginPath(); x.moveTo(0, -S * 0.38); x.lineTo(S * 0.4, S * 0.3); x.lineTo(-S * 0.4, S * 0.3); x.closePath(); x.fill(); x.stroke(); } },
    arcs: {
      shape: (x, S) => {
        x.lineWidth = S * 0.05; x.lineCap = 'round';
        for (const [a0, a1, r] of [[-2.6, -1.7, 0.46], [0.5, 1.4, 0.46], [-2.4, -1.95, 0.56], [0.7, 1.15, 0.56]]) { x.beginPath(); x.arc(0, 0, S * r, a0, a1); x.stroke(); }
      },
    },
  };
  const DEF = { tile: '#fff1d6', card: '#ffffff', wheel: '#ffffff', gallows: '#b07a45', arcs: '#ffffff' };

  for (const it of items) {
    const K = KINDS[it.k];
    const S = it.s * U;
    const n = Math.ceil(S * (it.k === 'word' ? Math.max(2.2, String(it.t).length * 0.8 + 0.8) : 2.2));
    const half = (c) => { const x = c.getContext('2d'); x.translate(n / 2, n / 2); return x; };
    // 1. Silhouette (masque).
    const mask = canvas(n); const mx = half(mask); mx.fillStyle = mx.strokeStyle = '#000'; K.shape(mx, S, it);
    // 2. Liseré blanc : la silhouette élargie dans toutes les directions.
    const out = canvas(n); const ox = out.getContext('2d');
    const r = it.edge === 0 ? 0 : Math.max(2, S * (it.edge || 0.045));
    for (let k = 0; k < 28 && r; k++) { const a = (k / 28) * Math.PI * 2; ox.drawImage(mask, Math.cos(a) * r, Math.sin(a) * r); }
    ox.globalCompositeOperation = 'source-in'; ox.fillStyle = '#fff'; ox.fillRect(0, 0, n, n);
    // 3. Couleur : dégradé de la couleur éclaircie (en haut à gauche) à la couleur, un peu assombrie en bas.
    const col = it.c || DEF[it.k] || '#ffffff';
    const fill = canvas(n); const fx = fill.getContext('2d');
    fx.drawImage(mask, 0, 0); fx.globalCompositeOperation = 'source-in';
    const gr = fx.createLinearGradient(n / 2 - S / 2, n / 2 - S / 2, n / 2 + S / 2, n / 2 + S / 2);
    gr.addColorStop(0, shade(col, 0.38)); gr.addColorStop(0.55, col); gr.addColorStop(1, shade(col, -0.14));
    fx.fillStyle = gr; fx.fillRect(0, 0, n, n);
    // 4. Assemblage + détails.
    const L = canvas(n); const lx = L.getContext('2d');
    lx.drawImage(out, 0, 0); lx.drawImage(fill, 0, 0);
    if (K.detail) { const dx = half(L); K.detail(dx, S, it); }
    // 5. Pose sur l'image, avec rotation et ombre douce.
    ctx.save();
    ctx.translate(it.x * U, it.y * U);
    ctx.rotate((it.r * Math.PI) / 180);
    if (it.f) ctx.scale(-1, 1);
    ctx.globalAlpha = it.o ?? 1;
    ctx.shadowColor = 'rgba(30, 8, 70, .32)';
    ctx.shadowBlur = S * 0.09;
    ctx.shadowOffsetY = S * 0.045;
    ctx.drawImage(L, -n / 2, -n / 2);
    ctx.restore();
  }
  return cv.toDataURL('image/png');
}
