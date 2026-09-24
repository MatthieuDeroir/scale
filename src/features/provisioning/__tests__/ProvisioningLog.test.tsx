import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '../messages/fr.json';
import { ProvisioningLog } from '../components/ProvisioningLog';

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <QueryClientProvider client={client}>
        <ProvisioningLog />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

function reponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body };
}

describe('ProvisioningLog', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('liste les machines enrôlées', async () => {
    vi.mocked(fetch).mockResolvedValue(
      reponse([{ deviceId: 'abc-123', enrolledAt: '2026-09-24T08:00:00.000Z' }]) as never
    );
    afficher();

    expect(await screen.findByText('abc-123')).toBeInTheDocument();
  });

  it('affiche un état vide plutôt qu’un tableau creux', async () => {
    vi.mocked(fetch).mockResolvedValue(reponse([]) as never);
    afficher();

    expect(
      await screen.findByText("Aucune machine enrôlée automatiquement pour l'instant.")
    ).toBeInTheDocument();
  });

  it('signale le journal injoignable', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 502 } as never);
    afficher();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
