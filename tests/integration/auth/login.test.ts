import { beforeEach, describe, expect, it } from 'vitest';
import { POST } from '@/app/api/auth/login/route';
import { sessionCookie } from '@/features/auth';
import { createUser, jsonRequest, prisma, resetDatabase } from '../helpers';

const URL = 'http://localhost/api/auth/login';
const post = (body: unknown) => POST(jsonRequest(URL, body));

describe('POST /api/auth/login', () => {
  beforeEach(resetDatabase);

  describe('validation', () => {
    it('refuse un corps absent', async () => {
      expect((await POST(new Request(URL, { method: 'POST' }))).status).toBe(400);
    });

    it('refuse un identifiant vide', async () => {
      expect((await post({ username: '', password: 'x' })).status).toBe(400);
    });

    it('refuse un mot de passe absent', async () => {
      expect((await post({ username: 'admin' })).status).toBe(400);
    });
  });

  describe('refus', () => {
    it('renvoie le MÊME code pour un compte inconnu et un mot de passe faux', async () => {
      await createUser({ username: 'connu', password: 'bon-mot-de-passe' });

      const inconnu = await post({ username: 'inconnu', password: 'peu importe' });
      const mauvais = await post({ username: 'connu', password: 'mauvais' });

      // Une différence ici offrirait un oracle d'énumération des comptes.
      expect(inconnu.status).toBe(401);
      expect(mauvais.status).toBe(401);
      expect(await inconnu.json()).toEqual(await mauvais.json());
    });

    it('ne pose pas de cookie de session', async () => {
      await createUser({ username: 'connu', password: 'bon' });
      const response = await post({ username: 'connu', password: 'faux' });
      expect(response.cookies.get(sessionCookie.name)).toBeUndefined();
    });
  });

  describe('succès', () => {
    it('pose un cookie httpOnly et renvoie mustChangePassword', async () => {
      const { user, password } = await createUser({ mustChangePassword: true });

      const response = await post({ username: user.username, password });
      const cookie = response.cookies.get(sessionCookie.name);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ mustChangePassword: true });
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite).toBe('lax');
      expect(cookie?.value).not.toBe('');
    });

    it('horodate la connexion et remet le compteur d’échecs à zéro', async () => {
      const { user, password } = await createUser();
      await post({ username: user.username, password: 'faux' });
      await post({ username: user.username, password });

      const apres = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(apres.failedAttempts).toBe(0);
      expect(apres.lastLoginAt).not.toBeNull();
    });
  });

  describe('verrouillage progressif', () => {
    it('incrémente le compteur à chaque échec', async () => {
      const { user } = await createUser();
      await post({ username: user.username, password: 'faux' });
      await post({ username: user.username, password: 'faux' });

      const apres = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(apres.failedAttempts).toBe(2);
      expect(apres.lockedUntil).toBeNull();
    });

    it('verrouille au cinquième échec', async () => {
      const { user } = await createUser();
      for (let i = 0; i < 5; i += 1) await post({ username: user.username, password: 'faux' });

      const apres = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(apres.failedAttempts).toBe(5);
      expect(apres.lockedUntil).not.toBeNull();
      expect(apres.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    });

    it('refuse le BON mot de passe pendant le verrouillage', async () => {
      const { user, password } = await createUser();
      for (let i = 0; i < 5; i += 1) await post({ username: user.username, password: 'faux' });

      expect((await post({ username: user.username, password })).status).toBe(401);
    });

    it('accepte de nouveau une fois le verrou expiré', async () => {
      const { user, password } = await createUser();
      for (let i = 0; i < 5; i += 1) await post({ username: user.username, password: 'faux' });

      await prisma.user.update({
        where: { id: user.id },
        data: { lockedUntil: new Date(Date.now() - 1000) },
      });

      expect((await post({ username: user.username, password })).status).toBe(200);
    });
  });

  describe('contraintes du schéma', () => {
    it('interdit deux comptes de même identifiant', async () => {
      // Le G552 n'a pas cette contrainte : d'où ses 40 comptes en double.
      await createUser({ username: 'doublon' });
      await expect(createUser({ username: 'doublon' })).rejects.toThrow();
    });

    it('ne stocke jamais le mot de passe en clair', async () => {
      const { user, password } = await createUser({ password: 'secret-en-clair' });
      const enBase = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(enBase.passwordHash).not.toContain(password);
      expect(enBase.passwordHash.startsWith('$2')).toBe(true);
    });
  });
});
