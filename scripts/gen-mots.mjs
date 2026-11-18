// Génère js/data/mots.js (dictionnaire du jeu « Le Bon Mot ») à partir de deux listes libres :
//
//   1. an-array-of-french-words 2.0.0 (MIT © Zeke Sikelianos) : ~336 000 mots français, formes conjuguées
//      et pluriels compris. Sert à vérifier que le mot tapé existe.
//        npm pack an-array-of-french-words@2.0.0 && tar xzf an-array-of-french-words-2.0.0.tgz
//   2. FrequencyWords, fr_50k.txt (Hermit Dave, contenu sous licence CC BY-SA 4.0) : mots classés par
//      fréquence d'usage. Sert à choisir des lettres jouables et à proposer des exemples de mots courants.
//        curl -O https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/fr/fr_50k.txt
//
// Utilisation :
//   node scripts/gen-mots.mjs package/index.json fr_50k.txt
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [dicoPath, freqPath] = process.argv.slice(2);
if (!dicoPath || !freqPath) {
  console.error('Usage : node scripts/gen-mots.mjs <an-array-of-french-words/index.json> <fr_50k.txt>');
  process.exit(1);
}

// Même normalisation que dans le jeu : minuscules, sans accents, lettres uniquement.
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z]/g, '');

// Mots récents ou familiers absents de la liste d'origine.
const EXTRAS = `
ok okay smartphone selfie emoji emoticone kebab tacos burger cheeseburger nuggets wrap bagel brownie cookie cupcake
donut pancake smoothie milkshake mojito spritz guacamole burrito fajita tiramisu ramen panini tartiflette
meuf keuf chelou relou wesh zarbi bolos boloss seum vener bogoss daron daronne taf taff
kiffer kiffe kiffes kiffent kiffons kiffez kiffé kiffée kiffés kiffées kiffait kiffais kiffaient kiffant kiffera kifferai
liker like likes liké likée likait likent likera
bloguer blogue blogues bloguent blogué tweeter tweete tweetes tweetent tweeté spoiler spoile spoilé spoilent
texto sms spam blog blogueur blogueuse youtubeur youtubeuse influenceur influenceuse startup hashtag streaming podcast
wifi web appli ordi gamer geek bug hacker pixel ebook drone vlog buzz clash punchline battle rappeur rappeuse rap slam
afterwork shot apéro apero resto ado manif perso info expo coloc covoiturage snowboard kitesurf crossfit fitness
padel futsal ping pong sweat hoodie sneakers legging fun swag looser loser fan follower story stories post tweet
binge spoiler week mayo covid visio
`.split(/\s+/).filter(Boolean);
// Pluriels en -s des mots ci-dessus (inoffensif si la forme n'existe pas vraiment).
const PLURALS = EXTRAS.filter((w) => !/[sxz]$/.test(w) && !/(er|é|ée|ait|ais|ent|ons|ez|ant|era|erai)$/.test(w)).map((w) => w + 's');

// Mots vulgaires ou insultants : toujours acceptés quand un joueur les tape,
// mais jamais proposés comme exemples par l'appli.
const BLOCK = /^(merd|putai?ns?$|putes?$|culs?$|bordel|foutr|fout(u|ue|us|ues|ent|ez|ons|ais|ait|e|oir|aises?)?$|conn(ar|as)|salop|salauds?$|chi(er|e)$|enfoir|imbecil|cretin|idiot|debil|abruti|couill|bites?$|piss|porno|chattes?$|viol(e|ee|es|ees|er|eur|eurs|s)?$|nazi|negre|batard|petass|garces?$|tapettes?$|gouine|morue|catin|cocu|poufs?$|zizi|niqu|branl|bander$|sperm|vagin|penis|nichon|suc(e|er|eur)s?$|orgasm|bais(e|er|es|ee|ees|ent|ers)$|caca$|chienne)/;

// ---------- Dictionnaire complet ----------
const all = JSON.parse(readFileSync(dicoPath, 'utf8'));
const set = new Set();
for (const w of [...all, ...EXTRAS, ...PLURALS]) {
  const n = norm(w);
  if (n.length >= 2) set.add(n);
}
const sorted = [...set].sort();

// Codage « front coding » : chaque mot = [nb de lettres communes avec le précédent, en base 36,
// noté 0-9A-Z] + [la fin du mot en minuscules]. Divise la taille par ~4.
const lines = [];
let line = '';
let prev = '';
for (const w of sorted) {
  let p = 0;
  while (p < 35 && p < prev.length && p < w.length && prev[p] === w[p]) p++;
  line += p.toString(36).toUpperCase() + w.slice(p);
  if (line.length >= 2000) { lines.push(line); line = ''; }
  prev = w;
}
if (line) lines.push(line);

// ---------- Mots courants (du plus au moins fréquent) ----------
const freq = readFileSync(freqPath, 'utf8').split('\n').map((l) => l.split(' ')[0]).filter(Boolean).slice(0, 20000);
const seen = new Set();
const common = [];
for (const w of freq) {
  if (!/^[a-zàâäçéèêëîïôöùûüÿœæ]+$/.test(w) || w.length < 3) continue;
  const n = norm(w);
  if (!set.has(n) || seen.has(n) || BLOCK.test(n)) continue;
  seen.add(n);
  common.push(w);
}
const commonLines = [];
for (let i = 0; i < common.length; i += 20) commonLines.push(common.slice(i, i + 20).join(' '));

const out = `// Le Bon Mot : dictionnaire. Fichier généré par scripts/gen-mots.mjs, ne pas modifier à la main.
//
// DICO : ${sorted.length} mots français (formes conjuguées et pluriels compris), sans accents, triés.
//   Source : an-array-of-french-words 2.0.0 (licence MIT, © Zeke Sikelianos), complétée de quelques mots récents.
//   Codage : chaque mot commence par le nombre de lettres qu'il partage avec le mot précédent (0-9 puis A-Z),
//   suivi du reste du mot. Les retours à la ligne ne comptent pas.
// COMMUNS : ${common.length} mots courants, du plus au moins fréquent.
//   Source : FrequencyWords (Hermit Dave), sous-titres OpenSubtitles 2018, licence CC BY-SA 4.0.

export const COMMUNS = \`
${commonLines.join('\n')}
\`;

export const DICO = \`
${lines.join('\n')}
\`;
`;
const dest = join(dirname(fileURLToPath(import.meta.url)), '..', 'js', 'data', 'mots.js');
writeFileSync(dest, out);
console.log(`mots.js généré : ${sorted.length} mots, ${common.length} mots courants, ${(out.length / 1024).toFixed(0)} Ko.`);
