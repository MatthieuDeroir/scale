import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { SignOutButton, type Role } from '@/features/auth';
import { AppShell } from '@/shared/ui';
import { guard } from './_components/guard';
import { navSections } from './_components/nav-links';

// Le layout survit à la navigation : la sidebar garde son état ouvert/réduit.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await guard();
  const [t, sections] = await Promise.all([
    getTranslations('nav'),
    navSections(session.role as Role),
  ]);

  return (
    <AppShell
      tagline={t('tagline')}
      sections={sections}
      toggleLabels={{ collapse: t('collapse'), expand: t('expand') }}
      footer={<SignOutButton username={session.username} />}
    >
      {children}
    </AppShell>
  );
}
