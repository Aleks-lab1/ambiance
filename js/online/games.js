// Catalogue des jeux jouables en ligne.
import dessin from './dessin.js';
import imposteur from './imposteur.js';
import { voteTP, voteDix, voteQui, voteOp, voteJamais } from './vote.js';
import { paranoiaOnline, debatsOnline, cinqOnline, deuxOnline } from './tour.js';
import { patateOnline, reflexesOnline, couleursOnline, sequenceOnline } from './live.js';
import { petitbacOnline, motmystereOnline, morpionOnline, penduOnline } from './mots.js';
import { eqMI, eqMime, eqFredonne, eqDisle, chapeauOnline, loupOnline } from './equipes.js';
import { quiaecritOnline, curseurOnline, danssateteOnline, ordreOnline, quisuisjeOnline, chifoumiOnline } from './soiree.js';
import { batailleOnline, memoryOnline, yamsOnline } from './plateau.js';
import { raceQuiz, raceEmoji, raceAnag, raceEstim, raceVf, raceCalc } from './race.js';
import { writePunch, writeDico } from './write.js';
import telephone from './telephone.js';
import bingo from './bingo.js';
import menteur from './menteur.js';
import bonmot from './bonmot.js';
import unisson from './unisson.js';
import { etsiOnline, confidencesOnline, capOnline, actionOnline } from './cartes.js';
import { roiOnline, plusmoinsOnline, busOnline } from './paquet.js';
import { bouteilleOnline, roueOnline, doigtOnline, outilsOnline } from './hasard.js';
import { frontOnline, niouiOnline, histoireOnline } from './oral.js';
import { fouleOnline } from './foule.js';

export const ONLINE_GAMES = [dessin, imposteur, raceQuiz, writePunch, telephone, writeDico, menteur, raceEmoji, raceAnag, raceEstim, raceVf, raceCalc, bonmot, unisson, bingo, voteTP, voteDix, voteQui, voteOp, voteJamais,
  eqMI, eqMime, eqFredonne, eqDisle, petitbacOnline, patateOnline, reflexesOnline, couleursOnline, motmystereOnline, morpionOnline,
  paranoiaOnline, debatsOnline, cinqOnline, deuxOnline, loupOnline,
  quiaecritOnline, curseurOnline, danssateteOnline, ordreOnline, quisuisjeOnline, chifoumiOnline, batailleOnline, memoryOnline, yamsOnline,
  actionOnline, capOnline, etsiOnline, confidencesOnline, bouteilleOnline, roueOnline, roiOnline, plusmoinsOnline, busOnline,
  chapeauOnline, frontOnline, niouiOnline, histoireOnline, penduOnline, sequenceOnline, doigtOnline, outilsOnline, fouleOnline];
export const onlineGame = (id) => ONLINE_GAMES.find((g) => g.id === id);

// Jeu du catalogue (js/games/index.js) qui correspond à chaque jeu en ligne : image de la case, couleurs,
// catégories et nombre de joueurs, pour le choix illustré du salon. Même identifiant sauf ceux-ci :
const LOCAL_OF = {
  'race-quiz': 'quiz', 'race-emoji': 'emojis', 'race-anag': 'anagrammes', 'race-estim': 'estimations', 'race-vf': 'vraifaux', 'race-calc': 'calcul',
  'write-punch': 'punchlines', 'write-dico': 'dico',
  'vote-tp': 'tupreferes', 'vote-dix': 'dix', 'vote-qui': 'qui', 'vote-op': 'opinions', 'vote-jamais': 'jamais',
  'eq-mi': 'motsinterdits', 'eq-mime': 'mime', 'eq-fredonne': 'fredonne', 'eq-disle': 'disle',
  reflexes: 'duel',
};
export const localIdOf = (onlineId) => LOCAL_OF[onlineId] || onlineId;
