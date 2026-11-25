// Génère js/icons-data.js : le dessin des icônes de l'interface, d'après la table scripts/icons-map.mjs.
// Sources (images seulement, aucun code exécuté), à récupérer puis passer en variables d'environnement :
//   mkdir -p /tmp/ph /tmp/gi
//   curl -sL https://registry.npmjs.org/@phosphor-icons/core/-/core-2.1.1.tgz | tar xz -C /tmp/ph
//   curl -sL https://registry.npmjs.org/@iconify-json/game-icons/-/game-icons-1.2.4.tgz | tar xz -C /tmp/gi
//   PHOSPHOR_DIR=/tmp/ph/package/assets ICONS_JSON=/tmp/gi/package/icons.json node scripts/gen-icons.mjs
// Phosphor Icons : licence MIT. game-icons.net : licence CC BY 3.0 (crédits dans les réglages et le README).
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAP } from './icons-map.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PH = process.env.PHOSPHOR_DIR, GI = process.env.ICONS_JSON;
if (!PH || !GI) throw new Error('PHOSPHOR_DIR et ICONS_JSON sont nécessaires (voir en tête du script).');
const gi = JSON.parse(readFileSync(GI, 'utf8'));
// Icônes toujours disponibles (utilisées directement par le code : icon('nom')), en plus de celles de la table.
const EXTRA = ['star', 'star|regular', 'gear-six', 'arrow-left', 'x', 'magnifying-glass', 'user', 'users', 'shuffle', 'corners-out', 'plus', 'minus',
  'check', 'sparkle', 'seal', 'cards', 'globe', 'television-simple', 'device-mobile', 'dice-five', 'crown-simple', 'heart', 'heart|regular', 'play'];

const names = new Set([...Object.values(MAP).map((v) => v.split('#')[0]), ...EXTRA]);
const out = {};
for (const n of [...names].sort()) {
  if (n.startsWith('gi:')) {
    const ic = gi.icons[n.slice(3)];
    if (!ic) throw new Error('game-icons : ' + n);
    out[n] = [ic.width || gi.width || 512, ic.body.replace(/ fill="currentColor"/g, '')];
  } else {
    const [base, w = 'fill'] = n.split('|');
    const svg = readFileSync(join(PH, w, `${base}${w === 'regular' ? '' : '-' + w}.svg`), 'utf8');
    out[n] = [256, svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>')).replace(/\s+fill="currentColor"/g, '')];
  }
}
const js = `// Dessin des icônes de l'interface (généré par scripts/gen-icons.mjs d'après scripts/icons-map.mjs : ne pas modifier à la main).
// Phosphor Icons (MIT) ; noms « gi:… » : game-icons.net (CC BY 3.0). [taille du repère, contenu SVG]
export const ICONS = ${JSON.stringify(out)};
// Emoji → icône (« nom#couleur » pour une icône colorée).
export const EMOJI = ${JSON.stringify(MAP)};
`;
writeFileSync(join(root, 'js/icons-data.js'), js);
console.log(`js/icons-data.js : ${Object.keys(out).length} icônes, ${Object.keys(MAP).length} emojis, ${Math.round(js.length / 1024)} Ko`);
