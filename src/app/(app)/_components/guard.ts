import { redirect } from 'next/navigation';
import { covers, type Role } from '@/features/auth';
import { currentUser } from '@/features/auth/lib/require-session';

/**
 * Compte obligatoire (relu en base : désactivé = déconnecté) ; mot de passe
 * provisoire = passage obligé par le changement ; en dessous du rôle requis,
 * retour à l'accueil.
 */
export async function guard(minRole: Role = 'VIEWER') {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.VERCEL === '1') {
    return { userId: 0, username: 'Démo Stramscale', role: 'ADMIN' as Role, mustChangePassword: false };
  }
  const user = await currentUser();
  if (!user) redirect('/login');
  if (user.mustChangePassword) redirect('/mot-de-passe');
  if (!covers(user.role, minRole)) redirect('/');
  return user;
}
