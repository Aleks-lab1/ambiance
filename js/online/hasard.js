// Jeux de hasard en ligne : La Bouteille, La roue des gages, Qui commence ?, Boîte à outils.
// Le joueur dont c'est le tour (ou l'hôte) lance, tout le monde voit l'animation sur son téléphone.
import { h, uid, shuffle, pick, randInt, seg, stepper } from '../ui.js';
import { levelPicker, dieFace, TEAM_COLORS, podium } from '../common.js';
import { sip } from '../store.js';
import { sfx, buzz } from '../sfx.js';
import { activePids, addScore, nextOn, isOn, playerOf } from './kit.js';
import { DEFIS, BOTTLE_SVG } from '../games/bouteille.js';
import { LEVELS as ROUE_LEVELS, SEGMENTS, drawWheel } from '../games/roue.js';
import GAGES from '../data/gages.js';

const name = (g, pid) => (pid === g.me ? 'Toi' : g.nameOf(pid));
function levelsForm(levels, st, set, label = 'Niveaux') {
  const sel = new Set((st.levels || []).filter((l) => levels.some((x) => x.id === l)));
  if (!sel.size) sel.add(levels[0].id);
  set({ levels: [...sel] });
  return h('div', { class: 'col' }, h('p', { class: 'muted small' }, label), levelPicker(levels, sel, (x) => set({ levels: [...x] })));
}
const validLevels = (levels, ls) => { const v = (ls || []).filter((l) => levels.some((x) => x.id === l)); return v.length ? v : [levels[0].id]; };

// =====================================================================
// LA BOUTEILLE
// =====================================================================
const BT_LEVELS = [
  { id: 'soft', name: 'Tranquille', emoji: '😇', desc: 'Des défis gentils à faire à deux.' },
  { id: 'fun', name: 'Délire', emoji: '🤪', desc: 'Gênant et drôle.' },
  { id: 'hot', name: 'Hot', emoji: '🔥', desc: 'Bisous et câlins, réservé aux adultes. Chacun peut refuser.', adult: true },
];
const SPIN_MS = 3700;

