// Loup-garou : distribution des rôles + assistant du meneur.
import { h, topbar, shuffle, confirmBox, stepper, toggleRow, countdown, timerView, seg, setText } from '../ui.js';
import { onlineBanner } from '../common.js';
import { get, set } from '../store.js';
import { requirePlayers, playersPanel } from '../players.js';
import { sfx, buzz } from '../sfx.js';

export const ROLES = {
  loup: { name: 'Loup-garou', emoji: '🐺', team: 'loups', colors: ['#7a0c2e', '#2b0a3d'], desc: 'Chaque nuit, avec les autres loups, tu choisis une victime. Le jour, fais-toi passer pour un innocent villageois.' },
  villageois: { name: 'Villageois', emoji: '🧑‍🌾', team: 'village', colors: ['#2f7d32', '#1b4d3e'], desc: 'Tu n\'as pas de pouvoir, mais ton vote compte ! Débusque les loups pendant les débats.' },
  voyante: { name: 'Voyante', emoji: '🔮', team: 'village', colors: ['#5a2ca0', '#2b1a6e'], desc: 'Chaque nuit, tu peux découvrir le vrai rôle d\'un joueur. Aide le village… sans te faire repérer !' },
  docteur: { name: 'Docteur', emoji: '🩺', team: 'village', colors: ['#0f7b8a', '#0b3d63'], desc: 'Chaque nuit, tu protèges un joueur (toi compris) : s\'il est attaqué, il survit. Pas deux fois de suite le même.' },
  chasseur: { name: 'Chasseur', emoji: '🏹', team: 'village', colors: ['#8a5a0f', '#4d2f0b'], desc: 'Si tu meurs, tu emportes immédiatement un joueur de ton choix avec toi dans la tombe.' },
};

