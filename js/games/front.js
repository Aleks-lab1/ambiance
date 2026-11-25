// Sur le front : téléphone sur le front, on incline pour valider ou passer.
import { h, topbar, seg, shuffle, countdown, setText } from '../ui.js';
import { onlineBanner } from '../common.js';
import { get, set, makeDeck } from '../store.js';
import { sfx, buzz } from '../sfx.js';

export function start(ctx) {
  const { root, meta } = ctx;
  let alive = true;
  let cleanupPlay = null;
  const opts = Object.assign({ time: 60 }, get('front', {}));
  const dataP = import('../data/front.js').then((m) => m.default);

  async function setup() {
    cleanupPlay && cleanupPlay();
    const cats = await dataP;
    if (!alive) return;
    root.replaceChildren(
      topbar(ctx),
      onlineBanner(ctx, 'front', { text: 'Ton mot s\'affiche sur le téléphone des autres, pas sur le tien : plus besoin de le poser sur ton front !' }),
      h('div', { class: 'section-title' }, 'Ou sur un seul téléphone'),
      h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
      h('label', { class: 'field' }, 'Durée', seg([45, 60, 90].map((v) => ({ value: v, label: v + ' s' })), opts.time, (v) => { opts.time = v; set('front', opts); })),
      h('div', { class: 'section-title' }, 'Choisis une catégorie'),
      h('div', { class: 'game-pick' }, cats.map((c) => h('button', { onclick: () => play(c) },
        h('span', { class: 'emo' }, c.emoji), h('span', { class: 'nm' }, c.name), h('span', { class: 'muted tiny' }, `${c.words.length} mots`)))),
      h('button', { class: 'btn btn-soft btn-block', onclick: () => play({ id: 'mix', name: 'Grand mélange', emoji: '🎲', words: cats.flatMap((c) => c.words) }) }, '🎲 Grand mélange'));
  }

  async function play(cat) {
    // Autorisation des capteurs (iOS) — doit être demandée sur un geste.
    let sensors = 'DeviceOrientationEvent' in window;
    try {
      if (sensors && typeof DeviceOrientationEvent.requestPermission === 'function') {
        sensors = (await DeviceOrientationEvent.requestPermission()) === 'granted';
      }
    } catch { sensors = false; }
    try { await document.documentElement.requestFullscreen?.(); } catch { /* */ }
    try { await screen.orientation?.lock?.('landscape'); } catch { /* */ }

    const deck = makeDeck('front:' + cat.id, cat.words);
    const results = [];
    let word = null;
    let state = 'wait';  // wait | play | cooldown | done
    let armed = false;
    let t = null;
    const wordEl = h('div', { class: 'word' });
    const timeEl = h('div', { class: 't' });
    const sub = h('div', { style: { fontWeight: '800', opacity: '.85' } });
    const flip = h('button', { class: 'icon-btn exit', 'aria-label': 'Quitter', onclick: () => finish() }, '✕');
    const center = h('div', { class: 'center' }, wordEl, sub);
    const help = h('div', { class: 'help' }, h('span', null, '⬅ Passer'), h('span', null, 'Trouvé ➡'));
    const el = h('div', { class: 'front-play' },
      h('button', { class: 'zone', 'aria-label': 'Passer', onclick: () => answer('pass') }),
      h('button', { class: 'zone', 'aria-label': 'Trouvé', onclick: () => answer('ok') }),
      timeEl, center, help, flip);
    document.body.append(el);
    const portrait = () => window.innerHeight > window.innerWidth;
    // Si l'écran ne pivote pas (verrouillage portrait), on fait tourner le texte nous-mêmes.
    const fit = () => {
      const p = portrait();
      Object.assign(center.style, p
        ? { inset: 'auto', left: '50%', top: '50%', width: window.innerHeight + 'px', height: window.innerWidth + 'px', transform: 'translate(-50%, -50%) rotate(90deg)' }
        : { inset: '0', left: '', top: '', width: '', height: '', transform: '' });
    };
    fit();
    window.addEventListener('resize', fit);

    function onOrient(e) {
      if (e.gamma == null) return;
      const g = Math.abs(e.gamma);
      const b = Math.abs(e.beta);
      if (g > 62) { armed = true; return; }
      if (!armed || state !== 'play') return;
      if (g < 32) { armed = false; answer(b > 90 ? 'ok' : 'pass'); }
    }
    if (sensors) window.addEventListener('deviceorientation', onOrient);

    // Compte à rebours de départ
    wordEl.textContent = 'Place le téléphone sur ton front';
    sub.textContent = sensors ? 'Penche vers le bas = trouvé · vers le haut = passer' : 'Touche à droite = trouvé · à gauche = passer';
    let n = 3;
    const pre = setInterval(() => {
      if (!el.isConnected) { clearInterval(pre); return; }
      if (n > 0) { timeEl.textContent = String(n); sfx.beep(); n--; return; }
      clearInterval(pre);
      sfx.go();
      state = 'play';
      armed = true;
      nextWord();
      t = countdown({
        seconds: opts.time,
        onTick: (l, s, ch) => { timeEl.textContent = String(s); if (ch && s <= 5 && s > 0) sfx.tick(); },
        onEnd: () => { sfx.bad(); buzz([300, 100, 300]); finish(); },
      });
    }, 900);

    function nextWord() {
      word = deck.next();
      wordEl.textContent = word;
      sub.textContent = '';
      el.classList.remove('flash-ok', 'flash-pass');
    }

    function answer(r) {
      if (state !== 'play') return;
      results.push({ w: word, r });
      state = 'cooldown';
      el.classList.add(r === 'ok' ? 'flash-ok' : 'flash-pass');
      setText(wordEl, r === 'ok' ? '✅ Trouvé !' : '⏭ Passé');
      r === 'ok' ? sfx.ok() : sfx.swoosh();
      buzz(r === 'ok' ? 40 : [20, 30, 20]);
      setTimeout(() => { if (state === 'cooldown') { state = 'play'; nextWord(); } }, 700);
    }

    function teardown() {
      clearInterval(pre);
      t && t.stop();
      window.removeEventListener('deviceorientation', onOrient);
      window.removeEventListener('resize', fit);
      el.remove();
      try { screen.orientation?.unlock?.(); } catch { /* */ }
      try { if (document.fullscreenElement) document.exitFullscreen(); } catch { /* */ }
    }
    cleanupPlay = teardown;

    function finish() {
      if (state === 'done') return;
      state = 'done';
      teardown();
      cleanupPlay = null;
      if (!alive) return;
      const score = results.filter((x) => x.r === 'ok').length;
      sfx.end();
      root.replaceChildren(
        topbar(ctx, { onBack: setup }),
        h('div', { class: 'center col' }, h('div', { class: 'hero-emo' }, score >= 10 ? '🏆' : score >= 5 ? '🎉' : '😅'), h('h2', null, `${score} mot${score > 1 ? 's' : ''} trouvé${score > 1 ? 's' : ''} !`), h('p', { class: 'muted' }, `${cat.emoji} ${cat.name}`)),
        h('div', { class: 'result-list' }, results.map((x) => h('div', { class: 'result-item' + (x.r === 'ok' ? '' : ' pass') }, h('span', { class: 't' }, x.w), h('span', { class: 'r' }, x.r === 'ok' ? '✅' : '⏭️')))),
        h('div', { class: 'grow' }),
        h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => play(cat) }, '🔁 Rejouer (joueur suivant)'),
        h('button', { class: 'btn btn-soft btn-block', onclick: setup }, 'Changer de catégorie'));
    }
  }

  setup();
  return () => { alive = false; cleanupPlay && cleanupPlay(); };
}
