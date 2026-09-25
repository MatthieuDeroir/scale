import type { ComponentType, ReactNode } from 'react';
import { cn } from '../lib';

/** Icône + message, plutôt qu'une ligne de texte perdue dans une carte vide. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center',
        className
      )}
    >
      <Icon className="size-8 text-muted-foreground/60" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
