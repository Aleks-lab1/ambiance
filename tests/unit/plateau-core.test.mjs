// Logique de Bataille navale, Memory et Yam's (js/plateau-core.js), sans navigateur.
import { createRequire } from 'node:module';
import { BN, SHIPS, randomFleet, fire, aiShot, memDeck, yamsScore, yamsTotals } from '../../js/plateau-core.js';
const { check, done } = createRequire(import.meta.url)('../lib/check.cjs');

let okFleets = true;
for (let k = 0; k < 200; k++) {
  const f = randomFleet();
  const cells = f.flatMap((s) => s.cells);
  if (f.length !== SHIPS.length || new Set(cells).size !== cells.length || cells.some((i) => i < 0 || i >= BN * BN)) okFleets = false;
  for (const a of f) for (const b of f) if (a !== b) for (const i of a.cells) for (const j of b.cells)
    if (Math.abs(Math.floor(i / BN) - Math.floor(j / BN)) <= 1 && Math.abs((i % BN) - (j % BN)) <= 1) okFleets = false;
}
check(okFleets, '200 flottes aléatoires valides, bateaux qui ne se touchent pas');
const ships = [{ len: 2, cells: [0, 1] }];
const shots = {};
check(fire(ships, shots, 10).res === 'miss', 'tir dans l\'eau');
check(fire(ships, shots, 0).res === 'hit', 'touché');
const r = fire(ships, shots, 1);
check(r.res === 'sunk' && r.sunk === 2 && r.all, 'coulé + flotte détruite', r);
const s2 = { 9: 'hit' };
check([1, 8, 10, 17].includes(aiShot(s2)), 'le téléphone vise autour d\'une touche');
const deck = memDeck(8);
check(deck.length === 16 && new Set(deck).size === 8, 'Memory : 8 paires');
check(yamsScore('full', [2, 2, 3, 3, 3]) === 25, 'full = 25');
check(yamsScore('petite', [1, 2, 3, 4, 6]) === 30, 'petite suite = 30');
check(yamsScore('grande', [2, 3, 4, 5, 6]) === 40, 'grande suite = 40');
check(yamsScore('yams', [4, 4, 4, 4, 4]) === 50, 'Yam\'s = 50');
check(yamsScore('brelan', [5, 5, 5, 1, 2]) === 18, 'brelan = total des dés');
check(yamsScore('n3', [3, 3, 1, 3, 6]) === 9, 'les trois = 9');
const t = yamsTotals({ n1: 3, n2: 6, n3: 9, n4: 12, n5: 15, n6: 18, chance: 20 });
check(t.upper === 63 && t.bonus === 35 && t.total === 118, 'bonus de 35 à partir de 63', t);
done();
