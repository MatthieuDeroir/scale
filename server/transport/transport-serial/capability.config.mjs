export const config = {
  id: 'transport-serial',
  name: 'Lecture et écriture sur port série',
  kind: 'transport',
  requires: [],
  /** Retirer la fonctionnalité permet de retirer ces dépendances. */
  dependencies: ['serialport'],
  summary:
    "Flux d'octets, réassemblage, resynchronisation, dispatch par type de trame, écriture. " +
    'Le protocole est déclaré par le data-module, jamais par le socle.',
};
export default config;
