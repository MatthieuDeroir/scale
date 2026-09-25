import { cn } from '../lib';

/**
 * Pictogramme Stramscale : un maillage de machines reliées entre elles (le
 * réseau WireGuard d'une flotte), blanc sur le rouge de la charte. Même dessin
 * que `src/app/icon.svg` (favicon).
 */
export function StramscaleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('shrink-0', className)}>
      <rect width="32" height="32" rx="8" className="fill-brand" />
      <g stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.9">
        <path d="M9 10.5 L22.5 8.5 L24 21 L11 23.5 Z" fill="none" />
        <path d="M9 10.5 L24 21 M22.5 8.5 L11 23.5" strokeOpacity="0.45" />
      </g>
      <g fill="white">
        <circle cx="9" cy="10.5" r="2.6" />
        <circle cx="22.5" cy="8.5" r="2.6" />
        <circle cx="24" cy="21" r="2.6" />
        <circle cx="11" cy="23.5" r="2.6" />
      </g>
    </svg>
  );
}

/** Mot-symbole « Stram·scale » : la racine Stramatel, et « scale » à l'accent de marque. */
export function StramscaleWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-semibold tracking-tight', className)}>
      Stram<span className="text-brand">scale</span>
    </span>
  );
}
