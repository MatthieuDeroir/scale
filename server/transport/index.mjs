/**
 * Couche de communication — chaque transport est une fonctionnalité activable.
 *
 *   transport-serial     flux d'octets, réassemblage, dispatch par type
 *   transport-udp        datagrammes, dispatch par octet de tête, émission
 *   transport-websocket  état poussé vers les interfaces, authentifié
 *
 * Invariant commun : **un port, une socket.** Le transport possède le port et
 * redistribue aux abonnés ; aucun module n'ouvre le sien. Le protocole n'est
 * jamais supposé par le socle : chaque module déclare le sien.
 *
 * `frame-codec.mjs` n'est pas une fonctionnalité : c'est le noyau pur partagé
 * par les transports de trames, sans dépendance et sans entrée/sortie.
 *
 * ⚠️ Ce fichier réexporte tout. Un projet qui désactive un transport n'importe
 * pas d'ici : il importe le transport voulu directement, et supprime le dossier
 * des autres. Voir docs/CATALOGUE.md.
 */
export { extractFrames, validateFrame, createOnceLogger, backoffDelay } from './frame-codec.mjs';
export { subscribeSerial, sendSerial, stopAllSerial } from './transport-serial/serial.mjs';
export { subscribeUdp, sendUdp, stopAllUdp } from './transport-udp/udp.mjs';
export { setupRealtime, emitToRole } from './transport-websocket/realtime.mjs';
