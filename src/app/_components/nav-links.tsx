import { getTranslations } from 'next-intl/server';
import { covers, type Role } from '@/features/auth';
import { NavLink } from '@/shared/ui';

/**
 * Liste unique des liens de nav, pour ne pas la dupliquer dans chaque
 * `page.tsx` protégé — chaque nouvelle page n'a qu'à dire laquelle est
 * active. `role` est optionnel : seul `/comptes` en a besoin pour se
 * masquer aux non-ADMIN, mais on le passe partout pour que le lien
 * apparaisse de façon cohérente sur tous les écrans.
 */
export async function NavLinks({
  active,
  role,
}: {
  active: 'overview' | 'keys' | 'provisioning' | 'acl' | 'accounts';
  role?: Role;
}) {
  const t = await getTranslations('nav');

  return (
    <>
      <NavLink href="/" active={active === 'overview'}>
        {t('overview')}
      </NavLink>
      <NavLink href="/keys" active={active === 'keys'}>
        {t('keys')}
      </NavLink>
      <NavLink href="/acl" active={active === 'acl'}>
        {t('acl')}
      </NavLink>
      <NavLink href="/provisioning" active={active === 'provisioning'}>
        {t('provisioning')}
      </NavLink>
      {role && covers(role, 'ADMIN') && (
        <NavLink href="/comptes" active={active === 'accounts'}>
          {t('accounts')}
        </NavLink>
      )}
    </>
  );
}
