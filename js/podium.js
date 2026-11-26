// Podium de fin de partie, façon remise des prix : la 3e marche sort du sol, puis la 2e (clochette à chaque fois),
// roulement de tambour pendant que la marche du gagnant monte (« ? » qui tremble), puis on dévoile le gagnant :
// coup de cymbale, couronne, rayons, flash, canons à confettis, fanfare et applaudissements (sons de js/sfx.js).
//
// Règle d'or : beaucoup d'écrans de fin refont leur podium à chaque mise à jour (un joueur qui se reconnecte…).
// Le spectacle est donc tenu ici, hors des éléments : un podium identique (mêmes 3 premiers, mêmes scores) créé
// pendant que le précédent est encore affiché reprend le spectacle là où il en est, sans rejouer sons et confettis.
import { h } from './ui.js';
import { sfx, buzz } from './sfx.js';

const AV_COLORS = ['#ff4d8d', '#2ec5ff', '#ffb020', '#22d39a', '#b07cff', '#ff7a45', '#13c4b5', '#f25fd0'];
const RISE = 560;    // montée d'une marche (ms)
const GAP = 850;     // entre deux marches
const ROLL = 1750;   // roulement de tambour avant le gagnant
const COUNT = 700;   // le score défile de 0 à sa valeur

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const colorOf = (name) => { let x = 0; for (const ch of String(name)) x = (x * 31 + ch.codePointAt(0)) >>> 0; return AV_COLORS[x % AV_COLORS.length]; };
const initial = (name) => { const m = String(name).trim().match(/\p{L}|\p{N}/u); return m ? m[0].toUpperCase() : '?'; };
const ease = (k) => 1 - Math.pow(1 - k, 3);
const joinNames = (a) => (a.length > 1 ? a.slice(0, -1).join(', ') + ' et ' + a[a.length - 1] : a[0]);

let show = null; // spectacle en cours : { sig, t0, reveal, end, els, stopSound, confetti, revealed, raf }

/**
 * Podium + classement à partir de [{ name, score, me }] (me : c'est le joueur de ce téléphone).
 * live : tableau des scores qui bouge pendant la partie (compteur de points) → pas de spectacle.
 */