export function start(ctx) {
  const { root, meta } = ctx;
  let timer = null;
  const opts = Object.assign({ voyante: true, docteur: true, chasseur: true, debate: 180 }, get('loup', {}));
  const save = () => set('loup', opts);

  function suggestWolves(n) { return Math.max(1, Math.round(n / 4.5)); }

  function setup() {
    ctx.setGuard(null);
    timer && timer.stop();
    let wolves = null;
    const wolvesSlot = h('div');
    const renderWolves = () => {
      const n = (get('players', []) || []).length;
      if (wolves == null) wolves = suggestWolves(n || 6);
      wolvesSlot.replaceChildren(h('div', { class: 'spread' }, h('b', null, '🐺 Loups-garous'), stepper(wolves, 1, 6, (v) => { wolves = v; })));
    };
    renderWolves();
    root.replaceChildren(
      topbar(ctx),
      onlineBanner(ctx, 'loup', { text: 'Chacun reçoit son rôle secret sur son téléphone. L\'hôte est le meneur : il voit tout et suit le script.' }),
      h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
      playersPanel(5, () => { wolves = null; renderWolves(); }),
      h('p', { class: 'muted small' }, 'Le meneur ne fait pas partie de la liste des joueurs.'),
      h('div', { class: 'panel col' },
        h('h3', null, 'Rôles'),
        wolvesSlot,
        toggleRow('🔮 Voyante', null, opts.voyante, (v) => { opts.voyante = v; save(); }),
        toggleRow('🩺 Docteur', null, opts.docteur, (v) => { opts.docteur = v; save(); }),
        toggleRow('🏹 Chasseur', null, opts.chasseur, (v) => { opts.chasseur = v; save(); }),
        h('p', { class: 'muted small' }, 'Les autres joueurs sont villageois.')),
      h('label', { class: 'field' }, 'Durée du débat de jour', seg([120, 180, 300].map((v) => ({ value: v, label: v / 60 + ' min' })), opts.debate, (v) => { opts.debate = v; save(); })),
      h('button', {
        class: 'btn btn-primary btn-big btn-block',
        onclick: async () => {
          const pl = await requirePlayers(5);
          if (!pl) return;
          const specials = ['voyante', 'docteur', 'chasseur'].filter((r) => opts[r]);
          if (wolves + specials.length >= pl.length) { await confirmBox('Trop de rôles spéciaux pour le nombre de joueurs. Retire un rôle ou ajoute des joueurs.', { ok: 'OK', cancel: 'Fermer' }); return; }
          const roles = [...Array(wolves).fill('loup'), ...specials];
          while (roles.length < pl.length) roles.push('villageois');
          shuffle(roles);
          const game = { players: pl.map((name, i) => ({ name, role: roles[i], alive: true })), night: 0, lastProtected: null, log: [] };
          distribute(game, 0);
        },
      }, '🎴 Distribuer les rôles'));
  }

  // ---------- Distribution ----------
  function distribute(game, i) {
    ctx.setGuard('Quitter la partie en cours ?');
    const top = topbar(ctx, { onBack: async () => { if (await confirmBox('Quitter la partie en cours ?')) setup(); } });
    if (i >= game.players.length) {
      root.replaceChildren(top, h('div', { class: 'big-center' },
        h('div', { class: 'hero-emo' }, '🌕'),
        h('h2', null, 'Tout le monde connaît son rôle !'),
        h('p', { class: 'muted' }, 'Donnez le téléphone au meneur de jeu.'),
        h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => night(game) }, '🌙 Je suis le meneur : commencer la nuit')));
      return;
    }
    const p = game.players[i];
    const R = ROLES[p.role];
    const btn = h('button', { class: 'secret-btn', style: { width: '100%' } }, h('div', { class: 'emo' }, '🔒'), `Je suis ${p.name}`, h('span', { class: 'muted small' }, 'Touche pour découvrir ton rôle'));
    btn.onclick = () => {
      sfx.pop(); buzz(30);
      const wolvesList = p.role === 'loup' ? game.players.filter((x) => x.role === 'loup' && x !== p).map((x) => x.name) : [];
      btn.replaceWith(h('div', { class: 'col', style: { width: '100%' } },
        h('div', { class: 'role-card reveal-in', style: { '--g1': R.colors[0], '--g2': R.colors[1] } },
          h('div', { class: 'emo' }, R.emoji), h('h2', null, R.name), h('p', null, R.desc),
          wolvesList.length ? h('p', null, h('b', null, 'Tes complices : '), wolvesList.join(', ')) : null),
        h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => distribute(game, i + 1) }, 'Cacher et passer le téléphone')));
    };
    root.replaceChildren(top, h('div', { class: 'big-center' },
      h('p', { class: 'muted' }, `Joueur ${i + 1}/${game.players.length} — passe le téléphone à`),
      h('h2', { style: { fontSize: '38px' } }, p.name),
      btn));
  }

  // ---------- Outils du meneur ----------
  const alive = (game) => game.players.filter((p) => p.alive);
  const hasRole = (game, r) => game.players.some((p) => p.role === r && p.alive);
  function winner(game) {
    const a = alive(game);
    const w = a.filter((p) => p.role === 'loup').length;
    if (w === 0) return 'village';
    if (w >= a.length - w) return 'loups';
    return null;
  }

  function stepScreen(game, { num, title, say, body, top }) {
    const rolesVisible = { v: false };
    const rolesBox = h('div', { class: 'hidden' }, h('div', { class: 'scoreboard' }, game.players.map((p) => h('div', { class: 'score-row', style: { opacity: p.alive ? 1 : 0.4 } }, h('span', null, ROLES[p.role].emoji), h('span', { class: 'n' }, p.name + (p.alive ? '' : ' ✝')), h('span', { class: 'muted small' }, ROLES[p.role].name)))));
    const toggle = h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { rolesVisible.v = !rolesVisible.v; rolesBox.classList.toggle('hidden', !rolesVisible.v); setText(toggle, rolesVisible.v ? '🙈 Cacher les rôles' : '👁 Voir les rôles (meneur)'); } }, '👁 Voir les rôles (meneur)');
    root.replaceChildren(top,
      h('div', { class: 'step-card' }, h('div', { class: 'step-num' }, num), h('h3', null, title), say ? h('p', { class: 'say' }, `« ${say} »`) : null),
      body,
      h('div', { class: 'grow' }),
      toggle, rolesBox);
  }

  function choose(game, step, list, o = {}) {
    return new Promise((res) => {
      const box = h('div', { class: 'plist-sel' }, list.map((p) => h('button', {
        class: p.alive ? '' : 'dead', disabled: !p.alive || (o.disabled && o.disabled(p)),
        onclick: () => res(p),
      }, p.name)), o.allowNone ? h('button', { onclick: () => res(null) }, '🚫 ' + (o.noneLabel || 'Personne')) : null);
      stepScreen(game, { ...step, body: box });
    });
  }

  function next(game, step, label = 'Suivant →') {
    return new Promise((res) => {
      stepScreen(game, { ...step, body: h('button', { class: 'btn btn-primary btn-big btn-block', onclick: res }, label) });
    });
  }

  async function night(game) {
    game.night++;
    const top = topbar(ctx, { title: `Nuit ${game.night}`, emoji: '🌙', onBack: async () => { if (await confirmBox('Quitter la partie en cours ?')) setup(); } });
    sfx.swoosh();
    await next(game, { top, num: `Nuit ${game.night}`, title: '🌙 La nuit tombe', say: 'Le village s\'endort. Tout le monde ferme les yeux.' });
    let protectedP = null;
    if (hasRole(game, 'docteur')) {
      protectedP = await choose(game, { top, num: 'Docteur', title: '🩺 Le docteur se réveille', say: 'Docteur, ouvre les yeux. Qui veux-tu protéger cette nuit ?' }, game.players, { disabled: (p) => p === game.lastProtected });
      game.lastProtected = protectedP;
      await next(game, { top, num: 'Docteur', title: '🩺', say: 'Docteur, ferme les yeux.' });
    }
    const victim = await choose(game, { top, num: 'Loups-garous', title: '🐺 Les loups-garous se réveillent', say: 'Loups-garous, ouvrez les yeux et désignez ensemble votre victime.' }, game.players, { disabled: (p) => p.role === 'loup' });
    await next(game, { top, num: 'Loups-garous', title: '🐺', say: 'Loups-garous, refermez les yeux.' });
    if (hasRole(game, 'voyante')) {
      const seen = await choose(game, { top, num: 'Voyante', title: '🔮 La voyante se réveille', say: 'Voyante, ouvre les yeux. Désigne le joueur dont tu veux connaître le rôle.' }, game.players, { disabled: (p) => p.role === 'voyante' });
      // Écran à montrer discrètement à la voyante
      await new Promise((res) => {
        const R = ROLES[seen.role];
        root.replaceChildren(top, h('div', { class: 'big-center' },
          h('p', { class: 'muted' }, `Rôle de ${seen.name}`),
          h('div', { class: 'role-card', style: { '--g1': R.colors[0], '--g2': R.colors[1], width: '100%' } }, h('div', { class: 'emo' }, R.emoji), h('h2', null, R.name)),
          h('p', { class: 'say' }, '« Voyante, ferme les yeux. »'),
          h('button', { class: 'btn btn-primary btn-big btn-block', onclick: res }, 'Suivant →')));
      });
    }
    // Matin
    const deaths = [];
    if (victim && victim !== protectedP) { victim.alive = false; deaths.push(victim); }
    await morning(game, deaths, top);
  }

  async function killWithHunter(game, p, top, deaths) {
    if (p.role === 'chasseur') {
      const shot = await choose(game, { top, num: 'Chasseur', title: '🏹 Le chasseur tire !', say: `${p.name} était chasseur. Avant de mourir, il désigne quelqu'un à emporter avec lui.` }, game.players, {});
      shot.alive = false;
      deaths.push(shot);
    }
  }

  async function morning(game, deaths, top) {
    for (const d of deaths.slice()) await killWithHunter(game, d, top, deaths);
    sfx.end();
    await next(game, {
      top, num: 'Le matin', title: '☀️ Le village se réveille',
      say: deaths.length ? `Cette nuit, ${deaths.map((d) => `${d.name} (${ROLES[d.role].name})`).join(' et ')} ${deaths.length > 1 ? 'ont' : 'a'} été tué${deaths.length > 1 ? 's' : ''} !` : 'Miracle : personne n\'est mort cette nuit !',
    });
    if (end(game)) return;
    day(game);
  }

  function end(game) {
    const w = winner(game);
    if (!w) return false;
    ctx.setGuard(null);
    sfx.fanfare();
    root.replaceChildren(topbar(ctx),
      h('div', { class: 'role-card', style: w === 'loups' ? { '--g1': '#7a0c2e', '--g2': '#2b0a3d' } : { '--g1': '#2f7d32', '--g2': '#1b4d3e' } },
        h('div', { class: 'emo' }, w === 'loups' ? '🐺' : '🎉'), h('h2', null, w === 'loups' ? 'Les loups-garous ont gagné !' : 'Le village a gagné !')),
      h('div', { class: 'scoreboard' }, game.players.map((p) => h('div', { class: 'score-row', style: { opacity: p.alive ? 1 : 0.55 } }, h('span', null, ROLES[p.role].emoji), h('span', { class: 'n' }, p.name + (p.alive ? '' : ' ✝')), h('span', { class: 'muted small' }, ROLES[p.role].name)))),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: setup }, '🔁 Nouvelle partie'));
    return true;
  }

  async function day(game) {
    const top = topbar(ctx, { title: `Jour ${game.night}`, emoji: '☀️', onBack: async () => { if (await confirmBox('Quitter la partie en cours ?')) setup(); } });
    // Débat
    await new Promise((res) => {
      const tv = timerView(opts.debate);
      const startBtn = h('button', { class: 'btn btn-soft btn-block' }, '⏱ Lancer le chrono du débat');
      startBtn.onclick = () => {
        startBtn.replaceWith(tv.el);
        timer = countdown({ seconds: opts.debate, onTick: (l, s, ch) => { if (!root.isConnected) { timer.stop(); return; } tv.set(l, opts.debate * 1000); if (ch && s <= 5 && s > 0) sfx.tick(); }, onEnd: () => { sfx.bad(); buzz([200, 100, 200]); } });
      };
      stepScreen(game, {
        top, num: `Jour ${game.night}`, title: '🗣️ Débat',
        say: 'Le village débat : qui sont les loups-garous ? Ensuite, on vote à main levée.',
        body: h('div', { class: 'col' },
          h('p', { class: 'muted small' }, `Encore en vie : ${alive(game).map((p) => p.name).join(', ')}`),
          startBtn,
          h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => { timer && timer.stop(); res(); } }, '🗳️ Passer au vote')),
      });
    });
    const out = await choose(game, { top, num: 'Vote', title: '🗳️ Qui le village élimine-t-il ?', say: 'Le joueur qui a reçu le plus de votes est éliminé.' }, game.players, { allowNone: true, noneLabel: 'Égalité : personne n\'est éliminé' });
    const deaths = [];
    if (out) {
      out.alive = false;
      deaths.push(out);
      await killWithHunter(game, out, top, deaths);
      sfx.end();
      await next(game, { top, num: 'Verdict', title: '⚖️ Le village a tranché', say: deaths.map((d) => `${d.name} était… ${ROLES[d.role].emoji} ${ROLES[d.role].name} !`).join(' ') });
    }
    if (end(game)) return;
    night(game);
  }

  setup();
  return () => timer && timer.stop();
}
