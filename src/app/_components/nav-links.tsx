import { getTranslations } from 'next-intl/server';
import { NavLink } from '@/shared/ui';

/**
 * Liste unique des liens de nav, pour ne pas la dupliquer dans chaque
 * `page.tsx` protégé — chaque nouvelle page n'a qu'à dire laquelle est
 * active.
 */
export async function NavLinks({ active }: { active: 'overview' | 'keys' | 'provisioning' }) {
  const t = await getTranslations('nav');

  return (
    <>
      <NavLink href="/" active={active === 'overview'}>
        {t('overview')}
      </NavLink>
      <NavLink href="/keys" active={active === 'keys'}>
        {t('keys')}
      </NavLink>
      <NavLink href="/provisioning" active={active === 'provisioning'}>
        {t('provisioning')}
      </NavLink>
    </>
  );
}
