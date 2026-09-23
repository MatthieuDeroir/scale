import type { ReactNode } from 'react';
import { cn } from '../lib';
import { ThemeToggle } from '../theme';

/**
 * Coquille d'exploitation : barre latérale sombre dans les deux thèmes,
 * comme sur ServeurTemps, SL MEDIA et SL FTP. Elle porte l'identité produit ;
 * le contenu reste sur fond clair ou sombre selon le thème choisi.
 */
export function AppShell({
  product,
  nav,
  children,
}: {
  product: string;
  nav?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 px-5 py-4">
          <span className="inline-block size-2.5 rounded-full bg-brand" aria-hidden />
          <span className="text-sm font-semibold tracking-wide text-sidebar-accent-foreground">
            STRAMATEL
          </span>
        </div>
        <p className="px-5 pb-4 text-xs text-sidebar-muted">{product}</p>

        <nav className="flex-1 px-2">{nav}</nav>

        <div className="border-t border-sidebar-border p-3">
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

export function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'block rounded-md px-3 py-2 text-sm text-sidebar-muted transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        active && 'bg-sidebar-accent text-sidebar-accent-foreground'
      )}
    >
      {children}
    </a>
  );
}
