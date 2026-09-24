'use client';

import { useTranslations } from 'next-intl';
import { SecretReveal } from '@/shared/ui';
import type { NewAccessKey } from '../api';

/**
 * Headscale ne renvoie la valeur en clair qu'à la création — jamais revue
 * ensuite (vérifié : `GET /api/v1/preauthkey` la masque). D'où l'avertissement
 * explicite plutôt qu'un simple affichage.
 */
export function NewKeyReveal({
  accessKey,
  onDismiss,
}: {
  accessKey: NewAccessKey;
  onDismiss: () => void;
}) {
  const t = useTranslations('keys');

  return (
    <SecretReveal
      title={t('revealTitle')}
      description={t('revealWarning')}
      value={accessKey.key}
      copyLabel={t('copy')}
      copiedLabel={t('copied')}
      dismissLabel={t('dismiss')}
      onDismiss={onDismiss}
    />
  );
}
