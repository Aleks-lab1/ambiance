// Jeux favoris, mémorisés sur ce téléphone (dans l'ordre où ils ont été ajoutés).
import { get, set } from './store.js';

const KEY = 'favs';

export function getFavs() {
  const v = get(KEY, []);
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
}

export function isFav(id) { return getFavs().includes(id); }

/** Ajoute ou retire un jeu des favoris. Renvoie true s'il est maintenant favori. */
export function toggleFav(id) {
  const favs = getFavs();
  const i = favs.indexOf(id);
  if (i >= 0) favs.splice(i, 1); else favs.push(id);
  set(KEY, favs);
  if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('favs-changed', { detail: { id, on: i < 0 } }));
  return i < 0;
}
