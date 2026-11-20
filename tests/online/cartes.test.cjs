// Jeux de cartes en ligne (js/online/cartes.js, js/online/paquet.js) avec 3 joueurs simulés :
// Et si, Confidences, Cap ou pas cap, Action ou vérité, Le Roi, Plus ou moins, Le Bus.
const { mp } = require('../lib/mp.cjs');
const { shot } = require('../lib/pw-helper.cjs');
const { check, wait: W, run } = require('../lib/check.cjs');
const clean = async (t, name) => { const s = await t.state(); check(!s.log.length && !t.errors.length, `${name} : aucune erreur`, [s.log, t.errors]); };
const P = ['A', 'B', 'C'];
const S = (t) => t.get(() => window.__h.s);

run(async () => {
  console.log('Et si… ?');
  let t = await mp('/js/online/cartes.js', 'etsiOnline');
  let s = await S(t);
  for (const x of P) check((await t.txt(x)).includes(s.card.t), `la carte s'affiche chez ${x}`);
  const other = P.find((x) => x !== s.who && x !== 'A');
  check(!(await t.at(other).getByRole('button', { name: /Joueur suivant/ }).count()), 'un spectateur n\'a pas le bouton « Joueur suivant »');
  await t.at(s.who).getByRole('button', { name: /Joueur suivant/ }).click(); await W(150);
  const s2 = await S(t);
  check(s2.who !== s.who && s2.n === 2, 'le joueur désigné passe au suivant', [s.who, s2.who, s2.n]);
  await t.at('A').getByRole('button', { name: /Autre carte/ }).click(); await W(150);
  check((await S(t)).n === 3, 'l\'hôte peut changer de carte');
  await clean(t, 'Et si'); await t.browser.close();

  console.log('Confidences');
  t = await mp('/js/online/cartes.js', 'confidencesOnline', { levels: ['fun', 'deep'] });
  s = await S(t);
  check((await t.txt('B')).includes(s.card.t), 'la question s\'affiche chez B');
  await clean(t, 'Confidences'); await t.browser.close();

  console.log('Cap ou pas cap ?');
  t = await mp('/js/online/cartes.js', 'capOnline');
  s = await S(t);
  await t.at(s.who).getByRole('button', { name: /Cap !/ }).click(); await W(150);
  check((await t.state()).phase === 'result', 'Cap ! → résultat');
  check((await t.get(() => window.__h.room.players)).find((p) => p.pid === s.who).score === 1, 'défi relevé : +1 point');
  check(/l'a fait|Bien joué/.test(await t.txt('B')), 'tout le monde voit le résultat', await t.txt('B'));
  await t.at(s.who).getByRole('button', { name: /Joueur suivant/ }).click(); await W(150);
  check((await t.state()).phase === 'card' && (await S(t)).who !== s.who, 'au joueur suivant');
  await clean(t, 'Cap'); await t.browser.close();

  console.log('Action ou vérité');
  t = await mp('/js/online/cartes.js', 'actionOnline');
  s = await S(t);
  check((await t.state()).phase === 'choose', 'le joueur désigné choisit d\'abord');
  await t.at(s.who).getByRole('button', { name: /Vérité/ }).click(); await W(150);
  s = await S(t);
  check(s.phase === 'card' && s.kind === 'verite' && !/\{joueur\}/.test(s.card.t), 'carte Vérité tirée (prénoms remplacés)', s.card);
  for (const x of P) check((await t.txt(x)).includes(s.card.t), `la carte s'affiche chez ${x}`);
  await t.at(s.who).getByRole('button', { name: /Je refuse/ }).click(); await W(150);
  check((await t.state()).phase === 'result' && /refuse/.test(await t.txt('C')), 'refus affiché chez tout le monde');
  await shot(t.page, 'mp-action');
  await clean(t, 'Action ou vérité'); await t.browser.close();

  console.log('Le Roi');
  t = await mp('/js/online/paquet.js', 'roiOnline');
  s = await S(t);
  await t.at(s.who).getByRole('button', { name: /piocher/i }).click(); await W(150);
  const s1 = await S(t);
  check(s1.n === 1 && s1.who !== s.who && s1.by === s.who, 'la carte est piochée, le tour passe');
  check(/Carte de|Ta carte/.test(await t.txt('B')) && /Carte de|Ta carte/.test(await t.txt('C')), 'tout le monde voit la carte et sa règle');
  for (let i = 0; i < 60 && (await t.state()).phase !== 'end'; i++) { await t.at('A').locator('.btn-big').first().click(); await W(40); }
  check((await t.state()).phase === 'end' && /4e ROI/.test(await t.txt('B')), 'le 4e Roi termine la partie');
  await clean(t, 'Le Roi'); await t.browser.close();

  console.log('Plus ou moins');
  t = await mp('/js/online/paquet.js', 'plusmoinsOnline', { rounds: 1 });
  s = await S(t);
  await t.at(s.who).getByRole('button', { name: /Plus/ }).click(); await W(2700);
  check((await t.state()).phase === 'guess', 'après la carte, on rejoue (série ou joueur suivant)');
  await t.get(() => { const h = window.__h; h.s.streak = 3; h.push(); });
  const cur = (await S(t)).who;
  await t.at(cur).getByRole('button', { name: /Encaisser 3 points/ }).click(); await W(150);
  check((await t.get(() => window.__h.room.players)).find((p) => p.pid === cur).score === 3 && (await S(t)).who !== cur, 'série encaissée : +3 et main passée');
  await clean(t, 'Plus ou moins'); await t.browser.close();

  console.log('Le Bus');
  t = await mp('/js/online/paquet.js', 'busOnline', { rounds: 1 });
  s = await S(t);
  const push = (c) => t.page.evaluate((c) => { window.__h.s.deck.push(c); }, c);
  await push({ r: '5', v: 5, s: '♥', n: 'Cœur', red: true });
  await t.at(s.who).getByRole('button', { name: /Rouge/ }).click(); await W(120);
  await push({ r: '9', v: 9, s: '♠', n: 'Pique', red: false });
  await t.at(s.who).getByRole('button', { name: /Plus/ }).click(); await W(120);
  await push({ r: '7', v: 7, s: '♣', n: 'Trèfle', red: false });
  await t.at(s.who).getByRole('button', { name: /Entre/ }).click(); await W(120);
  await push({ r: 'D', v: 12, s: '♠', n: 'Pique', red: false });
  await t.at(s.who).getByRole('button', { name: /Pique/ }).click(); await W(150);
  check((await t.state()).phase === 'won', '4 bonnes réponses : descente du bus');
  check((await t.get(() => window.__h.room.players)).find((p) => p.pid === s.who).score === 4, 'du premier coup : +4');
  await t.at(s.who).getByRole('button', { name: /Joueur suivant/ }).click(); await W(150);
  await push({ r: '5', v: 5, s: '♥', n: 'Cœur', red: true });
  const nx = (await S(t)).who;
  await t.at(nx).getByRole('button', { name: /Noir/ }).click(); await W(200);
  check((await t.state()).phase === 'show' && /Raté/.test(await t.txt('A')), 'erreur : pénalité affichée');
  await W(2700);
  check((await S(t)).tries === 2 && (await S(t)).step === 0, 'retour au début, 2e essai');
  await clean(t, 'Le Bus'); await t.browser.close();
});