export const bouteilleOnline = {
  id: 'bouteille', name: 'La Bouteille', short: 'Elle désigne quelqu\'un… et un défi à deux', emoji: '🍾', minPlayers: 2,
  defaults: { levels: ['soft'] },
  settingsForm: (st, set) => levelsForm(BT_LEVELS, st, set, 'Défis'),
  init(room, st) {
    const order = activePids(room);
    return { gid: uid(), st, order, spinner: pick(order), from: null, target: null, angle: 0, phase: 'idle', n: 0, deck: [] };
  },
  action(room, s, pid, a) {
    if (a.type !== 'spin' || s.phase === 'spin' || (pid !== s.spinner && pid !== room.host)) return false;
    const others = s.order.filter((p) => p !== s.spinner && isOn(room, p));
    if (!others.length) return false;
    const target = pick(others);
    const slice = 360 / s.order.length;
    const want = s.order.indexOf(target) * slice + (Math.random() - 0.5) * slice * 0.5;
    const cur = ((s.angle % 360) + 360) % 360;
    s.angle += 360 * (4 + randInt(0, 2)) + ((want - cur + 360) % 360);
    s.target = target;
    s.from = s.spinner;
    s.phase = 'spin';
    s.until = Date.now() + SPIN_MS;
    s.n++;
    return true;
  },
  tick(room, s) {
    if (s.phase !== 'spin' || Date.now() < s.until) return false;
    if (!s.deck.length) s.deck = shuffle(validLevels(BT_LEVELS, s.st.levels).flatMap((l) => DEFIS[l] || []));
    const nm = (p) => (playerOf(room, p) || {}).name || '?';
    s.defi = (s.deck.pop() || '').replace(/\{a\}/g, nm(s.from)).replace(/\{b\}/g, nm(s.target));
    s.spinner = s.target; // c'est la personne désignée qui fait tourner ensuite
    s.phase = 'result';
    return true;
  },
  onJoin(room, s, pid) { if (!s.order.includes(pid)) s.order.push(pid); },
  onLeave(room, s, pid) { if (pid === s.spinner && s.phase !== 'spin') s.spinner = nextOn(room, s.order, pid); },
  view(room, s) { return { gid: s.gid, n: s.n, phase: s.phase, order: s.order, spinner: s.spinner, from: s.from, target: s.target, angle: s.angle, defi: s.phase === 'result' ? s.defi : null }; },
  mount(root, g) {
    const status = h('h2', { class: 'center' });
    const ring = h('div', { class: 'bt-ring' });
    const result = h('div', { class: 'col' });
    const btnSlot = h('div', { class: 'col' });
    root.append(h('div', { class: 'col' }, status, ring, result, btnSlot));
    let names = {}, bottle = null, ringKey = '', lastKey = null, timers = [], v = null;
    const clear = () => { timers.forEach(clearTimeout); timers = []; };
    const can = () => v && (v.spinner === g.me || g.isHost) && v.phase !== 'spin';
    const spin = () => { if (can()) { g.send({ type: 'spin' }); sfx.pop(); } };
    function buildRing() {
      ring.replaceChildren();
      names = {};
      const n = v.order.length;
      v.order.forEach((p, i) => {
        const a = (i / n) * 2 * Math.PI;
        names[p] = h('div', { class: 'bt-name', style: { left: `${50 + 42 * Math.sin(a)}%`, top: `${50 - 42 * Math.cos(a)}%` } }, g.nameOf(p));
        ring.append(names[p]);
      });
      bottle = h('div', { class: 'bt-bottle', role: 'button', 'aria-label': 'Faire tourner la bouteille', html: BOTTLE_SVG, style: { transform: `translate(-50%, -50%) rotate(${v.angle}deg)` } });
      bottle.addEventListener('click', spin);
      ring.append(bottle);
    }
    return {
      update(r, view) {
        v = view;
        const rk = v.order.join(',') + '|' + v.order.map((p) => g.nameOf(p)).join(',');
        if (rk !== ringKey) { ringKey = rk; buildRing(); }
        bottle.style.transform = `translate(-50%, -50%) rotate(${v.angle}deg)`;
        for (const [p, el] of Object.entries(names)) {
          el.classList.toggle('cur', p === (v.phase === 'spin' ? v.from : v.spinner));
          el.classList.toggle('hit', v.phase === 'result' && p === v.target);
          el.style.opacity = r.players.some((x) => x.pid === p && x.on) ? '' : '.4';
        }
        const me = v.spinner === g.me;
        if (v.phase === 'spin') status.textContent = '🍾 Ça tourne…';
        else if (v.phase === 'result') status.textContent = `🍾 ${name(g, v.target)} !`;
        else status.textContent = me ? 'À toi de faire tourner !' : `${g.nameOf(v.spinner)} fait tourner la bouteille…`;
        result.replaceChildren(v.phase === 'result' ? h('div', { class: 'qcard' + (lastKey !== `${v.n}:result` ? ' anim' : ''), style: { minHeight: '0', padding: '18px' } },
          h('div', { class: 'kicker' }, `${name(g, v.from)} → ${name(g, v.target)}`),
          h('div', { class: 'big', style: { fontSize: 'clamp(20px,5.6vw,26px)' } }, v.defi.replace(/\{sip2\}/g, sip(2)).replace(/\{sip\}/g, sip(1))),
          h('div', { class: 'foot' }, `Refus ? ${sip(2)} !`)) : null);
        btnSlot.replaceChildren(v.phase === 'spin' ? null : can()
          ? h('button', { class: 'btn btn-primary btn-big btn-block', onclick: spin }, me ? '🍾 Tourner !' : `🍾 Tourner pour ${g.nameOf(v.spinner)}`)
          : h('p', { class: 'status-line' }, `⏳ ${g.nameOf(v.spinner)} va faire tourner la bouteille`));
        const key = `${v.n}:${v.phase}`;
        if (key !== lastKey) {
          clear();
          if (v.phase === 'spin') {
            sfx.swoosh(); buzz(20);
            let t = 0;
            for (let k = 0; k < 18; k++) { t += 60 + k * k * 4; timers.push(setTimeout(() => sfx.tick(), t)); }
          }
          if (v.phase === 'result') { sfx.ok(); buzz(v.target === g.me ? [60, 40, 120] : [40, 30, 80]); }
          if (v.phase !== 'spin' && me && lastKey) buzz(20);
        }
        lastKey = key;
      },
      destroy() { clear(); },
    };
  },
};

