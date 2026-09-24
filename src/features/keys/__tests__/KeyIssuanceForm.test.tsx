import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fleetsMessages from '../../fleets/messages/fr.json';
import messages from '../messages/fr.json';
import { KeyIssuanceForm } from '../components/KeyIssuanceForm';

const allMessages = { ...fleetsMessages, ...messages };

function afficher(onIssued = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { onIssued, ...render(
    <NextIntlClientProvider locale="fr" messages={allMessages}>
      <QueryClientProvider client={client}>
        <KeyIssuanceForm onIssued={onIssued} />
      </QueryClientProvider>
    </NextIntlClientProvider>
  ) };
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 400, json: async () => body };
}

describe('KeyIssuanceForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/fleets/nodes') return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse({}));
    }));
  });

  it('exige un nom de flotte avant de pouvoir émettre, sauf clé interne', async () => {
    afficher();

    await screen.findByText('Nouvelle flotte…');
    expect(screen.getByRole('button', { name: 'Émettre' })).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Clé interne Stramatel (tag:interne)'));
    expect(screen.getByRole('button', { name: 'Émettre' })).not.toBeDisabled();
  });

  it('normalise un nom de flotte en tag minuscule sans espace', async () => {
    const { onIssued } = afficher();
    vi.mocked(fetch).mockImplementation((url) => {
      if (url === '/api/fleets/nodes') return Promise.resolve(jsonResponse([]) as never);
      return Promise.resolve(
        jsonResponse({
          id: '1',
          key: 'preauthkey-secret',
          reusable: false,
          used: false,
          expiration: '2027-01-01T00:00:00.000Z',
          createdAt: '2026-09-24T00:00:00.000Z',
          tags: ['tag:flotte-nouveau-client'],
        }) as never
      );
    });

    fireEvent.change(await screen.findByPlaceholderText('nouveauclient'), {
      target: { value: 'Nouveau Client' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Émettre' }));

    await waitFor(() => expect(onIssued).toHaveBeenCalled());
    const call = vi.mocked(fetch).mock.calls.find(([url]) => url === '/api/keys');
    const body = JSON.parse((call?.[1] as RequestInit).body as string);
    expect(body.tags).toEqual(['tag:flotte-nouveau-client']);
  });

  it('affiche une erreur si Headscale refuse', async () => {
    const { onIssued } = afficher();
    vi.mocked(fetch).mockImplementation((url) => {
      if (url === '/api/fleets/nodes') return Promise.resolve(jsonResponse([]) as never);
      return Promise.resolve(jsonResponse({ message: 'Émission refusée par Headscale' }, false) as never);
    });

    fireEvent.click(screen.getByLabelText('Clé interne Stramatel (tag:interne)'));
    fireEvent.click(screen.getByRole('button', { name: 'Émettre' }));

    await waitFor(() => expect(onIssued).not.toHaveBeenCalled());
  });
});
