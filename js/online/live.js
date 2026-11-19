// Jeux en ligne en temps réel : Patate chaude, Réflexes, Couleurs pièges.
import { h, uid, shuffle, seg, pick, rand } from '../ui.js';
import { gameColors } from '../themes.js';
import { sip } from '../store.js';
import { sfx, buzz } from '../sfx.js';
import { activePids, addScore, nextOn, card, endScreen, actBtn } from './kit.js';
import PATATE from '../data/patate.js';
import { COLORS } from '../games/couleurs.js';

const name = (g, pid) => (pid === g.me ? 'Toi' : g.nameOf(pid));
const roundsSeg = (st, set, vals = [3, 5, 8]) => h('label', { class: 'field' }, 'Nombre de manches', seg(vals.map((n) => ({ value: n, label: String(n) })), st.rounds, (v) => set({ rounds: v })));

// =====================================================================
// PATATE CHAUDE
// =====================================================================
const FUSE = { court: [10, 25], normal: [20, 45], long: [35, 70] };
function patateTheme(mode) {
  const m = mode === 'mix' ? pick(['categories', 'syllabes', 'lettres']) : mode;
  if (m === 'categories') return { kicker: 'Cite…', text: pick(PATATE.categories) };
  if (m === 'syllabes') return { kicker: 'Un mot qui contient', text: `« ${pick(PATATE.syllabes)} »` };
  return { kicker: 'Un mot qui commence par', text: pick(PATATE.lettres) };
}

