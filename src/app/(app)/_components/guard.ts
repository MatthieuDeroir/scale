import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { covers, readSession, sessionCookie, type Role } from '@/features/auth';

/** Session obligatoire ; en dessous du rôle requis, retour à l'accueil. */
export async function guard(minRole: Role = 'VIEWER') {
  const token = (await cookies()).get(sessionCookie.name)?.value;
  const session = await readSession(token);
  if (!session) redirect('/login');
  if (!covers(session.role as Role, minRole)) redirect('/');
  return session;
}
