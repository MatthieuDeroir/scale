import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AclScreen } from '@/features/acl';
import { readSession, sessionCookie, type Role } from '@/features/auth';
import { AppShell } from '@/shared/ui';
import { navLinks } from '../_components/nav-links';

export default async function AclPage() {
  const token = (await cookies()).get(sessionCookie.name)?.value;
  const session = await readSession(token);
  if (!session) redirect('/login');

  const [t, links] = await Promise.all([
    getTranslations('nav'),
    navLinks({ active: 'acl', role: session.role as Role }),
  ]);

  return (
    <AppShell product="Stramscale" title={t('acl')} links={links}>
      <AclScreen />
    </AppShell>
  );
}
