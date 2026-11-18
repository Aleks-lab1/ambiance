// Moteur générique des jeux de cartes/questions + Tu préfères, Je n'ai jamais, C'est un 10 mais, Qui de nous.
import { h, topbar, onSwipe, toast } from '../ui.js';
import { get, set, makeDeck, getCustom, setCustom, drinkPl, drinks, getPlayers } from '../store.js';
import { levelPicker } from '../common.js';
import { LEVELS } from '../data/levels.js';
import { playersPanel } from '../players.js';
import { sfx, buzz } from '../sfx.js';

export { LEVELS };

const HOTPP_STYLE = { '--g1': '#b0123f', '--g2': '#1c0614' };
const PERSO = { id: 'perso', name: 'Mes cartes', emoji: '✍️', desc: 'Tes cartes personnalisées.' };

function cardGame(cfg) {
  return {
    start(ctx) {
      const { root, meta } = ctx;
      let data = null;
      let alive = true;
      const levelsAll = () => (getCustom(meta.id).trim() ? [...cfg.levels, PERSO] : cfg.levels);
      const valid = (id) => levelsAll().some((l) => l.id === id);
      let selected = new Set(get('lv:' + meta.id, [cfg.levels[0].id]).filter(valid));
      if (!selected.size) selected.add(cfg.levels[0].id);

      const loading = cfg.data().then((m) => { data = m.default; });

      function customItems() {
        return getCustom(meta.id).split('\n').map((s) => s.trim()).filter(Boolean).map(cfg.parseCustom || ((s) => s)).filter(Boolean);
      }

      function setup() {
        const pickerSlot = h('div');
        const renderPicker = () => pickerSlot.replaceChildren(levelPicker(levelsAll(), selected, (s) => set('lv:' + meta.id, [...s])));
        renderPicker();
        const ta = h('textarea', { class: 'input', placeholder: cfg.customHint || 'Une carte par ligne', value: getCustom(meta.id) });
        const custom = h('details', { class: 'panel' },
          h('summary', null, '✍️ Ajouter mes propres cartes'),
          h('div', { class: 'col' },
            h('p', { class: 'muted small' }, cfg.customHelp || 'Écris une carte par ligne. Elles apparaîtront dans le niveau « Mes cartes ».'),
            ta,
            h('button', {
              class: 'btn btn-soft', onclick: () => {
                setCustom(meta.id, ta.value);
                if (ta.value.trim()) selected.add('perso'); else selected.delete('perso');
                if (!selected.size) selected.add(cfg.levels[0].id);
                set('lv:' + meta.id, [...selected]);
                renderPicker();
                toast(ta.value.trim() ? 'Cartes enregistrées ✅' : 'Cartes perso supprimées');
              },
            }, 'Enregistrer mes cartes')));

        root.replaceChildren(
          topbar(ctx),
          h('div', { class: 'panel rules' }, h('p', { html: meta.rules[0] })),
          h('div', { class: 'col' }, h('div', { class: 'section-title' }, 'Niveaux d\'intensité'), pickerSlot),
          cfg.perPlayer ? playersPanel(0) : null,
          custom,
          h('div', { class: 'grow' }),
          h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => loading.then(play) }, '▶ Jouer sur ce téléphone'),
          cfg.online ? h('button', {
            class: 'btn btn-soft btn-block',
            onclick: () => ctx.open('online', { create: true, game: cfg.online, levels: [...selected].filter((l) => l !== 'perso') }),
          }, '🌐 Jouer en ligne — chacun vote sur son tél') : null,
        );
      }

      function play() {
        if (!alive) return;
        const lvls = levelsAll().filter((l) => selected.has(l.id));
        const items = [];
        for (const l of lvls) {
          const list = l.id === 'perso' ? customItems() : (data[l.id] || []);
          for (const it of list) items.push({ l: l.id, it });
        }
        if (!items.length) { toast('Aucune carte dans ces niveaux'); return; }
        const lvlById = Object.fromEntries(levelsAll().map((l) => [l.id, l]));
        const deck = makeDeck(meta.id + ':' + [...selected].sort().join(','), items);
        const players = cfg.perPlayer ? getPlayers() : [];
        let turn = Math.floor(Math.random() * Math.max(1, players.length));
        const hist = [];
        let idx = -1;
        const area = h('div', { class: 'play-area' });

        function show(entry, anim) {
          const level = lvlById[entry.e.l] || PERSO;
          const card = h('div', { class: 'qcard' + (anim ? ' anim' : ''), style: level.extreme ? HOTPP_STYLE : (cfg.cardStyle ? cfg.cardStyle(level) : null) },
            h('span', { class: 'badge lvl' }, `${level.emoji} ${level.name}`),
            h('span', { class: 'count' }, `#${idx + 1}`),
            entry.player ? h('div', { class: 'who' }, `🎯 ${entry.player}`) : null,
            cfg.kicker ? h('div', { class: 'kicker' }, cfg.kicker) : null,
            cfg.render(entry.e.it, { level }),
            cfg.footer ? h('div', { class: 'foot' }, cfg.footer(entry.e.it, { level })) : null,
          );
          if (cfg.tapToNext !== false) {
            card.addEventListener('click', (ev) => { if (card.dataset.swiped || ev.target.closest('button')) return; next(); });
          }
          onSwipe(card, { left: next, right: prev });
          area.replaceChildren(card, nav);
        }
        function next() {
          if (idx < hist.length - 1) { idx++; show(hist[idx], true); sfx.swoosh(); return; }
          const e = deck.next();
          const entry = { e, player: players.length ? players[turn++ % players.length] : null };
          hist.push(entry);
          idx = hist.length - 1;
          show(entry, true);
          sfx.swoosh();
        }
        function prev() { if (idx > 0) { idx--; show(hist[idx], true); } }

        const nav = h('div', { class: 'card-nav' },
          h('button', { class: 'btn btn-soft', 'aria-label': 'Carte précédente', onclick: prev }, '←'),
          h('button', { class: 'btn btn-primary', onclick: next }, 'Carte suivante →'));

        root.replaceChildren(
          topbar(ctx, { onBack: setup, right: h('button', { class: 'icon-btn', 'aria-label': 'Niveaux', onclick: setup }, '🎚️') }),
          area);
        next();
      }

      setup();
      return () => { alive = false; };
    },
  };
}

