// Configuration du mode en ligne (multijoueur pair-à-pair via WebRTC + PeerJS).
//
// Par défaut, la mise en relation des téléphones passe par le serveur public et
// gratuit de PeerJS (0.peerjs.com). Ensuite les données circulent directement
// entre les appareils. Pour plus de fiabilité, vous pouvez héberger votre propre
// serveur (npx peer --port 9000) et renseigner peerHost / peerPort ci-dessous.
//
// En développement, on peut aussi passer ?peerhost=localhost&peerport=9000 dans l'URL.

export const CONFIG = {
  peerHost: null,          // ex. 'peer.mondomaine.fr' (null = serveur public PeerJS)
  peerPort: 443,
  peerPath: '/',
  peerSecure: true,
  idPrefix: 'ambiance-soiree-v1-',
  maxPlayers: 16,
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    // Pour que ça passe aussi en 4G/5G derrière des NAT stricts, ajoutez un serveur TURN :
    // { urls: 'turn:turn.mondomaine.fr:3478', username: 'user', credential: 'motdepasse' },
  ],
};
