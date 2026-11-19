// La roue des gages.
import { h, topbar, pick } from '../ui.js';
import { get, set, makeDeck, getPlayers, sip } from '../store.js';
import { levelPicker } from '../common.js';
import { playersPanel } from '../players.js';
import { sfx, buzz } from '../sfx.js';

const LEVELS = [
  { id: 'soft', name: 'Tranquille', emoji: '😇', desc: 'Des gages gentils.' },
  { id: 'fun', name: 'Ridicule', emoji: '🤡', desc: 'La honte, mais pour rire.' },
  { id: 'hot', name: 'Hot', emoji: '🔥', desc: 'Coquin, réservé aux adultes.', adult: true },
  { id: 'hotpp', name: 'Hot++', emoji: '😈', desc: 'Très explicite, sans filtre. Adultes consentants uniquement : chacun peut refuser sans se justifier.', adult: true, extreme: true },
];

const SEGMENTS = [
  { label: 'Gage', emoji: '🎯', color: '#ff4d8d', kind: 'gage' },
  { label: 'Joker', emoji: '🍀', color: '#22d39a', kind: 'joker' },
  { label: 'Gage', emoji: '🎯', color: '#7c5cff', kind: 'gage' },
  { label: 'Double', emoji: '🔥', color: '#ff7a1a', kind: 'double' },
  { label: 'Gage', emoji: '🎯', color: '#2ec5ff', kind: 'gage' },
  { label: 'Tous !', emoji: '🎉', color: '#ffc93c', kind: 'tous' },
  { label: 'Gage', emoji: '🎯', color: '#e84aa3', kind: 'gage' },
  { label: 'Tu choisis', emoji: '👉', color: '#1fb5ad', kind: 'choisis' },
  { label: 'Gage', emoji: '🎯', color: '#9b3fd6', kind: 'gage' },
  { label: 'Pénalité', emoji: '🍹', color: '#e53935', kind: 'sip' },
];

function drawWheel(cv) {
  const g = cv.getContext('2d');
  const W = cv.width, R = W / 2;
  const n = SEGMENTS.length;
  g.clearRect(0, 0, W, W);
  SEGMENTS.forEach((s, i) => {
    const a0 = -Math.PI / 2 + (i / n) * Math.PI * 2 - Math.PI / n;
    const a1 = a0 + (Math.PI * 2) / n;
    g.beginPath(); g.moveTo(R, R); g.arc(R, R, R - 6, a0, a1); g.closePath();
    g.fillStyle = s.color; g.fill();
    g.lineWidth = 4; g.strokeStyle = '#120d26'; g.stroke();
    g.save();
    g.translate(R, R);
    g.rotate((a0 + a1) / 2);
    g.textAlign = 'right'; g.textBaseline = 'middle';
    g.font = `bold ${Math.round(W / 22)}px system-ui, sans-serif`;
    g.fillStyle = '#fff';
    g.fillText(s.label, R - 26, 0);
    g.font = `${Math.round(W / 16)}px system-ui, sans-serif`;
    g.fillText(s.emoji, R - 26 - g.measureText(s.label).width - W / 14, 0);
    g.restore();
  });
  g.beginPath(); g.arc(R, R, W / 11, 0, Math.PI * 2); g.fillStyle = '#120d26'; g.fill();
  g.lineWidth = 6; g.strokeStyle = '#fff'; g.stroke();
}

export function start(ctx) {
  const { root, meta } = ctx;
  const selected = new Set(get('lv:roue', ['soft', 'fun']).filter((id) => LEVELS.some((l) => l.id === id)));
  if (!selected.size) selected.add('soft');
  const dataP = import('../data/gages.js').then((m) => m.default);

  function setup() {
    root.replaceChildren(
      topbar(ctx),
      h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r }))),
      playersPanel(0),
      h('div', { class: 'section-title' }, 'Niveaux des gages'),
      levelPicker(LEVELS, selected, (s) => set('lv:roue', [...s])),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => dataP.then(play) }, '🎡 À la roue !'));
  }

  function play(data) {
    const deck = makeDeck('roue:' + [...selected].sort(), [...selected].flatMap((l) => data[l] || []));
    const players = getPlayers();
    const cv = h('canvas', { width: 760, height: 760 });
    drawWheel(cv);
    let angle = 0;
    let spinning = false;
    const result = h('div', { class: 'col', style: { minHeight: '150px' } });
    const btn = h('button', { class: 'btn btn-primary btn-big btn-block', onclick: spin }, '🎡 Tourner la roue');
    root.replaceChildren(topbar(ctx, { onBack: setup }),
      h('div', { class: 'wheel-wrap' }, h('div', { class: 'wheel-pointer' }, '🔻'), cv),
      result, btn);

    function spin() {
      if (spinning) return;
      spinning = true;
      btn.disabled = true;
      result.replaceChildren();
      const n = SEGMENTS.length;
      const idx = Math.floor(Math.random() * n);
      const jitter = (Math.random() - 0.5) * (360 / n) * 0.7;
      const target = 360 * (5 + Math.floor(Math.random() * 3)) + (360 - idx * (360 / n)) + jitter;
      angle = angle - (angle % 360) + target;
      cv.style.transform = `rotate(${angle}deg)`;
      sfx.swoosh();
      let ticks = 0;
      const tickIv = setInterval(() => { if (++ticks > 30 || !root.isConnected) clearInterval(tickIv); else sfx.tick(); }, 60 + ticks * 4);
      setTimeout(() => {
        clearInterval(tickIv);
        spinning = false;
        btn.disabled = false;
        if (!root.isConnected) return;
        const seg = SEGMENTS[idx];
        const who = players.length ? pick(players) : null;
        const gage = () => deck.next();
        let title, text;
        switch (seg.kind) {
          case 'joker': title = '🍀 Joker !'; text = who ? `${who} est épargné(e) cette fois-ci.` : 'Pas de gage cette fois-ci, chanceux !'; break;
          case 'double': title = '🔥 Double gage !'; text = `${who ? who + ' : ' : ''}${gage()} — ET — ${gage()}`; break;
          case 'tous': title = '🎉 Tout le monde !'; text = gage(); break;
          case 'choisis': title = '👉 Tu choisis la victime'; text = `${who ? who + ' désigne' : 'Désigne'} qui doit faire : ${gage()}`; break;
          case 'sip': title = '🍹 Pénalité'; text = `${who ? who + ' prend' : 'Tu prends'} ${sip(2)}.`; break;
          default: title = who ? `🎯 Gage pour ${who}` : '🎯 Gage'; text = gage();
        }
        sfx.fanfare(); buzz([50, 30, 80]);
        result.replaceChildren(h('div', { class: 'qcard anim', style: { minHeight: '0', '--g1': seg.color, '--g2': '#3a2a86' } }, h('div', { class: 'kicker' }, title), h('div', { class: 'big', style: { fontSize: '22px' } }, text)));
      }, 4300);
    }
  }

  setup();
}
