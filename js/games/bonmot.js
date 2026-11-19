// Le Bon Mot : tape vite un mot avec les lettres imposées, ou enchaîne les mots sur la dernière lettre.
import { h, topbar, seg, toggleRow, countdown, timerView, confirmBox } from '../ui.js';
import { get, set, getPlayers, sip } from '../store.js';
import { playersPanel } from '../players.js';
import { sfx, buzz } from '../sfx.js';
import { onlineBanner } from '../common.js';
import { loadDico, normWord, fits, minLength } from '../bonmot-core.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const RARE_START = new Set(['K', 'W', 'X', 'Y', 'Z']);
const GAP = 3; // secondes de compte à rebours entre deux joueurs
const LIVES = 3; // vies par joueur
const hearts = (n) => '❤️'.repeat(Math.max(0, n)) + '🤍'.repeat(Math.max(0, LIVES - n));



const up = (s) => s.toUpperCase();
const tiles = (letters) => h('div', { class: 'tiles bm-tiles' }, up(letters).split('').map((c, i) => h('span', { style: { animationDelay: i * 70 + 'ms' } }, c)));

export function start(ctx) {
  const { root, meta } = ctx;
  const opts = Object.assign({ mode: 'lettres', len: 'prog', pos: 'start', chain: 1, time: 15, dico: true }, get('bonmot', {}));
  if (opts.len === 'mix') opts.len = 'prog'; // ancien réglage « Mélange »
  const save = () => set('bonmot', opts);
  let dico = null;
  let timers = [];
  let timer = null;
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const clear = () => { timers.forEach(clearTimeout); timers = []; if (timer) { timer.stop(); timer = null; } };
  // Empêche un bouton de voler le focus du champ de saisie (le clavier reste ouvert).
  const keep = (e) => e.preventDefault();

  // ---------------- Réglages ----------------
  function setup() {
    clear();
    ctx.setGuard(null);
    const modeDesc = h('p', { class: 'muted small' });
    const optsBox = h('div', { class: 'col' });
    const startBtn = h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => dico && play() });

    function render() {
      modeDesc.textContent = opts.mode === 'chaine'
        ? 'Chaque mot doit commencer par la fin du mot précédent : « dernier » → « rose » → « escargot »… Le premier joueur choisit la lettre de départ.'
        : 'L\'appli tire 1, 2 ou 3 lettres au hasard (par exemple « DE ») : tape vite un mot qui va avec (« dernier »).';
      optsBox.replaceChildren(
        opts.mode === 'chaine'
          ? h('label', { class: 'field' }, 'Lettres à reprendre à la fin du mot précédent', seg([
            { value: 1, label: 'La dernière' }, { value: 2, label: 'Les 2 dernières' }, { value: 3, label: 'Les 3 dernières' },
          ], opts.chain, (v) => { opts.chain = v; save(); }))
          : [
            h('label', { class: 'field' }, 'Nombre de lettres imposées', seg([
              { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 'prog', label: '📈 De + en +' },
            ], opts.len, (v) => { opts.len = v; save(); })),
            h('label', { class: 'field' }, 'Les lettres doivent être…', seg([
              { value: 'start', label: 'Au début du mot' }, { value: 'in', label: 'N\'importe où' },
            ], opts.pos, (v) => { opts.pos = v; save(); })),
          ],
        h('label', { class: 'field' }, 'Temps par joueur', seg([10, 15, 20, 30].map((v) => ({ value: v, label: v + ' s' })), opts.time, (v) => { opts.time = v; save(); })),
        toggleRow('Vérifier avec le dictionnaire', 'Refuse les mots inconnus (le groupe peut quand même les accepter)', opts.dico, (v) => { opts.dico = v; save(); }));
      if (dico) { startBtn.disabled = false; startBtn.textContent = opts.mode === 'chaine' ? '🔗 Lancer la chaîne' : '🔠 C\'est parti !'; }
    }

    startBtn.disabled = true;
    startBtn.textContent = '⏳ Chargement du dictionnaire…';
    loadDico().then((d) => { dico = d; if (startBtn.isConnected) render(); }).catch(() => {
      if (startBtn.isConnected) startBtn.textContent = '😵 Dictionnaire introuvable. Réessaie plus tard.';
    });

    root.replaceChildren(
      topbar(ctx),
      onlineBanner(ctx, 'bonmot', { text: 'Chacun tape ses mots sur son téléphone, à tour de rôle, et tout le monde voit le mot s\'écrire en direct.' }),
      h('div', { class: 'section-title' }, 'Ou sur un seul téléphone'),
      h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
      playersPanel(0),
      h('label', { class: 'field' }, 'Mode de jeu', seg([
        { value: 'lettres', label: '🔤 Lettres imposées' }, { value: 'chaine', label: '🔗 Mots en chaîne' },
      ], opts.mode, (v) => { opts.mode = v; save(); render(); })),
      modeDesc,
      optsBox,
      h('div', { class: 'grow' }),
      startBtn);
    render();
  }

  // ---------------- Partie ----------------
  function play() {
    clear();
    const list = getPlayers();
    const solo = !list.length;
    const players = solo ? ['Toi'] : list;
    const stats = new Map(players.map((p) => [p, { pts: 0, fails: 0, best: '', lives: LIVES }]));
    const out = [];           // joueurs éliminés, dans l'ordre
    const chainMode = opts.mode === 'chaine';
    const pos = chainMode ? 'start' : opts.pos;
    const used = new Set();   // mots déjà joués (forme normalisée)
    const names = new Set(list.map(normWord)); // les prénoms des joueurs sont toujours acceptés
    const played = [];        // mots joués, pour l'affichage
    const recent = [];        // derniers tirages, pour éviter les répétitions
    let chain = [];           // chaîne en cours
    let bestChain = 0;
    let turn = 0;
    let letters = '';         // lettres imposées (normalisées)
    let state = 'idle';       // pick | count | play | result

    const who = () => players[turn % players.length];
    const alive = () => players.filter((p) => stats.get(p).lives > 0);
    // Passe au joueur suivant encore en vie.
    const nextTurn = () => { for (let i = 0; i < players.length; i++) { turn++; if (stats.get(who()).lives > 0) return; } };
    const isOver = () => (solo ? alive().length === 0 : alive().length <= 1);
    const quit = async () => { if (await confirmBox('Quitter la partie en cours ?', { ok: 'Quitter' })) setup(); };
    ctx.setGuard('Quitter la partie en cours ?');

    const whoPill = h('span', { class: 'pill' });
    const scorePill = h('span', { class: 'pill' });
    const tv = timerView(opts.time);
    const card = h('div', { class: 'bm-card' });
    const input = h('input', {
      class: 'input bm-input', type: 'text', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'none', spellcheck: 'false',
      enterkeyhint: 'send', maxlength: '32', placeholder: 'Tape ton mot…', 'aria-label': 'Ton mot',
      oninput: () => input.classList.toggle('ok', state === 'play' && !!letters && fits(normWord(input.value), letters, pos)),
    });
    const form = h('form', { class: 'row bm-form', onsubmit: (e) => { e.preventDefault(); submit(); } },
      input, h('button', { class: 'btn btn-primary', type: 'submit', onmousedown: keep }, 'Valider'));
    const msg = h('div', { class: 'bm-msg', 'aria-live': 'polite' });
    const usedBox = h('div', { class: 'bm-used' });
    const livesBar = h('div', { class: 'bm-lives' });
    const playZone = h('div', { class: 'col' }, tv.el, form, msg);

    root.replaceChildren(
      topbar(ctx, { onBack: quit, right: h('button', { class: 'btn btn-ghost btn-sm', onmousedown: keep, onclick: summary }, '🏁 Fin') }),
      h('div', { class: 'row' }, whoPill, h('div', { class: 'grow' }), scorePill),
      livesBar, card, playZone, usedBox);

    function updatePills() {
      const p = who();
      whoPill.textContent = `${solo ? '✍️ À toi !' : '✍️ ' + p} ${hearts(stats.get(p).lives)}`;
      livesBar.replaceChildren(solo ? null : players.map((x) => {
        const l = stats.get(x).lives;
        return h('span', { class: 'bm-life' + (x === p && state !== 'over' ? ' cur' : '') + (l ? '' : ' dead') }, h('b', null, x), ' ', l ? '❤️'.repeat(l) : '💀');
      }));
      scorePill.textContent = chainMode
        ? `🔗 ${chain.length} mot${chain.length > 1 ? 's' : ''} · record ${Math.max(get('bonmot-record', 0), bestChain)}`
        : `⭐ ${stats.get(p).pts} pt${stats.get(p).pts > 1 ? 's' : ''}${opts.len === 'prog' ? ` · 🔤 ${lenAt(turnsDone)}` : ''}`;
    }

    function renderUsed() {
      if (chainMode) {
        usedBox.replaceChildren(chain.length ? h('div', { class: 'bm-chain' }, chain.map((w, i) => [i ? h('span', { class: 'arr' }, '→') : null, h('span', { class: 'chip' }, w)])) : null);
      } else {
        usedBox.replaceChildren(played.length ? [h('p', { class: 'muted small' }, 'Déjà joués :'), h('div', { class: 'chips' }, played.slice(-24).reverse().map((w) => h('span', { class: 'chip' }, w)))] : null);
      }
    }

    function setMsg(text, cls = '', extra = null) {
      msg.className = 'bm-msg' + (cls ? ' ' + cls : '');
      msg.replaceChildren(text ? h('span', null, text) : null, extra);
    }

    function needText() {
      return pos === 'in' ? 'Un mot qui contient' : 'Un mot qui commence par';
    }

    // Lettres imposées du prochain tour (mode Lettres imposées).
    // Mode « de plus en plus » : 1 lettre au début, puis une de plus tous les 2 tours de table (3 au maximum).
    let turnsDone = 0;
    const lenAt = (k) => {
      if (opts.len !== 'prog') return opts.len;
      const first = pos === 'in' ? 2 : 1;
      const per = Math.max(4, 2 * alive().length);
      return Math.min(3, first + Math.floor(k / per));
    };
    function drawLetters() {
      const len = lenAt(turnsDone);
      turnsDone++;
      const s = dico.draw(pos, len, recent);
      recent.push(s);
      if (recent.length > 20) recent.shift();
      return s;
    }

    // ----- Compte à rebours de 3 s entre deux joueurs -----
    function countdownThen(head) {
      state = 'count';
      if (timer) { timer.stop(); timer = null; }
      updatePills();
      tv.set(opts.time * 1000, opts.time * 1000);
      const num = h('div', { class: 'bm-count' });
      const p = who();
      card.replaceChildren(
        head,
        h('div', { class: 'kicker' }, solo ? 'Prépare-toi…' : `Au tour de ${p} !`),
        num,
        chainMode ? h('div', { class: 'sub' }, `Prochain mot : commence par `, h('b', null, up(letters))) : null,
        !chainMode && turnsDone > 0 && lenAt(turnsDone) > lenAt(turnsDone - 1)
          ? h('div', { class: 'bm-levelup' }, `⬆️ Ça se corse : ${lenAt(turnsDone)} lettres maintenant !`) : null);
      if (!chainMode && turnsDone > 0 && lenAt(turnsDone) > lenAt(turnsDone - 1)) sfx.fanfare();
      let n = GAP;
      const step = () => {
        if (state !== 'count') return;
        if (n === 0) { go(); return; }
        num.textContent = String(n);
        num.classList.remove('pop'); void num.offsetWidth; num.classList.add('pop');
        sfx.beep(); buzz(15);
        n--;
        later(step, 1000);
      };
      step();
    }

    // ----- Choix de la première lettre (mode chaîne) -----
    function pickScreen(head = null) {
      state = 'pick';
      if (timer) { timer.stop(); timer = null; }
      letters = '';
      chain = [];
      updatePills();
      renderUsed();
      setMsg('');
      playZone.classList.add('hidden');
      input.blur();
      const choose = (c) => {
        letters = c.toLowerCase();
        playZone.classList.remove('hidden');
        input.value = '';
        input.focus(); // dans le geste de l'utilisateur : ouvre le clavier
        go();
      };
      card.replaceChildren(
        head,
        h('div', { class: 'kicker' }, solo ? 'Choisis la première lettre' : `${who()}, choisis la première lettre`),
        h('div', { class: 'bm-pick' },
          ALPHABET.map((c) => h('button', { class: RARE_START.has(c) ? 'rare' : '', onclick: () => choose(c) }, c)),
          h('button', { class: 'rnd', onclick: () => choose(dico.randomStart()), 'aria-label': 'Lettre au hasard' }, '🎲')));
    }

    // ----- Tour de jeu -----
    function go() {
      state = 'play';
      if (!chainMode) { letters = drawLetters(); input.value = ''; }
      input.classList.toggle('ok', fits(normWord(input.value), letters, pos));
      updatePills();
      setMsg('');
      const last = chain[chain.length - 1];
      card.replaceChildren(
        h('div', { class: 'kicker' }, needText()),
        tiles(letters),
        h('div', { class: 'sub' }, last ? `après « ${last} »` : (letters.length > 1 ? 'Les accents ne comptent pas' : `Au moins ${minLength(letters)} lettres`)));
      sfx.go();
      timer = countdown({
        seconds: opts.time,
        onTick: (l, s, ch) => {
          if (!root.isConnected) { clear(); return; }
          tv.set(l, opts.time * 1000);
          if (ch && s <= 3 && s > 0) sfx.tick();
        },
        onEnd: () => { if (state === 'play') fail('time'); },
      });
    }

    // Mauvais mot : 3 secondes de moins sur le chrono.
    const MALUS = 3;
    function reject(text, word = null) {
      sfx.bad(); buzz([60, 40, 60]);
      if (timer) { timer.add(-MALUS); tv.set(timer.left, opts.time * 1000); }
      text += ` −${MALUS} s ⏱️`;
      tv.el.classList.remove('bm-malus'); void tv.el.offsetWidth; tv.el.classList.add('bm-malus');
      form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
      const acceptBtn = word && h('button', {
        class: 'btn btn-soft btn-sm', type: 'button', onmousedown: keep,
        onclick: () => { if (state === 'play') { input.focus(); accept(word); } },
      }, '👍 Le groupe l\'accepte');
      setMsg(text, 'bad', acceptBtn);
    }

    // Mot connu : dictionnaire (prénoms compris), prénom d'un joueur, ou nom composé (« Jean-Pierre »).
    function known(raw, n) {
      if (dico.has(n) || names.has(n)) return true;
      const parts = raw.split(/[\s'’-]+/).map(normWord).filter(Boolean);
      return parts.length > 1 && parts.every((x) => dico.has(x) || names.has(x));
    }

    function submit() {
      if (state === 'count') { setMsg('Attends le top départ !'); return; }
      if (state !== 'play') return;
      const raw = input.value.trim().replace(/\s+/g, ' ');
      const n = normWord(raw);
      if (!n) return;
      const L = up(letters);
      if (!fits(n, letters, pos)) return reject(`« ${raw} » ${pos === 'in' ? 'ne contient pas' : 'ne commence pas par'} ${L}`);
      if (n.length < minLength(letters)) return reject(`Trop court ! Au moins ${minLength(letters)} lettres.`);
      if (used.has(n)) return reject(`« ${raw} » a déjà été joué !`);
      if (opts.dico && !known(raw, n)) return reject(`« ${raw} » n'est pas dans le dictionnaire.`, raw);
      accept(raw);
    }

    function accept(raw) {
      const n = normWord(raw);
      const p = who();
      const st = stats.get(p);
      if (timer) { timer.stop(); timer = null; }
      used.add(n);
      played.push(raw);
      st.pts++;
      if (n.length > normWord(st.best).length) st.best = raw;
      input.value = '';
      input.classList.remove('ok');
      setMsg('');
      sfx.ok(); buzz(30);
      const head = h('div', { class: 'res' }, `✅ « ${raw} »`, solo ? null : h('span', { class: 'by' }, ` · ${p} +1`));
      if (chainMode) {
        chain.push(raw);
        bestChain = Math.max(bestChain, chain.length);
        const next = dico.chainLetters(n, opts.chain, used);
        letters = next.letters;
        if (next.reduced) setMsg(`Aucun mot ne commence par ${up(n.slice(-opts.chain))} : on garde ${up(letters)}.`);
      }
      renderUsed();
      nextTurn();
      countdownThen(head);
    }

    function fail(kind) {
      state = 'result';
      if (timer) { timer.stop(); timer = null; }
      const p = who();
      const st = stats.get(p);
      st.fails++;
      st.lives--;
      const dead = st.lives <= 0;
      if (dead) out.push(p);
      updatePills();
      sfx.bad(); buzz(dead ? [300, 100, 300, 100, 500] : [200, 80, 200]);
      card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
      const ex = dico.examples(letters, pos, used);
      let chainInfo = null;
      if (chainMode && chain.length) {
        const rec = get('bonmot-record', 0);
        const isRec = chain.length > rec;
        if (isRec) set('bonmot-record', chain.length);
        chainInfo = h('div', { class: 'sub' }, `🔗 Chaîne de ${chain.length} mot${chain.length > 1 ? 's' : ''}${isRec ? ' — nouveau record ! 🏅' : ''}`);
      }
      const head = [
        h('div', { class: 'res' }, '⏰ Temps écoulé !'),
        h('div', { class: 'sub' }, dead
          ? (solo ? '💀 Plus de vies !' : `💀 ${p} est éliminé(e) et prend ${sip(2)} !`)
          : `${solo ? 'Tu perds' : p + ' perd'} une vie (${hearts(st.lives)})${solo ? '' : ' et prend ' + sip(1)}.`),
        ex.length ? h('div', { class: 'bm-ex' }, `Avec ${up(letters)}, il y avait : `, ex.map((w, i) => [i ? ', ' : '', h('b', null, w)])) : null,
        chainInfo,
      ];
      input.value = '';
      input.classList.remove('ok');
      setMsg('');
      if (isOver()) {
        // Partie terminée : il ne reste qu'un joueur (ou plus aucune vie en solo).
        state = 'over';
        updatePills();
        playZone.classList.add('hidden');
        input.blur();
        const winner = alive()[0];
        card.replaceChildren(...head, winner && !solo ? h('div', { class: 'res' }, `🏆 ${winner} gagne la partie !`) : null,
          h('button', { class: 'btn btn-primary', onclick: summary }, '🏁 Voir le classement'));
        return;
      }
      nextTurn();
      if (chainMode) {
        // La chaîne est cassée : le joueur suivant choisit une nouvelle lettre.
        pickScreen(h('div', { class: 'bm-fail' }, head));
        return;
      }
      // On enchaîne directement : compte à rebours pour le joueur suivant, sous le récap de l'échec.
      countdownThen(h('div', { class: 'bm-fail' }, head));
    }

    // ----- Fin de partie -----
    function summary() {
      clear();
      state = 'idle';
      ctx.setGuard(null);
      if (chainMode && chain.length) {
        if (chain.length > get('bonmot-record', 0)) set('bonmot-record', chain.length);
      }
      sfx.fanfare();
      const rows = players.map((p) => ({ name: p, score: stats.get(p).pts, ...stats.get(p) }));
      // Classement : les survivants (plus de vies, puis plus de mots), puis les éliminés du dernier au premier.
      const rank = (r) => (r.lives > 0 ? 1000 + r.lives * 100 + r.pts : out.indexOf(r.name) * 100 + r.pts);
      const ranked = rows.slice().sort((a, b) => rank(b) - rank(a));
      const winner = !solo && ranked[0];
      const longest = rows.filter((r) => r.best).sort((a, b) => normWord(b.best).length - normWord(a.best).length)[0];
      root.replaceChildren(
        topbar(ctx, { onBack: setup }),
        h('div', { class: 'center' }, h('div', { class: 'hero-emo' }, winner ? '🏆' : '🏁'), h('h2', null, winner ? `${winner.name} gagne !` : 'Fin de la partie !')),
        solo
          ? h('p', { class: 'center' }, 'Tu as trouvé ', h('b', null, `${rows[0].pts} mot${rows[0].pts > 1 ? 's' : ''}`), '.')
          : null,
        h('div', { class: 'scoreboard' },
          solo ? null : ranked.map((r, i) => h('div', { class: 'score-row' + (i === 0 ? ' lead' : '') },
            h('span', null, ['🥇', '🥈', '🥉'][i] || `${i + 1}.`),
            h('span', { class: 'n' }, r.name),
            h('span', { class: 'small' }, r.lives > 0 ? '❤️'.repeat(r.lives) : '💀'),
            h('span', { class: 's' }, `${r.pts} mot${r.pts > 1 ? 's' : ''}`))),
          longest ? h('div', { class: 'score-row' }, h('span', { class: 'n' }, '📏 Mot le plus long'), h('b', null, `${longest.best}${solo ? '' : ' · ' + longest.name}`)) : null,
          chainMode ? h('div', { class: 'score-row' }, h('span', { class: 'n' }, '🔗 Plus longue chaîne'), h('b', null, `${bestChain} mot${bestChain > 1 ? 's' : ''} (record : ${get('bonmot-record', 0)})`)) : null),
        h('div', { class: 'grow' }),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-ghost grow', onclick: setup }, '⚙️ Réglages'),
          h('button', { class: 'btn btn-primary grow', onclick: play }, '🔁 Rejouer')));
    }

    // ----- Démarrage -----
    renderUsed();
    if (chainMode) pickScreen();
    else { input.focus(); countdownThen(null); }
  }

  setup();
  return clear;
}
