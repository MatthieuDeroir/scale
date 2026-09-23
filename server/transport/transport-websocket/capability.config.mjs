export const config = {
  id: 'transport-websocket',
  name: 'Temps réel Socket.io, authentifié',
  kind: 'transport',
  requires: [],
  dependencies: ['socket.io', 'socket.io-client'],
  summary:
    "Poignée de main vérifiant le cookie de session quand `auth` est active, " +
    "état poussé à la connexion, diffusion par rôle. Une socket n'hérite pas du middleware HTTP.",
};
export default config;
