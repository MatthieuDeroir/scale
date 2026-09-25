import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fleets from '../../fleets/messages/fr.json';
import keys from '../../keys/messages/fr.json';
import parc from '../messages/fr.json';
import { AddMachineDialog } from '../components/AddMachineDialog';

const messages = { ...fleets, ...keys, ...parc };

const nodes = [
  { id: '5', name: 'nuc-5', givenName: 'nuc-5', ipAddresses: ['100.64.0.5'], online: true, lastSeen: null, tags: ['tag:a-assigner'] },
  { id: '7', name: 'rpi-7', givenName: 'rpi-7', ipAddresses: ['100.64.0.7'], online: true, lastSeen: null, tags: ['tag:flotte-autre'] },
];

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

function afficher(kind: 'hypervision' | 'equipment') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <QueryClientProvider client={client}>
        <AddMachineDialog fleetTag="tag:flotte-keolis" fleetLabel="keolis" kind={kind} open onOpenChange={vi.fn()} />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

describe('AddMachineDialog', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === '/api/keys' && init?.method === 'POST') {
          return jsonResponse({ id: '1', key: 'hskey-auth-test', loginServer: 'http://hs:8080', tags: [], used: false, reusable: false, expiration: '2030-01-01', createdAt: '2026-01-01' });
        }
        if (init?.method === 'POST') return jsonResponse({});
        return jsonResponse(nodes);
      })
    );
  });

  it('équipement : range une machine en attente dans la flotte', async () => {
    afficher('equipment');
    // Des machines attendent : c'est la source proposée par défaut.
    fireEvent.click(await screen.findByLabelText('Sélectionner nuc-5'));
    expect(screen.queryByText('rpi-7')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter à keolis (1)' }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/fleets/nodes/5/tags',
        expect.objectContaining({ body: JSON.stringify({ tags: ['tag:flotte-keolis'] }) })
      )
    );
  });

  it('équipement : peut basculer sur une clé d’équipement, sans tag hypervision', async () => {
    afficher('equipment');
    fireEvent.click(await screen.findByRole('radio', { name: /Installation manuelle/ }));
    fireEvent.click(screen.getByRole('button', { name: /Émettre la clé d'équipement/ }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/keys', expect.anything()));
    const body = JSON.parse(vi.mocked(fetch).mock.calls.find(([url]) => url === '/api/keys')![1]!.body as string);
    expect(body.tags).toEqual(['tag:flotte-keolis']);
  });

  it('poste d’hypervision : uniquement par clé, marquée hypervision', async () => {
    afficher('hypervision');
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Émettre la clé d'hypervision/ }));

    expect(await screen.findByText(/tailscale up --login-server=http:\/\/hs:8080 --authkey=hskey-auth-test/)).toBeInTheDocument();
    const body = JSON.parse(vi.mocked(fetch).mock.calls.find(([url]) => url === '/api/keys')![1]!.body as string);
    expect(body.tags).toEqual(['tag:flotte-keolis', 'tag:hypervision']);
  });
});
