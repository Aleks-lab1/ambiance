// Moteur générique des jeux de cartes/questions + Tu préfères, Je n'ai jamais, C'est un 10 mais, Qui de nous.
import { h, topbar, onSwipe, toast } from '../ui.js';
import { get, set, makeDeck, getCustom, setCustom, drinkPl, drinks, getPlayers, sip } from '../store.js';
import { levelPicker } from '../common.js';
import { LEVELS } from '../data/levels.js';
import { playersPanel } from '../players.js';
import { sfx, buzz } from '../sfx.js';

export { LEVELS };

const HOTPP_STYLE = { '--g1': '#b0123f', '--g2': '#1c0614' };
const PERSO = { id: 'perso', name: 'Mes cartes', emoji: '✍️', desc: 'Tes cartes personnalisées.' };

export function cardGame(cfg) {
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
          }, cfg.onlineLabel || '🌐 Jouer en ligne — chacun vote sur son tél') : null,
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
        const stack = h('div', { class: 'card-stack' });
        const hint = h('p', { class: 'tap-hint' }, '👆 Touche la carte pour passer à la suivante');
        const prevBtn = h('button', { class: 'btn btn-ghost btn-sm', 'aria-label': 'Carte précédente', disabled: true, onclick: () => prev() }, '↩️ Précédente');
        const area = h('div', { class: 'play-area' }, stack, h('div', { class: 'card-foot' }, prevBtn, hint));
        let current = null;

        function show(entry, dir) {
          const level = lvlById[entry.e.l] || PERSO;
          const it = entry.e.it;
          const kicker = typeof cfg.kicker === 'function' ? cfg.kicker(it) : cfg.kicker;
          const card = h('div', {
            class: 'qcard in-' + dir, role: 'button', tabindex: '0', 'aria-label': 'Carte suivante',
            style: level.extreme ? HOTPP_STYLE : (cfg.cardStyle ? cfg.cardStyle(level, it) : null),
          },
            h('span', { class: 'badge lvl' }, `${level.emoji} ${level.name}`),
            h('span', { class: 'count' }, `#${idx + 1}`),
            entry.player ? h('div', { class: 'who' }, `🎯 ${entry.player}`) : null,
            kicker ? h('div', { class: 'kicker' }, kicker) : null,
            cfg.render(it, { level }),
            cfg.footer ? h('div', { class: 'foot' }, cfg.footer(it, { level })) : null,
          );
          card.addEventListener('click', (ev) => { if (card.dataset.swiped || ev.target.closest('button')) return; next(); });
          card.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); next(); } });
          onSwipe(card, { left: next, right: prev });
          if (current) {
            const old = current;
            old.className = 'qcard out-' + (dir === 'prev' ? 'prev' : 'next');
            old.removeAttribute('tabindex');
            setTimeout(() => old.remove(), 420);
          }
          stack.append(card);
          current = card;
          if (idx >= 1) hint.classList.add('gone');
          prevBtn.disabled = idx <= 0;
        }
        function next() {
          if (idx < hist.length - 1) { idx++; show(hist[idx], 'next'); sfx.swoosh(); buzz(10); return; }
          const e = deck.next();
          const entry = { e, player: players.length ? players[turn++ % players.length] : null };
          hist.push(entry);
          idx = hist.length - 1;
          show(entry, hist.length === 1 ? 'first' : 'next');
          if (hist.length > 1) { sfx.swoosh(); buzz(10); }
        }
        function prev() { if (idx > 0) { idx--; show(hist[idx], 'prev'); sfx.swoosh(); } }

        root.replaceChildren(
          topbar(ctx, {
            onBack: setup,
            right: h('button', { class: 'icon-btn', 'aria-label': 'Niveaux', onclick: setup }, '🎚️'),
          }),
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
  kicker: 'Tu préfères…',
  customHelp: 'Une carte par ligne, avec les deux choix séparés par « / ». Exemple : Vivre sans musique / Vivre sans fromage',
  customHint: 'Avoir des bras de T-rex / Avoir des jambes de flamant rose',
  parseCustom: (s) => {
    const parts = s.split(/\s*\/\s*|\s+ou\s+/i).filter(Boolean);
    return parts.length >= 2 ? [parts[0], parts.slice(1).join(' / ')] : null;
  },
  render: (it) => h('div', { class: 'tp' }, h('div', { class: 'tp-opt' }, it[0]), h('div', { class: 'tp-or' }, 'OU'), h('div', { class: 'tp-opt' }, it[1])),
  footer: () => `Votez tous en même temps ! La minorité ${drinks(1)}.`,
});

