// Catalogue des jeux jouables en ligne.
import dessin from './dessin.js';
import imposteur from './imposteur.js';
import { voteTP, voteDix, voteQui } from './vote.js';

export const ONLINE_GAMES = [dessin, imposteur, voteTP, voteDix, voteQui];
export const onlineGame = (id) => ONLINE_GAMES.find((g) => g.id === id);
