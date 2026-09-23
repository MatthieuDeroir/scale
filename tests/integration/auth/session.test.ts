import { describe, expect, it } from 'vitest';
import { POST as logout } from '@/app/api/auth/logout/route';
import { createSession, readSession, sessionCookie } from '@/features/auth';

const UTILISATEUR = { userId: 1, username: 'operateur', role: 'OPERATOR' };

describe('session', () => {
  it('relit ce qu’elle a signé', async () => {
    const session = await readSession(await createSession(UTILISATEUR));
    expect(session).toEqual(UTILISATEUR);
  });

  it('refuse un jeton absent, vide ou illisible', async () => {
    expect(await readSession(undefined)).toBeNull();
    expect(await readSession('')).toBeNull();
    expect(await readSession('pas-un-jeton')).toBeNull();
  });

  it('refuse une signature falsifiée', async () => {
    const token = await createSession(UTILISATEUR);
    const [header, payload] = token.split('.');
    // Charge utile intacte, signature remplacée : `decode()` l'accepterait,
    // `verify()` doit la rejeter. C'est l'écart relevé dans le G552.
    expect(await readSession(`${header}.${payload}.signature-bidon`)).toBeNull();
  });

  it('refuse un jeton signé avec un autre secret', async () => {
    const original = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'un-autre-secret-suffisamment-long-pour-etre-valide';
    const etranger = await createSession(UTILISATEUR);
    process.env.JWT_SECRET = original;

    expect(await readSession(etranger)).toBeNull();
  });

  it('la déconnexion vide le cookie', async () => {
    const response = await logout();
    const cookie = response.cookies.get(sessionCookie.name);
    expect(cookie?.value).toBe('');
    expect(cookie?.maxAge).toBe(0);
  });
});