// ---------------- Je n'ai jamais ----------------
export const jamais = cardGame({
  levels: LEVELS.jamais,
  data: () => import('../data/jamais.js'),
  online: 'vote-jamais',
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
  // Une carte est soit un texte (« C'est un 10 mais… » + défaut),
  // soit { n, t } (« C'est un 4 mais… » + qualité qui peut faire remonter la note).
  kicker: (it) => `C'est un ${typeof it === 'object' ? it.n : 10} mais…`,
  cardStyle: (level, it) => (typeof it === 'object' ? { '--g1': '#11998e', '--g2': '#2ec5ff' } : null),
  customHelp: 'Une carte par ligne. « C\'est un 10 mais ronfle » pour un défaut, ou « C\'est un 3 mais a un jet privé » pour une qualité qui fait remonter la note.',
  customHint: 'ronfle comme un tracteur\nC\'est un 3 mais a un jet privé',
  parseCustom: (s) => {
    const m = s.match(/^c.?est un (\d{1,2}) mais\s*(.+)$/i);
    if (!m) return s;
    const n = Math.max(0, Math.min(10, Number(m[1])));
    return n === 10 ? m[2] : { n, t: m[2] };
  },
  render: (it) => h('div', { class: 'big' }, typeof it === 'object' ? it.t : it),
  footer: (it) => (typeof it === 'object' ? 'Ça fait remonter la note ? Chacun annonce sa nouvelle note sur 10 !' : 'Chacun annonce sa nouvelle note sur 10… et se justifie !'),
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

// ---------------- Opinions impopulaires ----------------
export const opinions = cardGame({
  levels: LEVELS.opinions,
  data: () => import('../data/opinions.js'),
  online: 'vote-op',
  kicker: 'Opinion impopulaire…',
  customHelp: 'Une opinion par ligne. Exemple : Le lundi est le meilleur jour de la semaine.',
  customHint: 'Le lundi est le meilleur jour de la semaine.',
  render: (it) => h('div', { class: 'big' }, `« ${it} »`),
  footer: () => `À 3 : pouce en l'air (d'accord) ou en bas (pas d'accord) ! La minorité se justifie et ${drinkPl(1)}.`,
});

// ---------------- Et si… ? ----------------
export const etsi = cardGame({
  levels: LEVELS.etsi,
  data: () => import('../data/etsi.js'),
  online: 'etsi',
  onlineLabel: '🌐 Jouer en ligne — la carte s\'affiche sur tous les téléphones',
  perPlayer: true,
  kicker: 'Et si…',
  customHelp: 'Une situation par ligne, sans « Et si ». Exemple : tu devenais un chat pendant une journée ?',
  customHint: 'tu devenais un chat pendant une journée ?',
  parseCustom: (s) => s.replace(/^et si\s*/i, ''),
  render: (it) => h('div', { class: 'big' }, it),
  footer: () => 'Chacun répond à tour de rôle. La réponse la plus folle gagne !',
});

// ---------------- Confidences ----------------
export const confidences = cardGame({
  levels: LEVELS.confidences,
  data: () => import('../data/confidences.js'),
  online: 'confidences',
  onlineLabel: '🌐 Jouer en ligne — la carte s\'affiche sur tous les téléphones',
  perPlayer: true,
  kicker: '💬 Confidence',
  customHelp: 'Une question par ligne.',
  customHint: 'Quel est ton plus beau souvenir de vacances ?',
  render: (it) => h('div', { class: 'big' }, it),
  footer: () => 'Réponds honnêtement… puis les autres peuvent répondre à leur tour.',
});

// ---------------- Deux vérités, un mensonge ----------------
export const deuxverites = cardGame({
  levels: [
    { id: 'soft', name: 'Classique', emoji: '🙂', desc: 'Des thèmes pour tout le monde.' },
    { id: 'hot', name: 'Hot', emoji: '🔥', desc: 'Vie amoureuse et coquine, réservé aux adultes.', adult: true },
  ],
  data: () => import('../data/deuxverites.js'),
  online: 'deuxverites',
  perPlayer: true,
  kicker: 'Deux vérités, un mensonge…',
  customHelp: 'Un thème par ligne. Exemple : sur ton premier appartement',
  customHint: 'sur ton premier appartement',
  render: (it) => h('div', { class: 'big' }, `Raconte trois anecdotes ${it}`),
  footer: () => `Deux vraies, une inventée. À 3, tout le monde désigne le mensonge ! Ceux qui se trompent ${drinkPl(1)}.`,
});

// ---------------- Cap ou pas cap ? ----------------
export const cap = cardGame({
  levels: LEVELS.cap,
  data: () => import('../data/cap.js'),
  online: 'cap',
  onlineLabel: '🌐 Jouer en ligne — la carte s\'affiche sur tous les téléphones',
  perPlayer: true,
  kicker: '🎯 Cap ou pas cap ?',
  customHelp: 'Un défi par ligne. Exemple : Cap de chanter sous la douche… tout habillé ?',
  customHint: 'Cap de parler en rimes jusqu\'à ton prochain tour ?',
  render: (it) => h('div', { class: 'big' }, it),
  footer: () => `Cap ? Fais-le ! Pas cap ? ${sip(2)} pour toi !`,
});

// ---------------- À l'unisson ----------------
export const unisson = cardGame({
  levels: [
    { id: 'fun', name: 'Classique', emoji: '🤝', desc: 'Des thèmes pour tout le monde.' },
    { id: 'hot', name: 'Hot', emoji: '🔥', desc: 'Amour et séduction, réservé aux adultes.', adult: true },
  ],
  data: () => import('../data/unisson.js'),
  online: 'unisson',
  kicker: 'Pensez tous pareil…',
  customHelp: 'Un thème par ligne. Exemple : Un fruit jaune',
  customHint: 'Un fruit jaune',
  render: (it) => {
    const big = h('div', { class: 'big' }, it);
    const out = h('div', { class: 'foot' });
    const btn = h('button', {
      class: 'btn btn-soft', style: { alignSelf: 'center', background: 'rgba(0,0,0,.25)' },
      onclick: () => {
        btn.disabled = true;
        let n = 3;
        const step = () => {
          if (n > 0) { btn.textContent = String(n); sfx.beep(); n--; setTimeout(step, 800); }
          else { btn.textContent = '🗣️ DITES-LE !'; sfx.go(); buzz([60, 40, 60]); out.textContent = `Ceux qui ont dit la même chose que la majorité marquent 1 point. Les moutons noirs ${drinkPl(1)} !`; }
        };
        step();
      },
    }, '3, 2, 1… Tous ensemble !');
    return h('div', { class: 'col', style: { alignItems: 'center' } }, big, btn, out);
  },
});