export const patateOnline = {
  id: 'patate', name: 'Patate chaude', short: 'La bombe passe de téléphone en téléphone', emoji: '💣', minPlayers: 2,
  defaults: { mode: 'categories', dur: 'normal', rounds: 5 },
  settingsForm(st, set) {
    return h('div', { class: 'col' },
      h('label', { class: 'field' }, 'Thèmes', seg([{ value: 'categories', label: 'Catégories' }, { value: 'syllabes', label: 'Syllabes' }, { value: 'lettres', label: 'Lettres' }, { value: 'mix', label: 'Mélange' }], st.mode, (v) => set({ mode: v }))),
      h('label', { class: 'field' }, 'Mèche', seg([{ value: 'court', label: 'Courte' }, { value: 'normal', label: 'Normale' }, { value: 'long', label: 'Longue' }], st.dur, (v) => set({ dur: v }))),
      roundsSeg(st, set));
  },
  init(room, st) {
    const s = { gid: uid(), st, order: shuffle(activePids(room)), round: 0 };
    patateRound(room, s);
    return s;
  },
  action(room, s, pid, a) {
    if (a.type === 'pass' && s.phase === 'play' && pid === s.holder) {
      const to = a.to && a.to !== pid && activePids(room).includes(a.to) ? a.to : nextOn(room, s.order, pid);
      if (to === pid) return false;
      s.holder = to; s.passes++;
      return true;
    }
    if (a.type === 'next' && s.phase === 'boom' && pid === room.host) { patateRound(room, s); return true; }
    return false;
  },
  tick(room, s) {
    if (s.phase === 'play' && Date.now() >= s.end) {
      s.phase = 'boom'; s.loser = s.holder;
      for (const p of activePids(room)) if (p !== s.loser) addScore(room, p, 1);
      return true;
    }
    return false;
  },
  onLeave(room, s, pid) { if (pid === s.holder && s.phase === 'play') s.holder = nextOn(room, s.order, pid); },
  onJoin(room, s, pid) { if (!s.order.includes(pid)) s.order.push(pid); },
  view(room, s) { return { gid: s.gid, round: s.round, rounds: s.st.rounds, phase: s.phase, theme: s.theme, holder: s.holder, start: s.start, end: s.end, loser: s.loser, passes: s.passes, next: s.phase === 'play' ? nextOn(room, s.order, s.holder) : null }; },
  mount(root, g) {
    const colors = gameColors('patate', ['#ee0979', '#ff6a00']);
    const main = h('div', { class: 'col' });
    root.append(main);
    let v = null, lastKey = null, timer = null, r = null;
    const loop = () => {
      if (!v || v.phase !== 'play') return;
      const f = Math.min(1, Math.max(0, (g.now() - v.start) / (v.end - v.start)));
      if (v.holder === g.me) { Math.floor(g.now() / 100) % 2 ? sfx.tick() : sfx.tock(); } else if (f > 0.5) sfx.tick();
      const bomb = main.querySelector('.bomb');
      if (bomb) bomb.classList.toggle('fast', f > 0.65);
      timer = setTimeout(loop, Math.max(110, 620 - 520 * f));
    };
    return {
      update(room, view) {
        v = view; r = room;
        if (v.phase === 'end') { clearTimeout(timer); main.replaceChildren(...endScreen(r, g, 'Fin de la partie !', h('p', { class: 'center muted' }, 'Un point par bombe évitée.'))); if (lastKey !== 'end') sfx.fanfare(); lastKey = 'end'; return; }
        const key = `${v.gid}:${v.round}:${v.phase}`;
        const me = v.holder === g.me;
        const parts = [h('div', { class: 'row' }, h('span', { class: 'pill' }, `💣 ${v.round}/${v.rounds}`), h('div', { class: 'grow' }), h('span', { class: 'pill' }, `🔁 ${v.passes} passe${v.passes > 1 ? 's' : ''}`)),
          card(colors, v.theme.kicker, v.theme.text)];
        if (v.phase === 'play') {
          if (me) {
            parts.push(h('div', { class: 'big-center', style: { padding: '0' } }, h('div', { class: 'bomb shake' }, '💣'), h('h2', null, 'Tu as la bombe ! Réponds à voix haute…')),
              h('button', { class: 'btn btn-bad btn-big btn-block', onclick: () => { g.send({ type: 'pass' }); sfx.swoosh(); buzz(20); } }, `… et passe-la à ${g.nameOf(v.next)} ➡️`),
              h('div', { class: 'chips', style: { justifyContent: 'center' } }, r.players.filter((p) => p.on && p.pid !== g.me).map((p) => h('button', { class: 'chip', onclick: () => { g.send({ type: 'pass', to: p.pid }); sfx.swoosh(); } }, `➡️ ${p.name}`))));
          } else {
            parts.push(h('div', { class: 'big-center', style: { padding: '0' } }, h('div', { class: 'bomb shake', style: { fontSize: '80px' } }, '💣'), h('h2', null, `${g.nameOf(v.holder)} a la bombe !`), h('p', { class: 'muted' }, v.next === g.me ? '😰 Tu es le prochain… prépare ta réponse !' : 'Prépare ta réponse, ça peut tomber sur toi !')));
          }
        } else {
          parts.push(h('div', { class: 'big-center', style: { padding: '0' } }, h('div', { class: 'bomb' }, '💥'), h('h2', { style: { fontSize: '40px' } }, 'BOUM !'),
            h('p', null, v.loser === g.me ? `C'est toi qui avais la bombe ! Tu prends ${sip(2)}.` : `${g.nameOf(v.loser)} avait la bombe et prend ${sip(2)} !`)));
          if (g.isHost) parts.push(actBtn(g, '💣 Manche suivante', 'next', 'btn-primary btn-big'));
        }
        if (key !== lastKey) {
          clearTimeout(timer);
          if (v.phase === 'play') { sfx.go(); loop(); }
          if (v.phase === 'boom') { sfx.boom(); buzz(v.loser === g.me ? [400, 100, 400, 100, 600] : [200, 100, 200]); }
        }
        if (v.phase === 'play' && me && main.dataset.h !== g.me) buzz([60, 40, 60]);
        main.dataset.h = v.holder;
        lastKey = key;
        main.replaceChildren(...parts);
      },
      destroy() { clearTimeout(timer); },
    };
  },
};
function patateRound(room, s) {
  s.round++;
  if (s.round > s.st.rounds) { s.phase = 'end'; return; }
  const [a, b] = FUSE[s.st.dur] || FUSE.normal;
  const on = activePids(room);
  s.theme = patateTheme(s.st.mode);
  s.holder = pick(on);
  s.start = Date.now();
  s.end = s.start + rand(a, b) * 1000;
  s.passes = 0; s.loser = null; s.phase = 'play';
}

