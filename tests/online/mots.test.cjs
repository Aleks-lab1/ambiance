// Jeux de mots en ligne (js/online/mots.js) avec 3 joueurs simulés.
const { mp } = require('../lib/mp.cjs');
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
  const play = async (pid, i) => { await t.at(pid).locator('.ttt-cell').nth(i).click(); await W(120); };
  await play('A', 0); await play('B', 3); await play('A', 1); await play('B', 4); await play('A', 2);
  check(/Alice/.test(await t.txt('C')), 'A aligne 3 et gagne');
  await clean(t, 'Morpion'); await t.browser.close();
});
