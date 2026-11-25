// La Bouteille : on fait tourner la bouteille au milieu du cercle des joueurs, elle désigne quelqu'un.
import { h, topbar, seg, pick, setText } from '../ui.js';
import { get, set, sip } from '../store.js';
import { requirePlayers, playersPanel } from '../players.js';
import { ensureAdult, onlineBanner, spinTicks } from '../common.js';
import { sfx, buzz } from '../sfx.js';

// {a} = celui qui a fait tourner la bouteille, {b} = celui qu'elle désigne.
export const DEFIS = {
  soft: [
    '{a} fait un compliment sincère à {b}.', '{a} et {b} échangent un accessoire jusqu\'au prochain tour.', '{b} pose une question à {a}, qui doit répondre honnêtement.',
    '{a} imite {b} pendant 20 secondes.', '{a} et {b} font un concours de regard : le premier qui rit prend {sip}.', '{b} choisit une chanson que {a} doit fredonner.',
    '{a} et {b} trinquent et boivent à la santé du groupe.', '{a} raconte son meilleur souvenir avec {b}.', '{a} et {b} font un pierre-feuille-ciseaux : le perdant prend {sip}.',
    '{b} donne un surnom à {a} pour toute la soirée.', '{a} et {b} se font un check inventé sur le moment.', '{a} doit deviner le plat préféré de {b}. Raté ? {sip} !',
    '{a} dit trois qualités de {b}.', '{b} invente un gage pour {a}.', '{a} et {b} chantent un refrain en duo.', '{a} et {b} échangent de place.',
    '{a} doit faire rire {b} en moins de 30 secondes.', '{b} pose une devinette à {a}.', '{a} et {b} miment un film ensemble, les autres devinent.',
    '{a} se met à genoux et demande {b} en amitié éternelle.',
    // Lot 2
    '{a} et {b} inventent ensemble une chanson de 4 vers.', '{b} raconte à {a} son meilleur souvenir d\'enfance.', '{a} et {b} font un bras de fer : le perdant prend {sip}.',
    '{a} doit faire deviner un film à {b} en mimant.', '{a} et {b} échangent leurs prénoms jusqu\'au prochain tour.', '{b} choisit un accent que {a} garde jusqu\'au prochain tour.',
    '{a} fait un portrait de {b} en 30 secondes.', '{a} et {b} se racontent une blague : celui qui rit en premier prend {sip}.', '{a} dit ce qu\'il ou elle admire chez {b}.',
    '{a} et {b} font un pierre-feuille-ciseaux en 3 manches : le perdant fait un gage choisi par le groupe.', '{b} pose trois questions à {a}, qui doit répondre en une seconde.', '{a} doit imiter la façon de rire de {b}.',
    '{a} et {b} dansent sur la prochaine chanson.', '{a} offre son verre à {b}… ou en sert un.', '{a} et {b} se tiennent par le petit doigt jusqu\'au prochain tour.',
    '{b} donne à {a} un nouveau prénom de super-héros.', '{a} raconte comment il ou elle a rencontré {b}.', '{a} et {b} font un selfie avec la grimace la plus moche possible.',
    '{a} chuchote un secret (pas trop grave) à {b}.', '{a} doit faire un compliment à {b} en alexandrin.',
  ],
  fun: [
    '{a} fait un massage des mains de 30 secondes à {b}.', '{a} et {b} dansent un slow sur la chanson choisie par le groupe.', '{b} écrit un message que {a} doit envoyer à son 5e contact.',
    '{a} et {b} échangent leur téléphone pendant 1 minute.', '{a} raconte sa première impression de {b}.', '{b} choisit qui {a} doit appeler en haut-parleur.',
    '{a} donne à manger à {b}, les yeux bandés.', '{a} et {b} font un selfie ridicule et le mettent en story.', '{a} et {b} se tiennent la main jusqu\'au prochain tour.',
    '{a} chante une sérénade à {b}.', '{b} peut poser n\'importe quelle question à {a}. Refus = {sip2}.', '{a} fait une déclaration d\'amour théâtrale à {b}.',
    '{a} et {b} boivent leur prochain verre bras dessus bras dessous.', '{a} et {b} échangent un vêtement jusqu\'à la fin de la partie.', '{a} se laisse coiffer par {b}.',
    '{b} imite {a} draguant quelqu\'un.', '{a} dit qui, selon lui ou elle, pourrait sortir avec {b} dans le groupe.', '{a} et {b} font un câlin de 10 secondes.',
    // Lot 2
    '{a} et {b} échangent leur téléphone pour lire leurs 3 derniers messages.', '{b} choisit une photo de la galerie de {a} à montrer au groupe.', '{a} fait une déclaration d\'amour à {b} façon telenovela.',
    '{a} et {b} doivent rester dos à dos, bras liés, jusqu\'au prochain tour.', '{b} dessine un truc sur la main de {a}.', '{a} et {b} rejouent la scène de « Titanic » sur une chaise.',
    '{a} fait manger un aliment surprise à {b}, qui a les yeux fermés.', '{a} et {b} s\'échangent une chaussure jusqu\'à la fin de la partie.', '{b} coiffe {a} comme il ou elle veut.',
    '{a} et {b} font une chorégraphie de 20 secondes devant tout le monde.', '{a} envoie un message à un ami de {b}, dicté par {b}.', '{a} et {b} jouent un couple qui se dispute pour une raison absurde.',
    '{b} choisit ce que {a} va boire au prochain verre.', '{a} et {b} font un concours de grimaces, le groupe vote.', '{a} porte {b} sur son dos (ou essaie) pendant 10 secondes.',
  ],
  hot: [
    '{a} fait un bisou sur la joue de {b}.', '{a} fait un bisou dans le cou de {b}.', '{a} murmure quelque chose de sexy à l\'oreille de {b}.',
    '{a} et {b} s\'embrassent (bisou, ou plus si les deux sont d\'accord).', '{a} fait un massage des épaules de 30 secondes à {b}.', '{b} s\'assoit sur les genoux de {a} jusqu\'au prochain tour.',
    '{a} et {b} se regardent dans les yeux 20 secondes sans rire. Le premier qui craque prend {sip2}.', '{a} dit ce qu\'il ou elle trouve le plus attirant chez {b}.',
    '{a} et {b} passent un glaçon de bouche en bouche.', '{b} choisit où {a} doit lui faire un bisou.', '{a} fait un slow très collé-serré avec {b}.',
    '{a} et {b} échangent un vêtement… que vous portez en ce moment.', '{a} mordille l\'oreille de {b}.', '{a} et {b} vont 1 minute seuls dans une autre pièce.',
    // Lot 2
    '{a} fait un massage des mains de 30 secondes à {b}, les yeux dans les yeux.', '{a} et {b} se regardent dans les yeux et se rapprochent jusqu\'à ce que l\'un craque.', '{a} embrasse {b} sur la joue, très lentement.',
    '{b} décrit à {a} son rendez-vous idéal, à voix basse.', '{a} et {b} dansent un slow en se tenant par la taille.', '{a} fait un compliment très osé à {b}.',
    '{a} et {b} se murmurent leur fantasme à l\'oreille.', '{b} enlève un accessoire de {a} (bijou, montre, veste…).',
  ],
};
const LEVELS = [
  { value: 'soft', label: '😇 Tranquille' },
  { value: 'fun', label: '🤪 Délire' },
  { value: 'hot', label: '🔥 Hot' },
];

