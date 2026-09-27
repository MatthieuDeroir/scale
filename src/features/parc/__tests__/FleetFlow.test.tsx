import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FleetNode } from '@/features/fleets';
import fleets from '../../fleets/messages/fr.json';
import parc from '../messages/fr.json';
import { FleetFlowDiagram } from '../components/FleetFlowDiagram';
import type { FleetSummary } from '../lib';

const messages = { ...fleets, ...parc };

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

function node(id: number, tags: string[], online = true, product?: FleetNode['product']): FleetNode {
  return { id: String(id), name: `n${id}`, givenName: `machine-${id}`, ipAddresses: [`100.64.0.${id}`], online, lastSeen: null, tags, product };
}

const products = [
  { id: 1, name: 'SL MEDIA', category: 'gamme' as const, master: true, slaves: true, machines: 0 },
  { id: 2, name: 'SL TEMPO', category: 'gamme' as const, master: true, slaves: false, machines: 0 },
];
const media = (masterNodeId: string | null = null) => ({ id: 1, name: 'SL MEDIA', reference: null, master: true, slaves: true, masterNodeId });
const tempo = { id: 2, name: 'SL TEMPO', reference: null, master: true, slaves: false, masterNodeId: null };

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
  const nodes = [
    node(1, ['tag:flotte-b', 'tag:serveur'], true, media()),
    node(2, ['tag:flotte-b'], true, media('1')),
    node(3, ['tag:flotte-b'], false, media('1')),
    node(4, ['tag:flotte-b', 'tag:hypervision']),
    node(5, ['tag:flotte-b', 'tag:serveur'], true, tempo),
  ];
  const links = [
    { id: 1, fromId: 1, toId: 1, ports: '5000', note: null },
    { id: 2, fromId: 2, toId: 1, ports: '123', note: null },
  ];

  it('place serveur, REPLICA, SL TEMPO, poste, support et exception, avec les ports des flux', () => {
    wrap(
      <FleetFlowDiagram
        fleet={fleetOf(nodes)}
        rules={[
          { id: 's', kind: 'support', src: ['tag:interne'], dst: ['*:*'] },
          { id: 'x', kind: 'custom', src: ['tag:flotte-a'], dst: ['tag:flotte-b:22'], from: 'tag:flotte-a', to: 'tag:flotte-b', ports: '22' },
        ]}
        labelOf={(tag) => (tag === 'tag:flotte-a' ? 'Keolis Lyon' : tag)}
        products={products}
        links={links}
      />
    );
    expect(screen.getByText('♛ machine-1')).toBeInTheDocument();
    expect(screen.getByText('machine-2')).toBeInTheDocument();
    // SL TEMPO est une machine maîtresse : dans la colonne SERVEUR, comme le SL MEDIA.
    expect(screen.getByText('♛ machine-5')).toBeInTheDocument();
    expect(screen.getByText('Support Stramatel')).toBeInTheDocument();
    expect(screen.getByText('Keolis Lyon')).toBeInTheDocument();
    // Deux REPLICA vers leur serveur sur 5000, SL TEMPO vers le serveur sur 123.
    expect(screen.getAllByText('5000')).toHaveLength(2);
    expect(screen.getByText('123')).toBeInTheDocument();
  });

  it('montre les emplacements du plan encore à pourvoir', () => {
    wrap(
      <FleetFlowDiagram
        fleet={fleetOf([nodes[0]])}
        rules={[]}
        labelOf={(tag) => tag}
        products={products}
        links={links}
        slots={[
          { id: 7, kind: 'equipment', label: 'SL MEDIA REPLICA 1', reference: null, parentSlotId: 6,
            product: { id: 1, name: 'SL MEDIA', master: true, slaves: true }, keyIssuedAt: null, machine: null },
          { id: 6, kind: 'equipment', label: 'SL MEDIA', reference: null, parentSlotId: null,
            product: { id: 1, name: 'SL MEDIA', master: true, slaves: true }, keyIssuedAt: null, machine: { id: '1', name: 'machine-1', online: true, ip: null } },
        ]}
      />
    );
    expect(screen.getByText('SL MEDIA REPLICA 1')).toBeInTheDocument();
    expect(screen.getByText('à pourvoir')).toBeInTheDocument();
    expect(screen.getByText('5000')).toBeInTheDocument();
  });

  it('un clic sur une machine ouvre sa page, sur une flotte externe la flotte', () => {
    push.mockReset();
    wrap(
      <FleetFlowDiagram
        fleet={fleetOf([node(7, ['tag:flotte-b', 'tag:serveur'], true, media())])}
        rules={[{ id: 'x', kind: 'custom', src: ['tag:flotte-a'], dst: ['tag:flotte-b:*'], from: 'tag:flotte-a', to: 'tag:flotte-b', ports: '*' }]}
        labelOf={() => 'Keolis Lyon'}
        products={products}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'SERVEUR : machine-7' }));
    expect(push).toHaveBeenCalledWith('/machines/7');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Keolis Lyon' }), { key: 'Enter' });
    expect(push).toHaveBeenCalledWith('/flottes/a');
  });

  it('en mode flux, deux clics ouvrent le flux entre les deux produits', () => {
    push.mockReset();
    wrap(<FleetFlowDiagram fleet={fleetOf(nodes)} rules={[]} labelOf={(tag) => tag} products={products} links={links} editable />);
    fireEvent.click(screen.getByRole('button', { name: 'Définir un flux' }));
    fireEvent.click(screen.getByRole('button', { name: 'SERVEUR : machine-5' }));
    fireEvent.click(screen.getByRole('button', { name: 'SERVEUR : machine-1' }));
    const dialog = screen.getByRole('dialog', { name: 'Flux SL TEMPO → SL MEDIA' });
    expect(within(dialog).getByLabelText('Ports')).toHaveValue('123');
    expect(push).not.toHaveBeenCalled();
  });

  it('sans serveur, relie tout au réseau de la flotte', () => {
    wrap(<FleetFlowDiagram fleet={fleetOf([node(1, ['tag:flotte-b', 'tag:hypervision'])])} rules={[]} labelOf={(tag) => tag} />);
    expect(screen.getByText('Réseau de la flotte')).toBeInTheDocument();
  });

  it('regroupe au-delà de quatorze machines par colonne', () => {
    const many = Array.from({ length: 20 }, (_, index) => node(index + 10, ['tag:flotte-b', 'tag:serveur'], index % 2 === 0, tempo));
    wrap(<FleetFlowDiagram fleet={fleetOf(many)} rules={[]} labelOf={(tag) => tag} products={products} />);
    expect(screen.getByText('+ 7 autres')).toBeInTheDocument();
  });
});
