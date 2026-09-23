'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, Radio, Timer } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui';
import { fetchHealth } from '../api';

/**
 * Le socle affiche l'état de la source matérielle dès la première page.
 * Sur un équipement posé chez un client, « est-ce que ça reçoit ? » est la
 * première question, et elle ne doit pas demander un accès SSH.
 */
export function HealthPanel() {
  const t = useTranslations('health');
  const { data, error } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 5000,
  });

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="size-4 text-muted-foreground" aria-hidden />
          {t('source')}
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <Badge variant="critical" role="alert">
            {error.message}
          </Badge>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        ) : (
          <>
            <Badge variant={data.source.fresh ? 'ok' : 'warning'}>
              <Activity className="size-3" aria-hidden />
              {data.source.fresh ? t('receiving') : t('silent')}
            </Badge>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t('lastFrame')}</dt>
              <dd className="tabular-nums">{data.source.lastFrameAt ?? t('never')}</dd>

              <dt className="text-muted-foreground">{t('frameCount')}</dt>
              <dd className="tabular-nums">{data.source.frameCount}</dd>

              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <Timer className="size-3.5" aria-hidden />
                {t('uptime')}
              </dt>
              <dd className="tabular-nums">{data.uptimeSeconds} s</dd>
            </dl>
          </>
        )}
      </CardContent>
    </Card>
  );
}
