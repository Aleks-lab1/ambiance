// Moteur des jeux en équipes : équipes, tours chronométrés, correction, scores.
import { h, toast, countdown, timerView, shuffle, setText } from './ui.js';
import { get, set, getPlayers } from './store.js';
import { editPlayers } from './players.js';
import { TEAM_COLORS, podium } from './common.js';
import { sfx, buzz } from './sfx.js';

/** Éditeur d'équipes (noms + répartition des joueurs). */
export function teamsSetup() {
  let teams = get('teams', [{ name: 'Les Licornes' }, { name: 'Les Pirates' }]);
  const save = () => set('teams', teams);
  const wrap = h('div', { class: 'col' });
  function render() {
    wrap.replaceChildren(
      h('div', { class: 'team-list' }, teams.map((t, i) => [
        h('div', { class: 'team-row' },
          h('span', { class: 'team-dot', style: { background: TEAM_COLORS[i] } }),
          h('input', { class: 'input', value: t.name, maxlength: '20', 'aria-label': `Nom de l'équipe ${i + 1}`, oninput: (e) => { t.name = e.target.value; save(); } }),
          teams.length > 2 ? h('button', { class: 'icon-btn', 'aria-label': 'Supprimer l\'équipe', onclick: () => { teams.splice(i, 1); save(); render(); } }, '×') : null),
        t.members && t.members.length ? h('div', { class: 'team-members' }, t.members.join(', ')) : null,
      ])),
      h('div', { class: 'row wrap' },
        teams.length < 4 ? h('button', { class: 'btn btn-soft btn-sm', onclick: () => { teams.push({ name: `Équipe ${teams.length + 1}` }); save(); render(); } }, '＋ Équipe') : null,
        h('button', { class: 'btn btn-soft btn-sm', onclick: split }, '🎲 Répartir les joueurs au hasard')));
  }
  async function split() {
    let pl = getPlayers();
    if (pl.length < teams.length) { toast('Ajoute d\'abord les joueurs'); pl = await editPlayers(); if (pl.length < teams.length) return; }
    pl = shuffle(pl.slice());
    teams.forEach((t) => { t.members = []; });
    pl.forEach((p, i) => teams[i % teams.length].members.push(p));
    save();
    render();
  }
  render();
  return {
    el: wrap,
    get teams() { return teams.map((t, i) => ({ name: (t.name || '').trim() || `Équipe ${i + 1}`, members: t.members || [], color: TEAM_COLORS[i] })); },
  };
}

const pts = (results) => results.reduce((s, x) => s + (x.r === 'ok' ? 1 : x.r === 'buzz' ? -1 : 0), 0);

/** Écran « Prêt ? » puis 3-2-1. */
export function readyScreen(root, { top, kicker = 'Au tour de', title, color, subtitle, emoji = '⏳', button = 'C\'est parti !' }) {
  return new Promise((resolve) => {
    root.replaceChildren(top, h('div', { class: 'big-center' },
      h('div', { class: 'hero-emo' }, emoji),
      h('p', { class: 'muted' }, kicker),
      h('h2', { style: { color } }, title),
      subtitle ? h('p', { class: 'muted', style: { maxWidth: '32ch' } }, subtitle) : null,
      h('button', { class: 'btn btn-primary btn-big', onclick: () => go() }, button)));
    function go() {
      let n = 3;
      const num = h('div', { class: 'countdown-num' }, '3');
      root.replaceChildren(top, h('div', { class: 'big-center' }, num));
      sfx.beep();
      const iv = setInterval(() => {
        if (!root.isConnected) { clearInterval(iv); return; }
        n--;
        if (n > 0) { num.textContent = String(n); num.style.animation = 'none'; void num.offsetWidth; num.style.animation = ''; sfx.beep(); }
        else { clearInterval(iv); sfx.go(); resolve(); }
      }, 800);
    }
  });
}

/**
 * Joue un tour chronométré.
 * opts.draw(lastResult, lastItem) → prochain item (ou null si plus rien)
 * Résout { results, timeUp, current }
 */
