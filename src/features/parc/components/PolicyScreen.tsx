'use client';

import { AccessRules, RawPolicyEditor } from '@/features/acl';
import { ChevronRight, Code2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/shared/ui';
import { useFleetOptions } from '../lib';

/** Politique d'accès : la lecture guidée d'abord, le HuJSON brut replié en dessous. */
export function PolicyScreen() {
  const t = useTranslations('parc');
  const fleets = useFleetOptions();

  return (
    <>
      <PageHeader title={t('policy.title')} description={t('policy.description')} />
      <AccessRules fleets={fleets} />
      <details className="group rounded-lg border bg-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-medium">
          <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
          <Code2 className="size-4 text-muted-foreground" aria-hidden />
          {t('policy.advanced')}
          <span className="font-normal text-muted-foreground">{t('policy.advancedHint')}</span>
        </summary>
        <div className="border-t px-5 py-4">
          <RawPolicyEditor />
        </div>
      </details>
    </>
  );
}
