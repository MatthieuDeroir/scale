import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AclScreen } from '@/features/acl';
import { readSession, sessionCookie } from '@/features/auth';
import { AppShell } from '@/shared/ui';
import { NavLinks } from '../_components/nav-links';

export default async function AclPage() {
  const token = (await cookies()).get(sessionCookie.name)?.value;
  const session = await readSession(token);
  if (!session) redirect('/login');

  return (
    <AppShell product="Stramscale" nav={<NavLinks active="acl" />}>
      <AclScreen />
    </AppShell>
  );
}
