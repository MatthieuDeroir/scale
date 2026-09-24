import Image from 'next/image';
import type { ReactNode } from 'react';
import { ThemeToggle } from '../theme';
import { Card, CardContent } from './card';
import { Sidebar, SidebarBody, SidebarLink, SidebarLogo, type NavLinkItem } from './sidebar';

/**
 * Coquille d'exploitation, empruntée à ServeurTemps
 * (`mes_projets/gamme/serveur_temps/src/app/[locale]/(protected)/layout.tsx`) : sidebar
 * collapsible qui s'ouvre au survol, bandeau d'en-tête dégradé avec le titre de l'écran et le
 * logo, panneau de contenu à coin arrondi qui « flotte » à côté de la sidebar. Sans l'effet de
 * particules au curseur ni l'horloge live de l'original — décoratif pour l'un, hors sujet pour
 * l'autre ici.
 */
export function AppShell({
  product,
  title,
  links,
  children,
}: {
  product: string;
  title: string;
  links: NavLinkItem[];
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-sidebar md:flex-row">
      <Sidebar>
        <SidebarBody className="justify-between">
          <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
            <SidebarLogo product={product} />

            <nav className="mt-8 flex flex-col gap-1">
              {links.map((link) => (
                <SidebarLink key={link.href} link={link} />
              ))}
            </nav>
          </div>

          <div className="border-t border-sidebar-border pt-3">
            <ThemeToggle />
          </div>
        </SidebarBody>
      </Sidebar>

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto rounded-tl-2xl border-l border-t border-border bg-background">
        <Card className="relative m-4 mb-0 flex-shrink-0 overflow-hidden rounded-xl border-none shadow-none">
          <div className="absolute inset-0 bg-gradient-to-r from-brand/5 via-transparent to-brand/5" />
          <CardContent className="relative flex items-center justify-between py-4">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {/* Logo_Stramatel.png fait 230×178 (≈1,29:1) — largeur calculée pour ne pas l'étirer. */}
            <Image
              src="/images/Logo_Stramatel.png"
              alt="Stramatel"
              width={36}
              height={28}
              className="h-7 w-auto"
            />
          </CardContent>
        </Card>

        <main className="flex-1 p-4">{children}</main>
      </div>
    </div>
  );
}
