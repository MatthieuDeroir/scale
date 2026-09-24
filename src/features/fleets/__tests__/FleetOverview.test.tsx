import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '../messages/fr.json';
import { FleetOverview } from '../components/FleetOverview';

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <QueryClientProvider client={client}>
        <FleetOverview />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

function reponse(nodes: unknown[]) {
  return { ok: true, json: async () => nodes };
}

describe('FleetOverview', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('groupe et affiche les machines par flotte', async () => {
    vi.mocked(fetch).mockResolvedValue(
      reponse([
        {
          id: '1',
          name: 'node-clienta',
          givenName: 'node-clienta',
          ipAddresses: ['100.64.0.2'],
          online: true,
          lastSeen: '2026-09-24T08:00:00.000Z',
          tags: ['tag:flotte-clienta'],
        },
        {
          id: '2',
          name: 'node-interne',
          givenName: 'node-interne',
          ipAddresses: ['100.64.0.3'],
          online: false,
          lastSeen: null,
          tags: ['tag:interne'],
        },
      ]) as never
    );
    afficher();

    expect(await screen.findByText('node-clienta')).toBeInTheDocument();
    expect(screen.getByText('clienta')).toBeInTheDocument();
    expect(screen.getByText('node-interne')).toBeInTheDocument();
    expect(screen.getByText('Interne')).toBeInTheDocument();
    expect(screen.getByText('en ligne')).toBeInTheDocument();
    expect(screen.getByText('hors ligne')).toBeInTheDocument();
    expect(screen.getByText('jamais')).toBeInTheDocument();
  });

  it('affiche un état vide plutôt qu’un tableau creux', async () => {
    vi.mocked(fetch).mockResolvedValue(reponse([]) as never);
    afficher();

    expect(await screen.findByText('Aucune machine enrôlée.')).toBeInTheDocument();
  });

  it('signale le parc injoignable au lieu de rester sur « chargement »', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 502 } as never);
    afficher();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
