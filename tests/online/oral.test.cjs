// Jeux en ligne « à voix haute » et autres (oral.js, mots.js, live.js, equipes.js) avec des joueurs simulés :
// Sur le front, Ni oui ni non, Histoire folle, Le Pendu, La Séquence, Le Chapeau.
const { mp } = require('../lib/mp.cjs');
const { shot } = require('../lib/pw-helper.cjs');
const { check, wait: W, run } = require('../lib/check.cjs');
const clean = async (t, name) => { const s = await t.state(); check(!s.log.length && !t.errors.length, `${name} : aucune erreur`, [s.log, t.errors]); };
const P = ['A', 'B', 'C'];
const S = (t) => t.get(() => window.__h.s);
const score = async (t, pid) => (await t.get(() => window.__h.room.players)).find((p) => p.pid === pid).score;

run(async () => {
  console.log('Sur le front');
  let t = await mp('/js/online/oral.js', 'frontOnline', { cat: 'animaux' });
  let s = await S(t);
  const gs = s.guesser;
  await t.at(gs).getByRole('button', { name: /C'est parti/ }).click(); await W(150);
  s = await S(t);
  const helper = P.find((x) => x !== gs);
  check(s.phase === 'play' && (await t.at(helper).locator('.word-card').innerText()).includes(s.word), 'les autres voient le mot');
  check(!(await t.at(gs).locator('.word-card').count()) && !(await t.txt(gs)).includes(s.word), 'celui qui devine ne le voit pas');
  await t.at(helper).getByRole('button', { name: /Trouvé/ }).click(); await W(150);
  check(await score(t, gs) === 1, 'mot trouvé : +1 pour celui qui devine');
  await t.get(() => { window.__h.s.deadline = Date.now(); });
  await W(500);
  check((await t.state()).phase === 'recap', 'fin du chrono : récapitulatif');
  await t.at(gs).getByRole('button', { name: /Joueur suivant/ }).click(); await W(150);
  check((await S(t)).guesser !== gs && (await t.state()).phase === 'ready', 'au suivant de deviner');
  await shot(t.page, 'mp-front');
  await clean(t, 'Sur le front'); await t.browser.close();

  console.log('Ni oui ni non');
  t = await mp('/js/online/oral.js', 'niouiOnline', { time: 30 });
  s = await S(t);
  const third = P.find((x) => x !== s.victim && x !== s.asker);
  await t.at(s.asker).getByRole('button', { name: /C'est parti/ }).click(); await W(150);
  const q1 = (await S(t)).q;
  check((await t.txt(s.victim)).includes(q1) && (await t.txt(third)).includes(q1), 'la question s\'affiche chez tout le monde');
  await t.at(s.asker).locator('.qcard').click(); await W(150);
  check((await S(t)).qn === 2, 'celui qui interroge passe à la question suivante');
  check(!(await t.at(s.victim).getByRole('button', { name: /a dit oui ou non/ }).count()), 'pas de buzzer pour celui qui répond');
  await t.at(third).getByRole('button', { name: /a dit oui ou non/ }).click(); await W(150);
  s = await S(t);
  check(s.phase === 'result' && s.won === false && /craqué/.test(await t.txt('A')), 'buzzer : perdu, affiché chez tout le monde');
  await clean(t, 'Ni oui ni non'); await t.browser.close();

  console.log('Histoire folle');
  t = await mp('/js/online/oral.js', 'histoireOnline', { rounds: 1 });
  s = await S(t);
  check((await t.txt('C')).includes(s.starter), 'le début de l\'histoire chez tout le monde');
  await t.at(s.who).getByRole('button', { name: /C'est parti/ }).click(); await W(150);
  const w = (await S(t)).word;
  check((await t.txt('B')).includes(w) && (await t.txt('C')).includes(w), 'le mot imposé chez tout le monde');
  await t.at(s.who).getByRole('button', { name: /Placé/ }).click(); await W(150);
  check(await score(t, s.who) === 1 && (await S(t)).who !== s.who, 'mot placé : +1, au suivant');
  await t.at('A').getByRole('button', { name: /Terminer l'histoire/ }).click(); await W(150);
  check((await t.state()).phase === 'end' && (await t.txt('B')).includes(w), 'fin : récapitulatif de l\'histoire');
  await clean(t, 'Histoire folle'); await t.browser.close();

  console.log('Le Pendu');
  t = await mp('/js/online/mots.js', 'penduOnline', { mode: 'secret', rounds: 1 });
  s = await S(t);
  const ch = s.chooser;
  await t.at(ch).locator('input').fill('Banane');
  await t.at(ch).getByRole('button', { name: /C'est parti/ }).click(); await W(150);
  s = await S(t);
  const guesser = s.cur;
  check(s.phase === 'play' && guesser !== ch, 'le mot est choisi, un autre joueur commence');
  check(!(await t.txt(guesser)).includes('BANANE') && /B\s*\|?\s*A/.test(await t.txt(ch)), 'le mot est caché, sauf pour celui qui l\'a choisi');
  await t.at(guesser).getByRole('button', { name: 'A', exact: true }).click(); await W(120);
  check(await score(t, guesser) === 1 && (await S(t)).cur === guesser, 'bonne lettre : +1 et on rejoue');
  await t.at(guesser).getByRole('button', { name: 'Z', exact: true }).click(); await W(120);
  s = await S(t);
  check(s.errors === 1 && s.cur !== guesser && s.cur !== ch, 'mauvaise lettre : au suivant (jamais celui qui a choisi)');
  for (const k of ['B', 'N', 'E']) { const c = (await S(t)).cur; await t.at(c).getByRole('button', { name: k, exact: true }).click(); await W(120); }
  s = await S(t);
  check(s.phase === 'over' && s.won && /trouvé le mot/.test(await t.txt('A')), 'mot trouvé : fin de la manche', s.phase);
  await clean(t, 'Le Pendu (secret)'); await t.browser.close();

  t = await mp('/js/online/mots.js', 'penduOnline', { mode: 'hasard', len: 'court', rounds: 1 });
  for (let i = 0; i < 40 && (await t.state()).phase === 'loading'; i++) await W(250);
  s = await S(t);
  check(s.phase === 'play' && s.word && s.word.length >= 4, 'mot au hasard tiré du dictionnaire', s.word);
  await clean(t, 'Le Pendu (hasard)'); await t.browser.close();

  console.log('La Séquence');
  t = await mp('/js/online/live.js', 'sequenceOnline');
  for (let i = 0; i < 40 && (await t.state()).phase !== 'input'; i++) await W(200);
  s = await S(t);
  check(s.phase === 'input' && s.seq.length === 1, 'la suite est montrée puis chacun la reproduit');
  await t.at('A').locator('.seq-pad').nth(s.seq[0]).dispatchEvent('pointerdown');
  await t.at('B').locator('.seq-pad').nth(s.seq[0]).dispatchEvent('pointerdown');
  await t.at('C').locator('.seq-pad').nth((s.seq[0] + 1) % 4).dispatchEvent('pointerdown');
  await W(300);
  s = await S(t);
  check(s.phase === 'result' && s.alive.join() === 'A,B', 'C se trompe : éliminé', s.alive);
  check(/Éliminé/.test(await t.txt('C')), 'C le voit sur son téléphone');
  await W(2800);
  s = await S(t);
  check(s.round === 2 && s.seq.length === 2, 'manche suivante : la suite s\'allonge');
  await clean(t, 'La Séquence'); await t.browser.close();

  console.log('Le Chapeau (4 joueurs)');
  t = await mp('/js/online/equipes.js', 'chapeauOnline', { cards: 20, time: 60 }, 4);
  s = await S(t);
  const giver = s.teams[0][0];
  await t.at(giver).getByRole('button', { name: /C'est parti/ }).click(); await W(150);
  const word = (await S(t)).word;
  const mate = s.teams[0][1], opp = s.teams[1][0];
  check((await t.txt(opp)).includes(word) && !(await t.txt(mate)).includes(word), 'l\'équipe adverse voit le nom, pas les coéquipiers');
  for (let i = 0; i < 20; i++) { await t.at(giver).getByRole('button', { name: /Trouvé/ }).click(); await W(40); }
  s = await S(t);
  check(s.phase === 'recap' && s.score[0] === 20 && /chapeau est vide/.test(await t.txt(opp)), 'chapeau vidé : fin de la manche 1');
  await t.at('A').getByRole('button', { name: /Manche 2/ }).click(); await W(150);
  s = await S(t);
  check(s.manche === 1 && s.team === 1 && s.left.length === 20, 'manche 2 avec les mêmes cartes, à l\'autre équipe');
  await clean(t, 'Le Chapeau'); await t.browser.close();
});
