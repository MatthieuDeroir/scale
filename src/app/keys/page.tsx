import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { readSession, sessionCookie } from '@/features/auth';
import { KeysScreen } from '@/features/keys';
import { AppShell } from '@/shared/ui';
import { NavLinks } from '../_components/nav-links';

export default async function KeysPage() {
  const token = (await cookies()).get(sessionCookie.name)?.value;
  const session = await readSession(token);
  if (!session) redirect('/login');

  return (
    <AppShell product="Stramscale" nav={<NavLinks active="keys" />}>
      <KeysScreen />
    </AppShell>
  );
}
