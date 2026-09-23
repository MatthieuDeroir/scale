/**
 * Découpage et validation de trames — pur, partagé par les transports.
 *
 * Ni série, ni UDP, ni WebSocket ici : uniquement des octets. C'est ce qui rend
 * la partie la plus piégeuse du produit testable sans matériel.
 */

/**
 * @typedef {object} FrameProtocol
 * @property {number} startByte   octet de synchronisation
 * @property {number} frameSize   taille fixe, en octets
 * @property {number} [endByte]   terminateur, vérifié s'il est déclaré
 */

/**
 * Valide une trame candidate.
 * @returns {null|'size'|'start'|'end'} le motif de rejet, ou null si valide
 */
export function validateFrame(frame, protocol) {
  if (frame.length !== protocol.frameSize) return 'size';
  if (frame[0] !== protocol.startByte) return 'start';
  if (protocol.endByte !== undefined && frame[protocol.frameSize - 1] !== protocol.endByte) {
    return 'end';
  }
  return null;
}

/**
 * Extrait les trames complètes d'un flux d'octets.
 *
 * Deux comportements que le lecteur historique du G552 n'avait pas :
 * le terminateur est **vérifié**, et une trame tronquée provoque une
 * resynchronisation sur l'octet de départ suivant au lieu d'être livrée telle
 * quelle. Sans cela une troncature est indétectable.
 *
 * @param {Buffer|Uint8Array} buffer
 * @param {FrameProtocol} protocol
 * @param {(frame: Uint8Array) => void} onFrame
 * @returns {Uint8Array} le reliquat non consommé
 */
export function extractFrames(buffer, protocol, onFrame) {
  const { startByte, frameSize } = protocol;
  let rest = buffer;

  while (rest.length >= frameSize) {
    const start = rest.indexOf(startByte);
    if (start === -1) return rest.subarray(rest.length); // rien d'exploitable
    if (start > 0) {
      rest = rest.subarray(start);
      continue;
    }
    if (rest.length < frameSize) break;

    const frame = rest.subarray(0, frameSize);
    if (validateFrame(frame, protocol)) {
      rest = rest.subarray(1); // resynchronisation sur l'octet de départ suivant
      continue;
    }

    onFrame(Uint8Array.prototype.slice.call(frame));
    rest = rest.subarray(frameSize);
  }

  return rest;
}

/**
 * Journalise un message au changement seulement.
 *
 * Un port absent produit une erreur toutes les deux secondes, indéfiniment.
 * Écrite telle quelle, elle noie le journal au moment précis où on en a besoin.
 */
export function createOnceLogger(prefix) {
  let last = null;
  return function logOnce(message, level = 'error') {
    if (last === message) return;
    last = message;
    console[level](`${prefix} ${message}`);
    console[level](`${prefix} répétitions silencieuses jusqu'à changement d'état`);
  };
}

/** Recul exponentiel plafonné. On n'abandonne jamais : un câble se rebranche. */
export function backoffDelay(attempt, baseMs = 2000, maxMs = 60_000) {
  return Math.min(baseMs * 2 ** attempt, maxMs);
}
