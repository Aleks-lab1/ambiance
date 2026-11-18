// Bingo de soirée en ligne : chacun sa grille, tout le monde est prévenu des BINGO.
import { h, uid } from '../ui.js';
import { sfx, buzz } from '../sfx.js';
import LIST from '../data/bingo.js';
import { newCard, completeLines, lineCells, isFull, gridEl, cellText, FREE } from '../bingo-core.js';

const player = (room, pid) => room.players.find((p) => p.pid === pid);

function deal(s, pid) {
  s.cards[pid] = newCard(LIST.length);
  s.marks[pid] = [];
  s.lines[pid] = [];
  s.full[pid] = false;
}

export default {
  id: 'bingo',
  name: 'Bingo de soirée',
  short: 'Chacun sa grille',
  emoji: '🎱',
  minPlayers: 2,
  defaults: {},
  settingsForm() { return h('p', { class: 'muted small' }, 'Chaque joueur reçoit sa propre grille de 25 situations. Une ligne complète = 100 points, la grille entière = 300 points de plus.'); },

  init(room) {
    const s = { gid: uid(), cards: {}, marks: {}, lines: {}, full: {}, feed: [], seq: 0 };
    for (const p of room.players) if (p.on) deal(s, p.pid);
    return s;
  },

  onJoin(room, s, pid) { if (!s.cards[pid]) deal(s, pid); },

  action(room, s, pid, a) {
    const p = player(room, pid);
    if (!p) return false;
    if (a.type === 'newcards' && pid === room.host) {
      for (const q of room.players) { deal(s, q.pid); q.score = 0; }
      s.feed = [];
      s.gid = uid();
      return true;
    }
    if (a.type !== 'mark' || !Number.isInteger(a.pos) || a.pos < 0 || a.pos > 24 || a.pos === FREE) return false;
    if (!s.cards[pid]) deal(s, pid);
    const marks = new Set(s.marks[pid]);
    if (marks.has(a.pos)) marks.delete(a.pos); else marks.add(a.pos);
    s.marks[pid] = [...marks];
    const before = new Set(s.lines[pid]);
    const now = completeLines(marks);
    const fresh = now.filter((l) => !before.has(l));
    s.lines[pid] = now;
    const wasFull = s.full[pid];
    s.full[pid] = isFull(marks);
    p.score = now.length * 100 + (s.full[pid] ? 300 : 0);
    for (const l of fresh) {
      s.feed.push({ id: ++s.seq, pid, full: false, cells: lineCells(l).filter((c) => c !== FREE).map((c) => cellText(s.cards[pid], LIST, c)) });
    }
    if (s.full[pid] && !wasFull) s.feed.push({ id: ++s.seq, pid, full: true, cells: [] });
    if (s.feed.length > 30) s.feed.splice(0, s.feed.length - 30);
    return true;
  },

  view(room, s, pid) {
    return {
      gid: s.gid,
      card: s.cards[pid] || null,
      marks: s.marks[pid] || [],
      lines: s.lines[pid] || [],
      full: !!s.full[pid],
      feed: s.feed.slice(-8),
      board: room.players.map((p) => ({ pid: p.pid, lines: (s.lines[p.pid] || []).length, full: !!s.full[p.pid] })),
    };
  },

  mount(root, g) {
    const head = h('div', { class: 'row' });
    const gridSlot = h('div');
    const feedSlot = h('div', { class: 'col' });
    const hostSlot = h('div');
    root.append(head, gridSlot, feedSlot, hostSlot);
    let lastFeed = null;
    let lastGid = null;
    return {
      update(room, v) {
        if (!v.card) { gridSlot.replaceChildren(h('p', { class: 'muted center' }, 'Ta grille arrive…')); return; }
        const hl = v.lines.flatMap((l) => lineCells(l));
        head.replaceChildren(h('span', { class: 'pill' }, `🎱 ${v.lines.length} ligne${v.lines.length > 1 ? 's' : ''}`), h('div', { class: 'grow' }),
          h('span', { class: 'pill' }, '🏆 ' + ((room.players.find((p) => p.pid === g.me) || {}).score || 0)));
        gridSlot.replaceChildren(gridEl({ card: v.card, list: LIST, marks: v.marks, highlight: hl, onToggle: (pos) => { g.send({ type: 'mark', pos }); sfx.pop(); buzz(10); } }));
        // Annonces
        const newest = v.feed.length ? v.feed[v.feed.length - 1].id : 0;
        if (lastGid === v.gid && lastFeed !== null && newest > lastFeed) {
          for (const f of v.feed.filter((x) => x.id > lastFeed)) {
            if (f.pid === g.me) { sfx.fanfare(); buzz([80, 40, 120]); } else sfx.ok();
          }
        }
        lastGid = v.gid;
        lastFeed = newest;
        feedSlot.replaceChildren(
          h('div', { class: 'section-title' }, 'Annonces'),
          v.feed.length
            ? v.feed.slice().reverse().map((f) => h('div', { class: 'bingo-feed' + (f.full ? ' full' : '') },
              h('b', null, f.full ? `🏆 CARTON PLEIN pour ${g.nameOf(f.pid)} !` : `🎉 BINGO ! ${g.nameOf(f.pid)} a complété une ligne`),
              f.cells.length ? h('span', { class: 'small muted' }, f.cells.join(' · ')) : null))
            : h('p', { class: 'muted small' }, 'Coche les cases quand les situations arrivent pour de vrai. Les autres verront tes lignes pour vérifier 😉'),
          h('div', { class: 'scoreboard' }, v.board.slice().sort((a, b) => b.lines - a.lines).map((x) => h('div', { class: 'score-row' }, h('span', { class: 'n' }, g.nameOf(x.pid) + (x.full ? ' 🏆' : '')), h('span', { class: 's' }, `${x.lines} ligne${x.lines > 1 ? 's' : ''}`)))));
        hostSlot.replaceChildren(g.isHost ? h('div', { class: 'row' },
          h('button', { class: 'btn btn-soft grow', onclick: () => g.send({ type: 'newcards' }) }, '🔄 Nouvelles grilles'),
          h('button', { class: 'btn btn-ghost grow', onclick: () => g.send({ type: 'lobby:end' }) }, '🎮 Changer de jeu')) : null);
      },
      destroy() {},
    };
  },
};
