import { beforeEach, describe, expect, it } from 'vitest';
import { getIo, isSocketReady, setSocketInstance } from '../socket-instance.mjs';

describe('instance Socket.io partagée', () => {
  beforeEach(() => setSocketInstance(null));

  it('n’est pas prête avant le démarrage', () => {
    expect(isSocketReady()).toBe(false);
    expect(getIo()).toBeNull();
  });

  it('devient disponible après enregistrement', () => {
    const io = { emit: () => {} };
    setSocketInstance(io);
    expect(isSocketReady()).toBe(true);
    expect(getIo()).toBe(io);
  });
});
