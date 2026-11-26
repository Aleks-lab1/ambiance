// Jeux d'écriture en ligne : Punchlines (réponse la plus drôle) et Dico bluff (fausses définitions).
// Déroulé d'une manche : écrire → voter (anonyme) → révélation des auteurs et des points.
import { h, uid, shuffle, seg, norm, setText } from '../ui.js';
import { drawNew, TV_PID, tvTimer, tvEnd, tvWho, ranking } from './kit.js';
import { podium, levelPicker } from '../common.js';
import { sfx, buzz } from '../sfx.js';
import PUNCH from '../data/punchlines.js';
import DICO from '../data/dico.js';

export const PUNCH_LEVELS = [
  { id: 'fun', name: 'Fun', emoji: '😂', desc: 'Pour tout le monde.' },
  { id: 'trash', name: 'Trash', emoji: '🤬', desc: 'Humour trash et gênant, réservé aux adultes.', adult: true },
  { id: 'hotpp', name: 'Hot++', emoji: '😈', desc: 'Très explicite. Adultes consentants uniquement.', adult: true, extreme: true },
];
const VOTE_MS = 45000;
const REAL = '__real';
const player = (room, pid) => room.players.find((p) => p.pid === pid);

function makeWrite(mode) {
  const dico = mode === 'dico';
  const maxLen = dico ? 160 : 100;

  function startRound(room, s) {
    s.round++;
    if (s.round > s.st.rounds) { s.phase = 'end'; return; }
    const item = drawNew(s, s.key, s.all);
    s.prompt = dico ? item[0] : item;
    s.real = dico ? item[1] : null;
    s.subs = {};
    s.options = [];
    s.votes = {};
    s.gains = {};
    s.knew = [];
    s.phase = 'write';
    s.deadline = Date.now() + s.st.time * 1000;
  }

  const active = (room) => room.players.filter((p) => p.on).map((p) => p.pid);
  const canVote = (s, pid) => s.options.some((o) => o.author !== pid);

  function startVote(room, s) {
    const opts = [];
    for (const [pid, text] of Object.entries(s.subs)) {
      if (dico && norm(text) === norm(s.real)) { s.knew.push(pid); continue; }
      opts.push({ id: uid(), text, author: pid });
    }
    if (dico) opts.push({ id: uid(), text: s.real, author: REAL });
    s.options = shuffle(opts);
    if (!s.options.length || active(room).every((pid) => !canVote(s, pid))) { reveal(room, s); return; }
    s.phase = 'vote';
    s.deadline = Date.now() + VOTE_MS;
  }

  function reveal(room, s) {
    const gains = {};
    const add = (pid, n) => { gains[pid] = (gains[pid] || 0) + n; };
    for (const [voter, id] of Object.entries(s.votes)) {
      const o = s.options.find((x) => x.id === id);
      if (!o) continue;
      if (o.author === REAL) add(voter, 200);
      else add(o.author, 100);
    }
    for (const pid of s.knew) add(pid, 200);
    for (const [pid, n] of Object.entries(gains)) { const p = player(room, pid); if (p) p.score += n; }
    s.gains = gains;
    s.phase = 'reveal';
  }

  return {
    id: 'write-' + mode,
    name: dico ? 'Dico bluff' : 'Punchlines',
    short: dico ? 'Fausses définitions' : 'La réponse la plus drôle',
    emoji: dico ? '📖' : '✍️',
    minPlayers: dico ? 2 : 3,
    defaults: { rounds: 6, time: dico ? 75 : 60, levels: ['fun'] },

    settingsForm(st, set) {
      const parts = [
        h('label', { class: 'field' }, 'Nombre de manches', seg([4, 6, 8, 10].map((n) => ({ value: n, label: String(n) })), st.rounds, (v) => set({ rounds: v }))),
        h('label', { class: 'field' }, 'Temps pour écrire', seg([45, 60, 75, 90].map((n) => ({ value: n, label: n + ' s' })), st.time, (v) => set({ time: v }))),
      ];
      if (!dico) {
        const sel = new Set((st.levels || []).filter((l) => PUNCH_LEVELS.some((x) => x.id === l)));
        if (!sel.size) sel.add('fun');
        set({ levels: [...sel] });
        parts.push(h('div', { class: 'col' }, h('p', { class: 'muted small' }, 'Niveaux'), levelPicker(PUNCH_LEVELS, sel, (s) => set({ levels: [...s] }))));
      }
      return h('div', { class: 'col' }, parts);
    },

    init(room, st) {
      const all = dico ? DICO.slice() : (st.levels && st.levels.length ? st.levels : ['fun']).flatMap((l) => PUNCH[l] || []);
      const s = { gid: uid(), st, all, key: dico ? 'on:dico' : 'on:punch:' + (st.levels && st.levels.length ? st.levels : ['fun']).slice().sort(), round: 0 };
      startRound(room, s);
      return s;
    },

    action(room, s, pid, a) {
      const host = pid === room.host;
      if (a.type === 'next' && host) {
        if (s.phase === 'write') startVote(room, s);
        else if (s.phase === 'vote') reveal(room, s);
        else if (s.phase === 'reveal') startRound(room, s);
        else return false;
        return true;
      }
      if (a.type === 'submit' && s.phase === 'write' && player(room, pid)) {
        const text = String(a.text || '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
        if (!text) return false;
        s.subs[pid] = text;
        if (active(room).every((p) => s.subs[p])) startVote(room, s);
        return true;
      }
      if (a.type === 'vote' && s.phase === 'vote') {
        const o = s.options.find((x) => x.id === a.id);
        if (!o || o.author === pid) return false;
        s.votes[pid] = o.id;
        if (active(room).filter((p) => canVote(s, p)).every((p) => s.votes[p])) reveal(room, s);
        return true;
      }
      return false;
    },

    tick(room, s) {
      if ((s.phase === 'write' || s.phase === 'vote') && Date.now() >= s.deadline) {
        if (s.phase === 'write') startVote(room, s); else reveal(room, s);
        return true;
      }
      return false;
    },

    onLeave(room, s) {
      if (s.phase === 'write' && Object.keys(s.subs).length && active(room).every((p) => s.subs[p])) startVote(room, s);
      else if (s.phase === 'vote' && active(room).filter((p) => canVote(s, p)).every((p) => s.votes[p])) reveal(room, s);
    },

    view(room, s, pid) {
      const votersOf = (id) => Object.entries(s.votes).filter(([, v]) => v === id).map(([p]) => p);
      return {
        gid: s.gid, mode, round: s.round, rounds: s.st.rounds, phase: s.phase, deadline: s.deadline, prompt: s.prompt,
        submitted: Object.keys(s.subs), mySub: s.subs[pid] || null,
        options: s.phase === 'vote' ? s.options.map((o) => ({ id: o.id, text: o.text, mine: o.author === pid })) : null,
        myVote: s.votes[pid] || null,
        voted: Object.keys(s.votes),
        reveal: s.phase === 'reveal' ? { options: s.options.map((o) => ({ ...o, voters: votersOf(o.id) })), gains: s.gains, knew: s.knew, real: s.real } : null,
      };
    },

    // Écran télé : la phrase (ou le mot), puis toutes les réponses en grand pour le vote, puis qui a écrit quoi.
    tv(room, s) { return this.view(room, s, TV_PID); },
    tvMount(root, g) {
      const style = dico ? { '--g1': '#3d2c8d', '--g2': '#916dd5' } : { '--g1': '#ff0844', '--g2': '#ff7a59' };
      const tm = tvTimer(g);
      const who = tvWho();
      const bar = h('div', { class: 'tv-bar' });
      const promptSlot = h('div');
      const body = h('div', { class: 'col', style: { gap: '1em' } });
      const status = h('p', { class: 'tv-status' });
      root.append(bar, promptSlot, body, status);
      let lastKey = null;
      const promptCard = (v, small) => {
        if (dico) return h('div', { class: 'tv-card', style }, h('div', { class: 'kicker' }, small ? 'Le mot' : 'Que veut dire… ? Inventez une définition sur vos téléphones'), h('div', { class: 'q', style: small ? { fontSize: '1.6em' } : { fontSize: '3.2em' } }, v.prompt));
        const parts = String(v.prompt).split('___');
        return h('div', { class: 'tv-card', style }, h('div', { class: 'kicker' }, small ? 'La phrase' : 'Complétez la phrase sur vos téléphones'),
          h('div', { class: 'q', style: small ? { fontSize: '1.4em' } : null }, parts.map((t, i) => [t, i < parts.length - 1 ? h('span', { class: 'blank' }, '______') : null])));
      };
      return {
        update(room, v) {
          if (v.phase === 'end') {
            tm.set(0); bar.replaceChildren(); promptSlot.replaceChildren(); status.textContent = '';
            if (lastKey !== 'end') { body.replaceChildren(...tvEnd(room)); }
            lastKey = 'end';
            return;
          }
          const key = v.gid + ':' + v.round + ':' + v.phase;
          const total = room.players.filter((p) => p.on).length;
          tm.set(v.phase === 'write' || v.phase === 'vote' ? v.deadline : 0);
          if (key !== lastKey) {
            bar.replaceChildren(h('span', { class: 'pill' }, `${dico ? '📖' : '✍️'} Manche ${v.round}/${v.rounds}`), h('div', { class: 'grow' }), tm.el);
            promptSlot.replaceChildren(promptCard(v, v.phase !== 'write'));
            if (v.phase === 'write') { body.replaceChildren(who.el); sfx.go(); }
            if (v.phase === 'vote') {
              body.replaceChildren(h('div', { class: 'tv-options' }, v.options.map((o, i) => h('div', { class: 'tv-option', style: { animationDelay: i * 0.12 + 's' } },
                h('span', { class: 'n' }, `Réponse ${i + 1}`), h('span', null, o.text)))));
              sfx.swoosh();
            }
            if (v.phase === 'reveal') {
              const r = v.reveal;
              const max = Math.max(0, ...r.options.map((o) => o.voters.length));
              body.replaceChildren(
                r.knew.length ? h('p', { class: 'tv-status' }, `🤓 ${r.knew.map(g.nameOf).join(', ')} connaissai${r.knew.length > 1 ? 'ent' : 't'} le mot (+200)`) : '',
                h('div', { class: 'tv-options' }, r.options.slice().sort((a, b) => b.voters.length - a.voters.length).map((o, i) => {
                  const real = o.author === REAL;
                  return h('div', { class: 'tv-option' + (real ? ' real' : '') + (!real && max && o.voters.length === max ? ' top' : ''), style: { animationDelay: i * 0.12 + 's' } },
                    h('span', { class: 'by' }, real ? '📖 La vraie définition' : `✍️ ${g.nameOf(o.author)}${r.gains[o.author] ? ' · +' + r.gains[o.author] : ''}`),
                    h('span', null, o.text),
                    h('div', { class: 'votes' }, o.voters.length ? o.voters.map((p) => h('span', null, '👍 ' + g.nameOf(p))) : h('span', null, 'Aucun vote')));
                })));
              sfx.end();
            }
          }
          if (v.phase === 'write') { who.set(room, v.submitted); setText(status, `✍️ ${v.submitted.length}/${total} ont écrit`); }
          else if (v.phase === 'vote') setText(status, `🗳️ ${v.voted.length} vote${v.voted.length > 1 ? 's' : ''} · ${dico ? 'Laquelle est la vraie définition ?' : 'Votez pour la plus drôle !'}`);
          else status.textContent = '';
          lastKey = key;
        },
        destroy() { tm.stop(); },
      };
    },

    mount(root, g) {
      const head = h('div', { class: 'row' });
      const promptSlot = h('div');
      const body = h('div', { class: 'col' });
      const status = h('p', { class: 'status-line' });
      const hostSlot = h('div', { class: 'col' });
      root.append(head, promptSlot, body, status, hostSlot);
      const timer = h('span', { class: 'pill timer-num', style: { fontSize: '15px' } });
      let v = null, lastKey = null, lastTick = null, ta = null;

      const iv = setInterval(updTimer, 250);
      function updTimer() {
        if (!v) return;
        if (v.phase === 'write' || v.phase === 'vote') {
          const sec = Math.ceil(Math.max(0, v.deadline - g.now()) / 1000);
          setText(timer, '⏱ ' + sec);
          timer.classList.toggle('low', sec <= 10);
          if (sec <= 5 && sec > 0 && sec !== lastTick) { lastTick = sec; sfx.tick(); }
        } else timer.textContent = '';
      }

      function promptCard() {
        const style = dico ? { '--g1': '#3d2c8d', '--g2': '#916dd5', minHeight: '0' } : { '--g1': '#ff0844', '--g2': '#ff7a59', minHeight: '0' };
        if (dico) return h('div', { class: 'qcard anim', style }, h('div', { class: 'kicker' }, 'Que veut dire…'), h('div', { class: 'big', style: { fontSize: 'clamp(30px,9vw,44px)' } }, v.prompt));
        const parts = String(v.prompt).split('___');
        return h('div', { class: 'qcard anim', style }, h('div', { class: 'kicker' }, 'Complète la phrase'),
          h('div', { class: 'big', style: { fontSize: 'clamp(20px,5.6vw,28px)' } }, parts.map((t, i) => [t, i < parts.length - 1 ? h('span', { class: 'blank' }, '______') : null])));
      }

      function writeUI() {
        ta = h('textarea', { class: 'input', maxlength: String(maxLen), placeholder: dico ? 'Invente une définition crédible…' : 'Ta réponse la plus drôle…', style: { minHeight: '90px' } });
        if (v.mySub) ta.value = v.mySub;
        const btn = h('button', { class: 'btn btn-primary btn-block' }, v.mySub ? '✏️ Modifier ma réponse' : '📨 Envoyer');
        btn.onclick = () => { const t = ta.value.trim(); if (!t) return; g.send({ type: 'submit', text: t }); sfx.pop(); buzz(20); };
        return [ta, btn, dico ? h('p', { class: 'muted small center' }, 'Astuce : imite le style d\'un vrai dictionnaire pour piéger les autres !') : null];
      }

      function voteUI() {
        return [h('p', { class: 'muted center' }, dico ? 'Laquelle est la VRAIE définition ?' : 'Vote pour ta réponse préférée !'),
          h('div', { class: 'plist-sel' }, v.options.map((o) => h('button', {
            class: v.myVote === o.id ? 'on' : '', disabled: o.mine,
            onclick: () => { g.send({ type: 'vote', id: o.id }); sfx.pop(); buzz(15); },
          }, h('span', { style: { flex: '1' } }, o.text), o.mine ? h('span', { class: 'rl' }, '(la tienne)') : null)))];
      }

      function revealUI() {
        const r = v.reveal;
        const rows = r.options.slice().sort((a, b) => b.voters.length - a.voters.length).map((o) => {
          const real = o.author === REAL;
          return h('div', { class: 'reveal-opt' + (real ? ' real' : '') },
            h('div', { class: 'txt' }, o.text),
            h('div', { class: 'meta' },
              h('b', null, real ? '📖 Vraie définition' : '✍️ ' + g.nameOf(o.author)),
              h('span', null, o.voters.length ? `👍 ${o.voters.map(g.nameOf).join(', ')}` : 'Aucun vote')));
        });
        const gains = Object.entries(r.gains).sort((a, b) => b[1] - a[1]);
        return [
          r.knew.length ? h('p', { class: 'center small' }, `🤓 ${r.knew.map(g.nameOf).join(', ')} connaissai${r.knew.length > 1 ? 'ent' : 't'} le mot (+200)`) : null,
          ...rows,
          gains.length ? h('div', { class: 'panel small center' }, gains.map(([p, n]) => h('div', null, `${g.nameOf(p)} +${n}`))) : h('p', { class: 'muted center' }, 'Personne ne marque de points cette manche.'),
        ];
      }

      return {
        update(room, view) {
          v = view;
          const me = room.players.find((p) => p.pid === g.me);
          if (v.phase === 'end') {
            head.replaceChildren(); promptSlot.replaceChildren(); status.textContent = ''; hostSlot.replaceChildren();
            body.replaceChildren(h('div', { class: 'center' }, h('div', { class: 'hero-emo' }, '🏆'), h('h2', null, 'Fin de la partie !')),
              podium(ranking(room, g)), g.hostBar());
            lastKey = 'end';
            return;
          }
          const key = v.gid + ':' + v.round + ':' + v.phase;
          head.replaceChildren(h('span', { class: 'pill' }, `Manche ${v.round}/${v.rounds}`), h('div', { class: 'grow' }), h('span', { class: 'pill' }, '🏆 ' + (me ? me.score : 0)), timer);
          const total = room.players.filter((p) => p.on).length;
          if (key !== lastKey) {
            promptSlot.replaceChildren(promptCard());
            if (v.phase === 'write') { body.replaceChildren(...writeUI()); sfx.go(); }
            if (v.phase === 'vote') { sfx.swoosh(); buzz(30); }
            if (v.phase === 'reveal') { sfx.end(); }
            lastTick = null;
          }
          if (v.phase === 'write') {
            // On ne reconstruit pas la zone de saisie (pour ne pas effacer ce qui est en cours de frappe).
            const btn = body.querySelector('.btn');
            if (btn) setText(btn, v.mySub ? '✏️ Modifier ma réponse' : '📨 Envoyer');
            setText(status, `${v.mySub ? '✅ Envoyé ! ' : ''}${v.submitted.length}/${total} ont écrit`);
          } else if (v.phase === 'vote') {
            body.replaceChildren(...voteUI());
            setText(status, `🗳️ ${v.voted.length} vote${v.voted.length > 1 ? 's' : ''}`);
          } else {
            body.replaceChildren(...revealUI());
            status.textContent = '';
          }
          hostSlot.replaceChildren(g.isHost
            ? h('button', { class: 'btn ' + (v.phase === 'reveal' ? 'btn-primary btn-big' : 'btn-soft') + ' btn-block', onclick: () => g.send({ type: 'next' }) },
              v.phase === 'write' ? '⏭ Passer au vote' : v.phase === 'vote' ? '👀 Révéler maintenant' : (v.round >= v.rounds ? '🏆 Voir le classement' : 'Manche suivante →'))
            : null);
          lastKey = key;
          updTimer();
        },
        destroy() { clearInterval(iv); },
      };
    },
  };
}

export const writePunch = makeWrite('punch');
export const writeDico = makeWrite('dico');
