// Jeux de rapidité (js/race-core.js) : questions sans répétition d'une partie à l'autre, mode sans limite,
// et vérification du contenu (Quiz, À vue de nez, Vrai ou faux, Émojis, Anagrammes). Sans navigateur.
import { createRequire } from 'node:module';
const { check, done } = createRequire(import.meta.url)('../lib/check.cjs');

// Faux localStorage : c'est là que l'appli mémorise les questions déjà posées.
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), key: (i) => [...mem.keys()][i], get length() { return mem.size; } };

const { questionSource, buildQuestions, matches } = await import('../../js/race-core.js');
const { norm } = await import('../../js/ui.js');
const QUIZ = (await import('../../js/data/quiz.js')).default;
const ESTIM = (await import('../../js/data/estimations.js')).default;
const VF = (await import('../../js/data/vraifaux.js')).default;
const EMO = (await import('../../js/data/emojis.js')).default;
const ANAG = (await import('../../js/data/anagrammes.js')).default;
const key = (s) => norm(s);

// --- Contenu ---
check(QUIZ.q.length >= 600, `Quiz : plus de 600 questions (${QUIZ.q.length})`);
check(QUIZ.q.every((q) => q.length === 6 && QUIZ.themes.some((t) => t.id === q[0]) && new Set(q.slice(2)).size === 4), 'Quiz : 1 bonne réponse + 3 fausses, toutes différentes, thème connu');
check(new Set(QUIZ.q.map((q) => key(q[1]))).size === QUIZ.q.length, 'Quiz : aucune question en double');
check(ESTIM.length >= 200 && ESTIM.every((e) => typeof e[0] === 'string' && Number.isFinite(e[1]) && typeof e[2] === 'string'), `À vue de nez : plus de 200 questions valides (${ESTIM.length})`);
check(new Set(ESTIM.map((e) => key(e[0]))).size === ESTIM.length, 'À vue de nez : aucune question en double');
check(VF.length >= 200 && VF.every((v) => typeof v[1] === 'boolean'), `Vrai ou faux : plus de 200 affirmations (${VF.length})`);
check(new Set(VF.map((v) => key(v[0]))).size === VF.length, 'Vrai ou faux : aucune affirmation en double');
check(new Set(EMO.map((e) => key(e[1]))).size === EMO.length && EMO.every((e) => matches(e[1], [e[1], ...(e[3] || [])], e[4])), `Émojis : réponses uniques et reconnues (${EMO.length})`);
check(new Set(ANAG.map(key)).size === ANAG.length, `Anagrammes : aucun mot en double (${ANAG.length})`);

// --- Pas de répétition d'une partie à l'autre ---
const game1 = buildQuestions('quiz', QUIZ, 200).map((q) => q.pub.q);
const game2 = buildQuestions('quiz', QUIZ, 200).map((q) => q.pub.q);
check(new Set(game1).size === 200, 'une partie de 200 questions : aucune répétition');
check(!game2.some((q) => game1.includes(q)), 'partie suivante : aucune question de la partie précédente');
const e1 = buildQuestions('estim', ESTIM, 100).map((q) => q.pub.q);
const e2 = buildQuestions('estim', ESTIM, 100).map((q) => q.pub.q);
check(!e2.some((q) => e1.includes(q)), 'À vue de nez : pas de répétition entre deux parties');

// --- Sans limite : quand tout a été vu, on repart pour un tour complet ---
const src = questionSource('vf', VF);
const all = Array.from({ length: VF.length * 2 + 5 }, () => src.next().pub.q);
const firstRound = all.slice(0, VF.length);
check(new Set(firstRound).size === VF.length, 'Vrai ou faux sans limite : toutes les affirmations passent avant la moindre répétition');
check(all.every(Boolean), 'sans limite : on peut tirer des questions à l\'infini');
const calc = questionSource('calc', null, { level: 'moyen' });
const calcs = Array.from({ length: 300 }, () => calc.next());
check(calcs.every((c) => c.pub.q && c.ans.text), 'Calcul express sans limite : 300 calculs générés');
const geo = questionSource('quiz', QUIZ, { themes: ['geo'] });
check(Array.from({ length: 30 }, () => geo.next()).every((q) => q.pub.theme.includes('Géographie')), 'Quiz : seulement les thèmes choisis');
done();
