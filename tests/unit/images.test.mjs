// Images des jeux (cases de l'accueil) : une composition dans scripts/images/scenes.mjs et une image
// img/jeux/<id>.webp pour chaque jeu du catalogue, au bon format, et tous les emojis utilisés présents.
// Sans navigateur. Un jeu ajouté sans image → node scripts/gen-images.mjs <id> (voir l'en-tête du script).
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
const { check, done } = createRequire(import.meta.url)('../lib/check.cjs');

const ROOT = new URL('../../', import.meta.url);
const { GAMES } = await import('../../js/games/index.js');
const { SCENES, MODE_CROPS } = await import('../../scripts/images/scenes.mjs');
const ids = GAMES.map((g) => g.id);

const noScene = ids.filter((id) => !SCENES[id]);
check(!noScene.length, `chaque jeu a sa composition dans scenes.mjs (${ids.length} jeux)`, noScene);
const extra = Object.keys(SCENES).filter((id) => !ids.includes(id));
check(!extra.length, 'aucune composition pour un jeu qui n\'existe plus', extra);

// Format WebP : en-tête RIFF/WEBP, puis bloc VP8X avec la taille du canevas (24 bits, moins 1).
function webpSize(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP' || buf.toString('ascii', 12, 16) !== 'VP8X') return null;
  return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3), !!(buf[20] & 0x10)];
}
const bad = [];
let total = 0;
for (const id of ids) {
  const f = new URL(`img/jeux/${id}.webp`, ROOT);
  if (!existsSync(f)) { bad.push(id + ' : manquante'); continue; }
  const buf = readFileSync(f);
  total += buf.length;
  const sz = webpSize(buf);
  if (!sz || sz[0] !== 540 || sz[1] !== 360 || !sz[2]) bad.push(`${id} : ${sz ? sz.join('×') : 'pas un WebP transparent'}`);
}
check(!bad.length, 'chaque jeu a son image img/jeux/<id>.webp (WebP transparent 540 × 360)', bad);
check(total < 1.5 * 1024 * 1024, `poids total des images raisonnable (${Math.round(total / 1024)} Ko)`);
const orphans = readdirSync(new URL('img/jeux/', ROOT)).filter((f) => f.endsWith('.webp') && !ids.includes(f.slice(0, -5)));
check(!orphans.length, 'aucune image en trop dans img/jeux/', orphans);

// Tous les emojis des compositions sont dans scripts/images/emoji/ (sinon le générateur échoue).
const have = new Set(readdirSync(new URL('scripts/images/emoji/', ROOT)));
const code = (ch) => [...ch].map((c) => c.codePointAt(0).toString(16)).join('-');
const missing = [];
for (const [id, items] of Object.entries(SCENES)) {
  for (const it of items) {
    if (it.k !== 'e') continue;
    const c = code(it.ch);
    if (![c, c.replace(/-fe0f/g, ''), c + '-fe0f'].some((n) => have.has(n + '.webp'))) missing.push(`${id} : ${it.ch}`);
  }
}
check(!missing.length, 'tous les emojis des compositions sont dans scripts/images/emoji/', missing);
check(have.has('LICENSE'), 'licence des emojis Fluent (MIT) présente');
// Les 3 cases de l'accueil : illustration découpée dans la maquette (gen-images.mjs modes), police Fredoka et sa licence.
const modeBad = ['local', 'online', 'tv'].filter((m) => { const f = new URL(`img/ui/mode-${m}.webp`, ROOT); return !MODE_CROPS[m] || !existsSync(f) || readFileSync(f).toString('ascii', 8, 12) !== 'WEBP'; });
check(!modeBad.length && existsSync(new URL('scripts/images/maquette-accueil.webp', ROOT)), 'accueil : maquette et illustration de chacun des 3 modes', modeBad);
check(['fonts/fredoka-700.woff2', 'fonts/fredoka-600.woff2', 'fonts/OFL.txt'].every((f) => existsSync(new URL(f, ROOT))), 'police Fredoka (titres des modes) et sa licence OFL présentes');
done();
