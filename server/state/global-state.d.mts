/** Types de l'état partagé. L'implémentation est dans global-state.mjs. */
export interface Runtime {
  startedAt: Date;
  lastFrameAt: Date | null;
  frameCount: number;
}

export const runtime: Runtime;
export function noteFrame(): void;
export function isSourceFresh(maxAgeMs?: number): boolean;
