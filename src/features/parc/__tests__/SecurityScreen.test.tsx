import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import acl from '../../acl/messages/fr.json';
import fleets from '../../fleets/messages/fr.json';
import parc from '../messages/fr.json';
import { SecurityScreen } from '../components/SecurityScreen';

const item = (key: string, severity: string, state: string, over: Record<string, unknown> = {}) => ({
  key, cve: key, ids: [`DEBIAN-${key}`], summary: `Résumé ${key}`, severity, cvss: 9.8, published: null,
  packages: ['curl'], state, active: 2, fixableOn: 1, assessments: [], productIds: [1], ...over,
});
const vulns = [
  item('CVE-2026-1', 'critical', 'open'),
  item('CVE-2026-2', 'critical', 'excluded', { active: 0, fixableOn: 0 }),
  item('CVE-2026-3', 'medium', 'investigating'),
];
const detail = {
  ...vulns[0],
  occurrences: [
    { nodeId: '26', machine: 'piscine-sl-media', online: true, fleetTag: 'tag:flotte-piscine', productId: 1, productName: 'SL MEDIA',
      package: 'curl', installed: '7.88', candidate: '7.88.1', fixable: true, excluded: false, status: null },
  ],
};

describe('SecurityScreen', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        json: async () =>
          url.startsWith('/api/security/detail')
            ? detail
            : url === '/api/security'
              ? { vulns, summary: { openBySeverity: {}, fixableBySeverity: {}, investigating: 1, excluded: 1, topPackages: [], perNode: {} } }
              : url.includes('policy')
                ? { fleets: [], raw: '{}', updatedAt: 'x', rules: [], ssh: [], warnings: [] }
                : [],
      }))
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <NextIntlClientProvider locale="fr" messages={{ ...acl, ...fleets, ...parc }}>
        <QueryClientProvider client={client}>
          <SecurityScreen />
        </QueryClientProvider>
      </NextIntlClientProvider>
    );
  });

  it('montre par défaut les failles à traiter, sans les écartées', async () => {
    expect(await screen.findByText('CVE-2026-1')).toBeInTheDocument();
    expect(screen.getByText('CVE-2026-3')).toBeInTheDocument();
    expect(screen.queryByText('CVE-2026-2')).not.toBeInTheDocument();
  });

  it('ouvre le détail : machines touchées, correctif, formulaire de tri', async () => {
    fireEvent.click(await screen.findByText('CVE-2026-1'));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('piscine-sl-media')).toBeInTheDocument();
    expect(within(dialog).getByText('7.88 → 7.88.1')).toBeInTheDocument();
    expect(within(dialog).getByText('Trier cette faille')).toBeInTheDocument();
    // « Non concerné » exige une justification avant d'enregistrer.
    expect(within(dialog).getByRole('button', { name: 'Enregistrer la décision' })).toBeDisabled();
  });
});
