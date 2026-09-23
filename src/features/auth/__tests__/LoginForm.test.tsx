import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '../messages/fr.json';
import { LoginForm } from '../components/LoginForm';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const erreurs: string[] = [];
vi.mock('sonner', () => ({ toast: { error: (m: string) => erreurs.push(m) } }));

function afficher() {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <LoginForm />
    </NextIntlClientProvider>
  );
}

describe('LoginForm', () => {
  beforeEach(() => {
    replace.mockClear();
    erreurs.length = 0;
    vi.stubGlobal('fetch', vi.fn());
  });

  it('refuse la soumission de champs vides sans appeler le serveur', async () => {
    afficher();
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => expect(screen.getByText('Identifiant requis')).toBeInTheDocument());
    expect(fetch).not.toHaveBeenCalled();
  });

  it('redirige après une connexion acceptée', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as never);
    afficher();

    fireEvent.change(screen.getByLabelText('Identifiant'), { target: { value: 'op' } });
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });

  it('affiche un message unique en cas de refus', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({}) } as never);
    afficher();

    fireEvent.change(screen.getByLabelText('Identifiant'), { target: { value: 'op' } });
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'faux' } });
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    // Le message ne doit rien révéler : ni « compte inconnu », ni « verrouillé ».
    await waitFor(() => expect(erreurs).toEqual(['Identifiant ou mot de passe incorrect.']));
  });

  it('marque le mot de passe comme tel pour les gestionnaires', () => {
    afficher();
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute(
      'autocomplete',
      'current-password'
    );
  });
});
