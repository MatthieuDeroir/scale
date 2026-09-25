'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import Image from 'next/image';
import Link, { type LinkProps } from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { cn } from '../lib';

/**
 * Sidebar ouverte par défaut, repliable par un bouton — pas d'ouverture au
 * survol : la version survol (reprise de ServeurTemps) se refermait dès qu'on
 * quittait la barre, et chaque clic de navigation la remontait fermée.
 * Rendue par le layout `(app)`, elle n'est plus remontée à la navigation :
 * son état ouvert/replié survit d'un écran à l'autre.
 */
export interface NavLinkItem {
  label: string;
  href: string;
  icon: ReactNode;
}

export interface NavSection {
  title?: string;
  links: NavLinkItem[];
}

interface SidebarContextProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error('useSidebar doit être utilisé dans <Sidebar>');
  return context;
}

export function Sidebar({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return <SidebarContext.Provider value={{ open, setOpen }}>{children}</SidebarContext.Provider>;
}

interface SidebarBodyProps {
  className?: string;
  children: ReactNode;
}

export function SidebarBody(props: SidebarBodyProps) {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...props} />
    </>
  );
}

function DesktopSidebar({ className, children }: SidebarBodyProps) {
  const { open } = useSidebar();
  return (
    <motion.div
      className={cn(
        'hidden h-full shrink-0 flex-col bg-sidebar px-3 py-4 text-sidebar-foreground md:flex',
        className
      )}
      initial={false}
      animate={{ width: open ? 232 : 64 }}
      transition={{ duration: 0.18, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}

function MobileSidebar({ className, children }: SidebarBodyProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex h-12 w-full items-center justify-between bg-sidebar px-4 text-sidebar-foreground md:hidden">
      <span className="text-sm font-semibold tracking-wide">STRAMATEL</span>
      <Menu className="cursor-pointer" onClick={() => setMobileOpen(true)} />
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.2 }}
            className={cn(
              'fixed inset-0 z-100 flex flex-col bg-sidebar p-6 text-sidebar-foreground',
              className
            )}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest('a')) setMobileOpen(false);
            }}
          >
            <X
              className="absolute right-6 top-6 cursor-pointer"
              onClick={() => setMobileOpen(false)}
            />
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const { open } = useSidebar();
  if (!open) return null;
  return <span className={cn('truncate whitespace-nowrap', className)}>{children}</span>;
}

export function SidebarLogo({ product }: { product: string }) {
  return (
    <Link href="/" className="flex h-8 items-center gap-2.5 px-2">
      <Image
        src="/images/Logo_Stramatel.png"
        alt="Stramatel"
        width={26}
        height={20}
        className="h-5 w-auto shrink-0 object-contain"
      />
      <Reveal className="text-sm font-semibold tracking-wide text-sidebar-accent-foreground">
        {product}
      </Reveal>
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/' || pathname.startsWith('/flottes');
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarLink({ link }: { link: NavLinkItem }) {
  const pathname = usePathname();
  const { open } = useSidebar();
  const active = isActive(pathname, link.href);
  return (
    <Link
      href={link.href as LinkProps['href']}
      aria-current={active ? 'page' : undefined}
      title={open ? undefined : link.label}
      className={cn(
        'flex h-9 items-center gap-3 rounded-md px-2.5 text-sm text-sidebar-muted transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        active && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
      )}
    >
      <span className="shrink-0 [&>svg]:size-[18px]">{link.icon}</span>
      <Reveal className="flex-1">{link.label}</Reveal>
    </Link>
  );
}

/** Rendu seulement sidebar ouverte (ex. sélecteur de thème, trop large replié). */
export function SidebarWhenOpen({ children }: { children: ReactNode }) {
  const { open } = useSidebar();
  return open ? <>{children}</> : null;
}

export function SidebarSectionTitle({ children }: { children: ReactNode }) {
  const { open } = useSidebar();
  if (!open) return <div className="mx-2.5 my-2 border-t border-sidebar-border" />;
  return (
    <p className="px-2.5 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wider text-sidebar-muted/70">
      {children}
    </p>
  );
}

export function SidebarToggle({ collapseLabel, expandLabel }: { collapseLabel: string; expandLabel: string }) {
  const { open, setOpen } = useSidebar();
  const label = open ? collapseLabel : expandLabel;
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-label={label}
      title={label}
      className="flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      {open ? <PanelLeftClose className="size-[18px] shrink-0" /> : <PanelLeftOpen className="size-[18px] shrink-0" />}
      <Reveal>{label}</Reveal>
    </button>
  );
}

/** Action en pied de sidebar (icône seule une fois repliée), ex. déconnexion. */
export function SidebarButton({
  icon,
  label,
  detail,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  detail?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const { open } = useSidebar();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={open ? undefined : label}
      className="flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:opacity-50"
    >
      <span className="shrink-0 [&>svg]:size-[18px]">{icon}</span>
      <Reveal className="flex-1 text-left">{label}</Reveal>
      {detail && <Reveal className="max-w-24 text-xs text-sidebar-muted/70">{detail}</Reveal>}
    </button>
  );
}
