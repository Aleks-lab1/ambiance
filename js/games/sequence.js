// La Séquence : retenir une suite de couleurs qui s'allonge à chaque tour.
import { h, topbar, randInt } from '../ui.js';
import { get, set, getPlayers, sip } from '../store.js';
import { playersPanel } from '../players.js';
import { sfx, buzz } from '../sfx.js';

const PADS = [
  { c: '#ff4d6d', f: 329.63, n: 'rouge' },
  { c: '#22d39a', f: 261.63, n: 'vert' },
  { c: '#2ec5ff', f: 392.0, n: 'bleu' },
  { c: '#ffd23f', f: 523.25, n: 'jaune' },
];

export function start(ctx) {
  const { root, meta } = ctx;
  let timers = [];
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const clear = () => { timers.forEach(clearTimeout); timers = []; };

  function setup() {
    clear();
    root.replaceChildren(
      topbar(ctx),
      h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
      playersPanel(0),
      h('p', { class: 'center muted' }, `🏅 Record : ${get('seq-record', 0)} couleurs`),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: play }, '▶ Commencer'));
  }

  function play() {
    clear();
    const players = getPlayers();
    let turn = 0;
    let seq = [randInt(0, 3)];
    let pos = 0;
    let input = false;
    const top = topbar(ctx, { onBack: setup });
    const status = h('h2', { class: 'center' });
    const sub = h('p', { class: 'center muted' });
    const pads = PADS.map((p, i) => {
      const b = h('button', { class: 'seq-pad', style: { '--c': p.c }, 'aria-label': p.n });
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); press(i); });
      return b;
    });
    const grid = h('div', { class: 'seq-grid' }, pads);
    const startBtn = h('button', { class: 'btn btn-primary btn-big btn-block' });
    const count = h('div', { class: 'seq-count', 'aria-live': 'assertive' });
    root.replaceChildren(top, status, sub, h('div', { class: 'seq-wrap' }, grid, count), h('div', { class: 'grow' }), startBtn);

    const who = () => (players.length ? players[turn % players.length] : 'Toi');
    const len = () => `${seq.length} couleur${seq.length > 1 ? 's' : ''}`;
    const light = (i, ms = 320) => {
      pads[i].classList.add('lit');
      sfx.note(PADS[i].f, ms / 1000);
      later(() => pads[i].classList.remove('lit'), ms);
    };

    // Un seul « Je suis prêt » au tout début de la partie…
    function intro() {
      input = false;
      status.textContent = players.length ? `Au tour de ${who()}` : 'Prêt(e) ?';
      sub.textContent = `Suite de ${len()}. Regarde bien…`;
      startBtn.textContent = '👀 Je suis prêt(e)';
      startBtn.classList.remove('hidden');
      startBtn.onclick = showSeq;
    }

    // … puis un compte à rebours de 3 secondes avant chaque nouvelle suite.
    function countdownThen(fn) {
      input = false;
      startBtn.classList.add('hidden');
      status.textContent = players.length ? `Au tour de ${who()} !` : 'Prépare-toi…';
      sub.textContent = `Suite de ${len()}`;
      pads.forEach((b) => b.classList.remove('lit'));
      grid.classList.add('dim');
      let n = 3;
      const step = () => {
        if (n === 0) {
          count.textContent = '';
          grid.classList.remove('dim');
          fn();
          return;
        }
        count.textContent = String(n);
        count.classList.remove('pop'); void count.offsetWidth; count.classList.add('pop');
        sfx.beep(); buzz(15);
        n--;
        later(step, 1000);
      };
      step();
    }

    function showSeq() {
      startBtn.classList.add('hidden');
      input = false;
      status.textContent = 'Regarde bien…';
      sub.textContent = '';
      const step = Math.max(260, 620 - seq.length * 22);
      seq.forEach((c, k) => later(() => light(c, step * 0.7), 450 + k * step));
      later(() => { input = true; pos = 0; status.textContent = 'À toi !'; sub.textContent = `Reproduis la suite (${seq.length})`; sfx.go(); }, 450 + seq.length * step + 150);
    }

    function press(i) {
      if (!input) return;
      light(i, 220);
      buzz(10);
      if (i !== seq[pos]) { fail(); return; }
      pos++;
      if (pos === seq.length) {
        input = false;
        const rec = get('seq-record', 0);
        if (seq.length > rec) set('seq-record', seq.length);
        sfx.ok();
        status.textContent = '✅ Parfait !';
        sub.textContent = `Suite de ${seq.length} réussie${seq.length > rec ? ' — nouveau record ! 🏅' : ''}`;
        seq.push(randInt(0, 3));
        turn++;
        later(() => countdownThen(showSeq), 1100);
      }
    }

    function fail() {
      input = false;
      sfx.bad(); buzz([200, 80, 200]);
      grid.classList.add('shake');
      later(() => grid.classList.remove('shake'), 500);
      status.textContent = '❌ Raté !';
      sub.textContent = `La suite faisait ${len()}. ${players.length ? who() + ' prend ' + sip(1) + '.' : ''}`;
      // Montre la bonne réponse
      seq.forEach((c, k) => later(() => light(c, 200), 700 + k * 260));
      startBtn.textContent = '🔁 On repart de zéro';
      startBtn.classList.remove('hidden');
      startBtn.onclick = () => { clear(); seq = [randInt(0, 3)]; turn++; countdownThen(showSeq); };
    }

    intro();
  }

  setup();
  return clear;
}
