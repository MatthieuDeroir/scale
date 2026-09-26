import type { ReactNode } from 'react';
import { ThemeToggle } from '../theme';
import {
  Sidebar,
  SidebarBody,
  SidebarLink,
  SidebarLogo,
  SidebarSectionTitle,
  SidebarToggle,
  SidebarWhenOpen,
  type NavSection,
} from './sidebar';

/**
 * Coquille d'exploitation, rendue une seule fois par le layout `(app)` — pas
 * par chaque page : l'état de la sidebar survit donc à la navigation. Largeur
 * de lecture bornée (`max-w-5xl`) : sans ça, sur un grand écran, les colonnes
 * d'un tableau s'écartent de plusieurs centaines de pixels.
 */
export function AppShell({
  tagline,
  sections,
  toggleLabels,
  footer,
  search,
  children,
}: {
  tagline: string;
  sections: NavSection[];
  toggleLabels: { collapse: string; expand: string };
  /** Actions de pied de sidebar (compte, déconnexion) — fournies par l'app, pas par le socle UI. */
  footer?: ReactNode;
  /** Recherche globale, sous le logo. */
  search?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-sidebar md:flex-row">
      <Sidebar>
        <SidebarBody className="justify-between">
          <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
            <SidebarLogo tagline={tagline} />
            {search && <div className="mt-4">{search}</div>}
            <nav className="mt-6 flex flex-col gap-0.5">
              {sections.map((section, index) => (
                <div key={section.title ?? index} className="flex flex-col gap-0.5">
                  {section.title && <SidebarSectionTitle>{section.title}</SidebarSectionTitle>}
                  {section.links.map((link) => (
                    <SidebarLink key={link.href} link={link} />
                  ))}
                </div>
              ))}
            </nav>
          </div>

          <div className="flex flex-col gap-2 border-t border-sidebar-border pt-3">
            <SidebarWhenOpen>
              <div className="px-1">
                <ThemeToggle />
              </div>
            </SidebarWhenOpen>
            {footer}
            <SidebarToggle collapseLabel={toggleLabels.collapse} expandLabel={toggleLabels.expand} />
          </div>
        </SidebarBody>
      </Sidebar>

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto rounded-tl-2xl border-l border-t border-border bg-background">
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
