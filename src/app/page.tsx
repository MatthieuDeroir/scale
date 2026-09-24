import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { readSession, sessionCookie } from '@/features/auth';
import { FleetOverview } from '@/features/fleets';
import { AppShell, NavLink } from '@/shared/ui';

export default async function Home() {
  const token = (await cookies()).get(sessionCookie.name)?.value;
  const session = await readSession(token);
  if (!session) redirect('/login');

  const t = await getTranslations('nav');

  return (
    <AppShell
      product="Stramscale"
      nav={
        <>
          <NavLink href="/" active>
            {t('overview')}
          </NavLink>
        </>
      }
    >
      <FleetOverview />
    </AppShell>
  );
}
