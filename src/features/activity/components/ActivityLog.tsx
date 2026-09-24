'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui';
import { fetchActivity } from '../api';

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' });
}

export function ActivityLog() {
  const t = useTranslations('activity');
  const { data, error } = useQuery({
    queryKey: ['activity'],
    queryFn: fetchActivity,
    refetchInterval: 15000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <Badge variant="critical" role="alert">
            {error.message}
          </Badge>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-medium">{t('columns.at')}</th>
                <th className="py-2 font-medium">{t('columns.actor')}</th>
                <th className="py-2 font-medium">{t('columns.action')}</th>
                <th className="py-2 font-medium">{t('columns.target')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((event) => (
                <tr key={event.id} className="border-b last:border-0">
                  <td className="py-2 tabular-nums">{formatDate(event.at)}</td>
                  <td className="py-2">{event.actor}</td>
                  <td className="py-2">{t(`actions.${event.action}`)}</td>
                  <td className="py-2 font-mono text-xs">{event.target ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
