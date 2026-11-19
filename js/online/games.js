// Catalogue des jeux jouables en ligne.
import dessin from './dessin.js';
import imposteur from './imposteur.js';
import { voteTP, voteDix, voteQui, voteOp } from './vote.js';
import { raceQuiz, raceEmoji, raceAnag, raceEstim, raceVf, raceCalc } from './race.js';
import { writePunch, writeDico } from './write.js';
import telephone from './telephone.js';
import bingo from './bingo.js';
import menteur from './menteur.js';
import bonmot from './bonmot.js';
import unisson from './unisson.js';

export const ONLINE_GAMES = [dessin, imposteur, raceQuiz, writePunch, telephone, writeDico, menteur, raceEmoji, raceAnag, raceEstim, raceVf, raceCalc, bonmot, unisson, bingo, voteTP, voteDix, voteQui, voteOp];
export const onlineGame = (id) => ONLINE_GAMES.find((g) => g.id === id);