export function podium(list, { live = false } = {}) {
  const sorted = list.slice().sort((a, b) => b.score - a.score);
  if (!sorted.length) return h('div', { class: 'podium-show live' });
  const rankOf = (p) => 1 + sorted.filter((q) => q.score > p.score).length;
  const top = sorted.slice(0, 3).map((p) => ({ ...p, rank: rankOf(p) }));
  const winners = top.filter((p) => p.rank === 1);
  // Ordre d'apparition : les moins bien classés d'abord, puis le roulement et tous les premiers ensemble.
  let t = 300;
  for (const p of top.filter((q) => q.rank > 1).sort((a, b) => b.rank - a.rank)) { p.at = t; t += GAP; }
  const rollAt = t - (winners.length < top.length ? 250 : 0);
  const reveal = rollAt + ROLL;
  for (const p of winners) p.at = rollAt;
  const rest = sorted.slice(3);
  const end = reveal + 700 + Math.min(rest.length, 12) * 90;

  const order = top.length >= 3 ? [1, 0, 2] : top.length === 2 ? [1, 0] : [0];
  const places = order.map((i) => {
    const p = top[i];
    const r = Math.min(p.rank, 3);
    return h('div', { class: `st r${r}` + (p.rank === 1 ? ' win' : '') + (p.me ? ' me' : ''), 'data-at': p.at, 'data-score': p.score },
      h('div', { class: 'pod-who' },
        p.rank === 1 ? h('div', { class: 'pod-crown' }, '👑') : null,
        h('div', { class: 'pod-av', style: { '--av': colorOf(p.name) } },
          h('span', { class: 'pod-l' }, initial(p.name)),
          p.rank === 1 ? h('span', { class: 'pod-q' }, '?') : null),
        h('div', { class: 'nm' }, p.me ? `${p.name} (toi)` : p.name)),
      h('div', { class: 'blk' },
        h('span', { class: 'pod-medal' }, String(p.rank)),
        h('b', { class: 'pod-score' }, live ? String(p.score) : '0')));
  });
  const rows = rest.map((p, i) => h('div', { class: 'score-row' + (p.me ? ' me' : ''), 'data-at': reveal + 650 + Math.min(i, 12) * 90 },
    h('span', null, `${rankOf(p)}.`), h('span', { class: 'n' }, p.me ? `${p.name} (toi)` : p.name), h('span', { class: 's' }, String(p.score))));

  const names = winners.slice().sort((a, b) => !!a.me - !!b.me).map((p) => (p.me ? 'toi' : p.name));
  const ribbon = winners.length > 1 ? `Égalité : ${joinNames(names)} !` : winners[0].me ? 'Bravo, tu as gagné !' : `Bravo ${winners[0].name} !`;
  const el = h('div', { class: 'podium-show' + (live ? ' live' : ''), 'data-reveal': reveal },
    live ? null : h('div', { class: 'pod-ribbon' }, h('span', null, ribbon)),
    h('div', { class: 'pod-stage' },
      live ? null : h('div', { class: 'pod-rays' }),
      h('div', { class: 'podium' + (top.length === 1 ? ' solo' : '') }, places),
      live ? null : h('div', { class: 'pod-sparks' }, [0, 1, 2, 3, 4, 5].map((i) => h('i', { style: { '--i': i } })))),
    rows.length ? h('div', { class: 'scoreboard pod-rest' }, rows) : null);

  if (live) { apply(el, Infinity, true); return el; }
  const sig = JSON.stringify(top.map((p) => [p.name, p.score]));
  const now = performance.now();
  const joining = show && show.sig === sig && (show.raf || [...show.els.keys()].some((n) => n.isConnected));
  if (joining) {
    // Même podium refait par une mise à jour : il reprend où en est le spectacle, sans rejouer ce qui est passé.
    show.els.set(el, now);
    apply(el, now - show.t0, true);
    return el;
  }
  if (show) stopShow(show);
  const calm = reduced();
  show = { sig, t0: now, reveal, end, els: new Map([[el, now]]), revealed: false, raf: 0, confetti: null, stopSound: null, landed: new Set() };
  if (calm) {
    // Animations réduites : tout de suite à sa place, juste la fanfare et les applaudissements.
    apply(el, Infinity, true);
    show.t0 = now - end;
    show.stopSound = sfx.party({ rises: [], roll: null, reveal: 0.1 });
    buzz([60, 40, 160]);
    return el;
  }
  show.stopSound = sfx.party({
    rises: top.filter((p) => p.rank > 1).sort((a, b) => a.at - b.at).map((p) => ({ at: p.at / 1000, rank: p.rank })),
    roll: { at: rollAt / 1000, dur: ROLL / 1000 },
    reveal: reveal / 1000,
  });
  const s = show;
  const loop = (time) => {
    s.raf = 0;
    if (show !== s) return;
    const e = time - s.t0;
    let alive = false;
    for (const [node, born] of s.els) {
      if (node.isConnected) { alive = true; apply(node, e, false); } else if (time - born > 600) s.els.delete(node);
      else alive = true;
    }
    if (!alive) { stopShow(s); show = null; return; }
    const shown = [...s.els.keys()].find((n) => n.isConnected);
    // Petites gerbes de confettis quand une marche arrive, la grande fête quand le gagnant est dévoilé.
    if (shown) {
      for (const st of shown.querySelectorAll('.st:not(.win)')) {
        const at = Number(st.dataset.at);
        if (e >= at + RISE * 0.8 && !s.landed.has(at)) { s.landed.add(at); if (e < at + RISE + 400) confettiOf(s).puff(st.querySelector('.blk'), st.classList.contains('r2') ? 'silver' : 'bronze'); }
      }
      if (e >= s.reveal && !s.revealed) {
        s.revealed = true;
        if (e < s.reveal + 800) {
          const win = shown.querySelector('.st.win .blk') || shown.querySelector('.podium');
          confettiOf(s).party(win);
          buzz(shown.querySelector('.st.win.me') ? [80, 50, 80, 50, 240] : [60, 40, 160]);
        }
      }
    }
    // On continue tant que ça bouge ou que la fête sonore dure (pour la couper si on quitte l'écran).
    if (e < Math.max(s.end, s.reveal + 6000) || (s.confetti && s.confetti.busy())) s.raf = requestAnimationFrame(loop);
  };
  s.raf = requestAnimationFrame(loop);
  return el;
}

