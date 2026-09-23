import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSocketEvent } from '../use-socket';

const socket = { on: vi.fn(), off: vi.fn(), disconnect: vi.fn() };
vi.mock('socket.io-client', () => ({ io: () => socket }));

describe('useSocketEvent', () => {
  it('s’abonne à l’événement demandé', () => {
    const onEvent = vi.fn();
    renderHook(() => useSocketEvent('scoreboard:state', onEvent));
    expect(socket.on).toHaveBeenCalledWith('scoreboard:state', expect.any(Function));
  });

  it('transmet la charge utile au gestionnaire courant', () => {
    const onEvent = vi.fn();
    renderHook(() => useSocketEvent('x', onEvent));
    socket.on.mock.calls.at(-1)![1]({ valeur: 1 });
    expect(onEvent).toHaveBeenCalledWith({ valeur: 1 });
  });

  it('ferme la connexion au démontage', () => {
    const { unmount } = renderHook(() => useSocketEvent('x', vi.fn()));
    unmount();
    expect(socket.off).toHaveBeenCalledWith('x');
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('ne se réabonne pas quand seul le gestionnaire change', () => {
    const { rerender } = renderHook(({ h }) => useSocketEvent('x', h), {
      initialProps: { h: vi.fn() },
    });
    const avant = socket.on.mock.calls.length;
    rerender({ h: vi.fn() });
    // Se réabonner à chaque rendu rouvrirait une socket par frame.
    expect(socket.on.mock.calls.length).toBe(avant);
  });
});
