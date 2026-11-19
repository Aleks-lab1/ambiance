// Versions « un seul téléphone » : Bataille navale (contre le téléphone), Memory et Yam's (chacun son tour).
import { h, topbar, seg } from '../ui.js';
import { get, set, getPlayers, sip } from '../store.js';
import { onlineBanner } from '../common.js';
import { playersPanel } from '../players.js';
import { sfx, buzz } from '../sfx.js';
import { randomFleet, fire, aiShot } from '../plateau-core.js';
import { bnGrid, memoryOnline, yamsOnline } from '../online/plateau.js';

const rulesPanel = (meta) => h('div', { class: 'panel rules' }, meta.rules.map((r) => h('p', { html: r })));

/**
 * Fait tourner un jeu « en ligne » chacun son tour sur un seul téléphone :
 * le téléphone affiche toujours la vue du joueur dont c'est le tour.
 */
function hotseat(ctx, mod, st, onExit) {
  const names = getPlayers().length ? getPlayers() : ['Toi'];
  const room = { host: 'p0', players: names.map((n, i) => ({ pid: 'p' + i, name: n, score: 0, on: true })) };
  const s = mod.init(room, st, {});
  const wrap = h('div', { class: 'col' });
  ctx.root.replaceChildren(topbar(ctx, { onBack: onExit }), wrap);
  const g = {
    get me() { return s.cur || 'p0'; }, isHost: true, hotseat: names.length > 1, now: () => Date.now(),
    nameOf: (pid) => (room.players.find((p) => p.pid === pid) || {}).name || '?',
    hostBar: () => h('div', { class: 'row' }, h('button', { class: 'btn btn-soft grow', onclick: onExit }, 'Réglages'), h('button', { class: 'btn btn-primary grow', onclick: () => hotseat(ctx, mod, st, onExit) }, '🔁 Rejouer')),
    send: (a) => { if (mod.action(room, s, g.me, a)) push(); },
  };
  const view = mod.mount(wrap, g);
  const push = () => { if (wrap.isConnected) view.update(room, mod.view(room, s, g.me)); };
  const iv = setInterval(() => { if (!wrap.isConnected) { clearInterval(iv); return; } if (mod.tick && mod.tick(room, s)) push(); }, 200);
  push();
}

// ---------------- Memory ----------------
export const memory = {
  start(ctx) {
    const { root, meta } = ctx;
    const st = Object.assign({ pairs: 10 }, get('memory', {}));
    const setup = () => root.replaceChildren(topbar(ctx),
      onlineBanner(ctx, 'memory', { text: 'Chacun retourne les cartes depuis son téléphone, à tour de rôle.' }),
      h('div', { class: 'section-title' }, 'Ou sur un seul téléphone'), rulesPanel(meta), playersPanel(0),
      h('label', { class: 'field' }, 'Nombre de paires', seg([8, 10, 12, 15].map((n) => ({ value: n, label: String(n) })), st.pairs, (v) => { st.pairs = v; set('memory', st); })),
      h('div', { class: 'grow' }), h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => hotseat(ctx, memoryOnline, st, setup) }, '🧩 Jouer'));
    setup();
  },
};

// ---------------- Yam's ----------------
export const yams = {
  start(ctx) {
    const { root, meta } = ctx;
    const setup = () => root.replaceChildren(topbar(ctx),
      onlineBanner(ctx, 'yams', { text: 'Chacun lance les dés sur son téléphone, la feuille de score est partagée.' }),
      h('div', { class: 'section-title' }, 'Ou sur un seul téléphone'), rulesPanel(meta), playersPanel(0),
      h('p', { class: 'muted small' }, 'Avec une liste de joueurs, on se passe le téléphone à chaque tour.'),
      h('div', { class: 'grow' }), h('button', { class: 'btn btn-primary btn-big btn-block', onclick: () => hotseat(ctx, yamsOnline, {}, setup) }, '🎲 Jouer'));
    setup();
  },
};

// ---------------- Bataille navale contre le téléphone ----------------
export const bataille = {
  start(ctx) {
    const { root, meta } = ctx;
    let timers = [];
    const clear = () => { timers.forEach(clearTimeout); timers = []; };
    const setup = () => { clear(); root.replaceChildren(topbar(ctx),
      onlineBanner(ctx, 'bataille', { text: 'Chacun sa flotte sur son téléphone. Le gagnant reste et affronte le suivant !' }),
      h('div', { class: 'section-title' }, 'Ou contre le téléphone'), rulesPanel(meta),
      h('p', { class: 'center muted' }, `🏅 Victoires contre le téléphone : ${get('bn-wins', 0)}`),
      h('div', { class: 'grow' }), h('button', { class: 'btn btn-primary btn-big btn-block', onclick: place }, '🚢 Jouer')); };
    function place() {
      let mine = randomFleet();
      const top = topbar(ctx, { onBack: setup });
      const draw = () => root.replaceChildren(top, h('h2', { class: 'center' }, 'Ta flotte'), bnGrid({}, { ships: mine }),
        h('div', { class: 'row' }, h('button', { class: 'btn btn-soft grow', onclick: () => { mine = randomFleet(); draw(); } }, '🔀 Remélanger'), h('button', { class: 'btn btn-primary grow', onclick: () => battle(mine) }, '⚔️ À l\'attaque !')));
      draw();
    }
    function battle(mine) {
      clear();
      const cpu = randomFleet();
      const onCpu = {}, onMe = {};
      let myTurn = true, over = false, msg = 'À toi de tirer !';
      const top = topbar(ctx, { onBack: setup });
      const draw = () => root.replaceChildren(top, h('h2', { class: 'center' }, msg),
        h('p', { class: 'center small' }, 'Chez le téléphone'), bnGrid(onCpu, { ships: over ? cpu : null, onFire: myTurn && !over ? shoot : null }),
        h('p', { class: 'center small' }, 'Ta flotte'), bnGrid(onMe, { ships: mine, small: true }),
        over ? h('button', { class: 'btn btn-primary btn-big btn-block', onclick: place }, '🔁 Rejouer') : null);
      function shoot(i) {
        const r = fire(cpu, onCpu, i);
        r.res === 'miss' ? sfx.swoosh() : (sfx.boom(), buzz(60));
        if (r.all) { over = true; msg = '🏆 Tu as coulé toute la flotte !'; set('bn-wins', get('bn-wins', 0) + 1); sfx.fanfare(); draw(); return; }
        if (r.res === 'miss') { myTurn = false; msg = '🌊 À l\'eau… le téléphone tire.'; draw(); timers.push(setTimeout(cpuShot, 800)); } else { msg = r.res === 'sunk' ? `💥 Coulé (bateau de ${r.sunk}) ! Rejoue.` : '🔥 Touché ! Rejoue.'; draw(); }
      }
      function cpuShot() {
        if (!root.isConnected || over) return;
        const r = fire(mine, onMe, aiShot(onMe));
        r.res === 'miss' ? sfx.swoosh() : (sfx.boom(), buzz([80, 40, 80]));
        if (r.all) { over = true; msg = `📱 Le téléphone a gagné… ${sip(2)} !`; sfx.bad(); draw(); return; }
        if (r.res === 'miss') { myTurn = true; msg = '🌊 Il a raté ! À toi.'; draw(); } else { msg = r.res === 'sunk' ? '💥 Il a coulé un de tes bateaux…' : '🔥 Il t\'a touché… il rejoue.'; draw(); timers.push(setTimeout(cpuShot, 900)); }
      }
      draw();
    }
    setup();
    return clear;
  },
};
