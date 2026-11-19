// Le Mot mystère : trouve le mot en 6 essais. Vert = bien placée, jaune = mal placée, gris = absente.
import { h, topbar, seg, pick, toast } from '../ui.js';
import { get, set, sip, getPlayers } from '../store.js';
import { playersPanel } from '../players.js';
import { sfx, buzz } from '../sfx.js';
import { loadDico, normWord } from '../bonmot-core.js';

const TRIES = 6;
const ROWS = ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'];

/** Couleur de chaque lettre d'un essai (gère les lettres en double). */
export function score(guess, target) {
  const res = Array(guess.length).fill('absent');
  const left = {};
  for (let i = 0; i < target.length; i++) {
    if (guess[i] === target[i]) res[i] = 'good';
    else left[target[i]] = (left[target[i]] || 0) + 1;
  }
  for (let i = 0; i < guess.length; i++) {
    if (res[i] === 'good') continue;
    if (left[guess[i]] > 0) { res[i] = 'near'; left[guess[i]]--; }
  }
  return res;
}

export function start(ctx) {
  const { root, meta } = ctx;
  const opts = Object.assign({ len: 5 }, get('motmystere', {}));
  let dico = null;
  let onKey = null;
  const recent = [];
  const unbind = () => { if (onKey) document.removeEventListener('keydown', onKey); onKey = null; };

  function setup() {
    unbind();
    const btn = h('button', { class: 'btn btn-primary btn-big btn-block', disabled: true }, '⏳ Chargement des mots…');
    root.replaceChildren(topbar(ctx),
      h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
      h('label', { class: 'field' }, 'Longueur du mot', seg([5, 6, 7].map((v) => ({ value: v, label: `${v} lettres` })), opts.len, (v) => { opts.len = v; set('motmystere', opts); })),
      playersPanel(0),
      h('p', { class: 'muted small' }, 'Avec une liste de joueurs, chacun propose un mot à son tour : celui qui trouve gagne !'),
      h('p', { class: 'center muted' }, `🏅 Mots trouvés : ${get('mm-wins', 0)} · série : ${get('mm-streak', 0)}`),
      h('div', { class: 'grow' }), btn);
    loadDico().then((d) => { dico = d; btn.disabled = false; btn.textContent = '🟩 Jouer'; btn.onclick = play; })
      .catch(() => { btn.textContent = '😵 Impossible de charger les mots'; });
  }

  function newTarget() {
    const n = opts.len;
    const list = dico.playable(n, n).slice(n === 5 ? 80 : 50, n === 5 ? 1800 : 2600).filter((x) => !recent.includes(x.n));
    const w = pick(list.length ? list : dico.playable(n, n));
    recent.push(w.n); if (recent.length > 50) recent.shift();
    return w;
  }

  function play() {
    unbind();
    const T = newTarget();
    const target = T.n;
    const n = target.length;
    const players = getPlayers();
    let turn = 0;
    let row = 0;
    let cur = '';
    let over = false;
    const keyState = {};
    const grid = h('div', { class: 'mm-grid', style: { '--n': n } });
    const cells = [];
    for (let r = 0; r < TRIES; r++) {
      const line = [];
      const rowEl = h('div', { class: 'mm-row' });
      for (let c = 0; c < n; c++) { const t = h('div', { class: 'mm-cell' }); line.push(t); rowEl.append(t); }
      cells.push({ el: rowEl, line });
      grid.append(rowEl);
    }
    const status = h('p', { class: 'center' });
    const keys = {};
    const kb = h('div', { class: 'kb mm-kb' }, ROWS.map((r, i) => h('div', { class: 'kb-row' },
      i === 2 ? h('button', { class: 'kb-key wide', onclick: enter }, 'OK') : null,
      [...r].map((k) => (keys[k] = h('button', { class: 'kb-key', onclick: () => type(k) }, k))),
      i === 2 ? h('button', { class: 'kb-key wide', 'aria-label': 'Effacer', onclick: back }, '⌫') : null)));
    const after = h('div', { class: 'col' });
    root.replaceChildren(topbar(ctx, { onBack: setup }), status, grid, kb, after);

    const who = () => (players.length ? players[turn % players.length] : null);
    function info() {
      if (over) return;
      const p = who();
      status.textContent = `${p ? `À ${p} · ` : ''}Essai ${row + 1}/${TRIES}`;
    }
    function draw() {
      cells[row].line.forEach((t, i) => { t.textContent = (cur[i] || '').toUpperCase(); t.classList.toggle('filled', !!cur[i]); });
    }
    function type(k) { if (over || cur.length >= n) return; cur += k.toLowerCase(); sfx.tick(); draw(); }
    function back() { if (over || !cur) return; cur = cur.slice(0, -1); draw(); }
    function shake(msg) {
      toast(msg, 1500);
      cells[row].el.classList.remove('shake'); void cells[row].el.offsetWidth; cells[row].el.classList.add('shake');
      sfx.bad(); buzz([60, 40, 60]);
    }
    function enter() {
      if (over) return;
      if (cur.length < n) { shake(`Il faut ${n} lettres`); return; }
      if (!dico.has(cur)) { shake('Mot inconnu du dictionnaire'); return; }
      const res = score(cur, target);
      const rank = { absent: 0, near: 1, good: 2 };
      cells[row].line.forEach((t, i) => {
        setTimeout(() => t.classList.add('flip', res[i]), i * 160);
      });
      [...cur].forEach((ch, i) => {
        const K = ch.toUpperCase();
        if (!keyState[K] || rank[res[i]] > rank[keyState[K]]) keyState[K] = res[i];
      });
      const guess = cur;
      setTimeout(() => {
        Object.entries(keyState).forEach(([K, st]) => { if (keys[K]) { keys[K].classList.remove('good', 'near', 'absent'); keys[K].classList.add(st); } });
      }, n * 160);
      if (guess === target) return end(true);
      row++;
      cur = '';
      turn++;
      sfx.pop();
      if (row >= TRIES) return end(false);
      info();
    }
    function end(won) {
      over = true;
      unbind();
      const p = who();
      setTimeout(() => {
        if (!root.isConnected) return;
        if (won) {
          sfx.fanfare(); buzz([40, 30, 40, 30, 120]);
          set('mm-wins', get('mm-wins', 0) + 1); set('mm-streak', get('mm-streak', 0) + 1);
          status.replaceChildren(h('b', null, `🎉 Trouvé en ${row + 1} essai${row ? 's' : ''} ! ${p ? `Bravo ${p}, distribue ${sip(row < 3 ? 3 : 2)}.` : ''}`));
        } else {
          sfx.bad(); buzz([300, 100, 300]);
          set('mm-streak', 0);
          status.replaceChildren(h('b', null, `💀 Le mot était « ${T.w.toUpperCase()} ». ${players.length ? `Tout le monde prend ${sip(1)} !` : ''}`));
        }
        after.replaceChildren(h('div', { class: 'row' },
          h('button', { class: 'btn btn-soft grow', onclick: setup }, 'Réglages'),
          h('button', { class: 'btn btn-primary grow', onclick: play }, '🔁 Nouveau mot')));
      }, n * 160 + 200);
    }
    onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') { e.preventDefault(); enter(); } else if (e.key === 'Backspace') back();
      else { const k = normWord(e.key).toUpperCase(); if (k.length === 1 && keys[k]) type(k); }
    };
    document.addEventListener('keydown', onKey);
    info();
  }

  setup();
  return unbind;
}