// =====================================================================
// LA ROUE DES GAGES
// =====================================================================
const WHEEL_MS = 4300;

export const roueOnline = {
  id: 'roue', name: 'La roue des gages', short: 'Chacun son tour fait tourner la roue', emoji: '🎡', minPlayers: 1,
  defaults: { levels: ['soft', 'fun'] },
  settingsForm: (st, set) => levelsForm(ROUE_LEVELS, st, set, 'Niveaux des gages'),
  init(room, st) {
    const order = shuffle(activePids(room));
    return { gid: uid(), st, order, who: order[0], victim: null, angle: 0, idx: 0, phase: 'idle', n: 0, deck: [], res: null };
  },
  action(room, s, pid, a) {
    if (a.type !== 'spin' || s.phase === 'spin' || (pid !== s.who && pid !== room.host)) return false;
    const n = SEGMENTS.length;
    s.idx = Math.floor(Math.random() * n);
    const jitter = (Math.random() - 0.5) * (360 / n) * 0.7;
    s.angle = s.angle - (s.angle % 360) + 360 * (5 + randInt(0, 2)) + (360 - s.idx * (360 / n)) + jitter;
    s.victim = s.who;
    s.phase = 'spin';
    s.until = Date.now() + WHEEL_MS;
    s.res = null;
    s.n++;
    return true;
  },
  tick(room, s) {
    if (s.phase !== 'spin' || Date.now() < s.until) return false;
    const gage = () => {
      if (!s.deck.length) s.deck = shuffle(validLevels(ROUE_LEVELS, s.st.levels).flatMap((l) => GAGES[l] || []));
      return s.deck.pop() || '…';
    };
    const kind = SEGMENTS[s.idx].kind;
    s.res = { kind, g1: ['gage', 'double', 'tous', 'choisis'].includes(kind) ? gage() : null, g2: kind === 'double' ? gage() : null };
    s.who = nextOn(room, s.order, s.victim);
    s.phase = 'result';
    return true;
  },
  onJoin(room, s, pid) { if (!s.order.includes(pid)) s.order.push(pid); },
  onLeave(room, s, pid) { if (pid === s.who && s.phase !== 'spin') s.who = nextOn(room, s.order, pid); },
  view(room, s) { return { gid: s.gid, n: s.n, phase: s.phase, who: s.who, victim: s.victim, angle: s.angle, idx: s.idx, res: s.res }; },
  mount(root, g) {
    const cv = h('canvas', { width: 760, height: 760 });
    drawWheel(cv);
    const status = h('h2', { class: 'center' });
    const result = h('div', { class: 'col', style: { minHeight: '120px' } });
    const btnSlot = h('div', { class: 'col' });
    let v = null, lastKey = null, tickIv = null, first = true;
    const can = () => v && (v.who === g.me || g.isHost) && v.phase !== 'spin';
    const spin = () => { if (can()) { g.send({ type: 'spin' }); sfx.pop(); } };
    cv.addEventListener('click', spin);
    root.append(h('div', { class: 'col' }, status, h('div', { class: 'wheel-wrap' }, h('div', { class: 'wheel-pointer' }, '🔻'), cv), result, btnSlot));

    function resultCard() {
      const seg0 = SEGMENTS[v.idx];
      const me = v.victim === g.me;
      const N = g.nameOf(v.victim);
      const x = v.res;
      let title, text;
      switch (x.kind) {
        case 'joker': title = '🍀 Joker !'; text = me ? 'Tu es épargné(e) cette fois-ci.' : `${N} est épargné(e) cette fois-ci.`; break;
        case 'double': title = me ? '🔥 Double gage pour toi !' : `🔥 Double gage pour ${N} !`; text = `${x.g1} — ET — ${x.g2}`; break;
        case 'tous': title = '🎉 Tout le monde !'; text = x.g1; break;
        case 'choisis': title = me ? '👉 Tu choisis la victime' : `👉 ${N} choisit la victime`; text = `${me ? 'Désigne' : N + ' désigne'} qui doit faire : ${x.g1}`; break;
        case 'sip': title = '🍹 Pénalité'; text = me ? `Tu prends ${sip(2)}.` : `${N} prend ${sip(2)}.`; break;
        default: title = me ? '🎯 Gage pour toi' : `🎯 Gage pour ${N}`; text = x.g1;
      }
      return h('div', { class: 'qcard anim', style: { minHeight: '0', '--g1': seg0.color, '--g2': '#3a2a86' } }, h('div', { class: 'kicker' }, title), h('div', { class: 'big', style: { fontSize: '22px' } }, text));
    }

    return {
      update(r, view) {
        v = view;
        if (first) { cv.style.transition = 'none'; cv.style.transform = `rotate(${v.angle}deg)`; void cv.offsetWidth; cv.style.transition = ''; first = false; } else cv.style.transform = `rotate(${v.angle}deg)`;
        const me = v.who === g.me;
        if (v.phase === 'spin') status.textContent = v.victim === g.me ? '🎡 Ta roue tourne…' : `🎡 La roue de ${g.nameOf(v.victim)} tourne…`;
        else status.textContent = me ? 'À toi de tourner la roue !' : `Au tour de ${g.nameOf(v.who)}`;
        const key = `${v.n}:${v.phase}`;
        if (key !== lastKey) result.replaceChildren(v.phase === 'result' && v.res ? resultCard() : null);
        btnSlot.replaceChildren(v.phase === 'spin' ? null : can()
          ? h('button', { class: 'btn btn-primary btn-big btn-block', onclick: spin }, me ? '🎡 Tourner la roue' : `🎡 Tourner pour ${g.nameOf(v.who)}`)
          : h('p', { class: 'status-line' }, `⏳ ${g.nameOf(v.who)} va tourner la roue`));
        if (key !== lastKey) {
          clearInterval(tickIv);
          if (v.phase === 'spin') {
            sfx.swoosh();
            let ticks = 0;
            tickIv = setInterval(() => { if (++ticks > 30) clearInterval(tickIv); else sfx.tick(); }, 90);
          }
          if (v.phase === 'result') { sfx.fanfare(); buzz(v.victim === g.me ? [80, 40, 120] : [50, 30, 80]); }
        }
        lastKey = key;
      },
      destroy() { clearInterval(tickIv); },
    };
  },
};

