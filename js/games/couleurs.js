// Couleurs pièges : touche la couleur de l'ENCRE, pas celle du mot écrit.
import { h, topbar, seg, countdown, timerView } from '../ui.js';
import { get, set, getPlayers, sip } from '../store.js';
import { playersPanel } from '../players.js';
import { podium } from '../common.js';
import { sfx, buzz } from '../sfx.js';

const COLORS = [
  { id: 'rouge', name: 'ROUGE', c: '#ff3b4f' },
  { id: 'bleu', name: 'BLEU', c: '#2f7bff' },
  { id: 'vert', name: 'VERT', c: '#1fd17a' },
  { id: 'jaune', name: 'JAUNE', c: '#ffd21f' },
  { id: 'violet', name: 'VIOLET', c: '#a855f7' },
  { id: 'orange', name: 'ORANGE', c: '#ff8a1f' },
];
const rnd = (n) => Math.floor(Math.random() * n);

export function start(ctx) {
  const { root, meta } = ctx;
  const opts = Object.assign({ time: 30, level: 'normal' }, get('couleurs', {}));
  const save = () => set('couleurs', opts);
  let timer = null;
  let timers = [];
  const clear = () => { timer && timer.stop(); timers.forEach(clearTimeout); timers = []; };

  function setup() {
    clear();
    root.replaceChildren(topbar(ctx),
      h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
      playersPanel(0),
      h('label', { class: 'field' }, 'Difficulté', seg([
        { value: 'normal', label: '🙂 Normal' }, { value: 'piege', label: '😈 Piège' },
      ], opts.level, (v) => { opts.level = v; save(); })),
      h('p', { class: 'muted small' }, opts.level === 'piege' ? 'Piège : les boutons portent aussi des noms de couleurs… écrits dans d\'autres couleurs.' : 'Normal : 4 couleurs, les boutons sont de la bonne couleur.'),
      h('label', { class: 'field' }, 'Durée d\'une manche', seg([20, 30, 45].map((v) => ({ value: v, label: v + ' s' })), opts.time, (v) => { opts.time = v; save(); })),
      h('p', { class: 'center muted' }, `🏅 Record : ${get('couleurs-record', 0)} points`),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => series(getPlayers()) }, '🎨 Jouer'));
  }

  // Chaque joueur fait une manche à tour de rôle, puis classement.
  function series(players) {
    const list = players.length ? players : ['Toi'];
    const scores = {};
    let i = 0;
    const nextPlayer = () => {
      if (i >= list.length) { results(list, scores); return; }
      const p = list[i];
      ready(p, () => round(p, (sc) => { scores[p] = sc; i++; nextPlayer(); }));
    };
    nextPlayer();
  }

  function ready(p, go) {
    clear();
    const num = h('div', { class: 'countdown-num' }, '');
    root.replaceChildren(topbar(ctx, { onBack: setup }), h('div', { class: 'big-center' },
      h('h2', null, p === 'Toi' ? 'Prêt(e) ?' : `Au tour de ${p} !`),
      h('p', { class: 'muted' }, 'Touche la couleur de l\'ENCRE, pas le mot écrit.'), num,
      h('button', {
        class: 'btn btn-primary btn-big', onclick: (e) => {
          e.target.remove();
          let n = 3;
          const step = () => { if (n === 0) { go(); return; } num.textContent = String(n); num.style.animation = 'none'; void num.offsetWidth; num.style.animation = ''; sfx.beep(); n--; timers.push(setTimeout(step, 800)); };
          step();
        },
      }, '👀 Je suis prêt(e)')));
  }

  function round(p, done) {
    clear();
    const pal = opts.level === 'piege' ? COLORS : COLORS.slice(0, 4);
    let score = 0, streak = 0, frozen = false, target = null;
    const tv = timerView(opts.time);
    const scoreEl = h('span', { class: 'pill' }, '⭐ 0');
    const word = h('div', { class: 'stroop-word' });
    const btns = h('div', { class: 'stroop-btns' + (pal.length > 4 ? ' six' : '') });
    root.replaceChildren(topbar(ctx, { onBack: setup }),
      h('div', { class: 'row' }, h('span', { class: 'pill' }, p === 'Toi' ? '🎨' : '🎨 ' + p), h('div', { class: 'grow' }), scoreEl),
      tv.el, word, btns);

    function next() {
      // Le mot et l'encre sont (presque toujours) différents.
      const w = pal[rnd(pal.length)];
      let ink = pal[rnd(pal.length)];
      if (Math.random() < 0.85) while (ink.id === w.id) ink = pal[rnd(pal.length)];
      target = ink.id;
      word.textContent = w.name;
      word.style.color = ink.c;
      word.classList.remove('pop'); void word.offsetWidth; word.classList.add('pop');
      const order = pal.slice().sort(() => Math.random() - 0.5);
      btns.replaceChildren(...order.map((c) => {
        const label = opts.level === 'piege' ? pal[rnd(pal.length)] : null;
        const b = h('button', {
          class: 'stroop-btn' + (label ? ' piege' : ''),
          style: { '--c': c.c, color: label ? label.c : null },
          'aria-label': c.name.toLowerCase(),
        }, label ? h('span', null, label.name) : null);
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(c.id, b); });
        return b;
      }));
    }

    function tap(id, b) {
      if (frozen) return;
      if (id === target) {
        streak++;
        score += streak >= 5 ? 2 : 1;
        sfx.pop(); buzz(8);
        next();
      } else {
        streak = 0;
        score = Math.max(0, score - 1);
        sfx.bad(); buzz([80, 40, 80]);
        b.classList.add('wrong');
        frozen = true; // petite pénalité de temps
        timers.push(setTimeout(() => { frozen = false; next(); }, 600));
      }
      scoreEl.textContent = `⭐ ${score}${streak >= 5 ? ' 🔥' : ''}`;
    }

    next();
    sfx.go();
    timer = countdown({
      seconds: opts.time,
      onTick: (l, s, ch) => { if (!root.isConnected) { clear(); return; } tv.set(l, opts.time * 1000); if (ch && s <= 3 && s > 0) sfx.tick(); },
      onEnd: () => {
        frozen = true;
        sfx.end(); buzz(200);
        const rec = get('couleurs-record', 0);
        if (score > rec) set('couleurs-record', score);
        root.replaceChildren(topbar(ctx, { onBack: setup }), h('div', { class: 'big-center' },
          h('div', { class: 'hero-emo' }, '⏰'), h('h2', null, `${score} point${score > 1 ? 's' : ''}`),
          score > rec ? h('p', null, '🏅 Nouveau record !') : null,
          h('button', { class: 'btn btn-primary btn-big', onclick: () => done(score) }, 'Continuer →')));
      },
    });
  }

  function results(list, scores) {
    clear();
    sfx.fanfare();
    const rows = list.map((p) => ({ name: p, score: scores[p] || 0 }));
    const last = rows.slice().sort((a, b) => a.score - b.score)[0];
    root.replaceChildren(topbar(ctx, { onBack: setup }),
      h('div', { class: 'center' }, h('div', { class: 'hero-emo' }, '🏆'), h('h2', null, 'Résultats')),
      list.length > 1 ? podium(rows) : h('p', { class: 'center' }, `Score : ${rows[0].score}`),
      list.length > 1 ? h('p', { class: 'center muted' }, `${last.name} a le plus petit score et prend ${sip(2)} !`) : null,
      h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => series(getPlayers()) }, '🔁 Rejouer'),
      h('button', { class: 'btn btn-soft btn-block', onclick: setup }, 'Réglages'));
  }

  setup();
  return clear;
}
