// Le Bon Mot en ligne : chacun sur son téléphone, à tour de rôle. L'hôte vérifie les mots.
import { h, uid, seg, timerView } from '../ui.js';
import { sfx, buzz } from '../sfx.js';
import { TV_PID, tvSay } from './kit.js';
import { loadDico, normWord, fits, minLength } from '../bonmot-core.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const RARE_START = new Set(['K', 'W', 'X', 'Y', 'Z']);
const GAP_MS = 3000;     // compte à rebours entre deux joueurs
const MALUS_MS = 3000;   // mauvais mot : 3 secondes de moins
const PICK_MS = 20000;   // temps pour choisir la première lettre (mode chaîne)
const up = (s) => String(s || '').toUpperCase();
const hearts = (n, max) => '❤️'.repeat(Math.max(0, n)) + '🤍'.repeat(Math.max(0, max - n));

// Le dictionnaire n'est chargé que par l'hôte (c'est lui qui vérifie les mots).
let dico = null;
const ensureDico = () => loadDico().then((d) => { dico = d; return d; }).catch(() => null);

const bonmot = {
  id: 'bonmot',
  name: 'Le Bon Mot',
  short: 'Lettres imposées ou mots en chaîne, 3 vies',
  emoji: '🔠',
  minPlayers: 2,
  defaults: { mode: 'lettres', len: 'prog', pos: 'start', chain: 1, time: 15, lives: 3 },

  settingsForm(st, set) {
    ensureDico(); // l'hôte commence à charger le dictionnaire pendant qu'il règle la partie
    const box = h('div', { class: 'col' });
    const render = () => box.replaceChildren(
      h('label', { class: 'field' }, 'Mode de jeu', seg([
        { value: 'lettres', label: '🔤 Lettres imposées' }, { value: 'chaine', label: '🔗 Mots en chaîne' },
      ], st.mode, (v) => { set({ mode: v }); render(); })),
      st.mode === 'chaine'
        ? h('label', { class: 'field' }, 'Lettres à reprendre à la fin du mot précédent', seg([
          { value: 1, label: 'La dernière' }, { value: 2, label: 'Les 2 dernières' }, { value: 3, label: 'Les 3 dernières' },
        ], st.chain, (v) => set({ chain: v })))
        : [
          h('label', { class: 'field' }, 'Nombre de lettres imposées', seg([
            { value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 'prog', label: '📈 De + en +' },
          ], st.len, (v) => set({ len: v }))),
          h('label', { class: 'field' }, 'Les lettres doivent être…', seg([
            { value: 'start', label: 'Au début du mot' }, { value: 'in', label: 'N\'importe où' },
          ], st.pos, (v) => set({ pos: v }))),
        ],
      h('label', { class: 'field' }, 'Temps par joueur', seg([10, 15, 20, 30].map((v) => ({ value: v, label: v + ' s' })), st.time, (v) => set({ time: v }))),
      h('label', { class: 'field' }, 'Vies par joueur', seg([1, 2, 3, 5].map((v) => ({ value: v, label: '❤️ ' + v })), st.lives, (v) => set({ lives: v }))));
    render();
    return box;
  },

  restore() { ensureDico(); }, // partie reprise par l'hôte : on recharge le dictionnaire

  init(room, st) {
    ensureDico();
    const order = room.players.filter((p) => p.on).map((p) => p.pid);
    const s = {
      gid: uid(), st, order, chainMode: st.mode === 'chaine', pos: st.mode === 'chaine' ? 'start' : st.pos,
      lives: Object.fromEntries(order.map((p) => [p, st.lives])), words: Object.fromEntries(order.map((p) => [p, 0])), best: {},
      out: [], turn: 0, phase: 'loading', letters: '', deadline: 0, until: 0, typing: '', used: new Set(), played: [], chain: [],
      recent: [], turnsDone: 0, last: null, msg: null, refused: null, levelup: 0, bestChain: 0, winner: null, n: 0,
    };
    return s;
  },

  action(room, s, pid, a) {
    if (!a || typeof a !== 'object') return false;
    const cur = curPid(s);
    if (a.type === 'typing') {
      if (pid !== cur || (s.phase !== 'play' && s.phase !== 'count')) return false;
      s.typing = String(a.v || '').slice(0, 32);
      return true;
    }
    if (a.type === 'pick') {
      if (pid !== cur || s.phase !== 'pick' || !ALPHABET.includes(up(a.c))) return false;
      s.letters = String(a.c).toLowerCase();
      startPlay(room, s);
      return true;
    }
    if (a.type === 'word') {
      if (pid !== cur || s.phase !== 'play' || !dico) return false; // !dico : partie reprise, dictionnaire en chargement
      return submit(room, s, String(a.v || '').trim().replace(/\s+/g, ' ').slice(0, 40));
    }
    if (a.type === 'accept') {
      if (pid !== room.host || s.phase !== 'play' || !s.refused) return false;
      accept(room, s, s.refused);
      return true;
    }
    return false;
  },

  tick(room, s) {
    const now = Date.now();
    if (s.phase === 'loading') {
      if (!dico) return false;
      firstTurn(room, s);
      return true;
    }
    if (s.phase === 'count' && now >= s.until) { startPlay(room, s); return true; }
    if (s.phase === 'play' && now >= s.deadline) { fail(room, s); return true; }
    if (s.phase === 'pick' && now >= s.until && dico) { s.letters = dico.randomStart(); startPlay(room, s); return true; }
    return false;
  },

  onLeave(room, s, pid) {
    // Le joueur dont c'est le tour est parti : on passe au suivant sans lui retirer de vie.
    if (pid === curPid(s) && (s.phase === 'play' || s.phase === 'count' || s.phase === 'pick')) {
      s.last = { kind: 'left', pid };
      nextTurn(room, s);
      afterTurn(room, s);
    }
  },

  view(room, s) {
    return {
      gid: s.gid, phase: s.phase, cur: curPid(s), order: s.order, lives: s.lives, max: s.st.lives, words: s.words,
      letters: s.letters, pos: s.pos, chainMode: s.chainMode, deadline: s.deadline, until: s.until, time: s.st.time,
      typing: s.typing, last: s.last, msg: s.msg, refused: s.refused, levelup: s.levelup, len: s.letters ? s.letters.length : lenAt(room, s, s.turnsDone),
      chain: s.chain.slice(-14), played: s.played.slice(-24), bestChain: s.bestChain, winner: s.winner, out: s.out, best: s.best, n: s.n,
    };
  },

  // Écran télé : les lettres imposées en grand, ce que tape le joueur en direct, la barre de temps et les vies.
  tv(room, s) { return this.view(room, s, TV_PID); },
  tvMount(root, g) {
    const lives = h('div', { class: 'tv-who tv-bm-lives' });
    const card = h('div', { class: 'tv-bm-card' });
    const bar = timerView(15);
    bar.el.classList.add('tv-bm-timer');
    const typing = h('div', { class: 'tv-bm-typing' });
    const say = tvSay();
    const used = h('div', { class: 'tv-bm-used' });
    const main = h('div', { class: 'tv-fill' }, lives, card, bar.el, typing, say.el, used);
    root.append(main);
    let v = null, lastKey = null, lastTick = null, lastMsgN = -1, ended = false;
    const iv = setInterval(() => {
      if (!v) return;
      if (v.phase === 'play') {
        const left = Math.max(0, v.deadline - g.now());
        bar.set(left, v.time * 1000);
        const sec = Math.ceil(left / 1000);
        if (sec <= 3 && sec > 0 && sec !== lastTick) { lastTick = sec; sfx.tick(); }
      } else if (v.phase === 'count') {
        bar.set(v.time * 1000, v.time * 1000);
        const n = Math.ceil(Math.max(0, v.until - g.now()) / 1000);
        const el = card.querySelector('.tv-count');
        if (el && n > 0 && el.textContent !== String(n)) { el.textContent = String(n); el.classList.remove('pop-in'); void el.offsetWidth; el.classList.add('pop-in'); sfx.beep(); }
      }
    }, 150);
    const lastText = () => {
      const L = v.last;
      if (!L) return '';
      if (L.kind === 'ok') return `✅ « ${L.word} » · ${g.nameOf(L.pid)} +1`;
      if (L.kind === 'left') return `👋 ${g.nameOf(L.pid)} est parti(e)`;
      return `⏰ Temps écoulé ! ${L.dead ? `💀 ${g.nameOf(L.pid)} est éliminé(e) !` : `${g.nameOf(L.pid)} perd une vie.`}${L.ex && L.ex.length ? ` Il y avait : ${L.ex.join(', ')}` : ''}`;
    };
    return {
      update(r, view) {
        v = view;
        const key = `${v.gid}:${v.phase}:${v.cur}:${v.letters}:${v.n}`;
        if (v.phase === 'end') {
          if (ended) return;
          ended = true;
          const rank = (pid) => (v.lives[pid] > 0 ? 1000 + v.lives[pid] * 100 + v.words[pid] : v.out.indexOf(pid) * 100 + v.words[pid]);
          const longest = Object.entries(v.best).sort((a, b) => normWord(b[1]).length - normWord(a[1]).length)[0];
          main.replaceChildren(h('div', { class: 'tv-big-emo' }, '🏆'), h('h1', { class: 'center' }, v.winner ? `${g.nameOf(v.winner)} gagne !` : 'Fin de la partie !'),
            h('ol', { class: 'tv-order' }, v.order.slice().sort((a, b) => rank(b) - rank(a)).map((pid) => h('li', null, `${g.nameOf(pid)} · ${v.words[pid] || 0} mot${v.words[pid] > 1 ? 's' : ''}`))),
            longest ? h('p', { class: 'tv-status' }, `📏 Mot le plus long : ${longest[1]} (${g.nameOf(longest[0])})`) : null);
          sfx.fanfare();
          return;
        }
        if (ended) { ended = false; main.replaceChildren(lives, card, bar.el, typing, say.el, used); lastKey = null; }
        lives.replaceChildren(...v.order.map((pid) => {
          const l = v.lives[pid];
          return h('span', { class: 'tv-chip' + (pid === v.cur ? ' done' : '') + (l ? '' : ' dead') }, `${g.nameOf(pid)} ${l ? '❤️'.repeat(l) : '💀'}`);
        }));
        bar.el.classList.toggle('hidden', v.phase !== 'play' && v.phase !== 'count');
        typing.replaceChildren(v.phase === 'play' ? h('span', null, `${g.nameOf(v.cur)} écrit :`) : null, v.phase === 'play' ? h('b', null, v.typing || '…') : null);
        if (v.msg && v.msg.n !== lastMsgN) {
          lastMsgN = v.msg.n;
          if (v.phase === 'play') { sfx.bad(); bar.el.classList.remove('bm-malus'); void bar.el.offsetWidth; bar.el.classList.add('bm-malus'); }
        }
        const showMsg = v.phase === 'play' && v.msg && v.msg.turn === `${v.cur}:${v.letters}:${v.n}`;
        if (key === lastKey) { say.set(showMsg ? `❌ ${v.msg.text}` : lastText()); return; }
        const N = g.nameOf(v.cur);
        if (v.phase === 'loading') card.replaceChildren(h('div', { class: 'tv-say' }, '⏳ Chargement du dictionnaire…'));
        else if (v.phase === 'count') {
          card.replaceChildren(h('div', { class: 'tv-say' }, `Au tour de ${N} !`), h('div', { class: 'tv-count' }, ''),
            v.chainMode ? h('p', { class: 'tv-status' }, 'Prochain mot : commence par ', h('b', null, up(v.letters))) : null,
            v.levelup ? h('p', { class: 'tv-status' }, `⬆️ ${v.len} lettres maintenant !`) : null);
        } else if (v.phase === 'pick') card.replaceChildren(h('div', { class: 'tv-say' }, `${N} choisit la première lettre…`));
        else if (v.phase === 'play') {
          const lastWord = v.chain[v.chain.length - 1];
          card.replaceChildren(h('div', { class: 'kicker' }, v.pos === 'in' ? 'Un mot qui contient' : 'Un mot qui commence par'),
            h('div', { class: 'tiles' }, up(v.letters).split('').map((c, i) => h('span', { style: { animationDelay: i * 70 + 'ms' } }, c))),
            h('div', { class: 'kicker' }, lastWord ? `après « ${lastWord} »` : `Au moins ${minLength(v.letters)} lettres`));
          lastTick = null; sfx.go();
        }
        say.set(showMsg ? `❌ ${v.msg.text}` : lastText());
        used.replaceChildren(...(v.chainMode ? v.chain : v.played.map((x) => x.w)).slice(-12).map((w) => h('span', { class: 'tv-res' }, w)));
        if (v.last && v.last.kind === 'ok' && v.phase === 'count') sfx.pop();
        if (v.last && v.last.kind === 'fail' && (v.phase === 'count' || v.phase === 'pick')) sfx.bad();
        lastKey = key;
      },
      destroy() { clearInterval(iv); },
    };
  },
  mount(root, g) {
    const head = h('div', { class: 'row' });
    const livesBar = h('div', { class: 'bm-lives' });
    const card = h('div', { class: 'bm-card' });
    const tv = timerView(15);
    const input = h('input', {
      class: 'input bm-input', type: 'text', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'none', spellcheck: 'false',
      enterkeyhint: 'send', maxlength: '32', placeholder: 'Tape ton mot…', 'aria-label': 'Ton mot',
      oninput: () => { liveHint(); sendTyping(); },
    });
    const form = h('form', { class: 'row bm-form', onsubmit: (e) => { e.preventDefault(); submitWord(); } },
      input, h('button', { class: 'btn btn-primary', type: 'submit', onmousedown: (e) => e.preventDefault() }, 'Valider'));
    const msg = h('div', { class: 'bm-msg', 'aria-live': 'polite' });
    const zone = h('div', { class: 'col' }, tv.el, form, msg);
    const watch = h('div', { class: 'bm-watch' });
    const usedBox = h('div', { class: 'bm-used' });
    const hostSlot = h('div', { class: 'col' });
    root.append(head, livesBar, card, zone, watch, usedBox, hostSlot);

    let v = null, room = null, lastKey = null, lastMsgN = -1, lastTick = null, typingTimer = null, lastLevel = 0;
    const mine = () => v && v.cur === g.me;

    function sendTyping() {
      if (!mine()) return;
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => g.send({ type: 'typing', v: input.value }), 120);
    }
    function liveHint() {
      input.classList.toggle('ok', !!(v && v.phase === 'play' && v.letters && fits(normWord(input.value), v.letters, v.pos)));
    }
    function submitWord() {
      if (!mine()) return;
      if (v.phase === 'count') { msg.className = 'bm-msg'; msg.textContent = 'Attends le top départ !'; return; }
      if (v.phase !== 'play') return;
      const t = input.value.trim();
      if (t) g.send({ type: 'word', v: t });
    }

    const iv = setInterval(updTimer, 150);
    function updTimer() {
      if (!v) return;
      if (v.phase === 'play') {
        const left = Math.max(0, v.deadline - g.now());
        tv.set(left, v.time * 1000);
        const sec = Math.ceil(left / 1000);
        if (sec <= 3 && sec > 0 && sec !== lastTick) { lastTick = sec; sfx.tick(); }
      } else if (v.phase === 'count') {
        tv.set(v.time * 1000, v.time * 1000);
        const n = Math.ceil(Math.max(0, v.until - g.now()) / 1000);
        const el = card.querySelector('.bm-count');
        if (el && el.textContent !== String(n) && n > 0) {
          el.textContent = String(n);
          el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
          sfx.beep(); if (mine()) buzz(15);
        }
      } else if (v.phase === 'pick') {
        const el = card.querySelector('.bm-pick-time');
        if (el) el.textContent = `⏱ ${Math.ceil(Math.max(0, v.until - g.now()) / 1000)} s`;
      }
    }

    const tiles = (letters) => h('div', { class: 'tiles bm-tiles' }, up(letters).split('').map((c, i) => h('span', { style: { animationDelay: i * 70 + 'ms' } }, c)));

    function lastBlock() {
      const L = v.last;
      if (!L) return null;
      if (L.kind === 'ok') return h('div', { class: 'res' }, `✅ « ${L.word} »`, h('span', { class: 'by' }, ` · ${g.nameOf(L.pid)} +1`));
      if (L.kind === 'left') return h('div', { class: 'sub' }, `👋 ${g.nameOf(L.pid)} est parti(e), on passe au suivant.`);
      return h('div', { class: 'bm-fail' },
        h('div', { class: 'res' }, '⏰ Temps écoulé !'),
        h('div', { class: 'sub' }, L.dead ? `💀 ${g.nameOf(L.pid)} est éliminé(e) !` : `${g.nameOf(L.pid)} perd une vie (${hearts(L.lives, v.max)}).`),
        L.ex && L.ex.length ? h('div', { class: 'bm-ex' }, `Avec ${up(L.letters)}, il y avait : `, L.ex.map((w, i) => [i ? ', ' : '', h('b', null, w)])) : null,
        L.chainLen ? h('div', { class: 'sub' }, `🔗 Chaîne de ${L.chainLen} mot${L.chainLen > 1 ? 's' : ''}`) : null);
    }

    function renderCard(key) {
      const who = v.cur;
      if (v.phase === 'loading') { card.replaceChildren(h('div', { class: 'kicker' }, '⏳ Chargement du dictionnaire chez l\'hôte…')); return; }
      if (v.phase === 'end') return;
      if (v.phase === 'count') {
        if (card.dataset.k === key) return;
        card.replaceChildren(lastBlock(),
          h('div', { class: 'kicker' }, mine() ? 'À toi dans…' : `Au tour de ${g.nameOf(who)} !`),
          h('div', { class: 'bm-count' }, ''),
          v.chainMode ? h('div', { class: 'sub' }, 'Prochain mot : commence par ', h('b', null, up(v.letters))) : null,
          v.levelup && v.levelup !== lastLevel ? h('div', { class: 'bm-levelup' }, `⬆️ Ça se corse : ${v.len} lettres maintenant !`) : null);
        if (v.levelup && v.levelup !== lastLevel) { lastLevel = v.levelup; sfx.fanfare(); }
      } else if (v.phase === 'pick') {
        if (card.dataset.k === key) return;
        card.replaceChildren(lastBlock(),
          h('div', { class: 'kicker' }, mine() ? 'Choisis la première lettre' : `${g.nameOf(who)} choisit la première lettre…`),
          mine() ? h('div', { class: 'bm-pick' },
            ALPHABET.map((c) => h('button', { class: RARE_START.has(c) ? 'rare' : '', onclick: () => { input.value = ''; input.focus(); g.send({ type: 'pick', c }); } }, c)),
            h('button', { class: 'rnd', 'aria-label': 'Lettre au hasard', onclick: () => { input.value = ''; input.focus(); g.send({ type: 'pick', c: ALPHABET[Math.floor(Math.random() * 26)] }); } }, '🎲')) : null,
          h('div', { class: 'sub bm-pick-time' }, ''));
      } else if (v.phase === 'play') {
        if (card.dataset.k === key) return;
        const lastWord = v.chain[v.chain.length - 1];
        card.replaceChildren(
          h('div', { class: 'kicker' }, v.pos === 'in' ? 'Un mot qui contient' : 'Un mot qui commence par'),
          tiles(v.letters),
          h('div', { class: 'sub' }, lastWord ? `après « ${lastWord} »` : `Au moins ${minLength(v.letters)} lettres · accents facultatifs`));
      }
      card.dataset.k = key;
    }

    function renderEnd(key) {
      const rank = (pid) => (v.lives[pid] > 0 ? 1000 + v.lives[pid] * 100 + v.words[pid] : v.out.indexOf(pid) * 100 + v.words[pid]);
      const ranked = v.order.slice().sort((a, b) => rank(b) - rank(a));
      const longest = Object.entries(v.best).sort((a, b) => normWord(b[1]).length - normWord(a[1]).length)[0];
      head.replaceChildren(); livesBar.replaceChildren(); zone.classList.add('hidden'); watch.replaceChildren(); usedBox.replaceChildren();
      card.className = 'col';
      card.replaceChildren(
        h('div', { class: 'center' }, h('div', { class: 'hero-emo' }, '🏆'), h('h2', null, v.winner ? (v.winner === g.me ? 'Tu as gagné !' : `${g.nameOf(v.winner)} gagne !`) : 'Fin de la partie !')),
        h('div', { class: 'scoreboard' },
          ranked.map((pid, i) => h('div', { class: 'score-row' + (i === 0 ? ' lead' : '') },
            h('span', null, ['🥇', '🥈', '🥉'][i] || `${i + 1}.`), h('span', { class: 'n' }, g.nameOf(pid)),
            h('span', { class: 'small' }, v.lives[pid] > 0 ? '❤️'.repeat(v.lives[pid]) : '💀'),
            h('span', { class: 's' }, `${v.words[pid] || 0} mot${v.words[pid] > 1 ? 's' : ''}`))),
          longest ? h('div', { class: 'score-row' }, h('span', { class: 'n' }, '📏 Mot le plus long'), h('b', null, `${longest[1]} · ${g.nameOf(longest[0])}`)) : null,
          v.chainMode ? h('div', { class: 'score-row' }, h('span', { class: 'n' }, '🔗 Plus longue chaîne'), h('b', null, `${v.bestChain} mot${v.bestChain > 1 ? 's' : ''}`)) : null),
        g.hostBar());
      if (lastKey !== key) { input.blur(); sfx.fanfare(); if (v.winner === g.me) buzz([60, 40, 60, 40, 200]); }
    }

    return {
      update(r, view) {
        room = r; v = view;
        const key = `${v.gid}:${v.phase}:${v.cur}:${v.letters}:${v.n}`;
        if (v.phase === 'end') { renderEnd(key); lastKey = key; return; }
        card.className = 'bm-card';
        zone.classList.remove('hidden');
        const me = mine();
        head.replaceChildren(
          h('span', { class: 'pill' }, v.phase === 'loading' ? '⏳' : `✍️ ${me ? 'À toi !' : g.nameOf(v.cur)} ${v.cur ? hearts(v.lives[v.cur], v.max) : ''}`),
          h('div', { class: 'grow' }),
          h('span', { class: 'pill' }, v.chainMode ? `🔗 ${v.chain.length}` : `🔤 ${v.len} lettre${v.len > 1 ? 's' : ''}`),
          h('span', { class: 'pill' }, `⭐ ${v.words[g.me] || 0}`));
        livesBar.replaceChildren(v.order.map((pid) => {
          const l = v.lives[pid];
          const p = r.players.find((x) => x.pid === pid);
          return h('span', { class: 'bm-life' + (pid === v.cur ? ' cur' : '') + (l ? '' : ' dead') + (p && !p.on ? ' off' : '') },
            h('b', null, pid === g.me ? 'Toi' : g.nameOf(pid)), ' ', l ? '❤️'.repeat(l) : '💀');
        }));
        renderCard(key);

        // Saisie : seul le joueur dont c'est le tour peut écrire.
        const canType = me && (v.phase === 'play' || v.phase === 'count' || v.phase === 'pick');
        zone.classList.toggle('hidden', !canType && v.phase !== 'play');
        form.classList.toggle('hidden', !canType);
        if (key !== lastKey) {
          if (me && (v.phase === 'count' || v.phase === 'pick')) input.value = '';
          if (me && v.phase === 'play') { if (!v.chainMode) input.value = ''; input.focus(); }
          if (v.phase === 'play') { lastTick = null; sfx.go(); if (me) buzz([30, 30, 60]); }
          if (v.last && v.last.kind === 'ok' && v.phase === 'count') { if (v.last.pid === g.me) { sfx.ok(); buzz(30); } else sfx.pop(); }
          if (v.last && v.last.kind === 'fail' && (v.phase === 'count' || v.phase === 'pick')) { sfx.bad(); if (v.last.pid === g.me) buzz([200, 80, 200]); }
        }
        liveHint();

        // Ce que tape le joueur, visible par tous les autres.
        watch.replaceChildren(!me && v.phase === 'play'
          ? h('div', { class: 'bm-typing' }, h('span', { class: 'muted small' }, `${g.nameOf(v.cur)} écrit :`), h('b', null, v.typing || '…'))
          : null);

        // Mot refusé : message (et −3 s), plus bouton d'acceptation pour l'hôte.
        if (v.msg && v.msg.n !== lastMsgN) {
          lastMsgN = v.msg.n;
          if (v.phase === 'play') {
            sfx.bad(); if (me) buzz([60, 40, 60]);
            tv.el.classList.remove('bm-malus'); void tv.el.offsetWidth; tv.el.classList.add('bm-malus');
            if (me) { form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); }
          }
        }
        const showMsg = v.phase === 'play' && v.msg && v.msg.turn === `${v.cur}:${v.letters}:${v.n}`;
        msg.className = 'bm-msg' + (showMsg ? ' bad' : '');
        msg.replaceChildren(
          showMsg ? h('span', null, (me ? '' : g.nameOf(v.cur) + ' : ') + v.msg.text) : null,
          v.phase === 'count' && v.last && v.last.reduced ? h('span', null, v.last.reduced) : null);
        hostSlot.replaceChildren(g.isHost && v.phase === 'play' && v.refused
          ? h('button', { class: 'btn btn-soft btn-block', onmousedown: (e) => e.preventDefault(), onclick: () => g.send({ type: 'accept' }) }, `👍 Accepter « ${v.refused} » (hôte)`)
          : null);

        usedBox.replaceChildren(v.chainMode
          ? (v.chain.length ? h('div', { class: 'bm-chain' }, v.chain.map((w, i) => [i ? h('span', { class: 'arr' }, '→') : null, h('span', { class: 'chip' }, w)])) : null)
          : (v.played.length ? [h('p', { class: 'muted small' }, 'Déjà joués :'), h('div', { class: 'chips' }, v.played.slice().reverse().map((x) => h('span', { class: 'chip' }, x.w)))] : null));
        lastKey = key;
        updTimer();
      },
      destroy() { clearInterval(iv); clearTimeout(typingTimer); },
    };
  },
};

