import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '../messages/fr.json';
import { MachineDetailPanel } from '../components/MachineDetailPanel';
import type { FleetNode } from '../api';

const node: FleetNode = {
  id: '1',
  name: 'node-clienta',
  givenName: 'node-clienta',
  ipAddresses: ['100.64.0.2'],
  online: true,
  lastSeen: '2026-09-24T08:00:00.000Z',
  tags: ['tag:flotte-clienta'],
};

function afficher(props: Partial<Parameters<typeof MachineDetailPanel>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <QueryClientProvider client={client}>
        <MachineDetailPanel
          node={node}
          knownTags={['tag:flotte-clienta', 'tag:interne']}
          open
          onOpenChange={vi.fn()}
          {...props}
        />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

function reponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body };
}

describe('MachineDetailPanel', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('exige une confirmation avant de supprimer', () => {
    afficher();

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(screen.getByRole('button', { name: /Confirmer la suppression/ })).toBeInTheDocument();
    // Aucun appel réseau tant que la confirmation n'a pas été redonnée.
    expect(fetch).not.toHaveBeenCalled();
  });

  it('renomme la machine', async () => {
    vi.mocked(fetch).mockResolvedValue(reponse({ ...node, givenName: 'nouveau-nom' }) as never);
    afficher();

    fireEvent.change(screen.getByLabelText('Renommer'), { target: { value: 'nouveau-nom' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Appliquer' })[0]);

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/fleets/nodes/1/rename',
        expect.objectContaining({ method: 'POST' })
      )
    );
  });

  it('supprime après double confirmation', async () => {
    vi.mocked(fetch).mockResolvedValue(reponse({}) as never);
    const onOpenChange = vi.fn();
    afficher({ onOpenChange });

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    fireEvent.click(screen.getByRole('button', { name: /Confirmer la suppression/ }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/fleets/nodes/1',
        expect.objectContaining({ method: 'DELETE' })
      )
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
