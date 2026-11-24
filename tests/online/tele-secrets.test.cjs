// Écran télé : il ne doit JAMAIS recevoir un secret. Pour chacun des jeux en ligne (et à plusieurs étapes des
// jeux qui ont un écran télé spécial), on compare ce que reçoit la télé avec ce que voit chaque joueur :
// un texte qui n'apparaît que chez certains joueurs (mot secret, rôle, réponse pas encore révélée…) est un
// secret, et la télé ne doit pas le contenir. Les jeux sans écran spécial n'envoient à la télé que { ended }.
const { open } = require('../lib/pw-helper.cjs');
const { check, run } = require('../lib/check.cjs');

run(async () => {
  const { browser, page, errors } = await open('');
  await page.waitForTimeout(500);
  const res = await page.evaluate(async () => {
    const { ONLINE_GAMES } = await import('/js/online/games.js');
    const { TV_PID } = await import('/js/online/kit.js');
    const api = { now: () => Date.now(), relay() {}, sendTo() {}, toastAll() {} };
    const pids = ['pa', 'pb', 'pc', 'pd', 'pe'];
    const strings = (v, out = new Set()) => {
      if (typeof v === 'string') { if (v.length >= 3) out.add(v); } else if (v && typeof v === 'object') for (const x of Object.values(v instanceof Set ? [...v] : v)) strings(x, out);
      return out;
    };
    const tvOf = (G, room, s) => (G.tv ? G.tv(room, s) : { ended: !!s && (s.phase === 'end' || s.over === true) });
    function leaks(G, room, s) {
      const views = pids.map((p) => strings(G.view(room, s, p)));
      const all = new Set(views.flatMap((x) => [...x]));
      const everywhere = [...all].filter((t) => views.every((x) => x.has(t)));
      const secret = new Set([...all].filter((t) => !everywhere.includes(t)));
      // Le mot masqué de Je dessine (« _ _ _ ») est public : tous les devineurs le voient (le dessinateur voit le mot).
      return [...strings(tvOf(G, room, s))].filter((t) => secret.has(t) && !/^[_\s\p{L}'-]*_[_\s\p{L}'-]*$/u.test(t));
    }
    const out = { n: ONLINE_GAMES.length, special: [], bad: [], generic: [], steps: 0 };
    for (const G of ONLINE_GAMES) {
      const room = { host: 'pa', code: 'TEST', players: pids.map((pid, i) => ({ pid, name: ['Alice', 'Bob', 'Chloé', 'David', 'Emma'][i], score: 0, on: true })) };
      const st = { ...G.defaults };
      let s;
      try { s = G.init(room, st, api); for (let k = 0; k < 3; k++) if (G.tick) G.tick(room, s, api); } catch (e) { out.bad.push(G.id + ' init ' + e.message); continue; }
      if (G.tv) out.special.push(G.id);
      else { const v = tvOf(G, room, s); if (Object.keys(v).join() !== 'ended') out.generic.push(G.id); }
      const check = (label) => { out.steps++; const l = leaks(G, room, s); if (l.length) out.bad.push(`${G.id} (${label}) : ${l.slice(0, 3).join(' | ')}`); };
      check('début');
      if (G.tv) {
        if (G.tv(room, s) && JSON.stringify(G.tv(room, s)) !== JSON.stringify(G.view(room, s, TV_PID))) out.bad.push(G.id + ' : tv() ≠ vue spectateur');
        // Quelques étapes de jeu, là où des secrets existent.
        try {
          if (G.id === 'dessin') {
            if (s.phase === 'choose') G.action(room, s, s.drawer, { type: 'choose', i: 0 }, api);
            check('dessin en cours (mot chez le dessinateur)');
            const guesser = pids.find((p) => p !== s.drawer);
            G.action(room, s, guesser, { type: 'guess', text: s.word.slice(0, -1) + 'x' }, api); // « tu chauffes » privé
            G.action(room, s, guesser, { type: 'guess', text: s.word }, api); // trouvé : ses messages deviennent privés
            G.action(room, s, guesser, { type: 'guess', text: 'indice pour les autres : ' + s.word }, api);
            check('mot trouvé par un joueur');
          }
          if (G.id === 'quiaecrit') {
            G.action(room, s, 'pb', { type: 'answer', v: 'Réponse secrète de Bob' }, api);
            G.action(room, s, 'pc', { type: 'answer', v: 'Réponse secrète de Chloé' }, api);
            check('réponses en cours d\'écriture');
          }
          if (G.id === 'write-punch' || G.id === 'write-dico') {
            G.action(room, s, 'pb', { type: 'submit', text: 'Texte secret de Bob' }, api);
            G.action(room, s, 'pc', { type: 'submit', text: 'Texte secret de Chloé' }, api);
            check('réponses en cours d\'écriture');
          }
          if (G.id === 'race-anag' || G.id === 'race-emoji') {
            G.action(room, s, 'pb', { type: 'answer', v: 'mauvaise réponse secrète' }, api);
            check('mauvaise réponse d\'un joueur');
          }
        } catch (e) { out.bad.push(G.id + ' étapes : ' + e.message); }
      }
    }
    return out;
  });
  check(res.special.length >= 11, `${res.special.length} jeux avec un écran télé spécial`, res.special);
  check(!res.generic.length, `les ${res.n - res.special.length} autres n'envoient à la télé que « partie finie ou non »`, res.generic);
  check(!res.bad.length, `aucun secret envoyé à la télé (${res.steps} situations vérifiées sur ${res.n} jeux)`, res.bad);
  check(!errors.length, 'aucune erreur JS', errors);
  await browser.close();
});
