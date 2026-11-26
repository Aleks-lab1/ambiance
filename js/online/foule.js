// Dans la foule (TV Mode seulement) : la télé montre une place pleine de bonshommes tous pareils. Chaque joueur
// en pilote un en secret avec la manette de son téléphone (joystick + bouton « Pousser ») et doit toucher ses
// 4 fontaines dans l'ordre affiché sur son téléphone… sans se faire repérer. Les passants (l'ordinateur) ne
// poussent jamais : pousser, c'est se démasquer. Faire tomber un joueur l'élimine de la manche.
// Jeu en temps réel : la télé fait tourner la partie (room.tvHost) et appelle frame() à chaque image ;
// les téléphones n'envoient que leur direction (quand elle change) et leurs poussées.
import { h, setText, shuffle, seg } from '../ui.js';
import { sfx, buzz } from '../sfx.js';
import { activePids, addScore, endScreen, TV_PID, tvSay, tvStage } from './kit.js';
import { makeWorld, step, tryPush, touching, crowdSize, FOUNTAINS } from '../foule-core.js';
import { createScene, drawAvatar, PALETTES } from '../foule-art.js';

const READY = 3.2;    // compte à rebours avant chaque manche (personne ne bouge)
const REVEAL = 6.5;   // révélation : on montre qui était qui
const CD = 2.5, CD_MISS = 4.5, CD_AIR = 1.2; // recharge du bouton « Pousser » (raté sur un passant = plus long)
const STALE = 2.6;    // sans nouvelle d'une manette depuis 2,6 s, son bonhomme s'arrête

const nameOf = (room, pid) => (room.players.find((p) => p.pid === pid) || {}).name || '?';
const pidOf = (s, i) => Object.keys(s.who).find((p) => s.who[p] === i) || null;
const say = (s, text) => { s.say = { n: (s.say ? s.say.n : 0) + 1, text }; };
const tell = (s, pid, text, tone = '') => { s.mseq = (s.mseq || 0) + 1; s.msg[pid] = { n: s.mseq, text, tone }; };
const alive = (s) => Object.keys(s.who).filter((p) => !s.out[p]);
const fname = (k) => FOUNTAINS[k].name;

function startRound(room, s) {
  const pids = activePids(room);
  const n = crowdSize(pids.length);
  s.round++;
  s.world = makeWorld(n);
  const idx = shuffle([...Array(n).keys()]);
  s.who = {}; s.order = {}; s.prog = {}; s.out = {}; s.input = {}; s.cd = {}; s.msg = {};
  pids.forEach((p, k) => { s.who[p] = idx[k]; s.order[p] = shuffle([0, 1, 2, 3]); s.prog[p] = 0; });
  s.start = pids.length;
  s.color = (s.c0 + s.round - 1) % PALETTES.length;
  s.phase = 'ready'; s.until = READY; s.best = 0; s.winner = null;
  say(s, '');
}

function endRound(room, s, how, pid = null) {
  s.phase = 'reveal';
  s.until = s.world.t + REVEAL;
  s.input = {};
  s.winner = { pid, how };
  const nm = pid ? nameOf(room, pid) : '';
  if (how === 'fountains') { addScore(room, pid, 3); say(s, `🏆 ${nm} a touché ses 4 fontaines ! +3`); }
  else if (how === 'last') { addScore(room, pid, 2); say(s, `🏆 ${nm} est le dernier debout ! +2`); }
  else if (how === 'time' && pid) { addScore(room, pid, 1); say(s, `⏱️ Temps écoulé ! ${nm} était le plus avancé : +1`); }
  else say(s, how === 'time' ? '⏱️ Temps écoulé ! Personne ne gagne la manche.' : 'Personne ne gagne la manche.');
}

/** Plus qu'un joueur debout : il gagne la manche. */
function checkLast(room, s) {
  if (s.phase !== 'play') return;
  const a = alive(s);
  if (s.start >= 2 && a.length === 1) endRound(room, s, 'last', a[0]);
  else if (!a.length) endRound(room, s, 'none');
}

