// Niveaux d'intensité des jeux de questions (partagés local / en ligne).
export const LEVELS = {
  tupreferes: [
    { id: 'soft', name: 'Tranquille', emoji: '😇', desc: 'Pour tout le monde, même en famille.' },
    { id: 'fun', name: 'Délire', emoji: '🤪', desc: 'Absurde et dégoûtant, fous rires garantis.' },
    { id: 'epice', name: 'Épicé', emoji: '🌶️', desc: 'Gênant, personnel, ça pique un peu.' },
    { id: 'hot', name: 'Hot', emoji: '🔥', desc: 'Coquin, réservé aux adultes.', adult: true },
  ],
  jamais: [
    { id: 'soft', name: 'Tranquille', emoji: '😇', desc: 'Des petites bêtises du quotidien.' },
    { id: 'soiree', name: 'Soirée', emoji: '🍻', desc: 'Fêtes, voyages, bêtises et galères.' },
    { id: 'epice', name: 'Épicé', emoji: '🌶️', desc: 'Secrets, amours et grosses hontes.' },
    { id: 'hot', name: 'Hot', emoji: '🔥', desc: 'Très coquin, réservé aux adultes.', adult: true },
  ],
  dix: [
    { id: 'classique', name: 'Classique', emoji: '😄', desc: 'Des défauts du quotidien, des manies et des red flags.' },
    { id: 'absurde', name: 'Absurde', emoji: '🤡', desc: 'Des situations complètement folles.' },
    { id: 'hot', name: 'Hot', emoji: '🔥', desc: 'Défauts intimes, réservé aux adultes.', adult: true },
  ],
  qui: [
    { id: 'soft', name: 'Tranquille', emoji: '😇', desc: 'Gentil et drôle.' },
    { id: 'epice', name: 'Épicé', emoji: '🌶️', desc: 'Ça balance, ça règle des comptes.' },
    { id: 'hot', name: 'Hot', emoji: '🔥', desc: 'Coquin, réservé aux adultes.', adult: true },
  ],
};
