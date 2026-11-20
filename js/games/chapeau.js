// Le Chapeau : 3 manches avec les mêmes cartes (décrire, un mot, mimer).
import { h, topbar, seg, confirmBox, shuffle, toast } from '../ui.js';
import { onlineBanner } from '../common.js';
import { get, set, getCustom, setCustom } from '../store.js';
import { teamsSetup, readyScreen, playTurn, reviewTurn, scoresScreen, finalScreen } from '../turn.js';

export const ROUNDS = [
  { name: 'Manche 1 : Décris !', emoji: '🗣️', rule: 'Fais deviner avec autant de mots que tu veux, sans dire le nom.' },
  { name: 'Manche 2 : Un seul mot !', emoji: '☝️', rule: 'Un seul mot pour faire deviner. Pas de geste !' },
  { name: 'Manche 3 : Mime !', emoji: '🤸', rule: 'Uniquement en mimant, sans un bruit.' },
];

export function start(ctx) {
  const { root, meta } = ctx;
  let alive = true;
  const opts = Object.assign({ duration: 30, cards: 40 }, get('chapeau', {}));
  const dataP = import('../data/chapeau.js').then((m) => m.default);

  function setup() {
    ctx.setGuard(null);
    const ts = teamsSetup();
    const ta = h('textarea', { class: 'input', placeholder: 'Un nom par ligne (personnes de la soirée, célébrités…)', value: getCustom('chapeau') });
    root.replaceChildren(
      topbar(ctx),
      onlineBanner(ctx, 'chapeau', { text: 'Les noms s\'affichent sur le téléphone de celui qui fait deviner, et l\'équipe adverse suit sur le sien.' }),
      h('div', { class: 'section-title' }, 'Ou sur un seul téléphone'),
      h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
      h('div', { class: 'section-title' }, 'Équipes'), ts.el,
      h('div', { class: 'section-title' }, 'Durée d\'un tour'),
      seg([30, 45, 60].map((v) => ({ value: v, label: v + ' s' })), opts.duration, (v) => { opts.duration = v; set('chapeau', opts); }),
      h('div', { class: 'section-title' }, 'Nombre de cartes'),
      seg([20, 30, 40, 50].map((v) => ({ value: v, label: String(v) })), opts.cards, (v) => { opts.cards = v; set('chapeau', opts); }),
      h('details', { class: 'panel' }, h('summary', null, '✍️ Ajouter nos propres noms'),
        h('div', { class: 'col' }, h('p', { class: 'muted small' }, 'Ils seront ajoutés au paquet en priorité. Idéal pour mettre les amis ou des private jokes !'), ta,
          h('button', { class: 'btn btn-soft', onclick: () => { setCustom('chapeau', ta.value); toast('Noms enregistrés ✅'); } }, 'Enregistrer'))),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => { setCustom('chapeau', ta.value); dataP.then((list) => game(ts.teams, list)); } }, '▶ Commencer'));
  }

  async function game(teams, list) {
    ctx.setGuard('Quitter la partie en cours ?');
    const custom = getCustom('chapeau').split('\n').map((s) => s.trim()).filter(Boolean);
    const cards = [...new Set([...shuffle(custom), ...shuffle(list.slice())])].slice(0, Math.max(opts.cards, Math.min(custom.length, 80)));
    const scores = teams.map(() => 0);
    const top = topbar(ctx, { onBack: async () => { if (await confirmBox('Quitter la partie en cours ?')) setup(); } });
    let ti = 0;
    const turnCount = teams.map(() => 0);
    for (let r = 0; r < 3; r++) {
      const R = ROUNDS[r];
      const remaining = shuffle(cards.slice());
      await scoresScreen(root, { top, teams, scores, emoji: R.emoji, info: `${R.name} — ${R.rule}`, next: teams[ti], button: 'Commencer la manche' });
      while (remaining.length) {
        if (!alive || !root.isConnected) return;
        const team = teams[ti];
        const who = team.members.length ? team.members[turnCount[ti] % team.members.length] : null;
        await readyScreen(root, { top, title: team.name, color: team.color, emoji: R.emoji, kicker: R.name, subtitle: (who ? `${who} fait deviner. ` : '') + R.rule + ` (${remaining.length} cartes restantes)` });
        if (!alive) return;
        const { results, current } = await playTurn(root, {
          label: `${team.name} · M${r + 1}`, color: team.color, duration: opts.duration,
          draw: (res, last) => {
            if (res === 'pass' && last) remaining.unshift(last);
            return remaining.pop() || null;
          },
          render: (name) => h('div', { class: 'word-card' }, h('div', { class: 'hint' }, R.emoji + ' ' + R.name.split(': ')[1]), h('div', { class: 'w' }, name), h('div', { class: 'hint' }, `${remaining.length} restante${remaining.length > 1 ? 's' : ''} dans le chapeau`)),
          buttons: [{ label: '⏭ Passer', cls: 'btn-soft', r: 'pass' }, { label: '✅ Trouvé', cls: 'btn-ok', r: 'ok' }],
        });
        if (!alive || !root.isConnected) return;
        if (current) remaining.unshift(current);
        // Les cartes passées puis corrigées en « trouvé » sortent du chapeau ; l'inverse y retourne.
        const before = results.map((x) => x.r);
        const p = await reviewTurn(root, { top, results, title: remaining.length ? 'Temps écoulé !' : 'Le chapeau est vide !', labelOf: (x) => x });
        results.forEach((x, i) => {
          if (before[i] === 'ok' && x.r !== 'ok') remaining.unshift(x.item);
          if (before[i] !== 'ok' && x.r === 'ok') { const k = remaining.indexOf(x.item); if (k >= 0) remaining.splice(k, 1); }
        });
        scores[ti] += p;
        turnCount[ti]++;
        ti = (ti + 1) % teams.length;
        if (remaining.length) await scoresScreen(root, { top, teams, scores, info: `${R.name} · ${remaining.length} cartes restantes`, next: teams[ti] });
      }
    }
    ctx.setGuard(null);
    finalScreen(root, { top: topbar(ctx), teams, scores, onReplay: setup });
  }

  setup();
  return () => { alive = false; };
}
