// Sauvegarde d'une partie en ligne (js/online/save.js) : copie en JSON, Set/Map, décalage des minuteurs.
import { createRequire } from 'node:module';
import { pack, unpack, shiftTimes, resumeText } from '../../js/online/save.js';
const { check, done } = createRequire(import.meta.url)('../lib/check.cjs');

const now = Date.now();
const s = { phase: 'q', deadline: now + 15000, start: now - 5000, used: new Set(['chat', 'chien']), m: new Map([['a', 1]]), list: [{ q: 'Combien ?', n: 1800000000000 * 0 + 42 }], big: 384400, nul: null, arr: [now, 3], u: undefined };
const back = unpack(JSON.parse(JSON.stringify(pack(s))));
check(back.used instanceof Set && back.used.has('chien') && back.used.size === 2, 'Set conservé');
check(back.m instanceof Map && back.m.get('a') === 1, 'Map conservée');
check(back.list[0].q === 'Combien ?' && back.nul === null && !('u' in back), 'données ordinaires conservées');
let threw = 0;
try { pack({ f: () => 1 }); } catch { threw++; }
try { pack({ d: new Date() }); } catch { threw++; }
class X {} try { pack({ x: new X() }); } catch { threw++; }
check(threw === 3, 'fonctions, dates et objets de classe refusés (la partie revient alors au salon)');

shiftTimes(back, now, 60000);
check(back.deadline === now + 75000 && back.start === now + 55000 && back.arr[0] === now + 60000, 'minuteurs décalés de la durée de la coupure (pause)');
check(back.big === 384400 && back.arr[1] === 3 && back.list[0].n === 42 && back.used.has('chat'), 'les autres nombres ne bougent pas');

const txt = resumeText({ at: now - 3 * 60000, n: 4, room: { players: [] }, game: { label: '🧠 Le Quiz' } });
check(txt === '🧠 Le Quiz · 4 joueurs · il y a 3 min', 'texte du bandeau « Reprendre »', txt);
check(/Au salon · 1 joueur · à l'instant/.test(resumeText({ at: now, room: { players: [{}] }, game: null })), 'texte du bandeau au salon');
done();
