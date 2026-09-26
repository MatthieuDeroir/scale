import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FleetNode } from '@/features/fleets';
import { PermissionsProvider } from '@/shared/ui';
import { FleetsHome } from '../components/FleetsHome';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import acl from '../../acl/messages/fr.json';
import fleets from '../../fleets/messages/fr.json';
import keys from '../../keys/messages/fr.json';
import parc from '../messages/fr.json';

const messages = { ...acl, ...fleets, ...keys, ...parc };

function renderWithProviders(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body };
}

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

function node(id: number, tags: string[], online = true): FleetNode {
  return { id: String(id), name: `n${id}`, givenName: `machine-${id}`, ipAddresses: [`100.64.0.${id}`], online, lastSeen: null, tags };
}

function stubApi(nodes: FleetNode[], fleetCount = 2, profiles: unknown[] = []) {
  const fleets = [
    { tag: 'tag:interne', label: 'Interne', deletable: false },
    ...Array.from({ length: fleetCount - 1 }, (_, index) => ({
      tag: `tag:flotte-client${String(index).padStart(3, '0')}`,
      label: `client${String(index).padStart(3, '0')}`,
      deletable: true,
    })),
  ];
  vi.mocked(fetch).mockImplementation(async (url) =>
    jsonResponse(String(url).includes('/api/acl/policy')
        ? { fleets, raw: '{}', updatedAt: 'x' }
        : String(url).includes('/profiles')
          ? profiles
          : nodes) as never
  );
}

describe('FleetsHome', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('déplie une flotte pour montrer ses machines', async () => {
    stubApi([node(1, ['tag:flotte-client000']), node(2, ['tag:flotte-client000', 'tag:hypervision'], false)]);
    renderWithProviders(<FleetsHome />);

    const row = (await screen.findByRole('link', { name: 'client000' })).closest('li')!;
    expect(within(row).getByText('1/2 en ligne')).toBeInTheDocument();
    expect(within(row).queryByText('machine-1')).not.toBeInTheDocument();

    fireEvent.click(within(row).getByRole('button', { name: 'Déplier client000' }));
    expect(within(row).getByText('machine-1')).toBeInTheDocument();
    expect(within(row).getByText('machine-2')).toBeInTheDocument();
  });

  it('pagine une centaine de flottes, interne en tête', async () => {
    stubApi([], 120);
    renderWithProviders(<FleetsHome />);

    expect(await screen.findByText('1–25 sur 120 flottes')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Flottes' });
    expect(within(list).getAllByRole('link')[0]).toHaveTextContent('Interne');
  });

  it('chercher une machine retrouve et déplie sa flotte', async () => {
    stubApi([node(1, ['tag:flotte-client000']), node(9, ['tag:flotte-client001'])], 3);
    renderWithProviders(<FleetsHome />);
    await screen.findByRole('link', { name: 'client000' });

    fireEvent.change(screen.getByLabelText('Rechercher une flotte ou une machine…'), {
      target: { value: 'machine-9' },
    });
    expect(screen.queryByRole('link', { name: 'client000' })).not.toBeInTheDocument();
    expect(screen.getByText('machine-9')).toBeInTheDocument();
  });

  it('signale les machines à assigner', async () => {
    stubApi([node(1, ['tag:a-assigner']), node(2, ['tag:a-assigner'])]);
    renderWithProviders(<FleetsHome />);
    expect(await screen.findByText('2 machines attendent une flotte.')).toBeInTheDocument();
  });

  it('affiche le nom lisible de la fiche et cherche dans la fiche', async () => {
    stubApi([node(1, ['tag:flotte-client000'])], 3, [
      { tag: 'tag:flotte-client000', displayName: 'Keolis Lyon', sector: 'Transport', reference: 'AFF-042' },
    ]);
    renderWithProviders(<FleetsHome />);

    expect(await screen.findByRole('link', { name: 'Keolis Lyon' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Rechercher une flotte ou une machine…'), {
      target: { value: 'aff-042' },
    });
    expect(screen.getByRole('link', { name: 'Keolis Lyon' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'client001' })).not.toBeInTheDocument();
  });

  it('un Lecteur ne voit ni création de flotte ni ajout de machine', async () => {
    stubApi([node(1, ['tag:flotte-client000'])]);
    renderWithProviders(
      <PermissionsProvider value={{ operate: false, admin: false }}>
        <FleetsHome />
      </PermissionsProvider>
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Déplier client000' }));
    expect(screen.queryByRole('button', { name: 'Nouvelle flotte' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ajouter un équipement/ })).not.toBeInTheDocument();
  });
});