// ---------------- Tu préfères ----------------
export const tupreferes = cardGame({
  levels: LEVELS.tupreferes,
  data: () => import('../data/tupreferes.js'),
  online: 'vote-tp',
  perPlayer: true,
  tapToNext: false,
  kicker: 'Tu préfères…',
  customHelp: 'Une carte par ligne, avec les deux choix séparés par « / ». Exemple : Vivre sans musique / Vivre sans fromage',
  customHint: 'Avoir des bras de T-rex / Avoir des jambes de flamant rose',
  parseCustom: (s) => {
    const parts = s.split(/\s*\/\s*|\s+ou\s+/i).filter(Boolean);
    return parts.length >= 2 ? [parts[0], parts.slice(1).join(' / ')] : null;
  },
  render: (it) => {
    const a = h('button', { class: 'tp-opt' }, it[0]);
    const b = h('button', { class: 'tp-opt' }, it[1]);
    const sel = (x, y) => { x.classList.add('sel'); x.classList.remove('dim'); y.classList.add('dim'); y.classList.remove('sel'); sfx.pop(); buzz(15); };
    a.onclick = () => sel(a, b);
    b.onclick = () => sel(b, a);
    return h('div', { class: 'tp' }, a, h('div', { class: 'tp-or' }, 'OU'), b);
  },
  footer: () => `Votez tous en même temps ! La minorité ${drinks(1)}.`,
});

// ---------------- Je n'ai jamais ----------------
export const jamais = cardGame({
  levels: LEVELS.jamais,
  data: () => import('../data/jamais.js'),
  kicker: 'Je n\'ai jamais…',
  customHelp: 'Une carte par ligne, sans « Je n\'ai jamais ». Exemple : dormi dans une baignoire',
  customHint: 'dormi dans une baignoire',
  parseCustom: (s) => s.replace(/^je n.?ai jamais\s*/i, ''),
  render: (it) => h('div', { class: 'big' }, it),
  footer: () => `Ceux qui l'ont déjà fait ${drinkPl(1)} 🍹`,
});

// ---------------- C'est un 10 mais ----------------
export const dix = cardGame({
  levels: LEVELS.dix,
  data: () => import('../data/dix.js'),
  online: 'vote-dix',
  kicker: 'C\'est un 10 mais…',
  customHelp: 'Une carte par ligne, sans « C\'est un 10 mais ». Exemple : ronfle comme un tracteur',
  customHint: 'ronfle comme un tracteur',
  parseCustom: (s) => s.replace(/^c.?est un 10 mais\s*/i, ''),
  render: (it) => h('div', { class: 'big' }, it),
  footer: () => 'Chacun annonce sa nouvelle note sur 10… et se justifie !',
});

// ---------------- Qui de nous ----------------
export const qui = cardGame({
  levels: LEVELS.qui,
  data: () => import('../data/qui.js'),
  online: 'vote-qui',
  kicker: 'Qui de nous est le plus susceptible de…',
  customHelp: 'Une carte par ligne. Exemple : finir en prison',
  customHint: 'finir en prison',
  parseCustom: (s) => s.replace(/^qui (de nous )?(est le plus susceptible de|pourrait)\s*/i, ''),
  render: (it) => {
    const big = h('div', { class: 'big' }, it);
    const out = h('div', { class: 'foot' });
    const btn = h('button', {
      class: 'btn btn-soft', style: { alignSelf: 'center', background: 'rgba(0,0,0,.25)' },
      onclick: () => {
        btn.disabled = true;
        let n = 3;
        const step = () => {
          if (n > 0) { btn.textContent = String(n); sfx.beep(); n--; setTimeout(step, 750); }
          else { btn.textContent = '👉 POINTEZ !'; sfx.go(); buzz([60, 40, 60]); out.textContent = `Le plus désigné ${drinks(1)} par doigt pointé sur lui !`; }
        };
        step();
      },
    }, '3, 2, 1… Pointez !');
    return h('div', { class: 'col', style: { alignItems: 'center' } }, big, btn, out);
  },
});
