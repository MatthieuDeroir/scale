import type { ComponentType } from 'react';
import { cn } from '../lib';
import { Card, CardContent } from './card';

/** Chiffre clé + icône, pour un bandeau de synthèse en haut d'écran. */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
  className,
}: {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  tone?: 'default' | 'ok' | 'critical';
  className?: string;
}) {
  return (
    <Card className={cn('shadow-xs', className)}>
      <CardContent className="flex items-center gap-3 py-4">
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md',
            tone === 'ok' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
            tone === 'critical' && 'bg-destructive/15 text-destructive',
            tone === 'default' && 'bg-brand/10 text-brand'
          )}
        >
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-semibold leading-none tabular-nums">{value}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      </CardContent>
    </Card>
  );
}