// ---------------- Logique (côté hôte) ----------------
const curPid = (s) => (s.phase === 'end' || s.phase === 'loading' ? null : s.order[s.turn % s.order.length]);
const isOn = (room, pid) => room.players.some((p) => p.pid === pid && p.on);
const aliveIds = (s) => s.order.filter((p) => s.lives[p] > 0);

// Lettres imposées : 1 au début, puis une de plus tous les 2 tours de table (3 au maximum).
function lenAt(room, s, k) {
  if (s.chainMode) return s.letters.length || 1;
  if (s.st.len !== 'prog') return s.st.len;
  const first = s.pos === 'in' ? 2 : 1;
  const per = Math.max(4, 2 * aliveIds(s).length);
  return Math.min(3, first + Math.floor(k / per));
}

function drawLetters(room, s) {
  const len = lenAt(room, s, s.turnsDone);
  if (s.turnsDone > 0 && len > lenAt(room, s, s.turnsDone - 1)) s.levelup++;
  s.turnsDone++;
  const l = dico.draw(s.pos, len, s.recent);
  s.recent.push(l);
  if (s.recent.length > 20) s.recent.shift();
  return l;
}

function firstTurn(room, s) {
  // Le premier joueur connecté et en vie commence.
  for (let i = 0; i < s.order.length && !(s.lives[curOf(s)] > 0 && isOn(room, curOf(s))); i++) s.turn++;
  if (s.chainMode) toPick(s); else toCount(room, s);
}
const curOf = (s) => s.order[s.turn % s.order.length];

