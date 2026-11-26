// Dans la foule : logique sans interface (déplacements, poussées, fontaines), utilisée par l'hôte en ligne.
// Une place vue d'en haut (repère 1600 × 900) avec 4 fontaines et une foule de bonshommes tous pareils :
// quelques-uns sont pilotés par les joueurs (manette sur leur téléphone), les autres par l'ordinateur
// (les « passants »). Les passants marchent à la même vitesse que les joueurs, s'arrêtent, vont toucher les
// fontaines… mais ne poussent jamais personne : pousser, c'est se démasquer.
// Tout l'état est fait de données (objets, tableaux, nombres) : la partie peut être enregistrée et reprise.
// Le temps est celui du monde (w.t, en secondes) : il n'avance que quand l'écran télé tourne.

export const W = 1600, H = 900;
export const ZONE = { x0: 165, y0: 215, x1: 1435, y1: 840 };
export const FOUNTAINS = [
  { x: 500, y: 370, name: 'bleue', c: '#3fa9f5' },
  { x: 1100, y: 370, name: 'verte', c: '#2ec27e' },
  { x: 500, y: 665, name: 'violette', c: '#8a5cf6' },
  { x: 1100, y: 665, name: 'orange', c: '#ff8a1f' },
];
export const SPEED = 52;        // vitesse de marche : la même pour tous (sinon on repérerait les joueurs)
export const DOWN_TIME = 2.6;   // un passant poussé se relève au bout de 2,6 s
export const PUSH_TIME = 0.45;  // durée du geste « pousser »
const HIT_DELAY = 0.15;         // le coup part un peu après le début du geste
const REACH_X = 76, REACH_Y = 38;   // portée d'une poussée (assez large : un voisin qui touche se fait pousser)
const SEP = 40;                 // deux bonshommes ne se marchent pas dessus
const FX = 92, FY = 48;         // bord des fontaines : on ne marche pas dedans
const TX = 106, TY = 58;        // on « touche » une fontaine quand on est contre son bord

/** Nombre de bonshommes sur la place pour n joueurs. */
export const crowdSize = (n) => Math.max(20, Math.min(36, 16 + 3 * n));

const rnd = (a, b) => a + Math.random() * (b - a);
const inFountain = (x, y, mx = 1) => FOUNTAINS.some((f) => ((x - f.x) / (FX * mx)) ** 2 + ((y - f.y) / (FY * mx)) ** 2 < 1);

/** Fontaine que touche ce bonhomme (indice), ou -1. */
export function touching(c) {
  for (let i = 0; i < FOUNTAINS.length; i++) {
    const f = FOUNTAINS[i];
    if (((c.x - f.x) / TX) ** 2 + ((c.y - f.y) / TY) ** 2 < 1) return i;
  }
  return -1;
}

/** Nouvelle place : n bonshommes debout, bien répartis, aucun dans une fontaine. */
export function makeWorld(n) {
  const chars = [];
  for (let i = 0; i < n; i++) {
    let x = 800, y = 520;
    for (let k = 0; k < 80; k++) {
      x = rnd(ZONE.x0 + 10, ZONE.x1 - 10); y = rnd(ZONE.y0 + 10, ZONE.y1 - 10);
      if (!inFountain(x, y, 1.15) && chars.every((c) => Math.hypot(c.x - x, (c.y - y) * 1.6) > 58)) break;
    }
    chars.push({
      x, y, vx: 0, vy: 0, kx: 0, ky: 0, f: Math.random() < 0.5 ? -1 : 1,
      m: 'up',            // 'up' debout, 'down' par terre (se relève), 'out' joueur éliminé (reste par terre)
      ai: 0, w: rnd(0.2, 1.6), tx: x, ty: y, // passants : 0 = arrêté (w = temps d'attente), 1 = marche vers (tx, ty)
      down: -99, fd: 1, push: -99, happy: -99, hcd: 0,
    });
  }
  return { t: 0, chars, hits: [] };
}

/** Direction de la manette (0…15, 0 = vers la droite, 4 = vers le bas), ou -1 = immobile. */
export function dirVec(d) {
  if (d == null || d < 0) return null;
  const a = (d * Math.PI) / 8;
  return { x: Math.cos(a), y: Math.sin(a) };
}

function botTarget(c) {
  for (let k = 0; k < 30; k++) {
    let x, y;
    if (Math.random() < 0.35) {
      // Comme les joueurs, les passants vont souvent toucher une fontaine.
      const f = FOUNTAINS[(Math.random() * FOUNTAINS.length) | 0], a = Math.random() * Math.PI * 2;
      x = f.x + Math.cos(a) * (FX + 6); y = f.y + Math.sin(a) * (FY + 5);
    } else {
      const a = Math.random() * Math.PI * 2, d = rnd(80, 340);
      x = c.x + Math.cos(a) * d; y = c.y + Math.sin(a) * d * 0.7;
    }
    x = Math.max(ZONE.x0, Math.min(ZONE.x1, x)); y = Math.max(ZONE.y0, Math.min(ZONE.y1, y));
    if (!inFountain(x, y, 1.02)) { c.tx = x; c.ty = y; c.ai = 1; c.w = 14; return; }
  }
  c.w = 1;
}