export function playTurn(root, { label, duration, draw, render, buttons, color }) {
  return new Promise((resolve) => {
    const results = [];
    let item = draw(null, null);
    if (!item) { resolve({ results, timeUp: false, current: null }); return; }
    const tv = timerView(duration);
    const card = h('div', { class: 'play-area' });
    const scoreEl = h('span', { class: 'pill' }, '0 pt');
    const btns = h('div', { class: 'answer-btns' + (buttons.length === 3 ? ' three' : '') },
      buttons.map((b) => h('button', { class: 'btn btn-big ' + b.cls, onclick: () => answer(b.r) }, b.label)));
    const pause = h('button', { class: 'icon-btn', 'aria-label': 'Pause', onclick: togglePause }, '⏸');
    root.replaceChildren(
      h('div', { class: 'row' }, h('span', { class: 'pill', style: { color } }, label), h('div', { class: 'grow' }), scoreEl, pause),
      tv.el, card, btns);
    const show = () => card.replaceChildren(render(item));
    show();
    let done = false;
    const t = countdown({
      seconds: duration,
      onTick: (left, s, changed) => {
        if (!root.isConnected || !tv.el.isConnected) { t.stop(); done = true; return; }
        tv.set(left, duration * 1000);
        if (changed && s <= 5 && s > 0) sfx.tick();
      },
      onEnd: () => { if (done) return; sfx.bad(); buzz([200, 100, 300]); finish(true); },
    });
    function togglePause() {
      if (t.paused) { t.resume(); setText(pause, '⏸'); card.style.filter = ''; btns.style.pointerEvents = ''; }
      else { t.pause(); setText(pause, '▶️'); card.style.filter = 'blur(14px)'; btns.style.pointerEvents = 'none'; }
    }
    function answer(r) {
      if (done) return;
      results.push({ item, r });
      if (r === 'ok') { sfx.ok(); buzz(30); } else if (r === 'buzz') { sfx.bad(); buzz([80, 40, 80]); } else sfx.swoosh();
      const p = pts(results);
      scoreEl.textContent = `${p} pt${Math.abs(p) > 1 ? 's' : ''}`;
      const last = item;
      item = draw(r, last);
      if (!item) { finish(false); return; }
      show();
    }
    function finish(timeUp) {
      if (done) return;
      done = true;
      t.stop();
      resolve({ results, timeUp, current: timeUp ? item : null });
    }
  });
}

/** Correction après un tour : on peut basculer chaque réponse. Résout le nombre de points. */
export function reviewTurn(root, { top, results, title, labelOf }) {
  return new Promise((resolve) => {
    const list = h('div', { class: 'result-list' });
    const total = h('b');
    const icon = { ok: '✅', pass: '⏭️', buzz: '🚫' };
    function render() {
      list.replaceChildren(...results.map((x) => h('button', {
        class: 'result-item' + (x.r === 'ok' ? '' : ' pass'),
        onclick: () => { x.r = x.r === 'ok' ? 'pass' : x.r === 'pass' ? (x.wasBuzz ? 'buzz' : 'ok') : 'ok'; render(); },
      }, h('span', { class: 't' }, labelOf(x.item)), h('span', { class: 'r' }, icon[x.r]))));
      if (!results.length) list.append(h('p', { class: 'muted center' }, 'Aucune carte jouée.'));
      total.textContent = `${pts(results)} point${Math.abs(pts(results)) > 1 ? 's' : ''}`;
    }
    results.forEach((x) => { if (x.r === 'buzz') x.wasBuzz = true; });
    render();
    root.replaceChildren(top,
      h('div', { class: 'center col', style: { gap: '4px' } }, h('div', { class: 'hero-emo' }, '⏰'), h('h2', null, title)),
      h('p', { class: 'muted small center' }, 'Touche une carte pour corriger le résultat si besoin.'),
      list,
      h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => resolve(pts(results)) }, 'Valider : ', total));
  });
}

/** Tableau des scores entre deux tours. */
export function scoresScreen(root, { top, teams, scores, info, next, button = 'Continuer', emoji = '📊' }) {
  return new Promise((resolve) => {
    const max = Math.max(...scores);
    root.replaceChildren(top,
      h('div', { class: 'center' }, h('div', { class: 'hero-emo' }, emoji), info ? h('p', { class: 'muted' }, info) : null),
      h('div', { class: 'scoreboard' }, teams.map((t, i) => h('div', { class: 'score-row' + (scores[i] === max && max > 0 ? ' lead' : '') },
        h('span', { class: 'team-dot', style: { background: t.color } }), h('span', { class: 'n' }, t.name), h('span', { class: 's' }, String(scores[i]))))),
      next ? h('p', { class: 'center' }, 'Prochain tour : ', h('b', { style: { color: next.color } }, next.name), next.members && next.members.length ? h('span', { class: 'muted' }, ` (${next.members.join(', ')})`) : null) : null,
      h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => resolve() }, button));
  });
}

export function finalScreen(root, { top, teams, scores, onReplay }) {
  sfx.fanfare();
  root.replaceChildren(top,
    h('div', { class: 'center' }, h('div', { class: 'hero-emo' }, '🏆'), h('h2', null, 'Fin de la partie !')),
    podium(teams.map((t, i) => ({ name: t.name, score: scores[i] }))),
    h('div', { class: 'grow' }),
    h('button', { class: 'btn btn-primary btn-big btn-block', onclick: onReplay }, '🔁 Rejouer'));
}
