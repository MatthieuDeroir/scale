'use client';

import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui';
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
  const [copied, setCopied] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('revealTitle')}</CardTitle>
        <CardDescription>{t('revealWarning')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <code className="break-all rounded-md bg-muted p-3 text-sm">{accessKey.key}</code>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(accessKey.key);
              setCopied(true);
            }}
          >
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? t('copied') : t('copy')}
          </Button>
          <Button variant="brand" onClick={onDismiss}>
            {t('dismiss')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
