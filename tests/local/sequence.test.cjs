// La Séquence : un seul « Je suis prêt », puis compte à rebours de 3 s entre les séquences.
const { open } = require('../lib/pw-helper.cjs');
const { check, run } = require('../lib/check.cjs');

run(async () => {
  const { browser, page, errors } = await open('#/sequence');
  await page.evaluate(() => localStorage.setItem('ambiance:players', JSON.stringify(['Alice', 'Bob'])));
  await page.reload();
  await page.getByRole('button', { name: /Commencer/ }).click();
  const seqLog = [];
  await page.exposeFunction('logLit', (i) => seqLog.push(i));
  await page.evaluate(() => {
    document.querySelectorAll('.seq-pad').forEach((b, i) => new MutationObserver(() => { if (b.classList.contains('lit')) window.logLit(i); }).observe(b, { attributes: true, attributeFilter: ['class'] }));
  });
  await page.getByRole('button', { name: /Je suis prêt/ }).click();
  for (let round = 1; round <= 2; round++) {
    await page.waitForFunction(() => document.querySelector('h2.center').textContent === 'À toi !', null, { timeout: 15000 });
    const seq = seqLog.splice(0);
    check(seq.length === round, `manche ${round} : séquence de ${round}`, seq);
    for (const i of seq) { await page.locator('.seq-pad').nth(i).dispatchEvent('pointerdown'); await page.waitForTimeout(250); }
    seqLog.length = 0;
    await page.waitForFunction(() => document.querySelector('.seq-count').textContent === '3', null, { timeout: 5000 });
    check(await page.locator('.btn-big').evaluate((b) => b.classList.contains('hidden')), `manche ${round} : pas de bouton, compte à rebours 3`);
    await page.waitForFunction(() => document.querySelector('.seq-count').textContent === '1', null, { timeout: 5000 });
    seqLog.length = 0;
  }
  check(!errors.length, 'aucune erreur JS', errors);
  await browser.close();
});
