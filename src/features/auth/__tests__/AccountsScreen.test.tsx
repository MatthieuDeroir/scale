import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '../messages/fr.json';
import { AccountsScreen } from '../components/AccountsScreen';

function afficher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <QueryClientProvider client={client}>
        <AccountsScreen />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

function reponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body };
}

const admin = {
  id: 1,
  username: 'admin',
  role: 'ADMIN',
  disabled: false,
  mustChangePassword: false,
  lastLoginAt: '2026-09-24T08:00:00.000Z',
  createdAt: '2026-09-01T00:00:00.000Z',
};

describe('AccountsScreen', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('liste les comptes existants', async () => {
    vi.mocked(fetch).mockResolvedValue(reponse([admin]) as never);
    afficher();

    expect(await screen.findByText('admin')).toBeInTheDocument();
    expect(screen.getByText('actif')).toBeInTheDocument();
  });

  it('la création exige un identifiant', async () => {
    vi.mocked(fetch).mockResolvedValue(reponse([admin]) as never);
    afficher();
    await screen.findByText('admin');

    expect(screen.getByRole('button', { name: 'Créer' })).toBeDisabled();
  });

  it('affiche le mot de passe une fois après création', async () => {
    vi.mocked(fetch).mockImplementation((url, init) => {
      if (init?.method === 'POST' && url === '/api/users') {
        return Promise.resolve(
          reponse({ ...admin, id: 2, username: 'op1', role: 'OPERATOR', password: 'genere-123' }) as never
        );
      }
      return Promise.resolve(reponse([admin]) as never);
    });
    afficher();
    await screen.findByText('admin');

    fireEvent.change(screen.getByPlaceholderText('Identifiant du nouveau compte'), {
      target: { value: 'op1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }));

    expect(await screen.findByText('genere-123')).toBeInTheDocument();
  });

  it('exige une confirmation avant de désactiver un compte', async () => {
    vi.mocked(fetch).mockResolvedValue(reponse([admin]) as never);
    afficher();
    await screen.findByText('admin');

    fireEvent.click(screen.getByRole('button', { name: 'Désactiver' }));
    expect(screen.getByRole('button', { name: 'Confirmer ?' })).toBeInTheDocument();
    // La liste initiale = 1 seul appel ; toujours aucune écriture.
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