// =====================================================================
// RÉFLEXES
// =====================================================================
export const reflexesOnline = {
  id: 'reflexes', name: 'Réflexes', short: 'Touche dès que ça passe au vert', emoji: '⚡', minPlayers: 2,
  defaults: { rounds: 5 },
  settingsForm: (st, set) => roundsSeg(st, set, [3, 5, 10]),
  init(room, st) { const s = { gid: uid(), st, round: 0 }; reflexRound(s); return s; },
  action(room, s, pid, a) {
    if (a.type !== 'tap' || s.phase !== 'wait' || s.taps[pid] || typeof a.at !== 'number') return false;
    const at = Math.min(a.at, Date.now() + 500);
    s.taps[pid] = at < s.goAt ? { fs: true } : { rt: Math.max(0, Math.round(at - s.goAt)) };
    if (activePids(room).every((p) => s.taps[p])) reflexResult(room, s);
    return true;
  },
  tick(room, s) {
    const now = Date.now();
    if (s.phase === 'wait' && now > s.goAt + 3000) { reflexResult(room, s); return true; }
    if (s.phase === 'result' && now > s.until) { reflexRound(s); return true; }
    return false;
  },
  view(room, s, pid) { return { gid: s.gid, round: s.round, rounds: s.st.rounds, phase: s.phase, goAt: s.goAt, mine: s.taps[pid] || null, ranking: s.ranking }; },
  mount(root, g) {
    const main = h('div', { class: 'col' });
    root.append(main);
    let lastKey = null, t = null;
    return {
      update(r, v) {
        if (v.phase === 'end') { clearTimeout(t); main.replaceChildren(...endScreen(r, g)); if (lastKey !== 'end') sfx.fanfare(); lastKey = 'end'; return; }
        const key = `${v.gid}:${v.round}:${v.phase}`;
        const head = h('div', { class: 'row' }, h('span', { class: 'pill' }, `⚡ Manche ${v.round}/${v.rounds}`), h('div', { class: 'grow' }), h('span', { class: 'pill' }, '🏆 ' + ((r.players.find((p) => p.pid === g.me) || {}).score || 0)));
        if (v.phase === 'wait') {
          if (key === lastKey && !v.mine) return; // ne pas recréer la zone pendant l'attente
          const zone = h('button', { class: 'reflex-zone' + (v.mine ? (v.mine.fs ? ' early' : ' done') : ' wait') });
          const label = h('div', { class: 'reflex-txt' });
          zone.append(label);
          const setGreen = () => { if (!zone.classList.contains('wait')) return; zone.classList.replace('wait', 'go'); label.textContent = 'TOUCHE !'; sfx.go(); buzz(30); };
          if (v.mine) label.textContent = v.mine.fs ? '😬 Trop tôt ! (−1)' : `⚡ ${v.mine.rt} ms`;
          else {
            label.textContent = 'Attends le vert…';
            clearTimeout(t);
            const wait = v.goAt - g.now();
            if (wait <= 0) setGreen(); else t = setTimeout(setGreen, wait);
            zone.addEventListener('pointerdown', (e) => { e.preventDefault(); g.send({ type: 'tap', at: g.now() }); }, { once: true });
          }
          main.replaceChildren(head, zone, h('p', { class: 'center muted small' }, 'Touche la zone dès qu\'elle devient verte. Trop tôt = −1 point.'));
        } else {
          clearTimeout(t);
          main.replaceChildren(head, h('h2', { class: 'center' }, 'Résultats'),
            h('div', { class: 'scoreboard' }, v.ranking.map((x, i) => h('div', { class: 'score-row' + (i === 0 && !x.fs ? ' lead' : '') },
              h('span', null, x.fs ? '😬' : x.rt == null ? '💤' : ['🥇', '🥈', '🥉'][i] || `${i + 1}.`), h('span', { class: 'n' }, name(g, x.pid)),
              h('span', { class: 'muted small' }, x.fs ? 'trop tôt' : x.rt == null ? 'trop lent' : `${x.rt} ms`), h('span', { class: 's' }, x.pts > 0 ? `+${x.pts}` : String(x.pts))))),
            h('p', { class: 'status-line' }, v.round < v.rounds ? 'Manche suivante dans un instant…' : 'Dernière manche !'));
          if (key !== lastKey) { const mine = v.ranking.find((x) => x.pid === g.me); mine && mine.pts > 0 ? sfx.ok() : sfx.bad(); }
        }
        lastKey = key;
      },
      destroy() { clearTimeout(t); },
    };
  },
};
function reflexRound(s) {
  s.round++;
  if (s.round > s.st.rounds) { s.phase = 'end'; return; }
  s.phase = 'wait'; s.taps = {}; s.ranking = null;
  s.goAt = Date.now() + 2500 + rand(1000, 4000);
}
function reflexResult(room, s) {
  const list = activePids(room).map((pid) => ({ pid, ...(s.taps[pid] || { rt: null }) }));
  list.sort((a, b) => (a.fs - b.fs) || ((a.rt ?? 1e9) - (b.rt ?? 1e9)));
  const pts = [3, 2, 1];
  let k = 0;
  for (const x of list) {
    x.pts = x.fs ? -1 : x.rt == null ? 0 : (pts[k++] || 0);
    if (x.pts) addScore(room, x.pid, x.pts);
  }
  s.ranking = list;
  s.phase = 'result';
  s.until = Date.now() + 4500;
}

