// Sauvegarde du jeu en ligne dans le téléphone (localStorage), pour reprendre une partie coupée.
//  - Hôte : toute la partie (joueurs, scores, jeu en cours) → « Reprendre la partie » au retour,
//    même code, mêmes scores, le jeu repart là où il était (minuteurs compris).
//  - Joueur : sa place (code + identifiant) → il retrouve ses points en revenant.
// Petit module sans dépendance lourde : l'accueil l'importe pour afficher le bandeau « Reprendre ».
import { get, set } from '../store.js';

const HOST_KEY = 'host-save';
const SEAT_KEY = 'seat';
export const HOST_MAX_AGE = 3 * 3600 * 1000; // au-delà, on ne propose plus de reprendre
export const SEAT_MAX_AGE = 3 * 3600 * 1000;

// ---------- Copie d'un état de jeu en JSON (Set et Map compris) ----------
/** Convertit un état de jeu en valeur JSON. Lève une erreur s'il contient autre chose que des données. */
export function pack(v) {
  if (v === null || typeof v !== 'object') {
    if (typeof v === 'function' || typeof v === 'symbol' || typeof v === 'bigint') throw new Error('non sauvegardable : ' + typeof v);
    return v;
  }
  if (Array.isArray(v)) return v.map(pack);
  if (v instanceof Set) return { $$set: [...v].map(pack) };
  if (v instanceof Map) return { $$map: [...v].map(([k, x]) => [pack(k), pack(x)]) };
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) throw new Error('non sauvegardable : ' + (proto.constructor?.name || 'objet'));
  const o = {};
  for (const k of Object.keys(v)) { if (v[k] !== undefined) o[k] = pack(v[k]); }
  return o;
}

/** Inverse de pack. */
export function unpack(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(unpack);
  if (Array.isArray(v.$$set)) return new Set(v.$$set.map(unpack));
  if (Array.isArray(v.$$map)) return new Map(v.$$map.map(([k, x]) => [unpack(k), unpack(x)]));
  const o = {};
  for (const k of Object.keys(v)) o[k] = unpack(v[k]);
  return o;
}

/**
 * Décale les dates (minuteurs, débuts de manche…) de `dt` ms : la partie reprend comme après une pause.
 * Une date = un nombre proche de l'heure de la sauvegarde (± 12 h). Aucun autre nombre d'un jeu n'en approche.
 */
export function shiftTimes(v, savedAt, dt) {
  const near = (x) => typeof x === 'number' && Math.abs(x - savedAt) < 12 * 3600 * 1000;
  const walk = (o) => {
    if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { if (near(o[i])) o[i] += dt; else if (o[i] && typeof o[i] === 'object') walk(o[i]); } return; }
    if (o instanceof Set || o instanceof Map) return;
    for (const k of Object.keys(o)) { if (near(o[k])) o[k] += dt; else if (o[k] && typeof o[k] === 'object') walk(o[k]); }
  };
  if (v && typeof v === 'object' && dt) walk(v);
  return v;
}

// ---------- Hôte ----------
/** { v, at, code, room, game: { type, gs } | null } ; gs = null si le jeu n'a pas pu être enregistré. */
export function saveHost(data) {
  try { localStorage.setItem('ambiance:' + HOST_KEY, JSON.stringify({ v: 1, at: Date.now(), ...data })); return true; } catch { return false; }
}
export function loadHost() {
  const s = get(HOST_KEY, null);
  if (!s || s.v !== 1 || !s.room || !s.code || Date.now() - s.at > HOST_MAX_AGE) return null;
  return s;
}
export function clearHost() { set(HOST_KEY, null); }

// ---------- Joueur ----------
/** Place d'un joueur dans une partie : { code, pid, at }. */
export function saveSeat(code, pid) { set(SEAT_KEY, { code, pid, at: Date.now() }); }
export function loadSeat(code) {
  const s = get(SEAT_KEY, null);
  if (!s || !s.code || !s.pid || Date.now() - s.at > SEAT_MAX_AGE) return null;
  if (code && s.code !== code) return null;
  return s;
}
export function clearSeat() { set(SEAT_KEY, null); }

/** « 🧠 Le Quiz · 4 joueurs · il y a 3 min » */
export function resumeText(saved) {
  const min = Math.max(0, Math.round((Date.now() - saved.at) / 60000));
  const ago = min < 1 ? 'à l\'instant' : min < 60 ? `il y a ${min} min` : `il y a ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
  const n = saved.n || (saved.room.players || []).length;
  return [saved.game && saved.game.label ? saved.game.label : '🎮 Au salon', `${n} joueur${n > 1 ? 's' : ''}`, ago].join(' · ');
}
