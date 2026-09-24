import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';

/** Verrouillage progressif : la limitation vit en base, pas en mémoire — un
 *  redémarrage ne doit pas remettre le compteur à zéro. */
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export type LoginResult =
  | { ok: true; user: { id: number; username: string; role: string; mustChangePassword: boolean } }
  | { ok: false; reason: 'invalid' | 'locked' | 'disabled' };

/**
 * Vérifie un couple identifiant / mot de passe.
 *
 * Le motif d'échec renvoyé au client est toujours le même côté appelant :
 * distinguer « compte inconnu » de « mot de passe faux » offre un oracle
 * d'énumération. La distinction ci-dessous sert uniquement au verrouillage.
 */
export async function verifyLogin(
  prisma: PrismaClient,
  username: string,
  password: string
): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user) {
    // Coût constant : sans cela, l'absence de hachage rend la réponse plus
    // rapide et trahit les comptes inexistants.
    await bcrypt.compare(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
    return { ok: false, reason: 'invalid' };
  }

  if (user.disabled) {
    return { ok: false, reason: 'disabled' };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { ok: false, reason: 'locked' };
  }

  if (!(await bcrypt.compare(password, user.passwordHash))) {
    const failedAttempts = user.failedAttempts + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts,
        lockedUntil:
          failedAttempts >= MAX_ATTEMPTS
            ? new Date(Date.now() + LOCK_MINUTES * 60_000)
            : user.lockedUntil,
      },
    });
    return { ok: false, reason: 'invalid' };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  return {
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Web Crypto plutôt que `node:crypto` : ce fichier est réexporté par le
 * barrel `auth`, que `src/middleware.ts` importe — `node:crypto` y fait
 * échouer le bundle Edge (« Native module not found »), repéré en
 * vérification réelle. `crypto.getRandomValues`/`btoa` fonctionnent sur les
 * deux runtimes.
 */
export function generatePassword(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
