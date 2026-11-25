// Le Pendu : devinez le mot lettre par lettre avant que le dessin soit complet.
import { h, topbar, seg, pick, toast, setText } from '../ui.js';
import { onlineBanner } from '../common.js';
import { get, set, sip, getPlayers } from '../store.js';
import { playersPanel } from '../players.js';
import { sfx, buzz } from '../sfx.js';
import { loadDico, normWord } from '../bonmot-core.js';

export const MAX = 7; // nombre d'erreurs autorisées (étapes du dessin)
export const KEYS = 'AZERTYUIOPQSDFGHJKLMWXCVBN'.split('');

export function start(ctx) {
  const { root, meta } = ctx;
  const opts = Object.assign({ mode: 'hasard', len: 'moyen' }, get('pendu', {}));
  const save = () => set('pendu', opts);
  let dico = null;
  const recent = [];
  let onKey = null;
  const unbind = () => { if (onKey) document.removeEventListener('keydown', onKey); onKey = null; };

  function setup() {
    unbind();
    const btn = h('button', { class: 'btn btn-primary btn-big btn-block', disabled: true }, '⏳ Chargement des mots…');
    root.replaceChildren(topbar(ctx),
      onlineBanner(ctx, 'pendu', { text: 'Chacun propose ses lettres sur son téléphone, à tour de rôle. Les points sont comptés automatiquement.' }),
      h('div', { class: 'section-title' }, 'Ou sur un seul téléphone'),
      h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
      h('label', { class: 'field' }, 'Le mot', seg([
        { value: 'hasard', label: '🎲 Au hasard' }, { value: 'secret', label: '🤫 Un joueur choisit' },
      ], opts.mode, (v) => { opts.mode = v; save(); })),
      h('label', { class: 'field' }, 'Longueur (mot au hasard)', seg([
        { value: 'court', label: 'Court' }, { value: 'moyen', label: 'Moyen' }, { value: 'long', label: 'Long' },
      ], opts.len, (v) => { opts.len = v; save(); })),
      playersPanel(0),
      h('p', { class: 'muted small' }, 'Avec une liste de joueurs, chacun propose une lettre à son tour.'),
      h('div', { class: 'grow' }), btn);
    loadDico().then((d) => { dico = d; btn.disabled = false; setText(btn, '🪢 Jouer'); btn.onclick = () => (opts.mode === 'secret' ? secret() : play(randomWord())); })
      .catch(() => { setText(btn, '😵 Impossible de charger les mots'); });
  }

  function randomWord() {
    const [a, b] = opts.len === 'court' ? [4, 6] : opts.len === 'long' ? [9, 13] : [6, 9];
    const list = dico.playable(a, b).slice(60, 5000).filter((x) => !recent.includes(x.n));
    const w = pick(list.length ? list : dico.playable(a, b)).w;
    recent.push(normWord(w)); if (recent.length > 40) recent.shift();
    return w;
  }

  function secret() {
    unbind();
    const input = h('input', { class: 'input code-input', type: 'password', placeholder: 'Le mot secret', maxlength: '20', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', style: { letterSpacing: '.15em', textTransform: 'none' } });
    const go = () => {
      const w = input.value.trim();
      const n = normWord(w);
      if (n.length < 3 || !/^[\p{L}' -]+$/u.test(w)) { toast('Un mot d\'au moins 3 lettres, sans chiffres'); return; }
      if (!dico.has(n)) toast('Mot inconnu du dictionnaire… mais on joue quand même !');
      input.blur();
      play(w);
    };
    root.replaceChildren(topbar(ctx, { onBack: setup }), h('div', { class: 'big-center' },
      h('div', { class: 'hero-emo' }, '🤫'), h('h2', null, 'Choisis le mot en secret'),
      h('p', { class: 'muted' }, 'Les autres ne regardent pas ! Ensuite, passe le téléphone.'),
      h('form', { class: 'col', style: { width: '100%' }, onsubmit: (e) => { e.preventDefault(); go(); } }, input,
        h('button', { class: 'btn btn-primary btn-big btn-block', type: 'submit' }, 'C\'est parti !'))));
    setTimeout(() => input.focus(), 50);
  }

  function play(word) {
    unbind();
    const target = normWord(word); // lettres à trouver (sans accents)
    const shown = word.toUpperCase();
    const players = getPlayers();
    let turn = 0;
    const tried = new Set();
    const shownIdx = new Set(); // lettres déjà affichées (les nouvelles apparaissent en sautant)
    let errors = 0;
    let over = false;
    const svg = h('div', { class: 'pendu-svg', html: drawing(0) });
    const slots = h('div', { class: 'pendu-word' });
    const status = h('p', { class: 'center' });
    const kb = h('div', { class: 'kb' });
    const keys = {};
    KEYS.forEach((k) => { keys[k] = h('button', { class: 'kb-key', onclick: () => guess(k) }, k); });
    kb.append(...KEYS.map((k) => keys[k]));
    const after = h('div', { class: 'col' });
    root.replaceChildren(topbar(ctx, { onBack: setup }), svg, slots, status, kb, after);

    function render() {
      // Lettres du mot (avec accents) : visibles si leur version sans accent a été trouvée.
      slots.replaceChildren(...[...shown].map((ch, i) => {
        const base = normWord(ch);
        if (!base) return h('span', { class: 'sp' }, ch === ' ' ? ' ' : ch);
        const found = [...base].every((c) => tried.has(c.toUpperCase())); // « œ » = O + E
        const show = found || over;
        const el = h('span', { class: 'ltr' + (over && !found ? ' miss' : '') + (show && !shownIdx.has(i) ? ' pop-in' : '') }, show ? ch : '');
        if (show) shownIdx.add(i);
        return el;
      }));
      const p = players.length ? players[turn % players.length] : null;
      if (!over) setText(status, `${p ? `À ${p} de proposer une lettre · ` : ''}❤️ ${MAX - errors} erreur${MAX - errors > 1 ? 's' : ''} restante${MAX - errors > 1 ? 's' : ''}`);
    }

    function guess(k) {
      if (over || tried.has(k)) return;
      tried.add(k);
      const good = target.includes(k.toLowerCase());
      keys[k].classList.add(good ? 'good' : 'bad');
      keys[k].disabled = true;
      if (good) { sfx.ok(); buzz(15); } else { errors++; sfx.bad(); buzz([80, 40, 80]); svg.innerHTML = drawing(errors, true); svg.classList.remove('oops'); void svg.offsetWidth; svg.classList.add('oops'); turn++; }
      const won = [...new Set(target)].every((c) => tried.has(c.toUpperCase()));
      if (won || errors >= MAX) end(won);
      render();
    }

    function end(won) {
      over = true;
      unbind();
      const p = players.length ? players[(turn) % players.length] : null;
      if (won) { sfx.fanfare(); buzz([40, 30, 40, 30, 120]); } else { sfx.boom(); buzz([300, 100, 300]); }
      status.innerHTML = '';
      status.append(won
        ? h('b', null, `🎉 Bravo ! ${p ? `${p} a trouvé la dernière lettre.` : ''}`)
        : h('b', null, `💀 Pendu ! ${p ? `${p} prend ${sip(2)}.` : `Tout le monde prend ${sip(1)}.`}`));
      after.replaceChildren(h('div', { class: 'row' },
        h('button', { class: 'btn btn-soft grow', onclick: setup }, 'Réglages'),
        h('button', { class: 'btn btn-primary grow', onclick: () => (opts.mode === 'secret' ? secret() : play(randomWord())) }, '🔁 Nouveau mot')));
      kb.classList.add('done');
    }

    onKey = (e) => { const k = (e.key || '').toUpperCase(); if (k.length === 1 && keys[k]) guess(k); };
    document.addEventListener('keydown', onKey);
    render();
  }

  setup();
  return unbind;
}

// Dessin du pendu, étape par étape (0 à 7). anim : la dernière partie ajoutée se trace comme au crayon.
export function drawing(n, anim = false) {
  const parts = [
    '<path d="M10 115 H70 M30 115 V10 H80 V22" />',
    '<path d="M80 22 a10 10 0 1 1 0 20 a10 10 0 1 1 0 -20" />',
    '<path d="M80 42 V72" />',
    '<path d="M80 50 L66 62" />',
    '<path d="M80 50 L94 62" />',
    '<path d="M80 72 L68 92" />',
    '<path d="M80 72 L92 92" />',
    '<path d="M75 29 l3 3 m0 -3 l-3 3 M82 29 l3 3 m0 -3 l-3 3 M75 37 q5 -3 10 0" />',
  ];
  const k = Math.min(parts.length, n + 1);
  const shown = parts.slice(0, k).map((p, i) => (anim && i === k - 1 && n > 0 ? p.replace('<path ', '<path class="new" pathLength="1" ') : p));
  return `<svg viewBox="0 0 120 120" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-label="Erreurs : ${n}">${shown.join('')}</svg>`;
}
