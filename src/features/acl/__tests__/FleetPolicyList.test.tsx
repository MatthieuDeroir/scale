import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '../messages/fr.json';
import { FleetPolicyList } from '../components/FleetPolicyList';

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <QueryClientProvider client={client}>
        <FleetPolicyList />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

function reponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body };
}

describe('FleetPolicyList', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/fleets/nodes') {
          return Promise.resolve(
            reponse([
              {
                id: '1',
                name: 'node-clienta',
                givenName: 'node-clienta',
                ipAddresses: [],
                online: true,
                lastSeen: null,
                tags: ['tag:flotte-clienta'],
              },
            ])
          );
        }
        return Promise.resolve(
          reponse({
            fleets: [
              { tag: 'tag:interne', label: 'Interne', deletable: false },
              { tag: 'tag:flotte-clienta', label: 'clienta', deletable: true },
            ],
            raw: '{}',
            updatedAt: '2026-09-24T00:00:00.000Z',
          })
        );
      })
    );
  });

  it('affiche les flottes avec leur nombre de machines', async () => {
    afficher();

    expect(await screen.findByText('Interne')).toBeInTheDocument();
    expect(screen.getByText('clienta')).toBeInTheDocument();
    expect(screen.getByText('1 machine')).toBeInTheDocument();
    expect(screen.getByText('aucune machine')).toBeInTheDocument();
  });

  it("ne propose pas de suppression pour l'interne", async () => {
    afficher();

    await screen.findByText('Interne');
    expect(screen.getAllByRole('button', { name: 'Supprimer' })).toHaveLength(1);
  });

  it('la création exige un nom non vide', async () => {
    afficher();
    await screen.findByText('Interne');

    expect(screen.getByRole('button', { name: 'Créer' })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Nom de la nouvelle flotte'), {
      target: { value: 'nouveauclient' },
    });
    expect(screen.getByRole('button', { name: 'Créer' })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Créer' }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/acl/fleets',
        expect.objectContaining({ method: 'POST' })
      )
    );
  });
});
