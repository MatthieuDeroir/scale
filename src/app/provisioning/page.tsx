import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { readSession, sessionCookie } from '@/features/auth';
import { ProvisioningLog } from '@/features/provisioning';
import { AppShell } from '@/shared/ui';
import { NavLinks } from '../_components/nav-links';

export default async function ProvisioningPage() {
  const token = (await cookies()).get(sessionCookie.name)?.value;
  const session = await readSession(token);
  if (!session) redirect('/login');

  return (
    <AppShell product="Stramscale" nav={<NavLinks active="provisioning" />}>
      <ProvisioningLog />
    </AppShell>
  );
}
