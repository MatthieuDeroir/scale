import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AccountsScreen, covers, readSession, sessionCookie, type Role } from '@/features/auth';
import { AppShell } from '@/shared/ui';
import { navLinks } from '../_components/nav-links';

export default async function ComptesPage() {
  const token = (await cookies()).get(sessionCookie.name)?.value;
  const session = await readSession(token);
  if (!session) redirect('/login');
  if (!covers(session.role as Role, 'ADMIN')) redirect('/');

  const [t, links] = await Promise.all([
    getTranslations('nav'),
    navLinks({ active: 'accounts', role: session.role as Role }),
  ]);

  return (
    <AppShell product="Stramscale" title={t('accounts')} links={links}>
      <AccountsScreen />
    </AppShell>
  );
}
