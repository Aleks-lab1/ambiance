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
          // Jeux par équipes : le mot est vu par celui qui fait deviner et l'équipe adverse, pas par ses coéquipiers.
          if (G.id.startsWith('eq-') || G.id === 'chapeau') {
            const tm = s.teams[s.team];
            G.action(room, s, tm[s.giverIdx[s.team] % tm.length], { type: 'start' }, api);
            check('mot à faire deviner');
            if (JSON.stringify(G.tv(room, s)).includes(JSON.stringify(G.view(room, s, tm[s.giverIdx[s.team] % tm.length]).word).slice(1, -1) || '§')) out.bad.push(G.id + ' : mot envoyé à la télé');
          }
          if (G.id === 'front') {
            G.action(room, s, s.guesser, { type: 'start' }, api);
            check('mot sur le front');
            if (G.tv(room, s).word) out.bad.push('front : mot envoyé à la télé');
          }
          if (G.id === 'paranoia') {
            const other = pids.find((p) => p !== s.asker);
            G.action(room, s, s.asker, { type: 'pick', pid: other }, api);
            check('pièce qui tourne');
          }
          if (G.id === 'deuxverites') {
            G.action(room, s, s.teller, { type: 'submit', items: ['Vérité secrète une', 'Mensonge secret', 'Vérité secrète deux'], lie: 1 }, api);
            check('anecdotes au vote');
            if (G.tv(room, s).lie != null) out.bad.push('deuxverites : mensonge envoyé à la télé');
          }
          if (G.id === 'curseur') {
            if (G.tv(room, s).target != null) out.bad.push('curseur : cible envoyée à la télé');
            G.action(room, s, s.giver, { type: 'clue', v: 'indice public' }, api);
            G.action(room, s, pids.find((p) => p !== s.giver), { type: 'guess', v: 30 }, api);
            check('curseurs posés');
            if (G.tv(room, s).target != null || G.tv(room, s).mine != null) out.bad.push('curseur : cible ou curseur envoyé à la télé');
          }
          if (G.id === 'danssatete' || G.id === 'ordre') {
            G.action(room, s, 'pb', G.id === 'ordre' ? { type: 'order', o: [3, 2, 1, 0] } : { type: 'rank', o: [4, 3, 2, 1, 0] }, api);
            check('classement envoyé');
            if (G.tv(room, s).mine) out.bad.push(G.id + ' : classement d\'un joueur envoyé à la télé');
          }
          if (G.id === 'unisson') {
            G.action(room, s, 'pb', { type: 'answer', v: 'Réponse secrète' }, api);
            check('réponse en cours');
          }
          if (G.id.startsWith('vote-') || G.id === 'chifoumi' || G.id === 'debats' || G.id === 'cinq') {
            if (G.id === 'debats') { G.action(room, s, s.pour, { type: 'done' }, api); G.action(room, s, s.contre, { type: 'done' }, api); }
            if (G.id === 'cinq') { G.action(room, s, s.player, { type: 'go' }, api); s.phase = 'judge'; }
            const voter = pids.find((p) => p !== s.pour && p !== s.contre && p !== s.player);
            const a = G.id === 'chifoumi' ? { type: 'pick', c: 'feuille' } : G.id === 'cinq' ? { type: 'judge', ok: true } : { type: 'vote', v: G.id === 'vote-qui' ? 'pc' : G.id === 'vote-dix' ? 7 : 1 };
            G.action(room, s, voter, a, api);
            check('vote secret');
            if (G.tv(room, s).mine != null) out.bad.push(G.id + ' : vote d\'un joueur envoyé à la télé');
          }
          if (G.id === 'pendu') {
            const P = G.init(room, { ...G.defaults, mode: 'secret' }, api);
            G.action(room, P, P.chooser, { type: 'word', w: 'Secretissime' }, api);
            const tv = JSON.stringify(G.tv(room, P));
            if (/[A-Z]/.test(G.tv(room, P).slots.map((x) => x.c).join(''))) out.bad.push('pendu : lettres du mot secret envoyées à la télé ' + tv.slice(0, 80));
            out.steps++;
          }
          if (G.id === 'motmystere') {
            await (await import('/js/bonmot-core.js')).loadDico();
            for (let k = 0; k < 20 && s.phase === 'loading'; k++) { await new Promise((ok) => setTimeout(ok, 50)); G.tick(room, s, api); }
            G.action(room, s, 'pb', { type: 'guess', w: 'pomme' }, api);
            check('essai d\'un joueur');
            if (JSON.stringify(G.tv(room, s)).includes('pomme')) out.bad.push('motmystere : lettres d\'un essai envoyées à la télé');
          }
          if (G.id === 'bataille') {
            if (G.tv(room, s).myFleet || G.tv(room, s).fleets) out.bad.push('bataille : flotte envoyée à la télé');
            out.steps++;
          }
        } catch (e) { out.bad.push(G.id + ' étapes : ' + e.message); }
      }
    }
    return out;
  });
  check(res.special.length >= 55, `${res.special.length} jeux avec un écran télé spécial`, res.special);
  check(!res.generic.length, `les ${res.n - res.special.length} autres n'envoient à la télé que « partie finie ou non »`, res.generic);
  check(!res.bad.length, `aucun secret envoyé à la télé (${res.steps} situations vérifiées sur ${res.n} jeux)`, res.bad);
  check(!errors.length, 'aucune erreur JS', errors);
  await browser.close();
});
