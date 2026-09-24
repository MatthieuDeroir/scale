import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '../messages/fr.json';
import { KeyList } from '../components/KeyList';

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <QueryClientProvider client={client}>
        <KeyList />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body };
}

describe('KeyList', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('affiche les clés en cours', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse([
        {
          id: '1',
          reusable: true,
          used: false,
          expiration: '2027-01-01T00:00:00.000Z',
          createdAt: '2026-09-24T00:00:00.000Z',
          tags: ['tag:flotte-clienta'],
        },
      ]) as never
    );
    afficher();

    expect(await screen.findByText('clienta')).toBeInTheDocument();
  });

  it("révoque après une seconde confirmation, jamais la première", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse([
        {
          id: '1',
          reusable: false,
          used: false,
          expiration: '2027-01-01T00:00:00.000Z',
          createdAt: '2026-09-24T00:00:00.000Z',
          tags: ['tag:interne'],
        },
      ]) as never
    );
    afficher();

    const revoke = await screen.findByRole('button', { name: 'Révoquer' });
    fireEvent.click(revoke);
    expect(screen.getByRole('button', { name: 'Confirmer ?' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1); // seulement la lecture initiale

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer ?' }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/keys/1/expire',
        expect.objectContaining({ method: 'POST' })
      )
    );
  });

  it('affiche un état vide plutôt qu’un tableau creux', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]) as never);
    afficher();

    expect(await screen.findByText("Aucune clé émise pour l'instant.")).toBeInTheDocument();
  });
});
