// Persistance locale (réglages, joueurs, cartes déjà vues…).
import { shuffle } from './ui.js';

const P = 'ambiance:';

export function get(k, d) {
  try { const v = localStorage.getItem(P + k); return v == null ? d : JSON.parse(v); } catch { return d; }
}
export function set(k, v) {
  try { localStorage.setItem(P + k, JSON.stringify(v)); } catch { /* stockage plein ou bloqué */ }
}

export const settings = Object.assign({ drink: true, sound: true, vibrate: true, adult: false }, get('settings', {}));
export function saveSettings() { set('settings', settings); }

export function getPlayers() { return get('players', []); }
export function setPlayers(list) { set('players', list); }

export function getName() { return get('name', ''); }
export function setName(n) { set('name', n); }

/** Texte de pénalité selon le mode (avec ou sans alcool). */
export function sip(n = 1) {
  return settings.drink ? `${n} gorgée${n > 1 ? 's' : ''}` : `${n} point${n > 1 ? 's' : ''} de gage`;
}
/** « boit 2 gorgées » / « prend 2 points de gage » (sujet au singulier) */
export function drinks(n = 1) {
  return (settings.drink ? 'boit ' : 'prend ') + sip(n);
}
/** « boivent 2 gorgées » / « prennent 2 points de gage » (sujet au pluriel) */
export function drinkPl(n = 1) {
  return (settings.drink ? 'boivent ' : 'prennent ') + sip(n);
}

function hash(x) {
  const s = typeof x === 'string' ? x : JSON.stringify(x);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Paquet de cartes qui évite les répétitions, même d'une soirée à l'autre.
 * Les cartes déjà vues sont mémorisées ; quand tout a été vu, on recommence.
 */
export function makeDeck(key, items) {
  const seenKey = 'seen:' + key;
  let seen = new Set(get(seenKey, []));
  let pool = items.filter((it) => !seen.has(hash(it)));
  if (!pool.length) {
    for (const it of items) seen.delete(hash(it));
    pool = items.slice();
  }
  shuffle(pool);
  const history = [];
  return {
    next() {
      if (!items.length) return null;
      if (!pool.length) {
        for (const it of items) seen.delete(hash(it));
        pool = shuffle(items.slice());
      }
      const it = pool.pop();
      seen.add(hash(it));
      set(seenKey, [...seen].slice(-4000));
      history.push(it);
      return it;
    },
    get left() { return pool.length; },
    get total() { return items.length; },
    history,
  };
}

export function resetSeen() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(P + 'seen:')).forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

export function getCustom(gameId) { return get('custom:' + gameId, ''); }
export function setCustom(gameId, text) { set('custom:' + gameId, text); }
