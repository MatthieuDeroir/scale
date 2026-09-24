import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '../messages/fr.json';
import { ActivityLog } from '../components/ActivityLog';

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <QueryClientProvider client={client}>
        <ActivityLog />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

function reponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body };
}

describe('ActivityLog', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it("traduit le code d'action en libellé lisible", async () => {
    vi.mocked(fetch).mockResolvedValue(
      reponse([
        {
          id: 1,
          at: '2026-09-24T08:00:00.000Z',
          actor: 'admin',
          action: 'keys-create',
          target: 'tag:flotte-clienta',
        },
      ]) as never
    );
    afficher();

    expect(await screen.findByText("Émission d'une clé")).toBeInTheDocument();
    expect(screen.getByText('tag:flotte-clienta')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('affiche un état vide plutôt qu’un tableau creux', async () => {
    vi.mocked(fetch).mockResolvedValue(reponse([]) as never);
    afficher();

    expect(await screen.findByText("Aucun événement pour l'instant.")).toBeInTheDocument();
  });

  it('signale le journal injoignable', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 502 } as never);
    afficher();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
