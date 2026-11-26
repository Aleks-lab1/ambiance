// Écrans télé des jeux (télé 1280 × 720, tests/lib/tv-sim.cjs) : pour chacun des jeux qui ont un écran télé
// (sauf les 11 premiers, testés par relay/tele.test.cjs et online/tele-secrets.test.cjs), on joue quelques
// coups et on vérifie ce qu'affiche la télé : question, carte, plateau, résultats, rien qui dépasse de
// l'écran, aucune erreur. Avec SHOTS=1 : une capture par étape dans tests/out/tv-*.png.
const { tvSim } = require('../lib/tv-sim.cjs');
const { check, run } = require('../lib/check.cjs');

const W = (ms) => new Promise((r) => setTimeout(r, ms));
const S = (t, k) => t.get((key) => window.__tv.s[key], k); // valeur de l'état de l'hôte

// [module, export, réglages, joueurs, scénario(t, see)] ; see(étape, regex attendue) vérifie l'écran.
const GAMES = [
  ['/js/online/vote.js', 'voteTP', {}, 4, async (t, see) => {
    await see('vote', /Tu préfères/i, '.tv-side');
    for (const [p, v] of [['A', 0], ['B', 1], ['C', 0], ['D', 0]]) await t.act(p, { type: 'vote', v });
    await see('résultats', /75 %/);
  }],
  ['/js/online/vote.js', 'voteDix', {}, 3, async (t, see) => {
    for (const [p, v] of [['A', 8], ['B', 4], ['C', 6]]) await t.act(p, { type: 'vote', v });
    await see('note moyenne', /Note moyenne 6,0 \/ 10/);
  }],
  ['/js/online/vote.js', 'voteQui', {}, 4, async (t, see) => {
    for (const [p, v] of [['A', 'B'], ['B', 'C'], ['C', 'B'], ['D', 'B']]) await t.act(p, { type: 'vote', v });
    await see('désigné', /Bob/, '.tv-barrow.win');
  }],
  ['/js/online/vote.js', 'voteOp', {}, 3, async (t, see) => { await see('vote', /D'accord/); }],
  ['/js/online/vote.js', 'voteJamais', {}, 3, async (t, see) => {
    for (const [p, v] of [['A', 0], ['B', 1], ['C', 0]]) await t.act(p, { type: 'vote', v });
    await see('résultats', /Alice, Chloé/);
  }],
  ['/js/online/cartes.js', 'actionOnline', {}, 3, async (t, see) => {
    await see('choix', /Au tour de .*Action.*Vérité/);
    const w = await S(t, 'who');
    await t.act(w, { type: 'choose', kind: 'verite' });
    await see('carte', /Vérité/i, '.tv-bigcard');
    await t.act(w, { type: 'done', ok: true });
    await see('fait', /\+1 point/);
  }],
  ['/js/online/cartes.js', 'etsiOnline', {}, 3, async (t, see) => { await see('carte', /Et si/i, '.tv-bigcard'); }],
  ['/js/online/cartes.js', 'confidencesOnline', {}, 3, async (t, see) => { await see('carte', /Confidence/i, '.tv-bigcard'); }],
  ['/js/online/cartes.js', 'capOnline', {}, 3, async (t, see) => {
    await t.act(await S(t, 'who'), { type: 'done', ok: false });
    await see('refus', /refuse et prend/);
  }],
  ['/js/online/hasard.js', 'bouteilleOnline', {}, 5, async (t, see) => {
    await see('anneau', /va faire tourner la bouteille/, '.tv-ring .bt-bottle');
    await t.act(await S(t, 'spinner'), { type: 'spin' });
    await W(3900);
    await see('défi', /→/, '.bt-name.hit');
  }],
  ['/js/online/hasard.js', 'roueOnline', {}, 3, async (t, see) => {
    await t.act(await S(t, 'who'), { type: 'spin' });
    await W(4600);
    await see('gage', /Ensuite/, '.tv-wheel canvas');
  }],
  ['/js/online/hasard.js', 'doigtOnline', { mode: 'order' }, 3, async (t, see) => {
    await t.act('A', { type: 'hold', on: true });
    await see('doigts', /1\/3 doigt posé/);
    await t.act('B', { type: 'hold', on: true }); await t.act('C', { type: 'hold', on: true });
    await W(2600);
    await see('ordre', /L'ordre de jeu/, '.tv-order li');
  }],
  ['/js/online/hasard.js', 'outilsOnline', {}, 3, async (t, see) => {
    await t.act('B', { type: 'roll' });
    await see('dés', /Lancés par Bob/, '.tv-dice .die');
    await t.act('A', { type: 'tab', tab: 'chrono' });
    await see('chrono', /1:00/, '.tv-chrono');
  }],
  ['/js/online/paquet.js', 'roiOnline', {}, 3, async (t, see) => {
    await t.act(await S(t, 'who'), { type: 'draw' });
    await see('carte', /Carte de/, '.flip3 .playing-card');
  }],
  ['/js/online/paquet.js', 'plusmoinsOnline', {}, 2, async (t, see) => {
    await see('cartes', /joue/, '.pc.tvc');
    await t.act(await S(t, 'who'), { type: 'guess', up: true });
    await see('carte suivante', /Bien vu|Raté|Égalité/, '.flip3');
  }],
  ['/js/online/paquet.js', 'busOnline', {}, 2, async (t, see) => {
    await see('bus', /Rouge ou noir/, '.tv-steps .bus-step');
    await t.act(await S(t, 'who'), { type: 'answer', choice: 'rouge' });
    await see('1re carte', /Étape 2|Raté/);
  }],
  ['/js/online/plateau.js', 'memoryOnline', { pairs: 8 }, 2, async (t, see) => {
    const cur = await S(t, 'cur');
    await t.act(cur, { type: 'flip', i: 0 });
    await see('plateau', /deux cartes/, '.tv-mem .mc.up');
  }],
  ['/js/online/plateau.js', 'yamsOnline', {}, 3, async (t, see) => {
    await t.act(await S(t, 'cur'), { type: 'roll' });
    await see('dés', /Lancer 1\/3/, '.tv-yams-dice .die');
  }],
  ['/js/online/plateau.js', 'batailleOnline', {}, 3, async (t, see) => {
    await see('placement', /placent leur flotte/);
    await t.act('A', { type: 'ready' }); await t.act('B', { type: 'ready' });
    const s = await t.get(() => ({ turn: window.__tv.s.turn, duo: window.__tv.s.duo }));
    await t.act(s.duo[s.turn], { type: 'fire', i: 0 });
    await see('tir', /tire/, '.tv-sea .bn-grid');
    check(await t.page.locator('.tv-sea .bn-cell.ship').count() === 0, 'Bataille navale : les bateaux restent cachés à la télé');
  }],
  ['/js/online/mots.js', 'morpionOnline', { game: 'quatre' }, 3, async (t, see) => {
    const s = await t.get(() => ({ turn: window.__tv.s.turn, duo: window.__tv.s.duo }));
    await t.act(s.duo[s.turn], { type: 'play', i: 3 });
    await W(1200);
    await see('4 en ligne', /contre/, '.tv-morpion .c4-disc');
  }],
  ['/js/online/mots.js', 'penduOnline', {}, 3, async (t, see) => {
    await W(2500);
    await t.act(await S(t, 'cur'), { type: 'letter', k: 'E' });
    await see('mot à trous', /Mot 1\/3/, '.tv-pendu svg');
  }],
  ['/js/online/mots.js', 'motmystereOnline', {}, 3, async (t, see) => {
    await W(2500);
    await t.act('B', { type: 'guess', w: 'pomme' });
    await see('course', /Bob/, '.tv-mm-g i');
  }],
  ['/js/online/mots.js', 'petitbacOnline', {}, 3, async (t, see) => {
    await see('lettre', /Manche 1\/3/, '.tv-letter');
    const s = await t.get(() => ({ cats: window.__tv.s.cats, L: window.__tv.s.letter }));
    for (const p of ['A', 'B']) await t.act(p, { type: 'save', list: s.cats.map((c, i) => s.L + 'aa' + i) });
    await t.act('A', { type: 'stop' });
    await see('tableau', /STOP de Alice/, '.tv-pb .ans');
  }],
  ['/js/online/tour.js', 'paranoiaOnline', {}, 3, async (t, see) => {
    await see('question secrète', /lit une question en secret/);
    const a = await S(t, 'asker');
    await t.act(a, { type: 'pick', pid: a === 'B' ? 'C' : 'B' });
    await W(2800);
    await see('pièce', /a désigné/);
  }],
  ['/js/online/tour.js', 'debatsOnline', {}, 4, async (t, see) => {
    await see('pour', /défend le POUR/, '.tv-debate .tv-side.on');
  }],
  ['/js/online/tour.js', 'cinqOnline', {}, 3, async (t, see) => {
    await t.act(await S(t, 'player'), { type: 'go' });
    await see('chrono', /Cite 3/i, '.tv-count');
  }],
  ['/js/online/tour.js', 'deuxOnline', {}, 3, async (t, see) => {
    const p = await S(t, 'teller');
    await t.act(p, { type: 'submit', items: ['Une vérité', 'Un mensonge', 'Une autre vérité'], lie: 1 });
    await see('anecdotes', /Un mensonge/, '.tv-anec');
  }],
  ['/js/online/soiree.js', 'curseurOnline', {}, 3, async (t, see) => {
    await t.act(await S(t, 'giver'), { type: 'clue', v: 'soupe' });
    await see('indice', /« soupe »/, '.tv-scale .scale-bar');
  }],
  ['/js/online/soiree.js', 'danssateteOnline', {}, 3, async (t, see) => {
    await see('thème', /a-t-il classé/i, '.tv-items span');
  }],
  ['/js/online/soiree.js', 'ordreOnline', {}, 2, async (t, see) => {
    const sol = await S(t, 'sol');
    await t.act('A', { type: 'order', o: sol }); await t.act('B', { type: 'order', o: sol.slice().reverse() });
    await see('frise', /La bonne réponse/, '.tv-sort .sort-item');
  }],
  ['/js/online/soiree.js', 'chifoumiOnline', {}, 3, async (t, see) => {
    for (const [p, c] of [['A', 'pierre'], ['B', 'feuille'], ['C', 'ciseaux']]) await t.act(p, { type: 'pick', c });
    await W(1400);
    await see('mains', /\+1/, '.tv-chi-p');
  }],
  ['/js/online/equipes.js', 'eqMI', {}, 4, async (t, see) => {
    const gv = await t.get(() => { const s = window.__tv.s; const tm = s.teams[s.team]; return tm[s.giverIdx[s.team] % tm.length]; });
    await t.act(gv, { type: 'start' }); await t.act(gv, { type: 'ok' });
    await see('équipes', /devinez/, '.tv-eqt.cur');
    const w = await t.get(() => window.__tv.s.word[0]);
    check(!(await t.txt()).includes(w), 'Mots interdits : le mot n\'est pas affiché à la télé', w);
  }],
  ['/js/online/equipes.js', 'chapeauOnline', {}, 4, async (t, see) => { await see('chapeau', /Manche 1\/3/, '.tv-eqt'); }],
  ['/js/online/unisson.js', 'default', {}, 3, async (t, see) => {
    for (const [p, x] of [['A', 'Chat'], ['B', 'chats'], ['C', 'Chien']]) await t.act(p, { type: 'answer', v: x });
    await see('groupes', /Chat/, '.tv-group.many');
  }],
  ['/js/online/bonmot.js', 'default', {}, 3, async (t, see) => {
    await W(7000);
    const cur = await t.get(() => window.__tv.s.order[window.__tv.s.turn % window.__tv.s.order.length]);
    await t.act(cur, { type: 'typing', v: 'bonjou' });
    await see('saisie en direct', /écrit : bonjou/, '.tv-bm-card .tiles span');
  }],
  ['/js/online/bingo.js', 'default', {}, 3, async (t, see) => {
    for (const pos of [0, 1, 2, 3, 4]) await t.act('B', { type: 'mark', pos });
    await see('bingo', /BINGO ! Bob/, '.tv-bingo-p');
  }],
  ['/js/online/oral.js', 'frontOnline', {}, 3, async (t, see) => {
    await t.act(await S(t, 'guesser'), { type: 'start' });
    await see('devine', /devine/);
    const w = await S(t, 'word');
    check(!(await t.txt()).includes(w), 'Sur le front : le mot n\'est pas affiché à la télé', w);
  }],
  ['/js/online/oral.js', 'niouiOnline', {}, 3, async (t, see) => {
    await t.act(await S(t, 'victim'), { type: 'start' });
    await see('question', /demande à/i, '.tv-bigcard');
  }],
  ['/js/online/oral.js', 'histoireOnline', {}, 3, async (t, see) => {
    await t.act(await S(t, 'who'), { type: 'go' });
    await see('mot imposé', /continue l'histoire/, '.tv-quote');
  }],
  ['/js/online/live.js', 'patateOnline', {}, 3, async (t, see) => {
    await see('bombe', /a la bombe/, '.tv-bomb.shake');
  }],
  ['/js/online/live.js', 'sequenceOnline', {}, 2, async (t, see) => {
    await W(3600);
    await see('suite', /Regardez bien/, '.tv-seq .seq-pad');
  }],
  // Dans la foule (TV Mode seulement, temps réel) : la place et la foule ; partie complète dans online/foule.test.cjs.
  ['/js/online/foule.js', 'fouleOnline', { rounds: 1 }, 3, async (t, see) => {
    await see('compte à rebours', /Manche 1 \/ 1/);
    await W(3000);
    await see('partez', /Les passants ne poussent jamais/);
  }],
];

run(async () => {
  const t = await tvSim();
  let n = 0;
  for (const [path, exp, st, players, scenario] of GAMES) {
    await t.load(path, exp, st, players);
    const id = await t.get(() => window.__tv.G.id);
    const see = async (step, re, sel) => {
      await W(700);
      const txt = await t.txt();
      const okSel = !sel || await t.page.locator(sel).count() > 0;
      check(re.test(txt) && okSel, `${id} (${step}) : la télé affiche ${re}${sel ? ' + ' + sel : ''}`, txt.slice(0, 220));
      check(await t.fits(), `${id} (${step}) : tout tient dans l'écran`);
      await t.shot(`${id}-${step.replace(/\W+/g, '-')}`);
    };
    try { await scenario(t, see); } catch (e) { check(false, `${id} : scénario`, e.message); }
    const { log } = await t.state();
    check(!log.length, `${id} : aucune erreur du jeu`, log);
    n++;
  }
  check(n === GAMES.length, `${n} écrans télé joués`);
  check(!t.errors.length, 'aucune erreur JS', t.errors);
  await t.browser.close();
});
