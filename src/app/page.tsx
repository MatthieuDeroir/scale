import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { readSession, sessionCookie, type Role } from '@/features/auth';
import { FleetOverview } from '@/features/fleets';
import { AppShell } from '@/shared/ui';
import { navLinks } from './_components/nav-links';

export default async function Home() {
  const token = (await cookies()).get(sessionCookie.name)?.value;
  const session = await readSession(token);
  if (!session) redirect('/login');

  const [t, links] = await Promise.all([
    getTranslations('nav'),
    navLinks({ active: 'overview', role: session.role as Role }),
  ]);

  return (
    <AppShell product="Stramscale" title={t('overview')} links={links}>
      <FleetOverview />
    </AppShell>
  );
}