function onHit(room, s, e) {
  const victim = pidOf(s, e.i), pusher = pidOf(s, e.by);
  if (!pusher) return false; // le joueur qui a poussé vient de quitter la partie
  if (victim) {
    s.world.chars[e.i].m = 'out';
    s.out[victim] = pusher;
    delete s.input[victim];
    addScore(room, pusher, 1);
    tell(s, pusher, `💥 Tu as fait tomber ${nameOf(room, victim)} ! +1`, 'good');
    tell(s, victim, `😵 ${nameOf(room, pusher)} t'a fait tomber !`, 'bad');
    say(s, `😵 ${nameOf(room, victim)} est éliminé !`);
    checkLast(room, s);
  } else {
    const cd = s.cd[pusher] || { n: 0 };
    s.cd[pusher] = { n: cd.n + 1, dur: CD_MISS, until: s.world.t + CD_MISS };
    tell(s, pusher, '🙈 Raté : c\'était un passant… et tout le monde t\'a vu pousser !', 'bad');
    say(s, '🙈 Un passant est tombé… Qui a poussé ?');
  }
  return true;
}

export const fouleOnline = {
  id: 'foule', name: 'Dans la foule', short: 'Cache-toi dans la foule, touche tes fontaines… et pousse les autres !', emoji: '👥',
  minPlayers: 2, tvOnly: true,
  defaults: { rounds: 5, time: 120 },
  settingsForm: (st, set) => h('div', { class: 'col' },
    h('label', { class: 'field' }, 'Nombre de manches', seg([3, 5, 7].map((n) => ({ value: n, label: String(n) })), st.rounds, (v) => set({ rounds: v }))),
    h('label', { class: 'field' }, 'Durée d\'une manche', seg([[90, '1 min 30'], [120, '2 min'], [180, '3 min']].map(([value, label]) => ({ value, label })), st.time, (v) => set({ time: v })))),

  init(room, st) {
    const s = { st: { ...st }, round: 0, c0: (Math.random() * PALETTES.length) | 0, mseq: 0, msg: {} };
    startRound(room, s);
    return s;
  },

  action(room, s, pid, a) {
    if (!s.world || s.who[pid] == null) return false;
    if (a.type === 'mv') {
      const d = Number.isInteger(a.d) && a.d >= 0 && a.d < 16 ? a.d : -1;
      s.input[pid] = { d, at: s.world.t };
      return false;
    }
    if (a.type === 'push') {
      const w = s.world, cd = s.cd[pid];
      if (s.phase !== 'play' || s.out[pid]) return false;
      if (cd && w.t < cd.until) {
        // Encore en recharge (la télé peut avancer un peu moins vite que l'horloge du téléphone) :
        // on renvoie au téléphone le temps qu'il reste, pour que le bouton ne semble pas prêt pour rien.
        s.cd[pid] = { n: cd.n + 1, dur: Math.round((cd.until - w.t) * 100) / 100, until: cd.until };
        return true;
      }
      const j = tryPush(w, s.who[pid]);
      if (j === -2) return false;
      const dur = j >= 0 ? CD : CD_AIR;
      s.cd[pid] = { n: (cd ? cd.n : 0) + 1, dur, until: w.t + dur };
      if (j < 0) tell(s, pid, '✋ Dans le vide ! Colle-toi à quelqu\'un pour le pousser.', '');
      return true;
    }
    return false;
  },

  // Appelé à chaque image par l'hôte (la télé). true = renvoyer la vue à tous (événement).
  frame(room, s, dt) {
    const w = s.world;
    if (!w || s.phase === 'end') return false;
    let changed = false;
    const ctl = {};
    for (const [pid, i] of Object.entries(s.who)) {
      const inp = s.input[pid];
      ctl[i] = s.phase === 'play' && inp && w.t - inp.at < STALE ? inp.d : -1;
    }
    for (const e of step(w, dt, ctl, { frozen: s.phase !== 'play' })) if (e.k === 'hit') changed = onHit(room, s, e) || changed;
    if (s.phase === 'ready' && w.t >= s.until) {
      s.phase = 'play'; s.until = w.t + s.st.time;
      say(s, 'Partez !');
      return true;
    }
    if (s.phase === 'play') {
      for (const [pid, i] of Object.entries(s.who)) {
        const c = w.chars[i];
        if (c.m !== 'up' || s.prog[pid] >= 4 || touching(c) !== s.order[pid][s.prog[pid]]) continue;
        s.prog[pid]++;
        changed = true;
        if (s.prog[pid] >= 4) { endRound(room, s, 'fountains', pid); return true; }
        tell(s, pid, `✅ Fontaine ${fname(s.order[pid][s.prog[pid] - 1])} touchée !`, 'good');
        if (s.prog[pid] > s.best) {
          s.best = s.prog[pid];
          if (s.best === 3) say(s, '😱 Quelqu\'un a déjà touché 3 fontaines !');
        }
      }
      if (s.phase === 'play' && w.t >= s.until) {
        const a = alive(s);
        const max = Math.max(0, ...a.map((p) => s.prog[p] || 0));
        const top = a.filter((p) => (s.prog[p] || 0) === max);
        endRound(room, s, 'time', max > 0 && top.length === 1 ? top[0] : null);
        return true;
      }
    } else if (s.phase === 'reveal' && w.t >= s.until) {
      if (s.round >= s.st.rounds) s.phase = 'end';
      else startRound(room, s);
      return true;
    }
    return changed;
  },

  onLeave(room, s, pid) {
    if (!s.who || s.who[pid] == null) return;
    // Son bonhomme devient un passant (ou reste par terre s'il était éliminé).
    delete s.who[pid]; delete s.input[pid];
    checkLast(room, s);
  },

  view(room, s, pid) {
    const v = { phase: s.phase, round: s.round, rounds: s.st.rounds, color: s.color,
      winner: s.winner ? { pid: s.winner.pid, name: s.winner.pid ? nameOf(room, s.winner.pid) : null, how: s.winner.how } : null };
    if (pid === TV_PID) {
      // Tout le monde voit la télé : la place, mais jamais qui est qui (sauf à la révélation de fin de manche).
      return { ...v, world: s.world, until: s.until, best: s.best, say: s.say,
        reveal: s.phase === 'reveal' ? Object.entries(s.who).map(([p, i]) => ({ i, name: nameOf(room, p), out: !!s.out[p] })) : null };
    }
    const i = s.who[pid];
    return { ...v, msg: s.msg[pid] || null,
      me: i == null ? null : { order: s.order[pid], done: s.prog[pid] || 0, outBy: s.out[pid] ? nameOf(room, s.out[pid]) : null,
        cd: s.cd[pid] ? { n: s.cd[pid].n, dur: s.cd[pid].dur } : null } };
  },
  tv(room, s) { return this.view(room, s, TV_PID); },

  // ---------- Téléphone : la manette ----------
  mount(root, g) {
    const avatar = h('canvas', { class: 'fp-avatar', width: 132, height: 132, 'aria-hidden': 'true' });
    const roundEl = h('span', { class: 'pill' });
    const status = h('p', { class: 'fp-status' });
    const goalEls = [0, 1, 2, 3].map((k) => h('span', { class: 'fp-goal' }, h('b', null, String(k + 1))));
    const goals = h('div', { class: 'fp-goals', 'aria-label': 'Tes fontaines, dans l\'ordre' }, goalEls);
    const next = h('p', { class: 'fp-next' });
    const msg = h('div', { class: 'fp-msg hidden', role: 'status' });
    const over = h('div', { class: 'fp-over hidden' });
    const knob = h('div', { class: 'fp-knob' });
    const base = h('div', { class: 'fp-base' }, knob);
    const stick = h('div', { class: 'fp-stick', role: 'application', 'aria-label': 'Manette : glisse le doigt pour marcher (ou flèches du clavier)' },
      base, h('span', { class: 'fp-hint' }, 'Glisse pour marcher'));
    const cdBar = h('span', { class: 'fp-cd' });
    const pushBtn = h('button', { class: 'fp-push', 'aria-label': 'Pousser' }, cdBar, h('span', { class: 'fp-push-in' }, '💥', h('span', null, 'Pousser')));
    const ctrl = h('div', { class: 'fp-ctrl' }, stick, pushBtn);
    const pad = h('div', { class: 'foule-pad' },
      h('div', { class: 'fp-top' }, avatar, h('div', { class: 'col', style: { gap: '4px' } }, roundEl, status)),
      goals, next, msg, over, ctrl);
    const endBox = h('div', { class: 'col hidden' });
    root.append(pad, endBox);

    let view = null, color = -1, lastMsg = 0, lastCd = '', msgT = null, coolT = null, ended = false;
    let dir = -1, active = null, center = null, keys = new Set();
    const canMove = () => view && view.me && !view.me.outBy && (view.phase === 'play' || view.phase === 'ready');
    const sendDir = (d) => { if (d === dir) return; dir = d; g.send({ type: 'mv', d }); };
    // Tant qu'on tient la manette, on redit sa direction chaque seconde (l'hôte arrête un bonhomme sans nouvelles).
    const keep = setInterval(() => { if (dir >= 0) g.send({ type: 'mv', d: dir }); }, 1000);

    // Joystick : la base se place sous le doigt, le bouton suit le doigt (16 directions).
    const R = 52;
    function moveTo(x, y) {
      let dx = x - center.x, dy = y - center.y;
      const m = Math.hypot(dx, dy);
      if (m > R) { dx = (dx / m) * R; dy = (dy / m) * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      sendDir(m < 14 || !canMove() ? -1 : ((Math.round(Math.atan2(dy, dx) / (Math.PI / 8)) % 16) + 16) % 16);
    }
    function release() {
      active = null; center = null;
      knob.style.transform = '';
      base.style.left = ''; base.style.top = '';
      stick.classList.remove('on');
      sendDir(-1);
    }
    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (active != null) return;
      active = e.pointerId;
      try { stick.setPointerCapture(e.pointerId); } catch { /* */ }
      const r = stick.getBoundingClientRect();
      const x = Math.max(R + 8, Math.min(r.width - R - 8, e.clientX - r.left)), y = Math.max(R + 8, Math.min(r.height - R - 8, e.clientY - r.top));
      base.style.left = x + 'px'; base.style.top = y + 'px';
      center = { x: r.left + x, y: r.top + y };
      stick.classList.add('on');
      moveTo(e.clientX, e.clientY);
    });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === active) moveTo(e.clientX, e.clientY); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(ev, (e) => { if (e.pointerId === active) release(); });

    function push() {
      if (!canMove() || view.phase !== 'play' || pushBtn.classList.contains('cool')) return;
      pushBtn.classList.remove('hit'); void pushBtn.offsetWidth; pushBtn.classList.add('hit');
      buzz(25);
      g.send({ type: 'push' });
    }
    pushBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); push(); });
    pushBtn.addEventListener('click', (e) => { if (e.detail === 0) push(); }); // clavier (Entrée)

    // Clavier (ordinateur) : flèches ou ZQSD/WASD pour marcher, Espace pour pousser.
    const KEYS = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], d: [1, 0], q: [-1, 0], a: [-1, 0], z: [0, -1], w: [0, -1], s: [0, 1] };
    const keyDir = () => {
      let x = 0, y = 0;
      for (const k of keys) { x += KEYS[k][0]; y += KEYS[k][1]; }
      if (!x && !y) return -1;
      return ((Math.round(Math.atan2(y, x) / (Math.PI / 8)) % 16) + 16) % 16;
    };
    const onKey = (e) => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (e.type === 'keydown' && (k === ' ' || k === 'Enter')) { e.preventDefault(); if (!e.repeat) push(); return; }
      if (!KEYS[k]) return;
      e.preventDefault();
      if (e.type === 'keydown') keys.add(k); else keys.delete(k);
      if (active == null) sendDir(canMove() ? keyDir() : -1);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKey);

    function showMsg(m) {
      setText(msg, m.text);
      msg.className = 'fp-msg pop-in ' + (m.tone || '');
      clearTimeout(msgT);
      msgT = setTimeout(() => msg.classList.add('hidden'), 4200);
      if (m.tone === 'good') { sfx.ok(); buzz([30, 40, 30]); } else if (m.tone === 'bad') { sfx.bad(); buzz(200); }
    }

    function winnerText(v) {
      const w = v.winner;
      if (!w) return '';
      const mine = w.pid === g.me;
      if (w.how === 'fountains') return mine ? '🏆 Tu as touché tes 4 fontaines ! +3' : `🏆 ${w.name} a touché ses 4 fontaines !`;
      if (w.how === 'last') return mine ? '🏆 Tu es le dernier debout ! +2' : `🏆 ${w.name} est le dernier debout !`;
      if (w.how === 'time') return w.pid ? (mine ? '⏱️ Temps écoulé ! Tu étais le plus avancé : +1' : `⏱️ Temps écoulé ! ${w.name} était le plus avancé.`) : '⏱️ Temps écoulé ! Personne ne gagne la manche.';
      return 'Personne ne gagne la manche.';
    }

    return {
      update(room, v) {
        view = v;
        if (v.phase === 'end') {
          if (!ended) { ended = true; release(); pad.classList.add('hidden'); endBox.classList.remove('hidden'); endBox.replaceChildren(...endScreen(room, g)); }
          return;
        }
        if (ended) { ended = false; pad.classList.remove('hidden'); endBox.classList.add('hidden'); }
        if (v.color !== color) { color = v.color; drawAvatar(avatar, color, 'open'); }
        setText(roundEl, `Manche ${v.round} / ${v.rounds}`);
        const me = v.me;
        const playing = me && !me.outBy && v.phase !== 'reveal';
        let text = '';
        if (!me) text = '👀 Tu joueras à la prochaine manche. Regarde la télé !';
        else if (me.outBy) text = `😵 Tu es tombé ! ${me.outBy} t'a poussé. Regarde la fin de la manche sur la télé.`;
        else if (v.phase === 'reveal') text = winnerText(v) + (v.round < v.rounds ? ' Manche suivante dans un instant…' : '');
        over.classList.toggle('hidden', !text);
        if (text) setText(over, text);
        ctrl.classList.toggle('hidden', !playing);
        ctrl.classList.toggle('wait', v.phase === 'ready');
        if (!playing && (active != null || dir >= 0)) release();
        setText(status, v.phase === 'ready'
          ? `👀 Tu es l'un des bonshommes ${PALETTES[v.color].name} de la télé… Dès que ça part, bouge pour te trouver !`
          : '🙈 Marche comme tout le monde. Pousser te démasque !');
        status.classList.toggle('hidden', !playing);
        goals.classList.toggle('hidden', !me || !!me.outBy);
        if (me) {
          me.order.forEach((k, j) => {
            const el = goalEls[j];
            el.style.setProperty('--c', FOUNTAINS[k].c);
            el.classList.toggle('done', j < me.done);
            el.classList.toggle('next', j === me.done && playing);
          });
          setText(next, playing && me.done < 4 ? `🎯 Va toucher la fontaine ${fname(me.order[me.done])}` : '');
          const cdKey = me.cd ? v.round + ':' + me.cd.n : '';
          if (me.cd && cdKey !== lastCd) {
            // Le bouton se recharge (barre qui descend) puis redevient utilisable.
            lastCd = cdKey;
            cdBar.style.animationDuration = me.cd.dur + 's';
            pushBtn.classList.remove('cool'); void pushBtn.offsetWidth; pushBtn.classList.add('cool');
            clearTimeout(coolT);
            coolT = setTimeout(() => pushBtn.classList.remove('cool'), me.cd.dur * 1000);
          }
        } else setText(next, '');
        next.classList.toggle('hidden', !playing);
        if (v.msg && v.msg.n !== lastMsg) { const first = !lastMsg; lastMsg = v.msg.n; if (!first || v.phase === 'play') showMsg(v.msg); }
      },
      destroy() {
        clearInterval(keep); clearTimeout(msgT); clearTimeout(coolT);
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('keyup', onKey);
        if (dir >= 0) g.send({ type: 'mv', d: -1 });
      },
    };
  },

  // ---------- Télé : la place en grand ----------
  tvMount(root) {
    const cv = h('canvas', { class: 'foule-cv', 'aria-label': 'La place et la foule' });
    const roundEl = h('span', { class: 'fh-pill' });
    const bestEl = h('span', { class: 'fh-pill hidden' });
    const timeEl = h('span', { class: 'fh-pill fh-time hidden' });
    const tip = h('div', { class: 'fh-tip' });
    const big = tvSay();
    const sayBox = h('div', { class: 'foule-say' }, big.el);
    const wrap = h('div', { class: 'foule-tv' }, cv,
      h('div', { class: 'foule-hud' }, roundEl, bestEl, timeEl), sayBox, tip);
    // Grande phrase au milieu de la place : elle s'efface au bout de quelques secondes (sauf à la révélation).
    let sayT = null;
    const shout = (text, keep = false) => {
      clearTimeout(sayT);
      sayBox.classList.toggle('hidden', !text);
      sayBox.classList.toggle('num', /^\d$/.test(text));
      if (text) big.set(text);
      if (text && !keep) sayT = setTimeout(() => sayBox.classList.add('hidden'), 2600);
    };
    const stg = tvStage(root, wrap);
    const scene = createScene(cv, { sound: { push: () => sfx.swoosh(), hit: () => sfx.boing(), thud: () => sfx.thud() } });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => scene.resize()) : null;
    if (ro) ro.observe(cv);
    let v = null, last = 0, raf = 0, lastSec = null, lastSay = 0, lastTip = null, revealOf = 0, tLeft = null;

    function hud() {
      const t = v.world.t;
      if (v.phase === 'ready') {
        const n = Math.ceil(v.until - t);
        if (n !== lastSec && n > 0) { lastSec = n; shout(String(n), true); sfx.tick(); }
      }
      const left = v.phase === 'play' ? Math.max(0, Math.ceil(v.until - t)) : null;
      if (left !== tLeft) {
        tLeft = left;
        timeEl.classList.toggle('hidden', left == null);
        if (left != null) { setText(timeEl, `⏱️ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`); timeEl.classList.toggle('low', left <= 10); }
      }
    }
    const loop = (ts) => {
      raf = requestAnimationFrame(loop);
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
      last = ts;
      if (!v || !v.world || !cv.isConnected) return;
      scene.draw(v.world, { color: v.color, reveal: v.reveal, dt });
      hud();
    };
    raf = requestAnimationFrame(loop);

    return {
      update(room, nv) {
        v = nv;
        if (stg.end(room, v.phase === 'end')) return;
        setText(roundEl, `Manche ${v.round} / ${v.rounds}`);
        bestEl.classList.toggle('hidden', !(v.phase === 'play' && v.best > 0));
        if (v.best > 0) setText(bestEl, `🎯 Le plus avancé : ${v.best} / 4`);
        const t = v.phase === 'ready' ? '📱 Bougez votre manette pour vous trouver… discrètement !' : v.phase === 'play' ? '🙈 Les passants ne poussent jamais : pousser vous démasque !' : '';
        if (t !== lastTip) { lastTip = t; setText(tip, t); tip.classList.toggle('hidden', !t); }
        if (v.say && v.say.n !== lastSay) {
          lastSay = v.say.n;
          if (v.say.text) { shout(v.say.text, v.phase === 'reveal'); if (v.say.text === 'Partez !') sfx.go(); }
          else { lastSec = null; shout(''); }
        }
        if (v.phase === 'reveal' && revealOf !== v.round) { revealOf = v.round; sfx.fanfare(); }
      },
      destroy() { cancelAnimationFrame(raf); clearTimeout(sayT); if (ro) ro.disconnect(); },
    };
  },
};
