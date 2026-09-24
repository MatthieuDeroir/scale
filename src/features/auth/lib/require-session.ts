import { cookies } from 'next/headers';
import { covers, type Role } from './roles';
import { readSession, sessionCookie } from './session.mjs';

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
  const token = (await cookies()).get(sessionCookie.name)?.value;
  const session = await readSession(token);
  if (!session) return { ok: false, status: 401 };
  if (minRole && !covers(session.role as Role, minRole)) return { ok: false, status: 403 };
  return { ok: true, session };
}
