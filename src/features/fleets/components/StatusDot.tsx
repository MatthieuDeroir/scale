import { cn } from '@/shared/lib';

/** Pastille d'état : lisible d'un coup d'œil sur une longue liste, là où un badge texte encombre. */
export function StatusDot({ online, label }: { online: boolean; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        online
          ? 'bg-emerald-500 shadow-[0_0_0_3px] shadow-emerald-500/20'
          : 'bg-muted-foreground/40'
      )}
    />
  );
}