function toCount(room, s) {
  s.n++;
  s.phase = 'count';
  s.until = Date.now() + GAP_MS;
  s.typing = '';
  s.refused = null;
  if (!s.chainMode) s.letters = drawLetters(room, s);
}
function toPick(s) {
  s.n++;
  s.phase = 'pick';
  s.until = Date.now() + PICK_MS;
  s.letters = '';
  s.chain = [];
  s.typing = '';
  s.refused = null;
}
function startPlay(room, s) {
  s.phase = 'play';
  s.deadline = Date.now() + s.st.time * 1000;
  s.refused = null;
}

function nextTurn(room, s) {
  for (let i = 0; i < s.order.length; i++) {
    s.turn++;
    const p = curOf(s);
    if (s.lives[p] > 0 && isOn(room, p)) return;
  }
}

function afterTurn(room, s) {
  const alive = aliveIds(s);
  const aliveOn = alive.filter((p) => isOn(room, p));
  if (alive.length <= 1 || aliveOn.length === 0) {
    s.phase = 'end';
    s.winner = alive.length === 1 ? alive[0] : null;
    return;
  }
  if (aliveOn.length === 1) {
    // Tous les autres survivants sont déconnectés : le dernier présent gagne.
    s.phase = 'end';
    s.winner = aliveOn[0];
    return;
  }
  if (s.chainMode && !s.letters) toPick(s); else toCount(room, s);
}

