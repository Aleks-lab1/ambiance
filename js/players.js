// Gestion de la liste des joueurs (partagée par tous les jeux).
import { h, modal, toast } from './ui.js';
import { getPlayers, setPlayers } from './store.js';

export async function editPlayers() {
  const list = getPlayers().slice();
  const listEl = h('div', { class: 'plist' });
  const input = h('input', {
    class: 'input', placeholder: 'Prénom du joueur', maxlength: '18', enterkeyhint: 'enter', autocomplete: 'off',
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } },
  });

  function add() {
    const n = input.value.trim().replace(/\s+/g, ' ');
    if (!n) return false;
    if (list.some((x) => x.toLowerCase() === n.toLowerCase())) { toast('Ce prénom est déjà dans la liste'); return false; }
    if (list.length >= 30) { toast('30 joueurs maximum'); return false; }
    list.push(n);
    input.value = '';
    render();
    input.focus();
    return true;
  }
  function render() {
    listEl.replaceChildren(...list.map((n, i) => h('span', { class: 'pchip' }, n,
      h('button', { class: 'x', 'aria-label': 'Retirer ' + n, onclick: () => { list.splice(i, 1); render(); } }, '×'))));
    if (!list.length) listEl.append(h('p', { class: 'muted small' }, 'Ajoute les prénoms des joueurs présents. Ils seront utilisés dans les jeux.'));
  }
  render();

  await modal({
    title: '👥 Les joueurs',
    content: h('div', { class: 'col' },
      h('div', { class: 'row' }, input, h('button', { class: 'btn btn-primary', onclick: add, 'aria-label': 'Ajouter' }, '＋')),
      listEl,
      list.length ? null : null),
    actions: [
      { label: 'Tout effacer', value: 'clear' },
      { label: 'Terminé', value: true, primary: true },
    ],
    onOpen: () => setTimeout(() => input.focus(), 50),
  }).then((v) => {
    if (v === 'clear') list.length = 0;
  });
  if (input.value.trim()) add();
  setPlayers(list);
  document.dispatchEvent(new CustomEvent('players-changed'));
  return list;
}

/** Renvoie la liste des joueurs s'il y en a au moins `min`, sinon ouvre l'éditeur. */
export async function requirePlayers(min = 2) {
  let l = getPlayers();
  if (l.length >= min) return l;
  toast(`Ajoute au moins ${min} joueurs`);
  l = await editPlayers();
  if (l.length < min) { toast(`Il faut au moins ${min} joueurs pour ce jeu`); return null; }
  return l;
}

/** Bloc « joueurs » réutilisable dans les écrans de préparation. */
export function playersPanel(min = 0, onChange) {
  const names = h('span', { class: 'names' });
  const el = h('button', { class: 'players-bar', onclick: async () => { await editPlayers(); render(); onChange && onChange(getPlayers()); } },
    h('span', { style: { fontSize: '22px' } }, '👥'), names, h('span', { class: 'chip' }, 'Modifier'));
  function render() {
    const l = getPlayers();
    names.replaceChildren(l.length ? h('b', null, `${l.length} joueurs : `) : h('b', null, 'Aucun joueur'),
      l.length ? l.join(', ') : (min ? ` — il en faut au moins ${min}` : ' — touche pour ajouter'));
  }
  render();
  return el;
}