export function start(ctx) {
  const { root, meta } = ctx;
  const opts = Object.assign({ level: 'soft' }, get('bouteille', {}));
  let timers = [];
  const clear = () => { timers.forEach(clearTimeout); timers = []; };

  function setup() {
    clear();
    root.replaceChildren(
      topbar(ctx),
      onlineBanner(ctx, 'bouteille', { text: 'La bouteille tourne sur tous les téléphones en même temps, et c\'est la personne désignée qui la relance.' }),
      h('div', { class: 'section-title' }, 'Ou sur un seul téléphone'),
      h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
      playersPanel(2),
      h('label', { class: 'field' }, 'Défis', seg(LEVELS, opts.level, async (v) => {
        if (v === 'hot' && !(await ensureAdult())) { setup(); return; }
        opts.level = v; set('bouteille', opts);
      })),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: async () => { const p = await requirePlayers(2); if (p) play(p); } }, '🍾 Faire tourner la bouteille'));
  }

  function play(players) {
    clear();
    const n = players.length;
    let spinner = Math.floor(Math.random() * n);
    let angle = 0;
    let spinning = false;
    const ring = h('div', { class: 'bt-ring' });
    const names = players.map((p, i) => {
      const a = (i / n) * 2 * Math.PI;
      const el = h('div', { class: 'bt-name', style: { left: `${50 + 42 * Math.sin(a)}%`, top: `${50 - 42 * Math.cos(a)}%` } }, p);
      ring.append(el);
      return el;
    });
    const bottle = h('div', { class: 'bt-bottle', role: 'button', 'aria-label': 'Faire tourner la bouteille', html: BOTTLE_SVG });
    ring.append(bottle);
    const status = h('h2', { class: 'center' });
    const result = h('div', { class: 'col' });
    const btn = h('button', { class: 'btn btn-primary btn-big btn-block' }, '🍾 Tourner !');
    root.replaceChildren(topbar(ctx, { onBack: setup }), status, ring, result, h('div', { class: 'grow' }), btn);

    function idle() {
      names.forEach((el, i) => { el.classList.toggle('cur', i === spinner); el.classList.remove('hit'); });
      status.textContent = `${players[spinner]}, fais tourner !`;
      btn.disabled = false;
      setText(btn, '🍾 Tourner !');
    }

    function spin() {
      if (spinning) return;
      spinning = true;
      btn.disabled = true;
      result.replaceChildren();
      sfx.swoosh(); buzz(20);
      // La bouteille désigne un autre joueur au hasard (jamais celui qui tourne).
      let target = Math.floor(Math.random() * (n - 1));
      if (target >= spinner) target++;
      const slice = 360 / n;
      const want = target * slice + (Math.random() - 0.5) * slice * 0.5;
      const cur = ((angle % 360) + 360) % 360;
      angle += 360 * (4 + Math.floor(Math.random() * 3)) + ((want - cur + 360) % 360);
      bottle.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
      // Un tic chaque fois que le goulot passe devant quelqu'un, dont le prénom s'allume un instant.
      const stop = spinTicks(bottle, n, { ms: 3700, onTick: (k) => { const el = names[k]; if (el) { el.classList.remove('pass'); void el.offsetWidth; el.classList.add('pass'); } } });
      timers.push(setTimeout(() => { stop(); done(target); }, 3700));
    }

    function done(target) {
      spinning = false;
      const a = players[spinner], b = players[target];
      names[target].classList.add('hit');
      sfx.ok(); buzz([40, 30, 80]);
      const txt = pick(DEFIS[opts.level] || DEFIS.soft).replace(/\{a\}/g, a).replace(/\{b\}/g, b).replace(/\{sip2\}/g, sip(2)).replace(/\{sip\}/g, sip(1));
      setText(status, `🍾 ${b} !`);
      result.replaceChildren(h('div', { class: 'qcard anim', style: { minHeight: '0', padding: '18px' } },
        h('div', { class: 'kicker' }, `${a} → ${b}`), h('div', { class: 'big', style: { fontSize: 'clamp(20px,5.6vw,26px)' } }, txt),
        h('div', { class: 'foot' }, `Refus ? ${sip(2)} !`)));
      spinner = target; // c'est la personne désignée qui fait tourner ensuite
      btn.disabled = false;
      setText(btn, `🍾 À ${b} de faire tourner`);
      btn.onclick = () => { idle(); spin(); };
    }

    bottle.addEventListener('click', () => { if (!spinning) { idle(); spin(); } });
    btn.onclick = spin;
    idle();
  }

  setup();
  return clear;
}

export const BOTTLE_SVG = `<svg viewBox="0 0 40 120" width="100%" height="100%" aria-hidden="true">
  <defs><linearGradient id="btg" x1="0" x2="1"><stop offset="0" stop-color="#1f7a3a"/><stop offset=".45" stop-color="#3fc46b"/><stop offset="1" stop-color="#145a2a"/></linearGradient></defs>
  <rect x="15" y="2" width="10" height="8" rx="2" fill="#d4a017"/>
  <path d="M15 10 h10 v22 c0 6 11 10 11 22 v56 a8 8 0 0 1 -8 8 h-16 a8 8 0 0 1 -8 -8 v-56 c0 -12 11 -16 11 -22z" fill="url(#btg)" stroke="rgba(0,0,0,.25)"/>
  <rect x="8" y="62" width="24" height="26" rx="3" fill="#f6eedd"/>
  <text x="20" y="79" font-size="9" text-anchor="middle" fill="#7a1f3d" font-weight="900" font-family="sans-serif">🍾</text>
  <path d="M10 60 q-2 20 0 44" stroke="rgba(255,255,255,.35)" stroke-width="2" fill="none"/>
</svg>`;
