// Contenu de tous les jeux (js/data/*.js) : bon format, rien de vide, pas de doublon dans un même paquet.
// (Les jeux de rapidité sont vérifiés dans race-core.test.mjs.)
import { createRequire } from 'node:module';
const { check, done } = createRequire(import.meta.url)('../lib/check.cjs');
const { norm } = await import('../../js/ui.js');
const D = async (f) => (await import(`../../js/data/${f}.js`)).default;
const str = (x) => typeof x === 'string' && x.trim().length > 0;
const dups = (list, key = (x) => norm(typeof x === 'string' ? x : JSON.stringify(x))) => {
  const seen = new Set(), out = [];
  for (const x of list) { const k = key(x); if (seen.has(k)) out.push(x); seen.add(k); }
  return out;
};
let total = 0;
function paquet(nom, list, valid, key) {
  total += list.length;
  const bad = list.filter((x) => !valid(x));
  const d = dups(list, key);
  check(list.length > 0 && !bad.length && !d.length, `${nom} : ${list.length} éléments valides, sans doublon`, { bad: bad.slice(0, 3), d: d.slice(0, 5) });
}
const levels = (nom, data, valid = str, key) => { for (const [l, list] of Object.entries(data)) paquet(`${nom} (${l})`, list, valid, key); };

for (const f of ['jamais', 'qui', 'opinions', 'etsi', 'confidences', 'cap', 'paranoia', 'deuxverites', 'unisson', 'gages', 'quiaecrit']) levels(f, await D(f));
levels('tupreferes', await D('tupreferes'), (p) => Array.isArray(p) && p.length === 2 && p.every(str));
levels('dix', await D('dix'), (x) => str(x) || (x && Number.isInteger(x.n) && x.n >= 0 && x.n <= 10 && str(x.t)), (x) => norm(typeof x === 'string' ? x : x.t));
const action = await D('action');
levels('action/vérité', action.verite); levels('action/action', action.action);
levels('punchlines', await D('punchlines'), (x) => str(x) && x.includes('___'));
levels('dessin', await D('dessin'));
for (const f of ['mime', 'cinq', 'petitbac', 'nioui', 'debats', 'telephone', 'bingo', 'chapeau']) paquet(f, await D(f), str);
const front = await D('front');
check(front.every((c) => str(c.id) && str(c.name) && str(c.emoji)) && !dups(front.map((c) => c.id)).length, `Sur le front : ${front.length} catégories`);
for (const c of front) paquet(`Sur le front (${c.id})`, c.words, str);
paquet('motsinterdits', await D('motsinterdits'), (x) => Array.isArray(x) && x.length === 6 && x.every(str), (x) => norm(x[0]));
paquet('chansons', await D('chansons'), (x) => Array.isArray(x) && x.length === 2 && x.every(str), (x) => norm(x[0]));
paquet('imposteur', await D('imposteur'), (x) => Array.isArray(x) && x.length === 2 && x.every(str) && norm(x[0]) !== norm(x[1]), (x) => [norm(x[0]), norm(x[1])].sort().join('|'));
paquet('curseur', await D('curseur'), (x) => Array.isArray(x) && x.length === 2 && x.every(str));
paquet('classement', await D('classement'), (x) => str(x[0]) && Array.isArray(x[1]) && x[1].length === 5 && x[1].every(str), (x) => norm(x[0]));
paquet('ordre', await D('ordre'), (x) => str(x[0]) && Number.isInteger(x[1]), (x) => norm(x[0]));
paquet('dico', await D('dico'), (x) => str(x[0]) && str(x[1]), (x) => norm(x[0]));
const patate = await D('patate'); levels('patate', patate);
const histoire = await D('histoire'); levels('histoire', histoire);
const disle = await D('disle'); levels('disle', disle);
console.log(`  (${total} éléments au total)`);
done();
