// Duel de réflexes : deux joueurs face à face sur le même téléphone posé à plat.
import { h, topbar, seg, rand } from '../ui.js';
import { get, set, getPlayers, sip } from '../store.js';
import { sfx, buzz } from '../sfx.js';

export function start(ctx) {
  const { root, meta } = ctx;
  let cleanupArena = null;
  const opts = Object.assign({ mode: 'mix', target: 3 }, get('duel', {}));
  const save = () => set('duel', opts);

  function setup() {
    cleanupArena && cleanupArena();
    const pl = getPlayers();
    const n1 = h('input', { class: 'input', maxlength: '14', value: pl[0] || 'Joueur 1', 'aria-label': 'Joueur 1' });
    const n2 = h('input', { class: 'input', maxlength: '14', value: pl[1] || 'Joueur 2', 'aria-label': 'Joueur 2' });
    root.replaceChildren(
      topbar(ctx),
      h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
      h('div', { class: 'row' },
        h('label', { class: 'field grow' }, '⬆️ Côté haut', n1),
        h('b', { style: { alignSelf: 'flex-end', paddingBottom: '14px' } }, 'VS'),
        h('label', { class: 'field grow' }, '⬇️ Côté bas', n2)),
      h('label', { class: 'field' }, 'Épreuve', seg([{ value: 'reflex', label: '⚡ Réflexe' }, { value: 'tap', label: '👆 Mitraillette' }, { value: 'mix', label: '🔀 Les deux' }], opts.mode, (v) => { opts.mode = v; save(); })),
      h('label', { class: 'field' }, 'Points pour gagner', seg([3, 5, 7].map((v) => ({ value: v, label: String(v) })), opts.target, (v) => { opts.target = v; save(); })),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => arena([n1.value.trim() || 'Joueur 1', n2.value.trim() || 'Joueur 2']) }, '⚔️ Que le duel commence !'));
  }

  function arena(names) {
    const scores = [0, 0];
    let round = 0;
    let handlers = [null, null];
    const timers = [];
    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const halves = [0, 1].map((i) => {
      const name = h('div', { class: 'duel-name' });
      const msg = h('div', { class: 'duel-msg' });
      const sub = h('div', { class: 'duel-sub' });
      const el = h('div', { class: 'duel-half' + (i === 0 ? ' top' : '') }, h('div', { class: 'duel-inner' }, name, msg, sub));
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); handlers[i] && handlers[i](e); });
      return { el, name, msg, sub };
    });
    const close = h('button', { class: 'icon-btn duel-close', 'aria-label': 'Quitter le duel', onclick: () => { teardown(); setup(); } }, '✕');
    const wrap = h('div', { class: 'duel' }, halves[0].el, halves[1].el, close);
    document.body.append(wrap);

    const paint = (bg) => halves.forEach((x) => { x.el.style.background = bg; });
    const say = (i, m, s = '') => { halves[i].msg.textContent = m; halves[i].sub.textContent = s; };
    const both = (m, s = '') => { say(0, m, s); say(1, m, s); };
    const names_ = () => halves.forEach((x, i) => { x.name.textContent = `${names[i]} · ${scores[i]} pt${scores[i] > 1 ? 's' : ''}`; });
    names_();

    function point(winner, text0, text1) {
      handlers = [null, null];
      if (winner >= 0) scores[winner]++;
      names_();
      say(0, text0[0], text0[1]); say(1, text1[0], text1[1]);
      if (winner >= 0) {
        halves[winner].el.style.background = 'var(--ok)';
        halves[1 - winner].el.style.background = 'var(--bad)';
        sfx.ok(); buzz(60);
      }
      if (scores[0] >= opts.target || scores[1] >= opts.target) later(finish, 1600);
      else later(next, 1800);
    }

    function next() {
      const mode = opts.mode === 'mix' ? (round % 2 ? 'tap' : 'reflex') : opts.mode;
      round++;
      if (mode === 'reflex') reflex(); else tapRace();
    }

    function reflex() {
      paint('#7a1630');
      both('Attends le vert…', 'Touche ta moitié dès que l\'écran devient vert');
      let go = false;
      let t0 = 0;
      const early = (i) => { clearTimeout(goTimer); sfx.bad(); buzz([100, 50, 100]); point(1 - i, i === 0 ? ['Trop tôt ! 😬', 'Point pour l\'adversaire'] : ['Il a craqué !', '+1 point'], i === 1 ? ['Trop tôt ! 😬', 'Point pour l\'adversaire'] : ['Il a craqué !', '+1 point']); };
      handlers = [0, 1].map((i) => () => {
        if (!go) { early(i); return; }
        const ms = Math.round(performance.now() - t0);
        const win = [`⚡ ${ms} ms !`, 'Point pour toi'];
        const lose = ['Trop lent…', `${names[i]} a été plus rapide`];
        point(i, i === 0 ? win : lose, i === 1 ? win : lose);
      });
      const goTimer = later(() => {
        go = true;
        t0 = performance.now();
        paint('#11a36a');
        both('TAPE !', '');
        sfx.go();
      }, rand(1600, 4800));
    }

    function tapRace() {
      handlers = [null, null];
      paint('#2b2160');
      const counts = [0, 0];
      let n = 3;
      both('Prépare-toi…', 'Mitraillette : tape le plus vite possible pendant 5 secondes !');
      const tick = () => {
        if (n > 0) { both(String(n), 'Mitraillette !'); sfx.beep(); n--; later(tick, 800); return; }
        both('0', 'TAPE TAPE TAPE !');
        sfx.go();
        paint('#3f2b96');
        handlers = [0, 1].map((i) => () => { counts[i]++; say(i, String(counts[i]), 'TAPE TAPE TAPE !'); if (counts[i] % 5 === 0) sfx.tick(); });
        later(() => {
          handlers = [null, null];
          const w = counts[0] === counts[1] ? -1 : counts[0] > counts[1] ? 0 : 1;
          const t = (i) => (w === -1 ? ['Égalité !', `${counts[i]} tapes chacun`] : w === i ? [`${counts[i]} tapes 💪`, 'Point pour toi'] : [`${counts[i]} tapes`, `${names[1 - i]} en a fait ${counts[1 - i]}`]);
          if (w === -1) { sfx.pop(); handlers = [null, null]; say(0, ...t(0)); say(1, ...t(1)); later(next, 1800); return; }
          point(w, t(0), t(1));
        }, 5000);
      };
      later(tick, 1200);
    }

    function finish() {
      const w = scores[0] > scores[1] ? 0 : 1;
      sfx.fanfare(); buzz([100, 50, 200]);
      halves[w].el.style.background = 'linear-gradient(160deg,#ffd166,#ff9f1c)';
      halves[1 - w].el.style.background = '#3a1020';
      say(w, '🏆 VICTOIRE !', `${scores[w]} à ${scores[1 - w]}`);
      say(1 - w, 'Défaite…', `${names[1 - w]} prend ${sip(2)}`);
      handlers = [null, null];
      halves.forEach((x) => x.el.querySelector('.duel-inner').append(h('button', { class: 'btn btn-primary', style: { marginTop: '10px' }, onclick: (e) => { e.stopPropagation(); teardown(); arena(names); } }, '🔁 Revanche')));
    }

    function teardown() { timers.forEach(clearTimeout); wrap.remove(); cleanupArena = null; }
    cleanupArena = teardown;
    later(next, 600);
  }

  setup();
  return () => cleanupArena && cleanupArena();
}