/** Arrête un spectacle : son coupé en fondu, confettis retirés. */
function stopShow(s) {
  if (s.raf) cancelAnimationFrame(s.raf);
  s.raf = 0;
  if (s.stopSound) s.stopSound();
  s.stopSound = null;
  if (s.confetti) s.confetti.stop();
  s.confetti = null;
}

/** Met un podium dans l'état du spectacle à l'instant e (ms). still : ce qui est déjà passé arrive sans animation. */
function apply(el, e, still) {
  const reveal = Number(el.dataset.reveal);
  for (const st of el.querySelectorAll('.st')) {
    const at = Number(st.dataset.at), win = st.classList.contains('win');
    if (e >= at && !st.classList.contains('up')) { st.classList.add('up'); if (still && e - at > 150) st.classList.add('still'); }
    const showAt = win ? reveal : at + RISE * 0.55;
    if (e >= showAt && !st.classList.contains('shown')) { st.classList.add('shown'); if (still && e - showAt > 150) st.classList.add('still-who'); }
    // Le score défile de 0 à sa valeur quand la marche est arrivée (au dévoilement pour le gagnant).
    const from = win ? reveal : at + RISE;
    const k = Math.max(0, Math.min(1, (e - from) / COUNT));
    const v = win && e < reveal ? '?' : String(Math.round(Number(st.dataset.score) * ease(k)));
    const sc = st.querySelector('.pod-score');
    if (sc.textContent !== v) sc.textContent = v;
  }
  if (e >= reveal && !el.classList.contains('revealed')) { el.classList.add('revealed'); if (still && e - reveal > 150) el.classList.add('still'); }
  for (const row of el.querySelectorAll('.pod-rest .score-row')) {
    if (e >= Number(row.dataset.at) && !row.classList.contains('on')) { row.classList.add('on'); if (still) row.classList.add('still'); }
  }
}

/** Fête sans podium (fin des jeux par équipes) : canons à confettis, fanfare et applaudissements. */
export function celebrate() {
  if (show) stopShow(show);
  const s = { sig: null, t0: performance.now(), els: new Map(), confetti: null, raf: 0 };
  show = s;
  s.stopSound = sfx.party({ rises: [], roll: null, reveal: 0.05 });
  buzz([60, 40, 160]);
  if (!reduced()) confettiOf(s).party(null);
  // Arrêté quand un autre spectacle commence (ou à la fin des confettis, tout seul).
  return () => { if (show === s) { stopShow(s); show = null; } };
}

// ---------- Confettis (un canvas par-dessus tout l'écran, qui ne gêne pas les doigts) ----------
const COLORS = ['#ffd23f', '#ff4d8d', '#2ec5ff', '#22d39a', '#b07cff', '#ff7a45', '#ffffff', '#ff5a5f'];
const TINTS = { gold: ['#ffd23f', '#ffe98a', '#ffb800', '#fff3b0'], silver: ['#e9eef5', '#c3cbd6', '#ffffff', '#9aa6b6'], bronze: ['#e0965a', '#ffc89a', '#b5642c', '#ffe0c4'] };

function confettiOf(s) {
  if (!s.confetti) { const c = confettiLayer(() => { if (s.confetti === c) s.confetti = null; }); s.confetti = c; }
  return s.confetti;
}

