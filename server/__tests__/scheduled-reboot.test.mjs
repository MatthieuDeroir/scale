import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduleReboot, stopReboot } from '../services/scheduled-reboot.service.mjs';

describe('redémarrage programmé', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    stopReboot();
    vi.useRealTimers();
  });

  it('ne programme rien sans heure', () => {
    scheduleReboot({ at: null });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('programme une échéance à venir', () => {
    vi.setSystemTime(new Date('2026-09-08T10:00:00'));
    scheduleReboot({ at: '03:30', timeZone: 'Europe/Paris', dryRun: true });
    expect(vi.getTimerCount()).toBe(1);
  });

  it('reporte au lendemain quand l’heure est passée', () => {
    vi.setSystemTime(new Date('2026-09-08T10:00:00'));
    const journal = vi.spyOn(console, 'log').mockImplementation(() => {});
    scheduleReboot({ at: '03:30', timeZone: 'Europe/Paris', dryRun: true });

    // 03:30 est passé : l'échéance doit être à plus de 12 h, pas négative.
    const minutes = Number(/dans (\d+) min/.exec(journal.mock.calls[0][0])[1]);
    expect(minutes).toBeGreaterThan(12 * 60);
    journal.mockRestore();
  });

  it('se replanifie après déclenchement', () => {
    vi.setSystemTime(new Date('2026-09-08T10:00:00'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    scheduleReboot({ at: '10:01', timeZone: 'Europe/Paris', dryRun: true });

    vi.advanceTimersByTime(61_000);

    // Sans replanification, le redémarrage n'aurait lieu qu'une fois.
    expect(vi.getTimerCount()).toBe(1);
  });

  it('remplace la programmation précédente au lieu d’en cumuler', () => {
    vi.setSystemTime(new Date('2026-09-08T10:00:00'));
    scheduleReboot({ at: '11:00', dryRun: true });
    scheduleReboot({ at: '12:00', dryRun: true });
    expect(vi.getTimerCount()).toBe(1);
  });

  it('s’arrête sur demande', () => {
    scheduleReboot({ at: '11:00', dryRun: true });
    stopReboot();
    expect(vi.getTimerCount()).toBe(0);
  });
});