// =====================================================================
// COULEURS PIÈGES
// =====================================================================
export const couleursOnline = {
  id: 'couleurs', name: 'Couleurs pièges', short: 'Touche la couleur de l\'encre', emoji: '🌈', minPlayers: 2,
  defaults: { time: 30, level: 'normal', rounds: 3 },
  settingsForm(st, set) {
    return h('div', { class: 'col' },
      h('label', { class: 'field' }, 'Difficulté', seg([{ value: 'normal', label: '🙂 Normal' }, { value: 'piege', label: '😈 Piège' }], st.level, (v) => set({ level: v }))),
      h('label', { class: 'field' }, 'Durée d\'une manche', seg([20, 30, 45].map((n) => ({ value: n, label: n + ' s' })), st.time, (v) => set({ time: v }))),
      roundsSeg(st, set, [1, 3, 5]));
  },
  init(room, st) { const s = { gid: uid(), st, round: 0 }; colorRound(s); return s; },
  action(room, s, pid, a) {
    if (a.type === 'score' && (s.phase === 'play' || s.phase === 'ready') && Number.isInteger(a.n) && a.n >= 0 && a.n < 500) { s.scores[pid] = a.n; return true; }
    if (a.type === 'next' && pid === room.host && s.phase === 'result') { colorRound(s); return true; }
    return false;
  },
  tick(room, s) {
    const now = Date.now();
    if (s.phase === 'ready' && now >= s.startAt) { s.phase = 'play'; return true; }
    if (s.phase === 'play' && (now >= s.endAt + 2500 || (now >= s.endAt && activePids(room).every((p) => s.scores[p] != null)))) {
      for (const [p, n] of Object.entries(s.scores)) addScore(room, p, n);
      s.phase = 'result';
      return true;
    }
    return false;
  },
  view(room, s) { return { gid: s.gid, round: s.round, rounds: s.st.rounds, phase: s.phase, startAt: s.startAt, endAt: s.endAt, time: s.st.time, level: s.st.level, scores: s.phase === 'result' ? s.scores : null }; },
  mount(root, g) {
    const main = h('div', { class: 'col' });
    root.append(main);
    let lastKey = null, timers = [], iv = null;
    const clear = () => { timers.forEach(clearTimeout); timers = []; clearInterval(iv); };
    function play(v) {
      const pal = v.level === 'piege' ? COLORS : COLORS.slice(0, 4);
      let score = 0, streak = 0, frozen = false, target = null, sent = false;
      const scoreEl = h('span', { class: 'pill' }, '⭐ 0');
      const timeEl = h('span', { class: 'pill timer-num', style: { fontSize: '15px' } });
      const word = h('div', { class: 'stroop-word' });
      const btns = h('div', { class: 'stroop-btns' + (pal.length > 4 ? ' six' : '') });
      main.replaceChildren(h('div', { class: 'row' }, h('span', { class: 'pill' }, `🌈 ${v.round}/${v.rounds}`), h('div', { class: 'grow' }), scoreEl, timeEl), word, btns);
      const rnd = (n) => Math.floor(Math.random() * n);
      const next = () => {
        const w = pal[rnd(pal.length)];
        let ink = pal[rnd(pal.length)];
        if (Math.random() < 0.85) while (ink.id === w.id) ink = pal[rnd(pal.length)];
        target = ink.id;
        word.textContent = w.name; word.style.color = ink.c;
        word.classList.remove('pop'); void word.offsetWidth; word.classList.add('pop');
        btns.replaceChildren(...pal.slice().sort(() => Math.random() - 0.5).map((c) => {
          const label = v.level === 'piege' ? pal[rnd(pal.length)] : null;
          const b = h('button', { class: 'stroop-btn' + (label ? ' piege' : ''), style: { '--c': c.c, color: label ? label.c : null }, 'aria-label': c.name.toLowerCase() }, label ? h('span', null, label.name) : null);
          b.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            if (frozen) return;
            if (c.id === target) { streak++; score += streak >= 5 ? 2 : 1; sfx.pop(); next(); } else { streak = 0; score = Math.max(0, score - 1); sfx.bad(); buzz([80, 40, 80]); b.classList.add('wrong'); frozen = true; timers.push(setTimeout(() => { frozen = false; next(); }, 600)); }
            scoreEl.textContent = `⭐ ${score}${streak >= 5 ? ' 🔥' : ''}`;
          });
          return b;
        }));
      };
      next();
      sfx.go();
      iv = setInterval(() => {
        const left = v.endAt - g.now();
        timeEl.textContent = '⏱ ' + Math.max(0, Math.ceil(left / 1000));
        if (left <= 0 && !sent) {
          sent = true; frozen = true; clearInterval(iv);
          g.send({ type: 'score', n: score });
          sfx.end();
          main.replaceChildren(h('div', { class: 'big-center' }, h('div', { class: 'hero-emo' }, '⏰'), h('h2', null, `${score} point${score > 1 ? 's' : ''}`), h('p', { class: 'muted' }, 'On attend les autres…')));
        }
      }, 100);
    }
    return {
      update(r, v) {
        if (v.phase === 'end') { clear(); main.replaceChildren(...endScreen(r, g)); if (lastKey !== 'end') sfx.fanfare(); lastKey = 'end'; return; }
        const key = `${v.gid}:${v.round}:${v.phase}`;
        if (key === lastKey) return;
        lastKey = key;
        if (v.phase === 'ready') {
          clear();
          const num = h('div', { class: 'countdown-num' });
          main.replaceChildren(h('div', { class: 'big-center' }, h('h2', null, `Manche ${v.round}/${v.rounds}`), h('p', { class: 'muted' }, 'Touche la couleur de l\'ENCRE, pas le mot écrit !'), num));
          iv = setInterval(() => { const n = Math.ceil((v.startAt - g.now()) / 1000); if (n > 0 && num.textContent !== String(n)) { num.textContent = String(n); sfx.beep(); } if (n <= 0) { clearInterval(iv); play(v); } }, 100);
        } else if (v.phase === 'play') {
          if (!main.querySelector('.stroop-word') && !main.querySelector('.hero-emo')) { clear(); play(v); }
        } else if (v.phase === 'result') {
          clear();
          const rows = r.players.map((p) => ({ p, n: v.scores[p.pid] ?? 0 })).sort((a, b) => b.n - a.n);
          main.replaceChildren(h('h2', { class: 'center' }, `Manche ${v.round} : résultats`),
            h('div', { class: 'scoreboard' }, rows.map((x, i) => h('div', { class: 'score-row' + (i === 0 ? ' lead' : '') }, h('span', null, ['🥇', '🥈', '🥉'][i] || `${i + 1}.`), h('span', { class: 'n' }, x.p.pid === g.me ? 'Toi' : x.p.name), h('span', { class: 'muted small' }, `total ${x.p.score}`), h('span', { class: 's' }, `+${x.n}`)))),
            h('p', { class: 'center muted' }, `${rows[rows.length - 1].p.name} a le plus petit score : ${sip(1)} !`),
            g.isHost ? actBtn(g, v.round < v.rounds ? 'Manche suivante →' : '🏆 Classement final', 'next', 'btn-primary btn-big') : null);
          sfx.end();
        }
      },
      destroy() { clear(); },
    };
  },
};
function colorRound(s) {
  s.round++;
  if (s.round > s.st.rounds) { s.phase = 'end'; return; }
  s.phase = 'ready'; s.scores = {};
  s.startAt = Date.now() + 3500;
  s.endAt = s.startAt + s.st.time * 1000;
}
