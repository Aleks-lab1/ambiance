// Bingo de soirée : version « ma grille » sur ce téléphone (+ accès au mode en ligne).
import { h, topbar, confirmBox } from '../ui.js';
import { get, set } from '../store.js';
import { onlineBanner } from '../common.js';
import { sfx, buzz } from '../sfx.js';
import LIST from '../data/bingo.js';
import { newCard, completeLines, lineCells, isFull, gridEl } from '../bingo-core.js';

export function start(ctx) {
  const { root, meta } = ctx;
  let st = get('bingo-card', null);
  if (!st || !Array.isArray(st.card) || st.card.some((i) => i >= LIST.length)) st = { card: newCard(LIST.length), marks: [] };
  const save = () => set('bingo-card', st);
  const gridSlot = h('div');
  const info = h('div', { class: 'center' });

  function render(celebrate, stamp = -1) {
    const lines = completeLines(st.marks);
    const full = isFull(st.marks);
    gridSlot.replaceChildren(gridEl({
      card: st.card, list: LIST, marks: st.marks, highlight: lines.flatMap(lineCells), stamp,
      onToggle: (pos) => {
        const before = completeLines(st.marks).length;
        const m = new Set(st.marks);
        if (m.has(pos)) m.delete(pos); else m.add(pos);
        st.marks = [...m];
        save();
        sfx.pop(); buzz(10);
        render(completeLines(st.marks).length > before, pos);
      },
    }));
    info.replaceChildren(h('h3', null, full ? '🏆 CARTON PLEIN !' : lines.length ? `🎉 ${lines.length} ligne${lines.length > 1 ? 's' : ''} complète${lines.length > 1 ? 's' : ''} !` : 'Aucune ligne pour l\'instant'));
    if (celebrate) { sfx.fanfare(); buzz([80, 40, 120]); }
  }

  root.replaceChildren(
    topbar(ctx),
    onlineBanner(ctx, 'bingo', { text: 'Chacun reçoit sa grille sur son téléphone et tout le monde est prévenu à chaque BINGO.' }),
    h('div', { class: 'section-title' }, 'Ma grille sur ce téléphone'),
    h('p', { class: 'muted small' }, meta.rules[0]),
    info, gridSlot,
    h('button', {
      class: 'btn btn-soft btn-block',
      onclick: async () => { if (await confirmBox('Tirer une nouvelle grille ? Les cases cochées seront effacées.')) { st = { card: newCard(LIST.length), marks: [] }; save(); render(); } },
    }, '🔄 Nouvelle grille'));
  render();
}
