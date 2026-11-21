// Jeux de rapidité en ligne (js/online/race.js) avec 3 joueurs simulés : mode ∞ sans limite, bouton
// « Terminer », pas de question répétée, nombre de questions fixe.
const { mp } = require('../lib/mp.cjs');
const { check, wait: W, run } = require('../lib/check.cjs');
const clean = async (t, name) => { const s = await t.state(); check(!s.log.length && !t.errors.length, `${name} : aucune erreur`, [s.log, t.errors]); };
const P = ['A', 'B', 'C'];
const S = (t) => t.get(() => window.__h.s);
async function playQuestion(t) {
  for (const x of P) await t.at(x).locator('.quiz-opt').first().click();
  await W(150);
  await t.at('A').getByRole('button', { name: /Question suivante|Voir le classement/ }).click(); await W(120);
}

run(async () => {
  console.log('Quiz sans limite (∞)');
  let t = await mp('/js/online/race.js', 'raceQuiz', { count: 0, time: 15 });
  check(/1 · ∞/.test(await t.txt('B')), 'le compteur affiche « ∞ »', await t.txt('B'));
  for (let k = 0; k < 13; k++) await playQuestion(t);
  let s = await S(t);
  check(s.phase === 'q' && s.i === 13, 'après 13 questions, la partie continue', [s.phase, s.i]);
  check(new Set(s.list.map((q) => q.pub.q)).size === s.list.length, 'aucune question répétée', s.list.length);
  check(!(await t.at('B').getByRole('button', { name: /Terminer/ }).count()), 'seul l\'hôte peut terminer');
  await t.at('A').getByRole('button', { name: /Terminer la partie/ }).click(); await W(150);
  check((await t.state()).phase === 'end' && /Fin de la partie/.test(await t.txt('C')), '« Terminer » : classement final chez tout le monde');
  await clean(t, 'Quiz ∞'); await t.browser.close();

  console.log('À vue de nez, 5 questions');
  t = await mp('/js/online/race.js', 'raceEstim', { count: 5, time: 25 });
  for (let k = 0; k < 5; k++) {
    for (const x of P) { await t.at(x).locator('input[type=number]').fill(String(100 + k)); await t.at(x).getByRole('button', { name: 'Valider' }).click(); }
    await W(150);
    await t.at('A').getByRole('button', { name: /Question suivante|Voir le classement/ }).click(); await W(120);
  }
  check((await t.state()).phase === 'end', 'fin après 5 questions');
  await clean(t, 'À vue de nez'); await t.browser.close();
});
