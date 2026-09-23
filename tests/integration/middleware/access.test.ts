import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from '@/middleware';
import { createSession, sessionCookie } from '@/features/auth';

function requete(pathname: string, cookie?: string) {
  const request = new NextRequest(new URL(pathname, 'http://localhost'));
  if (cookie) request.cookies.set(sessionCookie.name, cookie);
  return request;
}

async function jetonValide() {
  return createSession({ userId: 1, username: 'op', role: 'OPERATOR' });
}

describe('middleware — refus par défaut', () => {
  describe('chemins publics', () => {
    it.each(['/api/health', '/login', '/api/auth/login'])('laisse passer %s', async (chemin) => {
      expect((await middleware(requete(chemin))).status).toBe(200);
    });

    it('laisse passer les sous-chemins publics', async () => {
      expect((await middleware(requete('/login/aide'))).status).toBe(200);
    });
  });

  describe('sans session', () => {
    it('refuse une route API en 401, sans redirection', async () => {
      // Une API qui redirige vers une page de connexion casse le client et
      // masque la cause réelle : c'est un 401 qu'il faut.
      const reponse = await middleware(requete('/api/screens'));
      expect(reponse.status).toBe(401);
    });

    it('redirige une page vers /login', async () => {
      const reponse = await middleware(requete('/reglages'));
      expect(reponse.status).toBe(307);
      expect(reponse.headers.get('location')).toContain('/login');
    });

    it('refuse un chemin non listé, même proche d’un chemin public', async () => {
      // `/api/healthcheck` ne doit PAS hériter de la publicité de `/api/health`.
      expect((await middleware(requete('/api/healthcheck'))).status).toBe(401);
    });

    it('refuse un cookie de session falsifié', async () => {
      expect((await middleware(requete('/reglages', 'jeton-bidon'))).status).toBe(307);
    });
  });

  describe('avec session', () => {
    it('laisse passer une page', async () => {
      const reponse = await middleware(requete('/reglages', await jetonValide()));
      expect(reponse.status).toBe(200);
    });

    it('laisse passer une route API', async () => {
      const reponse = await middleware(requete('/api/screens', await jetonValide()));
      expect(reponse.status).toBe(200);
    });
  });
});
