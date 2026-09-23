import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '../messages/fr.json';
import { HealthPanel } from '../components/HealthPanel';

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <QueryClientProvider client={client}>
        <HealthPanel />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

function reponse(source: Record<string, unknown>) {
  return { ok: true, json: async () => ({ status: 'ok', uptimeSeconds: 12, source }) };
}

describe('HealthPanel', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('annonce une source silencieuse plutôt que de ne rien dire', async () => {
    // Sans matériel branché, l'absence de trame doit être VISIBLE.
    vi.mocked(fetch).mockResolvedValue(
      reponse({ fresh: false, lastFrameAt: null, frameCount: 0 }) as never
    );
    afficher();

    expect(await screen.findByText('aucune trame récente')).toBeInTheDocument();
    expect(screen.getByText('jamais')).toBeInTheDocument();
  });

  it('annonce une source vivante', async () => {
    vi.mocked(fetch).mockResolvedValue(
      reponse({ fresh: true, lastFrameAt: '2026-09-08T10:00:00.000Z', frameCount: 148 }) as never
    );
    afficher();

    expect(await screen.findByText('trames reçues')).toBeInTheDocument();
    expect(screen.getByText('148')).toBeInTheDocument();
  });

  it('signale une sonde injoignable au lieu de rester sur « chargement »', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as never);
    afficher();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
