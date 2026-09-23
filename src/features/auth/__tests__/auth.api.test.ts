import { beforeEach, describe, expect, it, vi } from 'vitest';
import { login, logout } from '../api/auth.api';

describe('client d’authentification', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  it('poste les identifiants en JSON', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as never);
    await login({ username: 'op', password: 'x' });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/api/auth/login');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ username: 'op', password: 'x' });
  });

  it('lève sur refus, avec le message du serveur', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Connexion refusée' }),
    } as never);

    await expect(login({ username: 'op', password: 'x' })).rejects.toThrow('Connexion refusée');
  });

  it('lève un message générique si le corps est illisible', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error('pas du JSON');
      },
    } as never);

    await expect(login({ username: 'op', password: 'x' })).rejects.toThrow('Connexion refusée');
  });

  it('déconnecte par POST', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as never);
    await logout();
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/auth/logout');
  });
});
