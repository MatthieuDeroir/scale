'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, History, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  usePagination,
} from '@/shared/ui';
import { datedFilename, downloadFile, toCsv } from '@/shared/lib';
import { fetchActivity, type ActivityEvent } from '../api';

const ALL = 'all';
/** Famille d'une action, d'après son préfixe : `keys-create` → `keys`. */
const CATEGORIES = ['auth', 'keys', 'fleets', 'acl', 'provisioning', 'users'] as const;

function categoryOf(action: string): string {
  return action.split('-')[0];
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' });
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function ActivityLog() {
  const t = useTranslations('activity');
  const { data, error } = useQuery({
    queryKey: ['activity'],
    queryFn: fetchActivity,
    refetchInterval: 15000,
  });

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL);
  const [actor, setActor] = useState(ALL);

  const label = (action: string) => {
    const key = `actions.${action}`;
    // Une action inconnue (ajoutée côté serveur sans libellé) reste lisible telle quelle.
    return t.has(key) ? t(key) : action;
  };

  const events = useMemo(() => data?.events ?? [], [data]);
  const actors = useMemo(() => [...new Set(events.map((event) => event.actor))].sort(), [events]);
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return events.filter(
      (event) =>
        (category === ALL || categoryOf(event.action) === category) &&
        (actor === ALL || event.actor === actor) &&
        (!q ||
          [event.actor, event.target ?? '', event.action].some((value) => normalize(value).includes(q)))
    );
  }, [events, query, category, actor]);
  const pagination = usePagination(filtered, 50);

  function exportCsv(rows: ActivityEvent[]) {
    downloadFile(
      datedFilename('journal-stramscale'),
      toCsv([
        [t('columns.at'), t('columns.actor'), t('columns.action'), t('columns.target')],
        ...rows.map((event) => [event.at, event.actor, label(event.action), event.target]),
      ])
    );
  }

  if (error) {
    return (
      <Badge variant="critical" role="alert" className="w-fit">
        {error.message}
      </Badge>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>
    );
  }
  if (events.length === 0) return <EmptyState icon={History} title={t('empty')} />;

  const reset = () => pagination.setPage(0);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            aria-label={t('search')}
            placeholder={t('search')}
            className="pl-8"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              reset();
            }}
          />
        </div>
        <Select
          value={category}
          onValueChange={(value) => {
            setCategory(value);
            reset();
          }}
        >
          <SelectTrigger className="w-44" aria-label={t('category')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('categories.all')}</SelectItem>
            {CATEGORIES.map((item) => (
              <SelectItem key={item} value={item}>
                {t(`categories.${item}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={actor}
          onValueChange={(value) => {
            setActor(value);
            reset();
          }}
        >
          <SelectTrigger className="w-40" aria-label={t('columns.actor')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allActors')}</SelectItem>
            {actors.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => exportCsv(filtered)} disabled={filtered.length === 0}>
          <Download aria-hidden />
          {t('export')}
        </Button>
      </div>

      <Card className="px-4 pt-1 pb-3">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('noResult')}</p>
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
                {pagination.items.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                      {formatDate(event.at)}
                    </TableCell>
                    <TableCell className="font-medium">{event.actor}</TableCell>
                    <TableCell>
                      <Badge variant={event.action.endsWith('failed') ? 'critical' : 'outline'}>
                        {label(event.action)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{event.target ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Pagination {...pagination} label={(range) => t('pagination', range)} />
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        {t('retention', { days: data.retentionDays, shown: events.length, total: data.total })}
      </p>
    </>
  );
}
