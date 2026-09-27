import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fleets from '../../fleets/messages/fr.json';
import parc from '../messages/fr.json';
import { EcosystemMap } from '../components/EcosystemMap';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const media = { id: 1, name: 'SL MEDIA', reference: null, master: true, slaves: true, masterNodeId: null };
const base = { ipAddresses: ['100.64.0.1'], lastSeen: null, online: true };
const nodes = [
  { ...base, id: '1', name: 'a', givenName: 'piscine-sl-media', tags: ['tag:flotte-piscine', 'tag:serveur'], product: media },
  { ...base, id: '2', name: 'b', givenName: 'piscine-sl-media-replica-1', tags: ['tag:flotte-piscine'], product: { ...media, masterNodeId: '1' } },
  { ...base, id: '3', name: 'c', givenName: 'cinema-sl-media', tags: ['tag:flotte-cinema', 'tag:serveur'], product: media },
  { ...base, id: '4', name: 'd', givenName: 'stra-neuve', tags: ['tag:a-assigner'] },
];
const policy = {
  fleets: [
    { tag: 'tag:flotte-piscine', label: 'piscine', deletable: true },
    { tag: 'tag:flotte-cinema', label: 'cinema', deletable: true },
  ],
  rules: [],
  raw: '{}',
  updatedAt: 'x',
  ssh: [],
  warnings: [],
};
const posts = [{ tag: 'tag:support-glegoff', name: 'glegoff', targets: ['tag:flotte-piscine', 'tag:flotte-cinema'], machines: [] }];

describe('EcosystemMap', () => {
  beforeEach(() => {
    push.mockReset();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        json: async () =>
          url.includes('policy')
            ? policy
            : url.includes('/api/support')
              ? posts
              : url.includes('/api/fleets/nodes')
                ? nodes
                : [],
      }))
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <NextIntlClientProvider locale="fr" messages={{ ...fleets, ...parc }}>
        <QueryClientProvider client={client}>
          <EcosystemMap />
        </QueryClientProvider>
      </NextIntlClientProvider>
    );
  });

  it('montre chaque flotte en grappe, les postes support et les machines en attente', async () => {
    expect(await screen.findByRole('link', { name: /Flotte piscine/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Flotte cinema/ })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Flotte À assigner/ })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'glegoff' })).toBeInTheDocument();
    // Préfixe de flotte retiré dans sa grappe.
    expect(screen.getByRole('link', { name: 'sl-media-replica-1' })).toBeInTheDocument();
  });

  it('un clic sans glisser ouvre la machine', async () => {
    const machine = await screen.findByRole('link', { name: 'sl-media-replica-1' });
    fireEvent.pointerDown(machine, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(machine, { clientX: 10, clientY: 10, pointerId: 1 });
    expect(push).toHaveBeenCalledWith('/machines/2');
  });
});
