import { redirect } from 'next/navigation';
import { covers, type Role } from '@/features/auth';
import { currentUser } from '@/features/auth/lib/require-session';

/**
 * Compte obligatoire (relu en base : désactivé = déconnecté) ; mot de passe
 * provisoire = passage obligé par le changement ; en dessous du rôle requis,
 * retour à l'accueil.
 */
export async function guard(minRole: Role = 'VIEWER') {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (user.mustChangePassword) redirect('/mot-de-passe');
  if (!covers(user.role, minRole)) redirect('/');
  return user;
}
