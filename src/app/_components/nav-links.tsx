import { KeyRound, LayoutDashboard, ShieldCheck, UploadCloud, Users } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { covers, type Role } from '@/features/auth';
import type { NavLinkItem } from '@/shared/ui';

type ActivePage = 'overview' | 'keys' | 'provisioning' | 'acl' | 'accounts';

/**
 * Fabrique la liste de liens (données, pas du JSX) pour `<AppShell links={...} />` —
 * un seul endroit à toucher pour ajouter un écran. `role` est optionnel :
 * seul « Comptes » en a besoin pour se masquer aux non-ADMIN.
 */
export async function navLinks({
  active,
  role,
}: {
  active: ActivePage;
  role?: Role;
}): Promise<NavLinkItem[]> {
  const t = await getTranslations('nav');

  const links: NavLinkItem[] = [
    {
      href: '/',
      label: t('overview'),
      icon: <LayoutDashboard />,
      active: active === 'overview',
    },
    { href: '/keys', label: t('keys'), icon: <KeyRound />, active: active === 'keys' },
    { href: '/acl', label: t('acl'), icon: <ShieldCheck />, active: active === 'acl' },
    {
      href: '/provisioning',
      label: t('provisioning'),
      icon: <UploadCloud />,
      active: active === 'provisioning',
    },
  ];

  if (role && covers(role, 'ADMIN')) {
    links.push({
      href: '/comptes',
      label: t('accounts'),
      icon: <Users />,
      active: active === 'accounts',
    });
  }

  return links;
}
