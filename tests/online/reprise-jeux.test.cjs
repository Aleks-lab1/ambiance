// Reprise d'une partie par l'hôte (js/online/save.js) pour CHACUN des jeux en ligne : on lance le jeu à
// 4 joueurs, on l'enregistre comme dans le téléphone de l'hôte (JSON), on le recharge, et chaque joueur
// doit voir exactement la même chose qu'avant. Puis le jeu doit continuer sans erreur.
const { open } = require('../lib/pw-helper.cjs');
const { check, run } = require('../lib/check.cjs');

run(async () => {
  const { browser, page, errors } = await open('');
  await page.waitForTimeout(500);
  const res = await page.evaluate(async () => {
    const { ONLINE_GAMES } = await import('/js/online/games.js');
    const { pack, unpack, shiftTimes } = await import('/js/online/save.js');
    const api = { now: () => Date.now(), relay() {}, sendTo() {}, toastAll() {} };
    const bad = [];
    for (const G of ONLINE_GAMES) {
      const room = { host: 'A', code: 'TEST', players: ['A', 'B', 'C', 'D'].map((pid) => ({ pid, name: 'J' + pid, score: 0, on: true })) };
      const r = { id: G.id };
      try {
        const s = G.init(room, { ...G.defaults }, api);
        for (let i = 0; i < 3; i++) if (G.tick) G.tick(room, s, api);
        const at = Date.now();
        const s2 = shiftTimes(unpack(JSON.parse(JSON.stringify(pack(s)))), at, 0);
        if (G.restore) G.restore(room, s2, api);
        for (const pid of ['A', 'B', 'C']) {
          const a = JSON.stringify(pack(G.view(room, s, pid))), b = JSON.stringify(pack(G.view(room, s2, pid)));
          if (a !== b) r.diff = (r.diff || '') + pid;
        }
        for (let i = 0; i < 3; i++) if (G.tick) G.tick(room, s2, api);
      } catch (e) { r.err = e.message; }
      if (r.diff || r.err) bad.push(r);
    }
    // Jeux de rapidité : après la reprise, l'hôte passe aux questions suivantes (pioche recréée).
    const race = ONLINE_GAMES.find((g) => g.id === 'race-quiz');
    const room = { host: 'A', code: 'T', players: ['A', 'B'].map((pid) => ({ pid, name: pid, score: 0, on: true })) };
    const s = race.init(room, { ...race.defaults }, api);
    const s2 = unpack(JSON.parse(JSON.stringify(pack(s))));
    race.restore(room, s2, api);
    let raceOk = true;
    try { for (let k = 0; k < 4; k++) race.action(room, s2, 'A', { type: 'next' }, api); } catch (e) { raceOk = e.message; }
    return { n: ONLINE_GAMES.length, bad, raceOk, q: s2.i, distinct: new Set(s2.list.map((x) => JSON.stringify(x.pub))).size };
  });
  check(res.n >= 61 && !res.bad.length, `les ${res.n} jeux en ligne se rechargent à l'identique (vue de chaque joueur)`, res.bad);
  check(res.raceOk === true && res.q === 2 && res.distinct === 3, 'Quiz repris : l\'hôte enchaîne les questions suivantes, sans répétition', res);
  check(!errors.length, 'aucune erreur JS', errors);
  await browser.close();
});
