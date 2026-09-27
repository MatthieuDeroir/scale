import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fleets from '../../fleets/messages/fr.json';
import parc from '../messages/fr.json';
import { Dashboard } from '../components/Dashboard';

const recent = new Date().toISOString();
const old = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
const media = { id: 1, name: 'SL MEDIA', reference: null, master: true, slaves: true, masterNodeId: null };
const base = { ipAddresses: ['100.64.0.1'], lastSeen: null };
const nodes = [
  { ...base, id: '1', name: 'a', givenName: 'nuc-grave', online: true, tags: ['tag:flotte-b', 'tag:serveur'], agent: true,
    product: media, inventory: { os: 'Debian 12', upgradableCount: 10, reportedAt: recent } },
  { ...base, id: '2', name: 'b', givenName: 'nuc-moyen', online: true, tags: ['tag:flotte-b'], agent: true,
    product: { ...media, masterNodeId: '1' }, inventory: { os: 'Debian 12', upgradableCount: 3, reportedAt: old } },
  { ...base, id: '3', name: 'c', givenName: 'nuc-sans-agent', online: false, tags: ['tag:flotte-b'], agent: false },
  { ...base, id: '4', name: 'd', givenName: 'poste-client', online: true, tags: ['tag:flotte-b', 'tag:hypervision'] },
];
const summary = {
  openBySeverity: { critical: 2, high: 5, medium: 9 },
  fixableBySeverity: { high: 3, medium: 4 },
  investigating: 1,
  excluded: 4,
  topPackages: [{ package: 'glibc', machines: 2, fixes: 17, worst: 'high' }],
  perNode: {
    '1': { fixableBySeverity: { high: 2, medium: 3 }, worstFixable: 'high', fixable: 5 },
    '2': { fixableBySeverity: { medium: 4 }, worstFixable: 'medium', fixable: 4 },
  },
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        json: async () =>
          url.includes('policy')
            ? { fleets: [{ tag: 'tag:flotte-b', label: 'b', deletable: true }], raw: '{}', updatedAt: 'x', rules: [], ssh: [], warnings: [] }
            : url.includes('profiles')
              ? [{ tag: 'tag:flotte-b', displayName: 'Transports B' }]
              : url.includes('/api/security/summary')
                ? summary
                : url.includes('/api/plan')
                  ? [{ fleetTag: 'tag:flotte-b', total: 5, filled: 3, keyIssued: 1 }]
                  : url.includes('/api/keys') || url.includes('/api/jobs')
                    ? []
                    : nodes,
      }))
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <NextIntlClientProvider locale="fr" messages={{ ...fleets, ...parc }}>
        <QueryClientProvider client={client}>
          <Dashboard />
        </QueryClientProvider>
      </NextIntlClientProvider>
    );
  });

  it('résume le parc : en ligne, failles graves à traiter, mises à jour, agents', async () => {
    // En ligne : sur le parc (indicateur) et dans la ligne de la flotte.
    expect(await screen.findAllByText('3/4')).toHaveLength(2);
    // Critiques + élevées, failles distinctes après tri.
    expect(await screen.findByText('7')).toBeInTheDocument();
    expect(screen.getByText('13')).toBeInTheDocument();
    // Postes clients exclus du compte des équipements ; un agent muet signalé.
    expect(screen.getByText('2/3')).toBeInTheDocument();
    expect(screen.getByText(/1 muet/)).toBeInTheDocument();
  });

  it('montre chaque flotte avec l’avancement de son plan', async () => {
    const list = await screen.findByRole('list', { name: 'Flottes' });
    expect(within(list).getByText('Transports B')).toBeInTheDocument();
    expect(await within(list).findByText('3/5 pourvus')).toBeInTheDocument();
  });

  it('classe les machines à traiter par gravité, d’après le tri', async () => {
    const list = (await screen.findByText('Machines à traiter en priorité')).closest('div')!.parentElement!;
    const names = within(list).getAllByRole('link').map((link) => link.textContent);
    expect(names[0]).toContain('nuc-grave');
    expect(names[1]).toContain('nuc-moyen');
  });

  it('liste les paquets prioritaires, la composition et les points à vérifier', async () => {
    expect(await screen.findByText('glibc')).toBeInTheDocument();
    expect(screen.getByText('corrige 17 failles · 2 machines')).toBeInTheDocument();
    const composition = screen.getByRole('list', { name: 'Composition du parc' });
    expect(within(composition).getByText('SL MEDIA SERVEUR')).toBeInTheDocument();
    expect(within(composition).getByText('SL MEDIA REPLICA')).toBeInTheDocument();
    expect(within(composition).getByText('Sans produit')).toBeInTheDocument();
    expect(screen.getByText('1 agent muet')).toBeInTheDocument();
    expect(screen.getByText('1 équipement sans agent')).toBeInTheDocument();
  });
});
