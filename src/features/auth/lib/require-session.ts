import { cookies } from 'next/headers';
import { prisma } from '@/core';
import { covers, type Role } from './roles';
import { readSession, sessionCookie } from './session.mjs';

export interface CurrentUser {
  userId: number;
  username: string;
  role: Role;
  mustChangePassword: boolean;
}

/**
 * Compte de la session courante, relu en base à chaque appel : le jeton dure
 * 8 h, mais un compte désactivé ou dont le rôle change doit perdre ses droits
 * tout de suite, pas à l'expiration du jeton.
 */
export async function currentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(sessionCookie.name)?.value;
  const session = await readSession(token);
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.disabled) return null;
  return {
    userId: user.id,
    username: user.username,
    role: user.role as Role,
    mustChangePassword: user.mustChangePassword,
  };
}

type SessionResult =
  | { ok: true; session: { userId: number; username: string; role: string } }
  | { ok: false; status: 401 | 403 };

/**
 * Garde d'accès pour les routes serveur. Distingue 401 (pas de session) de
 * 403 (session valide mais rôle insuffisant) : le client a besoin de la
 * différence pour afficher soit « connectez-vous », soit « vous n'avez pas
 * les droits ».
 */
export async function requireSession(minRole?: Role): Promise<SessionResult> {
  const user = await currentUser();
  if (!user) return { ok: false, status: 401 };
  if (minRole && !covers(user.role, minRole)) return { ok: false, status: 403 };
  return { ok: true, session: { userId: user.userId, username: user.username, role: user.role } };
}
