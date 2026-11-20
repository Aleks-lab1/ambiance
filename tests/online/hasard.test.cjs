// Jeux de hasard en ligne (js/online/hasard.js) avec 3 joueurs simulés :
// La Bouteille, La roue des gages, Qui commence ?, Boîte à outils.
const { mp } = require('../lib/mp.cjs');
const { shot } = require('../lib/pw-helper.cjs');
const { check, wait: W, run } = require('../lib/check.cjs');
const clean = async (t, name) => { const s = await t.state(); check(!s.log.length && !t.errors.length, `${name} : aucune erreur`, [s.log, t.errors]); };
const P = ['A', 'B', 'C'];
const S = (t) => t.get(() => window.__h.s);
const score = async (t, pid) => (await t.get(() => window.__h.room.players)).find((p) => p.pid === pid).score;

run(async () => {
  console.log('La Bouteille');
  let t = await mp('/js/online/hasard.js', 'bouteilleOnline');
  let s = await S(t);
  check(await t.at('B').locator('.bt-name').count() === 3, 'les 3 prénoms en cercle');
  const spectator = P.find((x) => x !== s.spinner && x !== 'A');
  check(!(await t.at(spectator).getByRole('button', { name: /Tourner/ }).count()), 'un spectateur ne peut pas lancer');
  await t.at(s.spinner).getByRole('button', { name: /Tourner/ }).click(); await W(200);
  check((await t.state()).phase === 'spin' && /Ça tourne/.test(await t.txt('C')), 'la bouteille tourne chez tout le monde');
  await W(4000);
  const s2 = await S(t);
  check(s2.phase === 'result' && s2.target !== s.spinner && s2.spinner === s2.target, 'elle désigne quelqu\'un d\'autre, qui relance ensuite');
  check(!/\{a\}|\{b\}|\{sip/.test(await t.txt('B')) && (await t.at('B').locator('.qcard').count()) === 1, 'défi affiché avec les prénoms', await t.txt('B'));
  await shot(t.page, 'mp-bouteille');
  await clean(t, 'Bouteille'); await t.browser.close();

  console.log('La roue des gages');
  t = await mp('/js/online/hasard.js', 'roueOnline');
  s = await S(t);
  await t.at(s.who).getByRole('button', { name: /Tourner la roue/ }).click(); await W(4700);
  const r2 = await S(t);
  check(r2.phase === 'result' && r2.res && r2.who !== s.who, 'résultat, puis au tour du joueur suivant', r2.res);
  for (const x of P) check(await t.at(x).locator('.qcard').count() === 1, `le résultat s'affiche chez ${x}`);
  await clean(t, 'Roue'); await t.browser.close();

  console.log('Qui commence ?');
  t = await mp('/js/online/hasard.js', 'doigtOnline');
  await t.at('B').locator('.hold-pad').dispatchEvent('pointerdown', { pointerId: 1 }); await W(100);
  await t.at('B').locator('.hold-pad').dispatchEvent('pointerup', { pointerId: 1 }); await W(100);
  check((await S(t)).hold.B === undefined, 'doigt levé : plus compté');
  for (const x of P) await t.at(x).locator('.hold-pad').dispatchEvent('pointerdown', { pointerId: 1 });
  await W(200);
  check((await t.state()).phase === 'count', 'tout le monde a posé son doigt : compte à rebours');
  await W(2600);
  s = await S(t);
  check(s.phase === 'done' && P.includes(s.res.winner), 'un gagnant est tiré au sort', s.res);
  check(/C'est toi qui commences/.test(await t.txt(s.res.winner)), 'le gagnant le voit sur son téléphone');
  await t.at('A').getByRole('button', { name: /Recommencer/ }).click(); await W(150);
  await t.at('A').getByRole('button', { name: /sans attendre/ }).click(); await W(150);
  check((await t.state()).phase === 'done', 'l\'hôte peut tirer au sort sans attendre');
  await clean(t, 'Qui commence'); await t.browser.close();

  console.log('Boîte à outils');
  t = await mp('/js/online/hasard.js', 'outilsOnline');
  await t.at('B').getByRole('button', { name: /Lancer/ }).click(); await W(150);
  check((await S(t)).dice.by === 'B' && /Lancé par Bob/.test(await t.txt('C')), 'B lance les dés, C voit le résultat');
  await t.at('A').getByRole('radio', { name: /Pièce/ }).click(); await W(150);
  check((await S(t)).tab === 'piece' && /Pièce/.test(await t.txt('B')), 'l\'hôte change d\'outil pour tout le monde');
  await t.at('C').getByRole('button', { name: /Lancer la pièce/ }).click(); await W(1300);
  check(/PILE|FACE/.test(await t.txt('B')), 'la pièce retombe chez tout le monde', await t.txt('B'));
  await t.at('A').getByRole('radio', { name: /Équipes/ }).click(); await W(100);
  await t.at('A').getByRole('button', { name: /Former les équipes/ }).click(); await W(150);
  check((await S(t)).teams.list.flat().length === 3 && /Équipe 1/.test(await t.txt('B')), 'équipes formées');
  await t.at('A').getByRole('radio', { name: /Chrono/ }).click(); await W(100);
  await t.at('A').getByRole('button', { name: /Démarrer/ }).click(); await W(1300);
  check((await S(t)).chrono.run && /0:5\d/.test(await t.txt('C')), 'le chrono tourne chez tout le monde', await t.txt('C'));
  await t.at('A').getByRole('button', { name: /Pause/ }).click(); await W(100);
  check(!(await S(t)).chrono.run, 'pause');
  await t.at('A').getByRole('radio', { name: /Points/ }).click(); await W(100);
  await t.at('A').getByRole('button', { name: 'Plus' }).nth(1).click(); await W(100);
  check(await score(t, 'B') === 1, 'l\'hôte donne un point à Bob');
  check(!(await t.at('B').getByRole('button', { name: 'Plus' }).count()), 'seul l\'hôte compte les points');
  await clean(t, 'Outils'); await t.browser.close();
});
