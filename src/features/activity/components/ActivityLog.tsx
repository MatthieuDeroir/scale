'use client';

import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui';
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
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <EmptyState icon={History} title={t('empty')} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('columns.at')}</TableHead>
                <TableHead>{t('columns.actor')}</TableHead>
                <TableHead>{t('columns.action')}</TableHead>
                <TableHead>{t('columns.target')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatDate(event.at)}
                  </TableCell>
                  <TableCell className="font-medium">{event.actor}</TableCell>
                  <TableCell>
                    <Badge variant={event.action.endsWith('failed') ? 'critical' : 'outline'}>
                      {t(`actions.${event.action}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{event.target ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