// =====================================================================
// QUI COMMENCE ?
// =====================================================================
const DOIGT_MODES = [{ value: 'one', label: '1 gagnant' }, { value: 'teams', label: '2 équipes' }, { value: 'order', label: 'Ordre de jeu' }];
const COUNT_MS = 2200;

export const doigtOnline = {
  id: 'doigt', name: 'Qui commence ?', short: 'Chacun pose son doigt, le hasard choisit', emoji: '☝️', minPlayers: 2,
  defaults: { mode: 'one' },
  settingsForm(st, set) {
    return h('div', { class: 'col' },
      h('p', { class: 'muted small' }, 'Chacun garde son doigt sur son téléphone. Quand tout le monde est prêt, le hasard choisit.'),
      h('label', { class: 'field' }, 'Mode', seg(DOIGT_MODES, st.mode, (v) => set({ mode: v }))));
  },
  init(room, st) { return { gid: uid(), st, phase: 'wait', hold: {}, n: 0, res: null }; },
  action(room, s, pid, a) {
    if (a.type === 'hold' && (s.phase === 'wait' || s.phase === 'count')) {
      if (a.on) s.hold[pid] = true; else delete s.hold[pid];
      doigtCheck(room, s);
      return true;
    }
    if (a.type === 'draw' && pid === room.host && s.phase !== 'done') { doigtChoose(room, s, activePids(room)); return true; }
    if (a.type === 'again' && pid === room.host && s.phase === 'done') { s.phase = 'wait'; s.hold = {}; s.res = null; s.n++; return true; }
    return false;
  },
  tick(room, s) {
    if (s.phase === 'count' && Date.now() >= s.until) { doigtChoose(room, s, activePids(room).filter((p) => s.hold[p])); return true; }
    return false;
  },
  onLeave(room, s, pid) { delete s.hold[pid]; doigtCheck(room, s); },
  onJoin(room, s) { doigtCheck(room, s); },
  view(room, s) { return { gid: s.gid, n: s.n, phase: s.phase, mode: s.st.mode, hold: Object.keys(s.hold), until: s.until, res: s.res }; },
  mount(root, g) {
    const status = h('h2', { class: 'center' });
    const sub = h('p', { class: 'center muted' });
    const pad = h('div', { class: 'hold-pad', role: 'button', 'aria-label': 'Garde ton doigt ici' });
    const list = h('div', { class: 'chips', style: { justifyContent: 'center' } });
    const out = h('div', { class: 'col' });
    const hostSlot = h('div', { class: 'col' });
    root.append(h('div', { class: 'col' }, status, sub, pad, list, out, hostSlot));
    let v = null, pressing = false, lastKey = null, iv = null;
    const press = (on) => {
      if (!v || v.phase === 'done' || pressing === on) return;
      pressing = on;
      pad.classList.toggle('on', on);
      g.send({ type: 'hold', on });
      if (on) { sfx.pop(); buzz(15); }
    };
    pad.addEventListener('pointerdown', (e) => { e.preventDefault(); try { pad.setPointerCapture(e.pointerId); } catch { /* */ } press(true); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(ev, () => press(false));
    pad.addEventListener('contextmenu', (e) => e.preventDefault());
    const padText = () => {
      if (!v) return;
      if (v.phase === 'count') {
        const n = Math.ceil(Math.max(0, v.until - g.now()) / (COUNT_MS / 3));
        if (pad.dataset.n !== String(n)) { pad.dataset.n = String(n); pad.replaceChildren(h('span', { class: 'n' }, String(Math.max(1, n)))); sfx.beep(); }
      }
    };
    return {
      update(r, view) {
        v = view;
        const on = r.players.filter((p) => p.on);
        const held = new Set(v.hold);
        const key = `${v.n}:${v.phase}`;
        clearInterval(iv);
        pad.classList.remove('win', 'lose');
        if (v.phase !== 'count') delete pad.dataset.n;
        if (v.phase === 'done') {
          pressing = false;
          pad.classList.remove('on');
          const res = v.res;
          if (res.winner) {
            const me = res.winner === g.me;
            status.textContent = me ? '👑 C\'est toi qui commences !' : `👑 ${g.nameOf(res.winner)} commence !`;
            pad.classList.add(me ? 'win' : 'lose');
            pad.replaceChildren(me ? '👑' : '😌');
            out.replaceChildren();
          } else if (res.teams) {
            const mine = res.teams.findIndex((t) => t.includes(g.me));
            status.textContent = mine >= 0 ? `Tu es dans l'équipe ${mine + 1} !` : 'Les équipes sont faites !';
            pad.replaceChildren(mine >= 0 ? `Équipe ${mine + 1}` : '👥');
            pad.style.background = mine >= 0 ? TEAM_COLORS[mine] : '';
            out.replaceChildren(...res.teams.map((t, i) => h('div', { class: 'panel' }, h('h3', { style: { color: TEAM_COLORS[i] } }, `Équipe ${i + 1}`), h('p', null, t.map((p) => name(g, p)).join(', ')))));
          } else {
            const k = res.order.indexOf(g.me);
            status.textContent = k >= 0 ? `Tu joues en n°${k + 1} !` : 'L\'ordre de jeu est fait !';
            pad.replaceChildren(h('span', { class: 'n' }, k >= 0 ? String(k + 1) : '🔢'));
            out.replaceChildren(h('div', { class: 'scoreboard' }, res.order.map((p, i) => h('div', { class: 'score-row' + (p === g.me ? ' lead' : '') }, h('span', null, `${i + 1}.`), h('span', { class: 'n' }, g.nameOf(p))))));
          }
          sub.textContent = '';
          list.replaceChildren();
          hostSlot.replaceChildren(g.isHost ? h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => g.send({ type: 'again' }) }, '🔁 Recommencer') : h('p', { class: 'status-line' }, '⏳ L\'hôte peut relancer un tirage'));
          if (key !== lastKey) { sfx.fanfare(); buzz(res.winner === g.me ? [80, 40, 120, 40, 200] : [60, 40, 60]); }
        } else {
          pad.style.background = '';
          pad.classList.toggle('on', pressing);
          if (v.phase === 'count') { if (key !== lastKey) delete pad.dataset.n; padText(); iv = setInterval(padText, 100); } else pad.replaceChildren(pressing ? '☝️ Garde ton doigt…' : '☝️ Pose ton doigt ici');
          status.textContent = v.phase === 'count' ? 'Ne lâchez plus !' : 'Tout le monde pose son doigt';
          sub.textContent = `${v.mode === 'teams' ? '👥 2 équipes' : v.mode === 'order' ? '🔢 Ordre de jeu' : '👑 1 gagnant'} · ${held.size}/${on.length} doigt${held.size > 1 ? 's' : ''} posé${held.size > 1 ? 's' : ''}`;
          list.replaceChildren(...on.map((p) => h('span', { class: 'chip' + (held.has(p.pid) ? ' on' : '') }, `${held.has(p.pid) ? '☝️' : '⏳'} ${p.pid === g.me ? 'Toi' : p.name}`)));
          out.replaceChildren();
          hostSlot.replaceChildren(g.isHost ? h('button', { class: 'btn btn-soft btn-block', onclick: () => g.send({ type: 'draw' }) }, '🎲 Tirer au sort sans attendre') : null);
        }
        lastKey = key;
      },
      destroy() { clearInterval(iv); },
    };
  },
};
function doigtCheck(room, s) {
  if (s.phase === 'done') return;
  const on = activePids(room);
  const all = on.length >= 2 && on.every((p) => s.hold[p]);
  if (all && s.phase === 'wait') { s.phase = 'count'; s.until = Date.now() + COUNT_MS; }
  else if (!all && s.phase === 'count') s.phase = 'wait';
}
function doigtChoose(room, s, pids) {
  if (pids.length < 1) return;
  const list = shuffle(pids.slice());
  if (s.st.mode === 'teams') s.res = { teams: [list.filter((_, i) => i % 2 === 0), list.filter((_, i) => i % 2 === 1)] };
  else if (s.st.mode === 'order') s.res = { order: list };
  else s.res = { winner: list[0] };
  s.phase = 'done';
  s.hold = {};
  s.n++;
}