function knock(c, dir) {
  c.m = 'down'; c.fd = dir; c.ai = 0; c.w = 0;
  c.vx = 0; c.vy = 0; c.kx = dir * 150; c.ky = rnd(-25, 25);
}

/**
 * Le bonhomme i pousse : le geste part tout de suite, le coup touche le plus proche à portée (de préférence
 * devant lui) un instant après. Renvoie l'indice de celui qui va tomber, ou -1 (poussée dans le vide).
 */
export function tryPush(w, i) {
  const c = w.chars[i];
  if (!c || c.m !== 'up' || w.t - c.push < PUSH_TIME) return -2;
  c.push = w.t;
  let best = -1, bd = 1e9;
  w.chars.forEach((o, j) => {
    if (j === i || o.m !== 'up' || w.hits.some((x) => x.i === j)) return;
    const dx = o.x - c.x, dy = o.y - c.y;
    const d = Math.hypot(dx / REACH_X, dy / REACH_Y) + (dx * c.f < 0 ? 0.35 : 0);
    if (Math.hypot(dx / REACH_X, dy / REACH_Y) < 1 && d < bd) { bd = d; best = j; }
  });
  if (best >= 0) {
    c.f = Math.sign(w.chars[best].x - c.x) || c.f;
    w.hits.push({ i: best, by: i, at: w.t + HIT_DELAY, dir: c.f });
  }
  return best;
}

/**
 * Fait avancer la place de dt secondes. ctl = { indice: direction (0…15, ou -1) } pour les bonshommes des
 * joueurs ; tous les autres sont des passants. frozen : personne ne bouge (compte à rebours, révélation).
 * Renvoie les événements : { k: 'hit', i, by } (i est tombé, poussé par by), { k: 'up', i } (il se relève).
 */
export function step(w, dt, ctl = {}, { frozen = false } = {}) {
  const ev = [];
  w.t += dt;
  const t = w.t;
  for (let k = w.hits.length - 1; k >= 0; k--) {
    const x = w.hits[k];
    if (t < x.at) continue;
    w.hits.splice(k, 1);
    const c = w.chars[x.i];
    if (c && c.m === 'up') { knock(c, x.dir); c.down = t; ev.push({ k: 'hit', i: x.i, by: x.by }); }
  }
  const fr = Math.exp(-dt * 4), acc = Math.min(1, dt * 6);
  w.chars.forEach((c, i) => {
    if (c.m === 'down' && t - c.down > DOWN_TIME) { c.m = 'up'; c.ai = 0; c.w = rnd(0.6, 1.6); ev.push({ k: 'up', i }); }
    let wx = 0, wy = 0;
    if (c.m === 'up' && !frozen && t - c.down > DOWN_TIME + 0.5) {
      if (i in ctl) {
        const d = dirVec(ctl[i]);
        if (d) { wx = d.x * SPEED; wy = d.y * SPEED * 0.8; }
      } else if (c.ai === 1) {
        const dx = c.tx - c.x, dy = c.ty - c.y, dd = Math.hypot(dx, dy);
        c.w -= dt;
        if (dd < 6 || c.w < 0) { c.ai = 0; c.w = rnd(0.3, 3.1); } else { wx = (dx / dd) * SPEED; wy = (dy / dd) * SPEED * 0.8; }
      } else {
        c.w -= dt;
        if (c.w < 0) botTarget(c);
      }
    }
    c.vx += (wx - c.vx) * acc; c.vy += (wy - c.vy) * acc;
    c.x += (c.vx + c.kx) * dt; c.y += (c.vy + c.ky) * dt;
    c.kx *= fr; c.ky *= fr;
    if (Math.abs(c.vx) > 8 && t - c.push > PUSH_TIME) c.f = Math.sign(c.vx);
    // Content quand il touche une fontaine (passants et joueurs pareil).
    if (c.m === 'up' && t >= c.hcd && touching(c) >= 0) { c.happy = t; c.hcd = t + 5; }
  });
  // Personne ne se marche dessus, personne ne sort de la place ni n'entre dans une fontaine.
  const up = w.chars.filter((c) => c.m === 'up');
  for (let a = 0; a < up.length; a++) for (let b = a + 1; b < up.length; b++) {
    const p = up[a], q = up[b], dx = q.x - p.x, dy = (q.y - p.y) * 1.6, d = Math.hypot(dx, dy);
    if (d < SEP && d > 0.01) { const m = (SEP - d) / 2 / d; p.x -= dx * m; q.x += dx * m; p.y -= (dy * m) / 1.6; q.y += (dy * m) / 1.6; }
  }
  for (const c of w.chars) {
    c.x = Math.max(ZONE.x0 - 10, Math.min(ZONE.x1 + 10, c.x)); c.y = Math.max(ZONE.y0 - 10, Math.min(ZONE.y1 + 10, c.y));
    for (const f of FOUNTAINS) {
      const nx = (c.x - f.x) / FX, ny = (c.y - f.y) / FY, d = Math.hypot(nx, ny);
      if (d < 1 && d > 0.001) { c.x = f.x + (nx / d) * FX; c.y = f.y + (ny / d) * FY; }
    }
  }
  return ev;
}
