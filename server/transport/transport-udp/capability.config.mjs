export const config = {
  id: 'transport-udp',
  name: 'Écoute et émission UDP',
  kind: 'transport',
  requires: [],
  /** Aucune : node:dgram est dans le runtime. */
  dependencies: [],
  summary:
    "Un port, une socket : écoute ET émission. Dispatch par octet de tête, " +
    'validation taille et terminateur. Évite le double bind de ServeurTemps.',
};
export default config;
