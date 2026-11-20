// Dictionaire du Bon Mot (js/data/mots.js + js/bonmot-core.js), sans navigateur.
import { createRequire } from 'node:module';
import * as data from '../../js/data/mots.js';
import { makeDico, normWord, fits, minLength } from '../../js/bonmot-core.js';
const { check, done } = createRequire(import.meta.url)('../lib/check.cjs');

const t0 = performance.now();
const d = makeDico(data);
console.log(`dictionnaire : ${d.size} mots, décodé en ${(performance.now() - t0).toFixed(0)} ms`);
check(d.size > 300000, 'plus de 300 000 mots', d.size);
for (const k of ['size', 'has', 'playable', 'withPrefix', 'candidates', 'draw', 'examples', 'chainLetters', 'randomStart'])
  check(k in d, `makeDico() renvoie ${k}`);
const yes = ['dernier', 'Dernier', 'éléphant', 'elephant', 'chevaux', 'smartphone', 'œuf', 'kiffé', // courants, accents, ligatures
  'kevin', 'lucas', 'inès', // prénoms
  'zgeg', 'beuteu', 'bzez', 'bbl', 'kayakoubeme', 'cuni', 'narvalo', 'chépa']; // argot / verlan
for (const w of yes) check(d.has(normWord(w)), `accepte « ${w} »`);
for (const w of ['xyzzq', 'qwxqw']) check(!d.has(normWord(w)), `refuse « ${w} »`);
for (const pos of ['start', 'in']) for (const L of [1, 2, 3]) {
  const c = d.candidates(pos, L);
  check(c.length > 0 && c.every((x) => x.s.length === L), `tirage ${L} lettre(s) (${pos}) : ${c.length} possibilités`);
}
check(fits('dernier', 'de') && fits('dernier', 'rn', 'in') && !fits('dernier', 'rn'), 'fits() début / dedans');
check(minLength('de') >= 3 && minLength('a') >= 2, 'minLength()', [minLength('de'), minLength('a')]);
const used = new Set();
check(d.examples('de', 'start', used).length > 0, 'examples("de")');
check(d.chainLetters('dernier', 1, used).letters === 'r', 'enchaînement : dernier → r', d.chainLetters('dernier', 1, used));
check(/^[a-z]$/.test(d.randomStart()), 'randomStart() donne une lettre');
done();
