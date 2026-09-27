import { Crown } from 'lucide-react';

/** Repère du NUC MASTER d'une flotte, là où la machine est citée. */
export function MasterBadge({ label = 'MASTER' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-700 dark:text-amber-400">
      <Crown className="size-3" aria-hidden />
      {label}
    </span>
  );
}
