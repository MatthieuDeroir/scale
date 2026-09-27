import Image from 'next/image';
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

/** Proportions de `stram-light.png` (lettres « STRAM » découpées dans le logo Stramatel). */
const STRAM_RATIO = 835 / 161;

/**
 * Mot-symbole : « STRAM » tiré du logo Stramatel (le S rouge et les lettres
 * obliques de la marque), puis « SCALE » dans le rouge de la charte, penché
 * et espacé pour rester dans le même dessin. Prévu pour fond sombre.
 */
export function StramscaleWordmark({ height = 18, className }: { height?: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-end gap-[0.18em]', className)} style={{ fontSize: height }} aria-label="Stramscale" role="img">
      <Image
        src="/images/stram-light.png"
        alt=""
        width={Math.round(height * STRAM_RATIO)}
        height={height}
        className="block shrink-0"
        style={{ height, width: 'auto' }}
        priority
      />
      <span
        aria-hidden
        className="font-medium uppercase leading-none tracking-[0.14em] text-brand"
        style={{ fontSize: height * 1.12, transform: 'skewX(-12deg)', marginBottom: -height * 0.06 }}
      >
        scale
      </span>
    </span>
  );
}
