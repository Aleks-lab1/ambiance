// Jeux de mots en ligne (js/online/mots.js) avec 3 joueurs simulés.
const { mp } = require('../lib/mp.cjs');
const { shot } = require('../lib/pw-helper.cjs');
const { check, wait: W, run } = require('../lib/check.cjs');
const clean = async (t, name) => { const s = await t.state(); check(!s.log.length && !t.errors.length, `${name} : aucune erreur`, [s.log, t.errors]); };

run(async () => {
  console.log('Petit bac');
  let t = await mp('/js/online/mots.js', 'petitbacOnline', { count: 4, rounds: 1 });
  const L = await t.get(() => window.__h.s.letter);
  const fill = async (pid, words) => { const ins = t.at(pid).locator('.pb-form input'); for (let i = 0; i < 4; i++) await ins.nth(i).fill(words[i]); };
  await fill('A', [L + 'aaa', L + 'bbb', L + 'ccc', L + 'ddd']);
  await fill('B', [L + 'aaa', L + 'xxx', 'zzz', L + 'eee']);
  await W(700);
  await t.at('A').getByRole('button', { name: /STOP/ }).click(); await W(400);
  check((await t.state()).phase === 'review', 'STOP → correction', (await t.state()).phase);
  await clean(t, 'Petit bac'); await t.browser.close();

  console.log('Mot mystère');
  t = await mp('/js/online/mots.js', 'motmystereOnline', { len: 5, rounds: 1 });
  await t.page.waitForFunction(() => window.__h.s.phase === 'play', null, { timeout: 15000 });
  const target = await t.get(() => window.__h.s.target);
  const typeW = async (pid, w) => { for (const ch of w) await t.at(pid).locator('.kb-key', { hasText: new RegExp('^' + ch.toUpperCase() + '$') }).click(); await t.at(pid).locator('.kb-key', { hasText: 'OK' }).click(); await W(250); };
  for (const p of ['A', 'B', 'C']) await typeW(p, target);
  await W(400);
  check(/over|end|result/.test((await t.state()).phase), 'tout le monde trouve → fin', (await t.state()).phase);
  await clean(t, 'Mot mystère'); await t.browser.close();

  console.log('Morpion');
  t = await mp('/js/online/mots.js', 'morpionOnline', {});
  const play = async (pid, i) => { await t.at(pid).locator('.ttt-c').nth(i).click(); await W(380); };
  await play('A', 0); await play('B', 3); await play('A', 1); await play('B', 4); await play('A', 2);
  await W(300);
  check(/Alice/.test(await t.txt('C')) && /Tu as gagné/.test(await t.txt('A')), 'A aligne 3 et gagne (« Tu as gagné » chez A)');
  check(await t.at('C').locator('.ttt-c .mk.x').count() === 3 && await t.at('C').locator('.ttt-line path').count() === 1, 'Morpion : croix dessinées et ligne gagnante barrée chez les spectateurs');
  await t.at('A').getByRole('button', { name: /suivant/ }).click(); await W(700);
  check(!(await t.at('A').locator('.ttt-c .mk').count()) && /Chloé/.test(await t.txt('A')), 'Morpion : grille effacée, Chloé remplace le perdant');
  await clean(t, 'Morpion'); await t.browser.close();

  console.log('4 en ligne');
  t = await mp('/js/online/mots.js', 'morpionOnline', { game: 'quatre' });
  check(await t.at('A').locator('.c4-hand img').count() === 1 && await t.at('A').locator('.c4-col').count() === 7, '4 en ligne : plateau avec une main et 7 colonnes');
  const col = async (pid, c) => { await t.at(pid).locator('.c4-col').nth(c).click(); await W(1000); };
  await col('A', 3);
  const disc = await t.page.evaluate(() => { const d = document.querySelector('#v-B .c4-discs .c4-disc'); const b = d.parentElement.getBoundingClientRect(), r = d.getBoundingClientRect(); return { p0: d.classList.contains('p0'), bottom: (r.bottom - b.top) / b.height }; });
  check(disc.p0 && disc.bottom > 0.85, '4 en ligne : le jeton rouge est tombé tout en bas de la colonne (chez B)', disc);
  await col('B', 2); await col('A', 3); await col('B', 2); await col('A', 3); await col('B', 4); await col('A', 3);
  await W(500);
  check(/Alice gagne/.test(await t.txt('C')) && await t.at('C').locator('.c4-disc.win').count() === 4, '4 en ligne : A aligne 4 jetons et gagne', await t.txt('C'));
  check(await t.page.evaluate(() => ['A', 'B', 'C'].every((p) => document.querySelectorAll('#v-' + p + ' .c4-discs .c4-disc').length === 7)), '4 en ligne : 7 jetons chez chacun');
  await t.at('B').getByRole('button', { name: /suivant/ }).click(); await W(1300);
  check(await t.page.evaluate(() => ['A', 'B', 'C'].every((p) => !document.querySelectorAll('#v-' + p + ' .c4-discs .c4-disc').length)), '4 en ligne : les jetons tombent du plateau à la manche suivante');
  await shot(t.page, 'mp-quatre');
  await clean(t, '4 en ligne'); await t.browser.close();
});
