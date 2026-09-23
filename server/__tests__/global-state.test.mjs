import { describe, expect, it, vi } from 'vitest';
import { isSourceFresh, noteFrame, runtime } from '../state/global-state.mjs';

describe('fraîcheur de la source', () => {
  it('est fausse tant qu’aucune trame n’est arrivée', () => {
    expect(runtime.lastFrameAt).toBeNull();
    expect(isSourceFresh()).toBe(false);
  });

  it('devient vraie et compte les trames', () => {
    const avant = runtime.frameCount;
    noteFrame();
    expect(runtime.frameCount).toBe(avant + 1);
    expect(isSourceFresh()).toBe(true);
  });

  it('redevient fausse après le délai', () => {
    // Un port ouvert ne prouve pas que la liaison est vivante : c'est cette
    // valeur qui fait foi.
    noteFrame();
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 6000);
    expect(isSourceFresh(5000)).toBe(false);
    vi.useRealTimers();
  });
});
