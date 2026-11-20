// Quiz, Émojis mystères, Anagrammes, À vue de nez : version un seul téléphone.
import { h, topbar, seg } from '../ui.js';
import { gameColors } from '../themes.js';
import { get, set, getPlayers } from '../store.js';
import { levelPicker, onlineBanner, podium } from '../common.js';
import { playersPanel } from '../players.js';
import { sfx, buzz } from '../sfx.js';
import { RACE_MODES, buildQuestions, isQcm, CALC_LEVELS } from '../race-core.js';

export function cardFor(mode, q) {
  const M = RACE_MODES[mode];
  const style = { '--g1': gameColors('mode-' + mode, M.colors)[0], '--g2': gameColors('mode-' + mode, M.colors)[1], minHeight: '0', padding: '22px 18px' };
  if (isQcm(mode)) return h('div', { class: 'qcard anim', style }, h('span', { class: 'badge lvl' }, q.theme), h('div', { class: 'big', style: { marginTop: '16px', fontSize: 'clamp(20px,5.4vw,28px)' } }, q.q));
  if (mode === 'calc') return h('div', { class: 'qcard anim', style }, h('div', { class: 'kicker' }, M.kicker), h('div', { class: 'calc-big' }, q.q, ' = ?'));
  if (mode === 'emoji') return h('div', { class: 'qcard anim', style }, h('span', { class: 'badge lvl' }, q.cat), h('div', { class: 'emoji-big' }, q.e));
  if (mode === 'anag') return h('div', { class: 'qcard anim', style }, h('div', { class: 'kicker' }, `${M.kicker} · ${q.len} lettres`), h('div', { class: 'tiles' }, q.s.split('').map((c) => h('span', null, c))));
  return h('div', { class: 'qcard anim', style }, h('div', { class: 'kicker' }, M.kicker), h('div', { class: 'big', style: { fontSize: 'clamp(20px,5.4vw,28px)' } }, q.q), q.unit ? h('div', { class: 'foot' }, `Réponse en : ${q.unit}`) : null);
}