// =====================================================================
// BOÎTE À OUTILS
// =====================================================================
const TOOLS = [
  { value: 'des', label: '🎲 Dés' }, { value: 'piece', label: '🪙 Pièce' }, { value: 'equipes', label: '👥 Équipes' }, { value: 'chrono', label: '⏱ Chrono' }, { value: 'scores', label: '🔢 Points' },
];
const CHRONO = [30, 60, 120, 180, 300, 600];
const fmt = (ms) => { const s = Math.ceil(Math.max(0, ms) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export const outilsOnline = {
  id: 'outils', name: 'Boîte à outils', short: 'Dés, pièce, équipes, chrono, points partagés', emoji: '🧰', minPlayers: 1,
  defaults: {},
  settingsForm: () => h('p', { class: 'muted small' }, 'L\'hôte choisit l\'outil, tout le monde voit le résultat. Chacun peut lancer les dés et la pièce.'),
  init(room, st) {
    return {
      gid: uid(), st, tab: 'des', n: 0,
      dice: { n: 2, vals: [1, 1], by: null, k: 0 }, coin: { res: null, by: null, k: 0, until: 0 },
      teams: { n: 2, list: null, k: 0 }, chrono: { secs: 60, end: 0, left: 60000, run: false, k: 0 },
    };
  },
  action(room, s, pid, a) {
    const host = pid === room.host;
    switch (a.type) {
      case 'tab': if (!host || !TOOLS.some((t) => t.value === a.tab)) return false; s.tab = a.tab; return true;
      case 'roll': s.dice.vals = Array.from({ length: s.dice.n }, () => randInt(1, 6)); s.dice.by = pid; s.dice.k++; return true;
      case 'diceN': if (!host) return false; s.dice.n = Math.max(1, Math.min(6, a.n | 0)); s.dice.vals = Array.from({ length: s.dice.n }, () => randInt(1, 6)); s.dice.by = pid; s.dice.k++; return true;
      case 'flip': if (Date.now() < s.coin.until) return false; s.coin = { res: Math.random() < 0.5 ? 'PILE' : 'FACE', by: pid, k: s.coin.k + 1, until: Date.now() + 1000 }; return true;
      case 'teamsN': if (!host) return false; s.teams.n = Math.max(2, Math.min(6, a.n | 0)); return true;
      case 'teams': {
        if (!host) return false;
        const sh = shuffle(activePids(room));
        const n = Math.min(s.teams.n, sh.length);
        s.teams.list = Array.from({ length: n }, (_, i) => sh.filter((_, k) => k % n === i));
        s.teams.k++;
        return true;
      }
      case 'chrono': {
        if (!host) return false;
        const c = s.chrono;
        if (a.op === 'set' && CHRONO.includes(a.secs)) { c.secs = a.secs; c.run = false; c.end = 0; c.left = a.secs * 1000; }
        else if (a.op === 'start' && !c.run) { if (c.left <= 0) c.left = c.secs * 1000; c.end = Date.now() + c.left; c.run = true; }
        else if (a.op === 'pause' && c.run) { c.left = Math.max(0, c.end - Date.now()); c.run = false; }
        else if (a.op === 'reset') { c.run = false; c.end = 0; c.left = c.secs * 1000; }
        else return false;
        return true;
      }
      case 'score': if (!host || !room.players.some((p) => p.pid === a.pid) || ![-1, 1].includes(a.d)) return false; addScore(room, a.pid, a.d); return true;
      case 'zero': if (!host) return false; room.players.forEach((p) => { p.score = 0; }); return true;
      default: return false;
    }
  },
  tick(room, s) {
    const c = s.chrono;
    if (c.run && Date.now() >= c.end) { c.run = false; c.left = 0; c.k++; return true; }
    return false;
  },
  view(room, s) { return { gid: s.gid, tab: s.tab, dice: s.dice, coin: s.coin, teams: s.teams, chrono: s.chrono }; },
  mount(root, g) {
    const tabs = h('div');
    const body = h('div', { class: 'col' });
    root.append(h('div', { class: 'col' }, tabs, body));
    let v = null, r = null, last = {}, iv = null, coinT = null, bigEl = null;
    const by = (pid) => (pid === g.me ? 'par toi' : `par ${g.nameOf(pid)}`);
    const tickChrono = () => {
      if (!v || !bigEl || !bigEl.isConnected) return;
      const c = v.chrono;
      bigEl.textContent = fmt(c.run ? c.end - g.now() : c.left);
    };
    iv = setInterval(tickChrono, 200);

    function des() {
      const fresh = last.dice !== v.dice.k;
      return [
        g.isHost ? h('div', { class: 'spread' }, h('b', null, 'Nombre de dés'), stepper(v.dice.n, 1, 6, (n) => g.send({ type: 'diceN', n }))) : null,
        h('div', { class: 'big-center' }, h('div', { class: 'dice-row' }, v.dice.vals.map((x) => dieFace(x, fresh ? 'roll' : ''))),
          v.dice.vals.length > 1 ? h('h2', null, `Total : ${v.dice.vals.reduce((a, b) => a + b, 0)}`) : null,
          v.dice.by ? h('p', { class: 'muted small' }, `Lancé ${by(v.dice.by)}`) : null),
        h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => g.send({ type: 'roll' }) }, '🎲 Lancer'),
      ];
    }
    function piece() {
      const c = v.coin;
      const flipping = !!c.res && g.now() < c.until;
      const coin = h('div', { class: 'coin' + (flipping && last.coin !== c.k ? ' spin' : '') }, flipping ? '' : c.res || '?');
      clearTimeout(coinT);
      if (flipping) coinT = setTimeout(() => { coin.textContent = c.res; sfx.ok(); buzz(40); }, c.until - g.now());
      return [h('div', { class: 'big-center' }, coin, c.by ? h('p', { class: 'muted small' }, `Lancée ${by(c.by)}`) : null),
        h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => g.send({ type: 'flip' }) }, '🪙 Lancer la pièce')];
    }
    function equipes() {
      const t = v.teams;
      return [
        g.isHost ? h('div', { class: 'spread' }, h('b', null, 'Nombre d\'équipes'), stepper(t.n, 2, 6, (n) => g.send({ type: 'teamsN', n }))) : null,
        t.list ? h('div', { class: 'col' }, t.list.map((tm, i) => h('div', { class: 'panel' + (tm.includes(g.me) ? ' lead' : '') },
          h('h3', { style: { color: TEAM_COLORS[i] } }, `Équipe ${i + 1}${tm.includes(g.me) ? ' (la tienne)' : ''}`), h('p', null, tm.map((p) => g.nameOf(p)).join(', '))))) : h('p', { class: 'center muted' }, 'Les équipes seront tirées au sort parmi les joueurs connectés.'),
        g.isHost ? h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => g.send({ type: 'teams' }) }, '🎲 Former les équipes') : null,
      ];
    }
    function chrono() {
      const c = v.chrono;
      bigEl = h('div', { class: 'letter-big', style: { fontSize: '96px', fontVariantNumeric: 'tabular-nums' } }, fmt(c.run ? c.end - g.now() : c.left));
      return [
        g.isHost ? seg(CHRONO.map((x) => ({ value: x, label: x < 60 ? x + 's' : x / 60 + 'min' })), c.secs, (secs) => g.send({ type: 'chrono', op: 'set', secs })) : null,
        h('div', { class: 'big-center' }, bigEl, !g.isHost ? h('p', { class: 'muted small' }, c.run ? '⏱ C\'est parti !' : 'L\'hôte lance le chrono') : null),
        g.isHost ? h('div', { class: 'row' },
          h('button', { class: 'btn btn-soft', onclick: () => g.send({ type: 'chrono', op: 'reset' }) }, '↺'),
          h('button', { class: 'btn btn-primary btn-big grow', onclick: () => g.send({ type: 'chrono', op: c.run ? 'pause' : 'start' }) }, c.run ? '⏸ Pause' : c.left < c.secs * 1000 && c.left > 0 ? '▶ Reprendre' : '▶ Démarrer')) : null,
      ];
    }
    function scores() {
      const max = Math.max(...r.players.map((p) => p.score));
      return [
        h('div', { class: 'scoreboard' }, r.players.map((p) => h('div', { class: 'score-row' + (p.score === max && max > 0 ? ' lead' : '') },
          h('span', { class: 'n' }, p.pid === g.me ? `${p.name} (toi)` : p.name),
          g.isHost ? h('button', { class: 'icon-btn', 'aria-label': 'Moins', onclick: () => { g.send({ type: 'score', pid: p.pid, d: -1 }); sfx.tock(); } }, '−') : null,
          h('span', { class: 's', style: { minWidth: '2.5ch', textAlign: 'center' } }, String(p.score)),
          g.isHost ? h('button', { class: 'icon-btn', 'aria-label': 'Plus', onclick: () => { g.send({ type: 'score', pid: p.pid, d: 1 }); sfx.tick(); } }, '+') : null))),
        g.isHost ? h('button', { class: 'btn btn-soft btn-block', onclick: () => g.send({ type: 'zero' }) }, '↺ Remettre à zéro') : h('p', { class: 'status-line' }, 'L\'hôte compte les points'),
        r.players.some((p) => p.score) ? podium(r.players.map((p) => ({ name: p.name, score: p.score }))) : null,
      ];
    }

    return {
      update(room, view) {
        v = view; r = room;
        tabs.replaceChildren(g.isHost
          ? seg(TOOLS, v.tab, (tab) => g.send({ type: 'tab', tab }))
          : h('div', { class: 'row' }, h('span', { class: 'pill' }, (TOOLS.find((t) => t.value === v.tab) || TOOLS[0]).label), h('div', { class: 'grow' }), h('span', { class: 'muted small' }, 'L\'hôte choisit l\'outil')));
        bigEl = null;
        body.replaceChildren(...({ des, piece, equipes, chrono, scores })[v.tab]().filter(Boolean));
        if (last.dice !== undefined && last.dice !== v.dice.k && v.tab === 'des') { sfx.pop(); buzz(30); }
        if (last.coin !== undefined && last.coin !== v.coin.k && v.tab === 'piece') sfx.swoosh();
        if (last.teams !== undefined && last.teams !== v.teams.k) sfx.pop();
        if (last.chrono !== undefined && last.chrono !== v.chrono.k) { sfx.fanfare(); buzz([300, 100, 300, 100, 300]); }
        last = { dice: v.dice.k, coin: v.coin.k, teams: v.teams.k, chrono: v.chrono.k };
      },
      destroy() { clearInterval(iv); clearTimeout(coinT); },
    };
  },
};