/** Calque de confettis. onDone : appelé quand tout est retombé (le calque s'est alors retiré). */
function confettiLayer(onDone) {
  const cv = h('canvas', { class: 'confetti', 'aria-hidden': 'true' });
  document.body.append(cv);
  const cx = cv.getContext('2d');
  const parts = [];
  const timers = [];
  let W = 0, H = 0, raf = 0, last = 0, stopped = false, pending = 0;
  const size = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  window.addEventListener('resize', size);
  const unit = () => Math.max(1, Math.min(W, H) / 400); // taille des confettis : plus grands sur la télé

  function add(x, y, n, { angle = -Math.PI / 2, spread = 0.6, speed = [500, 900], colors = COLORS, g = 1 } = {}) {
    if (stopped) return;
    const u = unit();
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * spread * 2;
      const v = (speed[0] + Math.random() * (speed[1] - speed[0])) * Math.sqrt(H / 700);
      parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g,
        r: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 14,
        f: Math.random() * Math.PI * 2, vf: 6 + Math.random() * 10,
        w: (5 + Math.random() * 6) * u, hh: (8 + Math.random() * 8) * u,
        kind: Math.random() < 0.18 ? 1 : Math.random() < 0.12 ? 2 : 0, // 0 rectangle, 1 rond, 2 étoile
        c: colors[(Math.random() * colors.length) | 0], life: 0,
      });
    }
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
  }
  function star(r) {
    cx.beginPath();
    for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, d = i % 2 ? r * 0.45 : r; cx.lineTo(Math.cos(a) * d, Math.sin(a) * d); }
    cx.closePath(); cx.fill();
  }
  function step(now) {
    raf = 0;
    if (stopped) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    cx.clearRect(0, 0, W, H);
    const G = H * 0.95;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      const drag = Math.pow(0.18, dt); // l'air freine les confettis : ils finissent par voleter
      p.vx *= drag; p.vy = p.vy * drag + G * p.g * dt;
      if (p.vy > H * 0.28) p.vy = H * 0.28;
      p.x += (p.vx + Math.sin(p.f) * 40 * unit()) * dt; p.y += p.vy * dt;
      p.r += p.vr * dt; p.f += p.vf * dt;
      if (p.y > H + 40 || p.life > 9) { parts.splice(i, 1); continue; }
      cx.save();
      cx.translate(p.x, p.y);
      cx.rotate(p.r);
      cx.globalAlpha = p.life > 7 ? Math.max(0, (9 - p.life) / 2) : 1;
      cx.fillStyle = p.c;
      if (p.kind === 1) { cx.beginPath(); cx.arc(0, 0, p.w * 0.55, 0, Math.PI * 2); cx.fill(); }
      else if (p.kind === 2) { cx.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(p.f))); star(p.w * 0.9); }
      else { cx.scale(1, Math.cos(p.f)); cx.fillRect(-p.w / 2, -p.hh / 2, p.w, p.hh); } // la face qui tourne
      cx.restore();
    }
    if (parts.length) raf = requestAnimationFrame(step);
    else if (!pending) { stop(); onDone(); }
  }
  const center = (node) => {
    const r = node && node.isConnected ? node.getBoundingClientRect() : null;
    return r && r.width ? { x: r.left + r.width / 2, y: r.top } : { x: W / 2, y: H * 0.45 };
  };
  return {
    /** Petite gerbe au-dessus d'une marche qui arrive. */
    puff(node, tint) { const c = center(node); add(c.x, c.y, 26, { spread: 0.75, speed: [320, 620], colors: TINTS[tint] }); },
    /** La grande fête : deux canons depuis les coins du bas, une gerbe dorée du gagnant, puis une pluie qui tombe d'en haut. */
    party(node) {
      add(0, H, 110, { angle: -Math.PI / 2 + 0.62, spread: 0.32, speed: [900, 1500] });
      add(W, H, 110, { angle: -Math.PI / 2 - 0.62, spread: 0.32, speed: [900, 1500] });
      const c = center(node);
      add(c.x, c.y, 60, { spread: 1.1, speed: [450, 900], colors: TINTS.gold.concat(COLORS) });
      for (let k = 1; k <= 8; k++) {
        pending++;
        timers.push(setTimeout(() => { pending--; for (let i = 0; i < 9; i++) add(Math.random() * W, -20, 1, { angle: Math.PI / 2, spread: 0.5, speed: [40, 160], g: 0.6 }); }, 300 + k * 260));
      }
    },
    busy: () => !stopped && (parts.length > 0 || pending > 0),
    stop,
  };
  function stop() {
    if (stopped) return;
    stopped = true;
    timers.forEach(clearTimeout);
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener('resize', size);
    cv.classList.add('out');
    setTimeout(() => cv.remove(), 400);
  }
}
