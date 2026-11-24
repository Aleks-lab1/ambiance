// Accueil : « On est combien ? », recherche, tirage au hasard (js/finder.js), sans navigateur.
import { createRequire } from 'node:module';
import { GAMES, FILTERS } from '../../js/games/index.js';
import { playersRange, fitsCount, matchSearch, pickGame, COUNTS } from '../../js/finder.js';
const { check, done } = createRequire(import.meta.url)('../lib/check.cjs');

check(JSON.stringify(playersRange('2-16')) === '[2,16]' && playersRange('3+')[1] === Infinity && JSON.stringify(playersRange('2')) === '[2,2]', 'nombre de joueurs : « 2-16 », « 3+ », « 2 »');
const bad = GAMES.filter((g) => { const [a, b] = playersRange(g.players); return !(a >= 1 && b >= a && /^\d+(-\d+|\+)?$/.test(g.players)); });
check(!bad.length, `les ${GAMES.length} jeux ont un nombre de joueurs lisible`, bad.map((g) => g.id + ' ' + g.players));
const g = (players) => ({ players });
check(fitsCount(g('3-16'), 3) && !fitsCount(g('3-16'), 2) && fitsCount(g('4+'), 10) && !fitsCount(g('1-2'), 4) && fitsCount(g('1-2'), 0), 'filtre : bornes respectées, 0 = peu importe');
const two = GAMES.filter((x) => fitsCount(x, 2)).length;
check(two > 10 && two < GAMES.length, `à 2 joueurs : ${two} jeux sur ${GAMES.length}`);
for (const n of COUNTS) check(GAMES.some((x) => fitsCount(x, n)), `au moins un jeu à ${n >= 10 ? '10+' : n} joueurs`);

const tw = (x) => x.tags.map((t) => FILTERS.find((f) => f.id === t)?.label || '').join(' ');
const find = (q) => GAMES.filter((x) => matchSearch(x, q, tw(x))).map((x) => x.id);
check(JSON.stringify(find('loup')) === '["loup"]', 'recherche « loup » → Loup-garou', find('loup'));
check(find('LOUP-garou').includes('loup') && find('Garou').includes('loup'), 'majuscules et tirets ignorés');
check(find('equipe').includes('motsinterdits') && find('équipe').includes('motsinterdits'), '« equipe » et « équipe » → jeux en équipes (catégorie)');
const des = find('dés');
check(des.includes('yams') && des.includes('menteur') && !des.includes('dessin'), '« dés » → jeux de dés, pas « Je dessine »', des);
check(find('4 en ligne').includes('morpion'), '« 4 en ligne » → Morpion & 4 en ligne');
check(find('zzzz').length === 0 && find('').length === GAMES.length, 'mot inconnu → rien ; vide → tout');

const list = GAMES.slice(0, 6);
let avoided = true;
for (let k = 0; k < 200; k++) { const p = pickGame(list, [list[0].id, list[1].id, list[2].id]); if ([0, 1, 2].some((i) => list[i] === p)) avoided = false; }
check(avoided, 'au hasard : évite les 3 derniers jeux joués');
check(pickGame([list[0]], [list[0].id]) === list[0] && pickGame([], []) === null, 'au hasard : un seul jeu possible → celui-là ; aucun → rien');
const seen = new Set(); for (let k = 0; k < 300; k++) seen.add(pickGame(list, []).id);
check(seen.size === list.length, 'au hasard : tous les jeux peuvent sortir');
done();
