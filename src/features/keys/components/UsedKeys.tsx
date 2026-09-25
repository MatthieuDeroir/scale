'use client';

import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AccessKey } from '../api';

const RECENT_DAYS = 7;

/** Clés émises ces derniers jours et déjà consommées : « la machine est bien arrivée ». */
export function recentlyUsed(keys: AccessKey[], now = new Date()): AccessKey[] {
  const since = now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  return keys.filter((key) => key.used && key.usedBy && new Date(key.createdAt).getTime() >= since);
}

export function UsedKeys({ keys }: { keys: AccessKey[] }) {
  const t = useTranslations('keys');
  return (
    <ul className="flex flex-col gap-1 py-1.5">
      {keys.map((key) => (
        <li key={key.id} className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <span>
            <span className="font-medium text-foreground">{t('usedBy', { name: key.usedBy!.name })}</span>
            {' · '}
            {new Date(key.usedBy!.at ?? key.createdAt).toLocaleString(undefined, {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}
