/**
 * Transport série — un port, une socket, redistribution par type de trame.
 *
 * Le port appartient à ce service ; les modules s'y abonnent. Si chaque module
 * ouvrait le port, le dernier ouvert recevrait tout et les autres seraient
 * sourds — c'est le même invariant que pour l'UDP.
 *
 * Ce fichier ne connaît AUCUN sport et AUCUN champ métier : il resynchronise,
 * découpe, distribue. Le décodage vit dans les data-modules, en fonctions
 * pures testables sans matériel.
 */
import { SerialPort } from 'serialport';
import { serial as serialConfig } from '../../config.mjs';
import { backoffDelay, createOnceLogger, extractFrames } from '../frame-codec.mjs';

/** path -> { port, buffer, subscribers:Set, retry, closing, logOnce } */
const listeners = new Map();

function dispatch(listener, frame) {
  const type = frame[1];
  let delivered = false;

  for (const sub of listener.subscribers) {
    if (sub.types.has(type)) {
      delivered = true;
      try {
        sub.handler(frame);
      } catch (error) {
        listener.logOnce(`handler 0x${type.toString(16)} : ${error.message}`);
      }
    }
  }

  // Un type inconnu est une information, pas un non-événement : il signale un
  // pupitre d'une autre génération ou un profil protocolaire différent.
  if (!delivered) listener.onUnknown?.(type, frame);
}

function ensureListener(path, protocol) {
  let listener = listeners.get(path);
  if (listener) return listener;

  listener = {
    path,
    protocol,
    buffer: new Uint8Array(0),
    subscribers: new Set(),
    port: null,
    closing: false,
    onUnknown: null,
    retryTimer: null,
    retryCount: 0,
    logOnce: createOnceLogger(`[Serial:${path}]`),
  };
  listeners.set(path, listener);
  open(listener);
  return listener;
}

function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function open(listener) {
  const port = new SerialPort({
    path: listener.path,
    baudRate: serialConfig.baudRate,
    dataBits: serialConfig.dataBits,
    parity: serialConfig.parity,
    stopBits: serialConfig.stopBits,
    autoOpen: false,
  });

  listener.port = port;

  port.on('open', () => {
    listener.retryCount = 0;
    console.log(`[Serial:${listener.path}] ouvert à ${serialConfig.baudRate} bauds`);
    for (const sub of listener.subscribers) sub.onOpen?.();
  });

  port.on('data', (chunk) => {
    listener.buffer = extractFrames(concat(listener.buffer, chunk), listener.protocol, (frame) =>
      dispatch(listener, frame)
    );
  });

  // Un port ouvert ne prouve pas que la liaison est vivante : une perte radio
  // laisse le port ouvert. Les abonnés qui ont besoin d'une notion de
  // fraîcheur la maintiennent eux-mêmes.
  port.on('error', (error) => {
    listener.logOnce(error.message);
    for (const sub of listener.subscribers) sub.onError?.(error);
    reopenLater(listener);
  });

  port.on('close', () => {
    if (!listener.closing) reopenLater(listener);
  });

  port.open((error) => {
    if (error) {
      listener.logOnce(`ouverture impossible : ${error.message}`);
      reopenLater(listener);
    }
  });
}

function reopenLater(listener) {
  if (listener.closing || listener.retryTimer) return;
  const delay = backoffDelay(listener.retryCount);
  listener.retryCount += 1;
  listener.retryTimer = setTimeout(() => {
    listener.retryTimer = null;
    if (!listener.closing) open(listener);
  }, delay);
}

/**
 * Abonne un handler aux trames dont l'octet de type figure dans `types`.
 *
 * @param {number[]} types
 * @param {(frame: Uint8Array) => void} handler
 * @param {{protocol: import('./frame-codec.mjs').FrameProtocol, path?: string,
 *          onOpen?: Function, onError?: Function, onUnknown?: Function}} options
 * @returns {() => void} désabonnement ; le port se ferme avec le dernier abonné
 */
export function subscribeSerial(types, handler, options = {}) {
  const path = options.path || serialConfig.path;

  // Le protocole appartient au produit, pas au socle : aucune valeur par
  // défaut. Un défaut RSCOM imposerait 0xF8 / 54 octets à tout projet.
  const { protocol } = options;
  if (!protocol?.frameSize || protocol.startByte === undefined) {
    throw new Error(
      'subscribeSerial : protocol { startByte, frameSize, endByte? } est obligatoire. ' +
        'Il se déclare dans le manifeste du data-module, pas dans le socle.'
    );
  }
  if (!serialConfig.baudRate) {
    throw new Error(
      'SERIAL_BAUD_RATE est obligatoire dès que la liaison série est utilisée. ' +
        'Le socle ne suppose aucun débit : il dépend du protocole du produit.'
    );
  }

  const listener = ensureListener(path, protocol);
  if (options.onUnknown) listener.onUnknown = options.onUnknown;

  const subscriber = {
    types: new Set(types),
    handler,
    onOpen: options.onOpen,
    onError: options.onError,
  };
  listener.subscribers.add(subscriber);

  return function unsubscribe() {
    listener.subscribers.delete(subscriber);
    if (listener.subscribers.size === 0 && listeners.get(path) === listener) {
      listener.closing = true;
      clearTimeout(listener.retryTimer);
      listener.port?.close(() => {});
      listeners.delete(path);
    }
  };
}

/** Écrit sur la liaison série (retour vers le pupitre, commande d'équipement). */
export async function sendSerial(payload, path = serialConfig.path) {
  const listener = listeners.get(path);
  if (!listener?.port?.isOpen) throw new Error(`[Serial:${path}] port non ouvert`);
  return new Promise((resolve, reject) => {
    listener.port.write(Buffer.from(payload), (error) => (error ? reject(error) : resolve()));
  });
}

export function stopAllSerial() {
  for (const listener of listeners.values()) {
    listener.closing = true;
    clearTimeout(listener.retryTimer);
    listener.port?.close(() => {});
  }
  listeners.clear();
}
