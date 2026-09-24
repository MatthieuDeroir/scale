import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AccountsScreen, covers, readSession, sessionCookie, type Role } from '@/features/auth';
import { AppShell } from '@/shared/ui';
import { NavLinks } from '../_components/nav-links';

export default async function ComptesPage() {
  const token = (await cookies()).get(sessionCookie.name)?.value;
  const session = await readSession(token);
  if (!session) redirect('/login');
  if (!covers(session.role as Role, 'ADMIN')) redirect('/');

  return (
    <AppShell product="Stramscale" nav={<NavLinks active="accounts" role={session.role as Role} />}>
      <AccountsScreen />
    </AppShell>
  );
}
