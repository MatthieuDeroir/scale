import { Boxes, Headset, History, ShieldAlert, Inbox, Layers, LayoutDashboard, Server, ShieldCheck, Users } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { covers, type Role } from '@/features/auth';
import type { NavSection } from '@/shared/ui';

/** Navigation selon le rôle : un seul endroit à toucher pour ajouter un écran. */
export async function navSections(role: Role): Promise<NavSection[]> {
  const t = await getTranslations('nav');

  const sections: NavSection[] = [
    {
      links: [
        { href: '/', label: t('dashboard'), icon: <LayoutDashboard /> },
        { href: '/flottes', label: t('fleets'), icon: <Layers /> },
        { href: '/machines', label: t('machines'), icon: <Server /> },
        { href: '/a-assigner', label: t('unassigned'), icon: <Inbox /> },
        { href: '/support', label: t('support'), icon: <Headset /> },
        { href: '/cybersecurite', label: t('security'), icon: <ShieldAlert /> },
        { href: '/produits', label: t('catalog'), icon: <Boxes /> },
      ],
    },
  ];

  const admin = [
    ...(covers(role, 'OPERATOR')
      ? [{ href: '/politique', label: t('policy'), icon: <ShieldCheck /> }]
      : []),
    ...(covers(role, 'ADMIN')
      ? [
          { href: '/comptes', label: t('accounts'), icon: <Users /> },
          { href: '/activite', label: t('activity'), icon: <History /> },
        ]
      : []),
  ];
  if (admin.length > 0) sections.push({ title: t('admin'), links: admin });

  return sections;
}
