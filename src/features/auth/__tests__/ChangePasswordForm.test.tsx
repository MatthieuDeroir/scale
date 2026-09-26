import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '../messages/fr.json';
import { ChangePasswordForm } from '../components/ChangePasswordForm';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh: vi.fn(), back: vi.fn() }) }));

function remplir(values: { current: string; next: string; confirm: string }) {
  fireEvent.change(screen.getByLabelText('Mot de passe actuel'), { target: { value: values.current } });
  fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: values.next } });
  fireEvent.change(screen.getByLabelText('Confirmer le nouveau mot de passe'), {
    target: { value: values.confirm },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
}

describe('ChangePasswordForm', () => {
  beforeEach(() => {
    replace.mockReset();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })));
    render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <ChangePasswordForm forced />
      </NextIntlClientProvider>
    );
  });

  it('refuse un mot de passe trop court sans appeler le serveur', async () => {
    remplir({ current: 'ancien-provisoire', next: 'court', confirm: 'court' });
    expect(await screen.findByText('Au moins 12 caractères')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuse deux saisies différentes', async () => {
    remplir({ current: 'ancien-provisoire', next: 'un-long-mot-de-passe', confirm: 'un-autre-mot-de-passe' });
    expect(await screen.findByText('Les deux saisies ne correspondent pas')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('envoie un changement valide puis ramène à l’accueil', async () => {
    remplir({ current: 'ancien-provisoire', next: 'un-long-mot-de-passe', confirm: 'un-long-mot-de-passe' });
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/auth/password', expect.objectContaining({ method: 'POST' }))
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });

  it('forcé : pas de bouton pour y échapper', () => {
    expect(screen.queryByRole('button', { name: 'Annuler' })).not.toBeInTheDocument();
  });
});
