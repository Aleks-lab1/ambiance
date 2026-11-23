// En ligne : les cartes déjà tirées ne reviennent pas d'une partie à l'autre (mémoire dans le téléphone de
// l'hôte, kit.js drawNew), et partagent la mémoire de la version locale quand c'est le même paquet.
const { open } = require('../lib/pw-helper.cjs');
const { check, run } = require('../lib/check.cjs');

run(async () => {
  const { browser, page, errors } = await open('');
  await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    const room = { host: 'A', players: ['A', 'B', 'C', 'D'].map((pid) => ({ pid, name: pid, score: 0, on: true })) };
    const out = {};
    // Lance N parties d'affilée et récupère la première carte de chacune.
    const firsts = async (path, name, st, get, n = 30) => {
      const G = (await import(path))[name];
      const list = [];
      for (let k = 0; k < n; k++) list.push(JSON.stringify(get(G.init(room, { ...G.defaults, ...st }, {}))));
      return list;
    };
    const uniq = (l) => new Set(l).size === l.length;
    out.jamais = uniq(await firsts('/js/online/vote.js', 'voteJamais', { levels: ['soft'] }, (s) => s.q));
    out.tp = uniq(await firsts('/js/online/vote.js', 'voteTP', { levels: ['soft', 'fun'] }, (s) => s.q));
    out.etsi = uniq(await firsts('/js/online/cartes.js', 'etsiOnline', { levels: ['fun'] }, (s) => s.card.t));
    out.cinq = uniq(await firsts('/js/online/tour.js', 'cinqOnline', {}, (s) => s.prompt));
    out.debats = uniq(await firsts('/js/online/tour.js', 'debatsOnline', {}, (s) => s.topic));
    out.para = uniq(await firsts('/js/online/tour.js', 'paranoiaOnline', { levels: ['soft'] }, (s) => s.q));
    out.unisson = uniq(await firsts('/js/online/unisson.js', 'default', { levels: ['fun'] }, (s) => s.prompt));
    out.punch = uniq(await firsts('/js/online/write.js', 'writePunch', { levels: ['fun'] }, (s) => s.prompt));
    out.curseur = uniq(await firsts('/js/online/soiree.js', 'curseurOnline', {}, (s) => s.pair));
    // Chapeau : 30 noms tous différents dans une partie, et aucun nom repris à la partie suivante.
    const CH = (await import('/js/online/equipes.js')).chapeauOnline;
    const g1 = CH.init(room, { cards: 30, time: 30 }, {}).cards, g2 = CH.init(room, { cards: 30, time: 30 }, {}).cards;
    out.chapeau = g1.length === 30 && uniq(g1) && !g2.some((x) => g1.includes(x));
    // Qui suis-je : identités toutes différentes dans une partie.
    const QSJ = (await import('/js/online/soiree.js')).quisuisjeOnline;
    out.qsj = uniq(Object.values(QSJ.init(room, { ...QSJ.defaults }, {}).who));
    // Mémoire partagée avec la version locale : clé « jamais:soft » remplie par les parties en ligne.
    out.shared = (JSON.parse(localStorage.getItem('ambiance:seen:jamais:soft') || '[]')).length >= 30;
    return out;
  });
  const labels = { jamais: 'Je n\'ai jamais', tp: 'Tu préfères', etsi: 'Et si…', cinq: '3 en 5 secondes', debats: 'Pour ou contre', para: 'Paranoïa', unisson: 'À l\'unisson', punch: 'Punchlines', curseur: 'Le Curseur' };
  for (const [k, l] of Object.entries(labels)) check(r[k], `${l} : 30 parties de suite, jamais la même première carte`);
  check(r.chapeau, 'Le Chapeau : 30 noms différents, aucun repris à la partie suivante');
  check(r.qsj, 'Qui suis-je : identités toutes différentes');
  check(r.shared, 'mémoire partagée avec la version locale (même paquet « jamais:soft »)');
  check(!errors.length, 'aucune erreur JS', errors);
  await browser.close();
});
