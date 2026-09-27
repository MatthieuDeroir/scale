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

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <QueryClientProvider client={client}>
        <AddMachineDialog fleetTag="tag:flotte-keolis" fleetLabel="keolis" open onOpenChange={vi.fn()} />
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

  it('poste d’hypervision : uniquement par clé, marquée hypervision', async () => {
    afficher();
    // Pas de choix d'origine : un poste d'hypervision arrive toujours par une clé.
    expect(screen.queryByRole('radio', { name: /Déjà démarré/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nom de la machine (facultatif)'), {
      target: { value: 'Poste Atelier' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Émettre la clé d'hypervision/ }));

    // Poste client : commande Windows par défaut, nom normalisé passé à Tailscale.
    expect(
      await screen.findByText(
        /tailscale\.exe" up --login-server=http:\/\/hs:8080 --authkey=hskey-auth-test --hostname=poste-atelier/
      )
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Linux' }));
    expect(screen.getByText(/sudo tailscale up --login-server/)).toBeInTheDocument();
    const body = JSON.parse(vi.mocked(fetch).mock.calls.find(([url]) => url === '/api/keys')![1]!.body as string);
    expect(body.tags).toEqual(['tag:flotte-keolis', 'tag:hypervision']);
  });
});
