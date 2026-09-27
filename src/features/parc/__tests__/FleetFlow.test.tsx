import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FleetNode } from '@/features/fleets';
import fleets from '../../fleets/messages/fr.json';
import parc from '../messages/fr.json';
import { FleetFlowDiagram } from '../components/FleetFlowDiagram';
import { MasterDialog } from '../components/MasterDialog';
import type { FleetSummary } from '../lib';

const messages = { ...fleets, ...parc };

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

function node(id: number, tags: string[], online = true): FleetNode {
  return { id: String(id), name: `n${id}`, givenName: `machine-${id}`, ipAddresses: [`100.64.0.${id}`], online, lastSeen: null, tags };
}

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

function fleetOf(nodes: FleetNode[]): FleetSummary {
  return {
    tag: 'tag:flotte-b',
    slug: 'b',
    label: 'Transports B',
    internal: false,
    inPolicy: true,
    profile: null,
    nodes,
    online: nodes.filter((item) => item.online).length,
    hypervision: nodes.filter((item) => item.tags.includes('tag:hypervision')).length,
  };
}

describe('FleetFlowDiagram', () => {
  it('place MASTER, SLAVE, poste, support et exception', () => {
    const nodes = [
      node(1, ['tag:flotte-b', 'tag:master']),
      node(2, ['tag:flotte-b']),
      node(3, ['tag:flotte-b'], false),
      node(4, ['tag:flotte-b', 'tag:hypervision']),
    ];
    wrap(
      <FleetFlowDiagram
        fleet={fleetOf(nodes)}
        rules={[
          { id: 's', kind: 'support', src: ['tag:interne'], dst: ['*:*'] },
          { id: 'x', kind: 'custom', src: ['tag:flotte-a'], dst: ['tag:flotte-b:22'], from: 'tag:flotte-a', to: 'tag:flotte-b', ports: '22' },
        ]}
        labelOf={(tag) => (tag === 'tag:flotte-a' ? 'Keolis Lyon' : tag)}
      />
    );
    expect(screen.getByText('♛ machine-1')).toBeInTheDocument();
    expect(screen.getByText('machine-2')).toBeInTheDocument();
    expect(screen.getByText('machine-4')).toBeInTheDocument();
    expect(screen.getByText('Support Stramatel')).toBeInTheDocument();
    expect(screen.getByText('Keolis Lyon')).toBeInTheDocument();
    expect(screen.getByText('ports 22')).toBeInTheDocument();
  });

  it('un clic sur une machine ouvre sa page, sur une flotte externe la flotte', () => {
    push.mockReset();
    wrap(
      <FleetFlowDiagram
        fleet={fleetOf([node(7, ['tag:flotte-b', 'tag:master'])])}
        rules={[{ id: 'x', kind: 'custom', src: ['tag:flotte-a'], dst: ['tag:flotte-b:*'], from: 'tag:flotte-a', to: 'tag:flotte-b', ports: '*' }]}
        labelOf={() => 'Keolis Lyon'}
      />
    );
    fireEvent.click(screen.getByRole('link', { name: 'machine-7' }));
    expect(push).toHaveBeenCalledWith('/machines/7');
    fireEvent.keyDown(screen.getByRole('link', { name: 'Keolis Lyon' }), { key: 'Enter' });
    expect(push).toHaveBeenCalledWith('/flottes/a');
  });

  it('sans MASTER, relie tout au réseau de la flotte', () => {
    wrap(<FleetFlowDiagram fleet={fleetOf([node(1, ['tag:flotte-b'])])} rules={[]} labelOf={(tag) => tag} />);
    expect(screen.getByText('Réseau de la flotte')).toBeInTheDocument();
  });

  it('regroupe les équipements au-delà de sept', () => {
    const many = Array.from({ length: 12 }, (_, index) => node(index + 10, ['tag:flotte-b'], index % 2 === 0));
    wrap(<FleetFlowDiagram fleet={fleetOf(many)} rules={[]} labelOf={(tag) => tag} />);
    expect(screen.getByText('+ 5 autres (2 en ligne)')).toBeInTheDocument();
  });
});

describe('MasterDialog', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })));
  });

  it('ne retague que les machines dont le rôle change', async () => {
    const equipment = [node(1, ['tag:flotte-b', 'tag:master']), node(2, ['tag:flotte-b'])];
    wrap(<MasterDialog fleetLabel="Transports B" equipment={equipment} open onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('MASTER : machine-2'));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer (1 changement)' }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/fleets/nodes/2/tags',
        expect.objectContaining({ body: JSON.stringify({ tags: ['tag:flotte-b', 'tag:master'] }) })
      )
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
