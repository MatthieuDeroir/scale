'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link, { type LinkProps } from 'next/link';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { cn } from '../lib';

/**
 * Repris de ServeurTemps (`mes_projets/gamme/serveur_temps/src/shared/components/ui/sidebar.tsx`,
 * lui-même Aceternity UI) — mais avec les jetons `sidebar*` du projet plutôt
 * que le neutral-100/800 d'origine : la sidebar Stramatel est sombre dans
 * les deux thèmes (barre de navigation brandée), pas juste en dark mode.
 */
export interface NavLinkItem {
  label: string;
  href: string;
  icon: ReactNode;
  active?: boolean;
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
  const [open, setOpen] = useState(false);
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
  const { open, setOpen } = useSidebar();
  return (
    <motion.div
      className={cn(
        'hidden h-full flex-col bg-sidebar px-3 py-4 text-sidebar-foreground md:flex',
        className
      )}
      animate={{ width: open ? '260px' : '68px' }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
    </motion.div>
  );
}

function MobileSidebar({ className, children }: SidebarBodyProps) {
  const { open, setOpen } = useSidebar();
  return (
    <div className="flex h-12 w-full items-center justify-between bg-sidebar px-4 text-sidebar-foreground md:hidden">
      <span className="text-sm font-semibold tracking-wide">STRAMATEL</span>
      <Menu className="cursor-pointer" onClick={() => setOpen(!open)} />
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className={cn(
              'fixed inset-0 z-100 flex flex-col bg-sidebar p-6 text-sidebar-foreground',
              className
            )}
          >
            <X className="absolute right-6 top-6 cursor-pointer" onClick={() => setOpen(false)} />
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Marque compacte (`Logo_Stramatel.png`, 230×178 — proche du carré) toujours
 * affichée ; le nom du produit apparaît à côté seulement sidebar ouverte,
 * même comportement que le libellé d'un `SidebarLink`. Les fichiers
 * `Logo_Stramatel_White/Dark.png` sont un bandeau texte très large
 * (1370×178) : pas adaptés à une case compacte, réservés à un usage plein
 * format ailleurs si besoin.
 */
export function SidebarLogo({ product }: { product: string }) {
  const { open } = useSidebar();
  return (
    <Link href="/" className="flex items-center gap-2.5 px-1.5 py-1.5">
      <Image
        src="/images/Logo_Stramatel.png"
        alt="Stramatel"
        width={26}
        height={20}
        className="h-5 w-auto shrink-0 object-contain"
      />
      <motion.span
        animate={{ display: open ? 'inline-block' : 'none', opacity: open ? 1 : 0 }}
        className="whitespace-pre text-sm font-semibold tracking-wide text-sidebar-accent-foreground"
      >
        {product}
      </motion.span>
    </Link>
  );
}

export function SidebarLink({ link }: { link: NavLinkItem }) {
  const { open } = useSidebar();
  return (
    <Link
      href={link.href as LinkProps['href']}
      aria-current={link.active ? 'page' : undefined}
      className={cn(
        'group/sidebar flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-sidebar-muted transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        link.active && 'bg-sidebar-accent text-sidebar-accent-foreground'
      )}
    >
      <span className="shrink-0 [&>svg]:size-5">{link.icon}</span>
      <motion.span
        animate={{ display: open ? 'inline-block' : 'none', opacity: open ? 1 : 0 }}
        className="whitespace-pre transition duration-150 group-hover/sidebar:translate-x-0.5"
      >
        {link.label}
      </motion.span>
    </Link>
  );
}
