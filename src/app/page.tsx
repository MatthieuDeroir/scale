import { getTranslations } from 'next-intl/server';
import { HealthPanel } from '@/features/health';
import { AppShell, NavLink } from '@/shared/ui';

export default async function Home() {
  const t = await getTranslations('nav');

  return (
    <AppShell
      product="Starter 2026"
      nav={
        <>
          <NavLink href="/" active>
            {t('overview')}
          </NavLink>
        </>
      }
    >
      <HealthPanel />
    </AppShell>
  );
}
