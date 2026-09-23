/**
 * État partagé du serveur.
 * Volontairement minimal : tout ce qui est métier appartient à un data-module.
 */
export const runtime = {
  startedAt: new Date(),
  lastFrameAt: null,
  frameCount: 0,
};

export function noteFrame() {
  runtime.lastFrameAt = new Date();
  runtime.frameCount += 1;
}

/**
 * Fraîcheur de la source matérielle. Un port ouvert ne suffit pas à conclure
 * que la liaison est vivante : c'est cette valeur qui fait foi.
 */
export function isSourceFresh(maxAgeMs = 5000) {
  if (!runtime.lastFrameAt) return false;
  return Date.now() - runtime.lastFrameAt.getTime() < maxAgeMs;
}
