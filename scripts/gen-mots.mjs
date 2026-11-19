// Génère js/data/mots.js (dictionnaire du jeu « Le Bon Mot ») à partir de deux listes libres :
//
//   1. an-array-of-french-words 2.0.0 (MIT © Zeke Sikelianos) : ~336 000 mots français, formes conjuguées
//      et pluriels compris. Sert à vérifier que le mot tapé existe.
//        npm pack an-array-of-french-words@2.0.0 && tar xzf an-array-of-french-words-2.0.0.tgz
//   2. FrequencyWords, fr_50k.txt (Hermit Dave, contenu sous licence CC BY-SA 4.0) : mots classés par
//      fréquence d'usage. Sert à choisir des lettres jouables et à proposer des exemples de mots courants.
//        curl -O https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/fr/fr_50k.txt
//   3. (facultatif) prenoms.txt : un prénom par ligne. Liste utilisée : les ~5 700 prénoms du jeu de données
//      « Liste de prénoms et patronymes » (data.gouv.fr, Licence Ouverte), tels que repris dans le paquet npm
//      @socialgouv/match-entities 1.1.18 (Apache-2.0) :
//        npm pack @socialgouv/match-entities@1.1.18 && tar xzf socialgouv-match-entities-1.1.18.tgz
//        grep -o 'value: "[A-Z-]*"' package/dist/index.mjs | sed 's/value: "\(.*\)"/\1/' > prenoms.txt
//      (ne garder que le bloc « prenoms_default » du fichier). Les prénoms sont acceptés comme des mots.
//
// Utilisation :
//   node scripts/gen-mots.mjs package/index.json fr_50k.txt [prenoms.txt]
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [dicoPath, freqPath, prenomsPath] = process.argv.slice(2);
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
// Prénoms récents absents de la liste data.gouv.
const EXTRA_PRENOMS = `
kylian kilian noah liam nolan timeo mael maelys jade lina mila ambre leon gabin sacha raphael louna nael ayden eden
kais elio alba romy livia giulia ayaan aylan ilyes rayan ryan wassim imran lyna lya inaya aya maya nina lola lena
mya alma iris lia elena luna kenza sohan sofiane naim isaac ethan evan tiago diego milan lyam marley soan sasha
`.split(/\s+/).filter(Boolean);
const PRENOMS = [...EXTRA_PRENOMS, ...(prenomsPath ? readFileSync(prenomsPath, 'utf8').split(/\r?\n/) : [])];

// Pluriels en -s des mots ci-dessus (inoffensif si la forme n'existe pas vraiment).
const PLURALS = EXTRAS.filter((w) => !/[sxz]$/.test(w) && !/(er|é|ée|ait|ais|ent|ons|ez|ant|era|erai)$/.test(w)).map((w) => w + 's');

// Mots vulgaires ou insultants : toujours acceptés quand un joueur les tape,
// mais jamais proposés comme exemples par l'appli.
const BLOCK = /^(merd|putai?ns?$|putes?$|culs?$|bordel|foutr|fout(u|ue|us|ues|ent|ez|ons|ais|ait|e|oir|aises?)?$|conn(ar|as)|salop|salauds?$|chi(er|e)$|enfoir|imbecil|cretin|idiot|debil|abruti|couill|bites?$|piss|porno|chattes?$|viol(e|ee|es|ees|er|eur|eurs|s)?$|nazi|negre|batard|petass|garces?$|tapettes?$|gouine|morue|catin|cocu|poufs?$|zizi|niqu|branl|bander$|sperm|vagin|penis|nichon|suc(e|er|eur)s?$|orgasm|bais(e|er|es|ee|ees|ent|ers)$|caca$|chienne)/;

// ---------- Dictionnaire complet ----------
const all = JSON.parse(readFileSync(dicoPath, 'utf8'));
const base = new Set();
for (const w of [...all, ...EXTRAS, ...PLURALS]) {
  const n = norm(w);
  if (n.length >= 2) base.add(n);
}
const set = new Set(base);
for (const w of PRENOMS) { const n = norm(w); if (n.length >= 2) set.add(n); }
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
  // Les exemples ne proposent que de vrais mots (pas les prénoms seuls).
  if (!base.has(n) || seen.has(n) || BLOCK.test(n)) continue;
  seen.add(n);
  common.push(w);
}
const commonLines = [];
for (let i = 0; i < common.length; i += 20) commonLines.push(common.slice(i, i + 20).join(' '));

const out = `// Le Bon Mot : dictionnaire. Fichier généré par scripts/gen-mots.mjs, ne pas modifier à la main.
//
// DICO : ${sorted.length} mots français (formes conjuguées et pluriels compris), sans accents, triés.
//   Source : an-array-of-french-words 2.0.0 (licence MIT, © Zeke Sikelianos), complétée de quelques mots récents
//   et de ${PRENOMS.length} prénoms (data.gouv.fr « Liste de prénoms et patronymes », Licence Ouverte).
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
