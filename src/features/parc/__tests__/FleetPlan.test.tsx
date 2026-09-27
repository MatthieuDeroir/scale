import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fleets from '../../fleets/messages/fr.json';
import keys from '../../keys/messages/fr.json';
import parc from '../messages/fr.json';
import { FleetPlan } from '../components/FleetPlan';

const slots = [
  { id: 3, kind: 'hypervision', label: "Poste d'hypervision", reference: null, parentSlotId: null, product: null, keyIssuedAt: null, machine: null },
  { id: 2, kind: 'equipment', label: 'SL MEDIA REPLICA 1', reference: null, parentSlotId: 1, product: { id: 1, name: 'SL MEDIA', master: true, slaves: true },
    keyIssuedAt: new Date().toISOString(), machine: null },
  { id: 1, kind: 'equipment', label: 'SL MEDIA', reference: 'AFF-12', parentSlotId: null, product: { id: 1, name: 'SL MEDIA', master: true, slaves: true },
    keyIssuedAt: null, machine: { id: '7', name: 'sl-media', online: true, ip: '100.64.0.7' } },
];
const pending = { id: '9', name: 'x', givenName: 'nuc-neuf', ipAddresses: ['100.64.0.9'], online: true, lastSeen: null, tags: ['tag:a-assigner'] };

describe('FleetPlan', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        json: async () => (url.startsWith('/api/plan/') ? slots : url.includes('nodes') ? [pending] : []),
      }))
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <NextIntlClientProvider locale="fr" messages={{ ...fleets, ...keys, ...parc }}>
        <QueryClientProvider client={client}>
          <FleetPlan fleetTag="tag:flotte-b" fleetLabel="Transports B" />
        </QueryClientProvider>
      </NextIntlClientProvider>
    );
  });

  it('montre l’avancement et l’état de chaque emplacement', async () => {
    expect(await screen.findByText('1/3 pourvus')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sl-media 100/ })).toHaveAttribute('href', '/machines/7');
    expect(screen.getByText(/Clé émise/)).toBeInTheDocument();
    expect(screen.getByText('À pourvoir')).toBeInTheDocument();
  });

  it('range chaque REPLICA sous son serveur, qui peut en recevoir d’autres', async () => {
    await screen.findByText('1/3 pourvus');
    const labels = screen.getAllByRole('listitem').map((item) => item.textContent ?? '');
    expect(labels.findIndex((text) => text.startsWith('SL MEDIA REPLICA 1'))).toBe(
      labels.findIndex((text) => text.startsWith('SL MEDIASERVEUR')) + 1
    );
    expect(screen.getByRole('button', { name: 'REPLICA' })).toBeInTheDocument();
  });

  it('propose d’émettre une clé pour chaque emplacement libre, et d’assigner seulement un équipement', async () => {
    await screen.findByText('1/3 pourvus');
    expect(screen.getAllByRole('button', { name: /Émettre la clé/ })).toHaveLength(2);
    expect(await screen.findAllByRole('button', { name: /^Assigner$/ })).toHaveLength(1);
  });
});
