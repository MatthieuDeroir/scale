import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionsProvider } from '@/shared/ui';
import messages from '../messages/fr.json';
import { AccessRules } from '../components/AccessRules';

const policy = {
  fleets: [],
  raw: '{}',
  updatedAt: 'x',
  ssh: [],
  warnings: [{ code: 'no-isolation', tag: 'tag:flotte-orpheline' }],
  rules: [
    { id: 'a', kind: 'support', src: ['tag:interne'], dst: ['*:*'] },
    { id: 'b', kind: 'isolation', src: ['tag:flotte-clienta'], dst: ['tag:flotte-clienta:*'] },
    {
      id: 'tag:flotte-clienta>tag:flotte-clientb:22',
      kind: 'custom',
      src: ['tag:flotte-clienta'],
      dst: ['tag:flotte-clientb:22'],
      from: 'tag:flotte-clienta',
      to: 'tag:flotte-clientb',
      ports: '22',
    },
  ],
};
const fleets = [
  { tag: 'tag:interne', label: 'Interne' },
  { tag: 'tag:flotte-clienta', label: 'Keolis Lyon' },
  { tag: 'tag:flotte-clientb', label: 'Transports B' },
];

function afficher(operate = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <QueryClientProvider client={client}>
        <PermissionsProvider value={{ operate, admin: operate }}>
          <AccessRules fleets={fleets} />
        </PermissionsProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

describe('AccessRules', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => policy })));
  });

  it('lit les règles en phrases, avec les noms des flottes', async () => {
    afficher();
    expect(await screen.findByText('Support Stramatel')).toBeInTheDocument();
    expect(screen.getAllByText('Keolis Lyon').length).toBeGreaterThan(0);
    expect(screen.getByText('Transports B')).toBeInTheDocument();
    expect(screen.getByText('sur les ports 22')).toBeInTheDocument();
    expect(screen.getByText(/« orpheline » n'a pas de règle de cloisonnement/)).toBeInTheDocument();
  });

  it('retire une exception en deux temps', async () => {
    afficher();
    fireEvent.click(await screen.findByRole('button', { name: 'Retirer cet accès' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retirer ?' }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        `/api/acl/rules?id=${encodeURIComponent('tag:flotte-clienta>tag:flotte-clientb:22')}`,
        expect.objectContaining({ method: 'DELETE' })
      )
    );
  });

  it('un Lecteur ne peut ni ajouter ni retirer', async () => {
    afficher(false);
    await screen.findByText('Support Stramatel');
    expect(screen.queryByRole('button', { name: 'Autoriser un accès' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retirer cet accès' })).not.toBeInTheDocument();
  });
});
