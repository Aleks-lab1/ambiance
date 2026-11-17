// Boîte à outils : dés, pile ou face, équipes, chrono, compteur de points.
import { h, topbar, seg, shuffle, randInt, countdown, timerView, stepper, toast } from '../ui.js';
import { get, set, getPlayers } from '../store.js';
import { editPlayers } from '../players.js';
import { TEAM_COLORS } from '../common.js';
import { sfx, buzz } from '../sfx.js';

// Position des points (grille 3×3) pour chaque face.
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const die = (v) => h('div', { class: 'die roll', 'aria-label': String(v) }, Array.from({ length: 9 }, (_, i) => h('i', { class: PIPS[v].includes(i) ? 'on' : '' })));

export function start(ctx) {
  const { root } = ctx;
  let tab = get('outils-tab', 'des');
  let cleanupTab = null;
  const body = h('div', { class: 'col grow' });
  const tabs = h('div');

  function renderTabs() {
    tabs.replaceChildren(seg([
      { value: 'des', label: '🎲 Dés' }, { value: 'piece', label: '🪙 Pièce' }, { value: 'equipes', label: '👥 Équipes' }, { value: 'chrono', label: '⏱ Chrono' }, { value: 'scores', label: '🔢 Points' },
    ], tab, (v) => { tab = v; set('outils-tab', v); show(); }));
  }

  function show() {
    cleanupTab && cleanupTab();
    cleanupTab = null;
    body.replaceChildren();
    ({ des, piece, equipes, chrono, scores })[tab]();
  }

  function des() {
    let n = get('dice-n', 2);
    const row = h('div', { class: 'dice-row' });
    const total = h('h2', { class: 'center' });
    const roll = () => {
      const vals = Array.from({ length: n }, () => randInt(1, 6));
      row.replaceChildren(...vals.map(die));
      total.textContent = n > 1 ? `Total : ${vals.reduce((a, b) => a + b, 0)}` : '';
      sfx.pop(); buzz(30);
    };
    body.append(
      h('div', { class: 'spread' }, h('b', null, 'Nombre de dés'), stepper(n, 1, 6, (v) => { n = v; set('dice-n', v); roll(); })),
      h('div', { class: 'big-center' }, row, total),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: roll }, '🎲 Lancer'));
    roll();
  }

  function piece() {
    const coin = h('div', { class: 'coin' }, '?');
    let busy = false;
    const flip = () => {
      if (busy) return;
      busy = true;
      coin.classList.remove('spin'); void coin.offsetWidth; coin.classList.add('spin');
      coin.textContent = '';
      sfx.swoosh();
      setTimeout(() => { coin.textContent = Math.random() < 0.5 ? 'PILE' : 'FACE'; sfx.ok(); buzz(40); busy = false; }, 1000);
    };
    body.append(h('div', { class: 'big-center' }, coin), h('button', { class: 'btn btn-primary btn-big btn-block', onclick: flip }, '🪙 Lancer la pièce'));
  }

  function equipes() {
    let n = get('teams-n', 2);
    const out = h('div', { class: 'col' });
    const make = async () => {
      let pl = getPlayers();
      if (pl.length < n) { toast('Ajoute d\'abord les joueurs'); pl = await editPlayers(); if (pl.length < n) return; }
      const sh = shuffle(pl.slice());
      const teams = Array.from({ length: n }, () => []);
      sh.forEach((p, i) => teams[i % n].push(p));
      out.replaceChildren(...teams.map((t, i) => h('div', { class: 'panel' }, h('h3', { style: { color: TEAM_COLORS[i] } }, `Équipe ${i + 1}`), h('p', null, t.join(', ')))));
      sfx.pop();
    };
    body.append(
      h('div', { class: 'spread' }, h('b', null, 'Nombre d\'équipes'), stepper(n, 2, 6, (v) => { n = v; set('teams-n', v); })),
      out,
      h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: make }, '🎲 Former les équipes'));
  }

  function chrono() {
    let secs = get('chrono-s', 60);
    let t = null;
    const tv = timerView(secs);
    tv.set(secs * 1000, secs * 1000);
    const big = h('div', { class: 'letter-big', style: { fontSize: '96px', fontVariantNumeric: 'tabular-nums' } }, fmt(secs * 1000));
    const startBtn = h('button', { class: 'btn btn-primary btn-big grow' }, '▶ Démarrer');
    function fmt(ms) { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
    function reset() { t && t.stop(); t = null; big.textContent = fmt(secs * 1000); tv.set(secs * 1000, secs * 1000); startBtn.textContent = '▶ Démarrer'; }
    startBtn.onclick = () => {
      if (!t) {
        t = countdown({
          seconds: secs,
          onTick: (l, s, ch) => { big.textContent = fmt(l); tv.set(l, secs * 1000); if (ch && s <= 5 && s > 0) sfx.tick(); },
          onEnd: () => { sfx.fanfare(); buzz([300, 100, 300, 100, 300]); startBtn.textContent = '▶ Démarrer'; t = null; },
        });
        startBtn.textContent = '⏸ Pause';
      } else if (t.paused) { t.resume(); startBtn.textContent = '⏸ Pause'; } else { t.pause(); startBtn.textContent = '▶ Reprendre'; }
    };
    body.append(
      seg([30, 60, 120, 180, 300, 600].map((v) => ({ value: v, label: v < 60 ? v + 's' : v / 60 + 'min' })), secs, (v) => { secs = v; set('chrono-s', v); reset(); }),
      h('div', { class: 'big-center' }, big, h('div', { style: { width: '100%' } }, tv.el)),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-soft', onclick: reset }, '↺'), startBtn));
    cleanupTab = () => t && t.stop();
  }

  function scores() {
    let data = get('counter', null);
    if (!data || !Array.isArray(data)) data = (getPlayers().length ? getPlayers() : ['Joueur 1', 'Joueur 2']).map((n) => ({ n, s: 0 }));
    const save = () => set('counter', data);
    const list = h('div', { class: 'scoreboard' });
    function render() {
      const max = Math.max(...data.map((d) => d.s));
      list.replaceChildren(...data.map((d) => h('div', { class: 'score-row' + (d.s === max && max > 0 ? ' lead' : '') },
        h('span', { class: 'n' }, d.n),
        h('button', { class: 'icon-btn', 'aria-label': 'Moins', onclick: () => { d.s--; save(); render(); sfx.tock(); } }, '−'),
        h('span', { class: 's', style: { minWidth: '2.5ch', textAlign: 'center' } }, String(d.s)),
        h('button', { class: 'icon-btn', 'aria-label': 'Plus', onclick: () => { d.s++; save(); render(); sfx.tick(); } }, '+'))));
    }
    render();
    body.append(list,
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-soft grow', onclick: () => { data.forEach((d) => { d.s = 0; }); save(); render(); } }, '↺ Remettre à zéro'),
        h('button', { class: 'btn btn-soft grow', onclick: () => { const pl = getPlayers(); if (!pl.length) { toast('Aucun joueur dans la liste'); return; } data = pl.map((n) => ({ n, s: data.find((d) => d.n === n)?.s || 0 })); save(); render(); } }, '👥 Reprendre les joueurs')));
  }

  root.replaceChildren(topbar(ctx), tabs, body);
  renderTabs();
  show();
  return () => cleanupTab && cleanupTab();
}