function raceLocal(mode, load, onlineId) {
  return {
    start(ctx) {
      const { root, meta } = ctx;
      const opts = Object.assign({ count: 15, themes: null, level: 'moyen' }, get('race:' + mode, {}));
      const save = () => set('race:' + mode, opts);
      const dataP = load().then((m) => m && m.default);
      let alive = true;

      async function setup() {
        const data = await dataP;
        if (!alive) return;
        let themes = null;
        if (mode === 'quiz') {
          const sel = new Set(opts.themes && opts.themes.length ? opts.themes : data.themes.map((t) => t.id));
          themes = [h('div', { class: 'section-title' }, 'Thèmes'), levelPicker(data.themes.map((t) => ({ ...t, desc: '' })), sel, (s) => { opts.themes = [...s]; save(); })];
        }
        root.replaceChildren(
          topbar(ctx),
          onlineBanner(ctx, onlineId),
          h('div', { class: 'section-title' }, 'Ou sur un seul téléphone'),
          h('div', { class: 'panel rules' }, h('p', { html: meta.rules[meta.rules.length - 1] })),
          themes,
          mode === 'calc' ? h('label', { class: 'field' }, 'Difficulté', seg(CALC_LEVELS, opts.level, (v) => { opts.level = v; save(); })) : null,
          h('label', { class: 'field' }, 'Nombre de questions', seg([10, 15, 20, 30].map((v) => ({ value: v, label: String(v) })), opts.count, (v) => { opts.count = v; save(); })),
          playersPanel(0),
          h('p', { class: 'muted small' }, isQcm(mode) ? 'Avec une liste de joueurs, chacun répond à son tour et les points sont comptés automatiquement.' : 'Avec une liste de joueurs, touche le prénom de ceux qui ont trouvé pour compter les points.'),
          h('div', { class: 'grow' }),
          h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => play(data) }, '▶ Jouer sur ce téléphone'));
      }

      function play(data) {
        const list = buildQuestions(mode, data, opts.count, { themes: opts.themes, level: opts.level });
        const players = getPlayers();
        const scores = Object.fromEntries(players.map((p) => [p, 0]));
        let i = 0;
        const top = topbar(ctx, { onBack: setup });

        function show() {
          if (i >= list.length) { end(); return; }
          const Q = list[i];
          let revealed = false;
          const card = cardFor(mode, Q.pub);
          if (isQcm(mode)) { showQcm(Q); return; }
          const answer = h('div', { class: 'answer-reveal hidden' }, h('span', { class: 'muted small' }, 'La réponse'), h('b', null, Q.ans.text), Q.ans.note ? h('span', { class: 'small muted' }, Q.ans.note) : null);
          const gained = new Set();
          const chips = players.length ? h('div', { class: 'chips' }, players.map((p) => {
            const c = h('button', { class: 'chip' }, `${p} · ${scores[p]}`);
            c.onclick = () => {
              if (gained.has(p)) { gained.delete(p); scores[p]--; c.classList.remove('on'); } else { gained.add(p); scores[p]++; c.classList.add('on'); sfx.pop(); }
              c.textContent = `${p} · ${scores[p]}`;
            };
            return c;
          })) : null;
          const whoBox = chips ? h('div', { class: 'col hidden' }, h('p', { class: 'muted small' }, 'Qui a trouvé ? (touche pour donner le point)'), chips) : null;
          const btn = h('button', { class: 'btn btn-primary btn-big btn-block' }, '👀 Révéler la réponse');
          btn.onclick = () => {
            if (!revealed) {
              revealed = true;
              answer.classList.remove('hidden');
              whoBox && whoBox.classList.remove('hidden');
              btn.textContent = i + 1 < list.length ? 'Question suivante →' : '🏆 Voir les résultats';
              sfx.ok(); buzz(30);
            } else { i++; show(); }
          };
          root.replaceChildren(top,
            h('div', { class: 'row' }, h('span', { class: 'pill' }, `${meta.emoji} ${i + 1}/${list.length}`)),
            card, answer,
            whoBox,
            h('div', { class: 'grow' }), btn);
          sfx.swoosh();
        }

        // Quiz, Vrai ou faux : le joueur dont c'est le tour touche directement sa réponse ;
        // la bonne réponse s'affiche et le point est compté automatiquement.
        function showQcm(Q) {
          const who = players.length ? players[i % players.length] : null;
          const next = h('button', { class: 'btn btn-primary btn-big btn-block hidden' }, i + 1 < list.length ? 'Question suivante →' : '🏆 Voir les résultats');
          next.onclick = () => { i++; show(); };
          const answer = h('div', { class: 'answer-reveal hidden' }, h('span', { class: 'muted small' }, 'La réponse'), h('b', null, Q.ans.text), Q.ans.note ? h('span', { class: 'small muted' }, Q.ans.note) : null);
          const result = h('p', { class: 'center hidden', style: { fontWeight: '800', margin: '0' } });
          let answered = false;
          const btns = Q.pub.opts.map((o, k) => h('button', { class: 'quiz-opt', onclick: () => pick(k) }, h('b', null, 'ABCD'[k]), o));
          function pick(k) {
            if (answered) return;
            answered = true;
            const ok = k === Q.ans.i;
            btns.forEach((b, j) => { b.disabled = true; b.classList.add(j === Q.ans.i ? 'good' : j === k ? 'bad' : 'dim'); });
            if (who && ok) scores[who]++;
            result.textContent = ok ? (who ? `✅ Bien joué ${who} ! +1 point` : '✅ Bonne réponse !') : (who ? `❌ Raté pour ${who}…` : '❌ Raté…');
            result.classList.remove('hidden');
            answer.classList.remove('hidden');
            next.classList.remove('hidden');
            if (ok) { sfx.ok(); buzz(30); } else { sfx.bad(); buzz(80); }
          }
          root.replaceChildren(top,
            h('div', { class: 'row' },
              h('span', { class: 'pill' }, `${meta.emoji} ${i + 1}/${list.length}`),
              who ? h('span', { class: 'pill' }, `🎯 Au tour de ${who} · ${scores[who]} pt${scores[who] > 1 ? 's' : ''}`) : null),
            cardFor(mode, Q.pub), h('div', { class: 'quiz-opts' + (mode === 'vf' ? ' vf' : '') }, btns), result, answer,
            h('div', { class: 'grow' }), next);
          sfx.swoosh();
        }

        function end() {
          sfx.fanfare();
          root.replaceChildren(topbar(ctx, { onBack: setup }),
            h('div', { class: 'center' }, h('div', { class: 'hero-emo' }, '🏆'), h('h2', null, 'Fin de la partie !')),
            players.length ? podium(players.map((p) => ({ name: p, score: scores[p] }))) : h('p', { class: 'center muted' }, `${list.length} questions jouées.`),
            h('div', { class: 'grow' }),
            h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => play(data) }, '🔁 Rejouer'),
            h('button', { class: 'btn btn-soft btn-block', onclick: setup }, 'Réglages'));
        }
        show();
      }

      setup();
      return () => { alive = false; };
    },
  };
}

export const quiz = raceLocal('quiz', () => import('../data/quiz.js'), 'race-quiz');
export const emojis = raceLocal('emoji', () => import('../data/emojis.js'), 'race-emoji');
export const anagrammes = raceLocal('anag', () => import('../data/anagrammes.js'), 'race-anag');
export const estimations = raceLocal('estim', () => import('../data/estimations.js'), 'race-estim');
export const vraifaux = raceLocal('vf', () => import('../data/vraifaux.js'), 'race-vf');
export const calcul = raceLocal('calc', () => Promise.resolve(null), 'race-calc');