function names(room) { return new Set(room.players.map((p) => normWord(p.name))); }
function known(room, raw, n) {
  const nm = names(room);
  if (dico.has(n) || nm.has(n)) return true;
  const parts = raw.split(/[\s'’-]+/).map(normWord).filter(Boolean);
  return parts.length > 1 && parts.every((x) => dico.has(x) || nm.has(x));
}

function reject(s, text, word = null) {
  s.deadline -= MALUS_MS;
  s.msg = { n: (s.msg ? s.msg.n : 0) + 1, text: `${text} −3 s ⏱️`, turn: `${curPid(s)}:${s.letters}:${s.n}` };
  s.refused = word;
  return true;
}

function submit(room, s, raw) {
  const n = normWord(raw);
  if (!n) return false;
  const L = up(s.letters);
  if (!fits(n, s.letters, s.pos)) return reject(s, `« ${raw} » ${s.pos === 'in' ? 'ne contient pas' : 'ne commence pas par'} ${L}.`);
  if (n.length < minLength(s.letters)) return reject(s, `Trop court ! Au moins ${minLength(s.letters)} lettres.`);
  if (s.used.has(n)) return reject(s, `« ${raw} » a déjà été joué !`);
  if (!known(room, raw, n)) return reject(s, `« ${raw} » n'est pas dans le dictionnaire.`, raw);
  accept(room, s, raw);
  return true;
}

function accept(room, s, raw) {
  const n = normWord(raw);
  const pid = curPid(s);
  s.used.add(n);
  s.played.push({ w: raw, pid });
  s.words[pid] = (s.words[pid] || 0) + 1;
  const p = room.players.find((x) => x.pid === pid);
  if (p) p.score++;
  if (!s.best[pid] || n.length > normWord(s.best[pid]).length) s.best[pid] = raw;
  s.last = { kind: 'ok', pid, word: raw };
  if (s.chainMode) {
    s.chain.push(raw);
    s.bestChain = Math.max(s.bestChain, s.chain.length);
    const next = dico.chainLetters(n, s.st.chain, s.used);
    s.letters = next.letters;
    if (next.reduced) s.last.reduced = `Aucun mot ne commence par ${up(n.slice(-s.st.chain))} : on garde ${up(next.letters)}.`;
  }
  nextTurn(room, s);
  afterTurn(room, s);
}

function fail(room, s) {
  const pid = curPid(s);
  s.lives[pid] = Math.max(0, s.lives[pid] - 1);
  const dead = s.lives[pid] === 0;
  if (dead) s.out.push(pid);
  s.last = { kind: 'fail', pid, dead, lives: s.lives[pid], letters: s.letters, ex: dico.examples(s.letters, s.pos, s.used), chainLen: s.chainMode ? s.chain.length : 0 };
  if (s.chainMode) s.letters = ''; // la chaîne est cassée : le joueur suivant choisit une lettre
  nextTurn(room, s);
  afterTurn(room, s);
}

export default bonmot;
