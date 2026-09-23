/**
 * Instance Socket.io partagée, pour que les routes API Next.js puissent
 * émettre sans recréer de connexion.
 */
let ioInstance = null;

export function setSocketInstance(io) {
  ioInstance = io;
}

export function getIo() {
  return ioInstance;
}

export function isSocketReady() {
  return ioInstance !== null;
}
