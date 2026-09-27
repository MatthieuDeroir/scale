import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fleets from '../../fleets/messages/fr.json';
import parc from '../messages/fr.json';
import { Dashboard } from '../components/Dashboard';

const base = { ipAddresses: ['100.64.0.1'], lastSeen: null };
const nodes = [
  { ...base, id: '1', name: 'a', givenName: 'nuc-grave', online: true, tags: ['tag:flotte-b'], agent: true,
    inventory: { os: 'Debian 12', upgradableCount: 10, reportedAt: 'x' },
    vulns: { total: 9, fixable: 5, fixableBySeverity: { high: 2, medium: 3 }, worstFixable: 'high' } },
  { ...base, id: '2', name: 'b', givenName: 'nuc-moyen', online: true, tags: ['tag:flotte-b'], agent: true,
    inventory: { os: 'Debian 12', upgradableCount: 3, reportedAt: 'x' },
    vulns: { total: 4, fixable: 4, fixableBySeverity: { medium: 4 }, worstFixable: 'medium' } },
  { ...base, id: '3', name: 'c', givenName: 'nuc-sans-agent', online: false, tags: ['tag:flotte-b'], agent: false },
  { ...base, id: '4', name: 'd', givenName: 'poste-client', online: true, tags: ['tag:flotte-b', 'tag:hypervision'] },
];

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
              : url.includes('/api/jobs')
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

  it('résume le parc : en ligne, exposées, mises à jour, agents', async () => {
    expect(await screen.findByText('3/4')).toBeInTheDocument();
    expect(screen.getByText('13')).toBeInTheDocument();
    // Postes clients exclus du compte des équipements.
    expect(screen.getByText('2/3')).toBeInTheDocument();
  });

  it('classe les machines à traiter par gravité puis par nombre', async () => {
    const list = (await screen.findByText('Machines à traiter en priorité')).closest('div')!.parentElement!;
    const names = within(list).getAllByRole('link').map((link) => link.textContent);
    expect(names[0]).toContain('nuc-grave');
    expect(names[1]).toContain('nuc-moyen');
  });

  it('signale les équipements sans agent, jamais les postes clients', async () => {
    expect(await screen.findByText('1 équipement sans agent')).toBeInTheDocument();
    expect(screen.getAllByText('nuc-sans-agent').length).toBeGreaterThan(0);
  });
});
