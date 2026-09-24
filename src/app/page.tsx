import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { readSession, sessionCookie, type Role } from '@/features/auth';
import { FleetOverview } from '@/features/fleets';
import { AppShell } from '@/shared/ui';
import { NavLinks } from './_components/nav-links';

export default async function Home() {
  const token = (await cookies()).get(sessionCookie.name)?.value;
  const session = await readSession(token);
  if (!session) redirect('/login');

  return (
    <AppShell
      product="Stramscale"
      nav={<NavLinks active="overview" role={session.role as Role} />}
    >
      <FleetOverview />
    </AppShell>
  );
}
