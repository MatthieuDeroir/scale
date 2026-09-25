'use client';

import { useQuery } from '@tanstack/react-query';
import { Layers, Search, SearchX, Server, Wifi } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Skeleton,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui';
import { fetchNodes, type FleetNode } from '../api';
import { parseFleetLabel } from '../lib';
import { MachineDetailPanel } from './MachineDetailPanel';

function formatLastSeen(lastSeen: string | null): string | null {
  if (!lastSeen) return null;
  return new Date(lastSeen).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function sortNodes(nodes: FleetNode[]): FleetNode[] {
  return [...nodes].sort((a, b) => {
    const fleetA = parseFleetLabel(a.tags);
    const fleetB = parseFleetLabel(b.tags);
    return fleetA === fleetB
      ? a.givenName.localeCompare(b.givenName)
      : fleetA.localeCompare(fleetB);
  });
}

function matchesQuery(node: FleetNode, query: string): boolean {
  const haystack = `${node.givenName} ${node.name} ${parseFleetLabel(node.tags)}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function FleetOverview() {
  const t = useTranslations('fleets');
  const { data, error } = useQuery({
    queryKey: ['fleets', 'nodes'],
    queryFn: fetchNodes,
    refetchInterval: 15000,
  });

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(
    () => (data ?? []).filter((node) => matchesQuery(node, query)),
    [data, query]
  );
  const knownTags = useMemo(
    () => Array.from(new Set((data ?? []).map((node) => node.tags[0]).filter(Boolean))),
    [data]
  );
  const selectedNode = data?.find((node) => node.id === selectedId) ?? null;

  const onlineCount = data?.filter((node) => node.online).length ?? 0;
  const fleetCount = new Set((data ?? []).map((node) => parseFleetLabel(node.tags))).size;

  return (
    <div className="flex flex-col gap-4">
      {data && data.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label={t('stats.total')} value={data.length} icon={Server} />
          <StatCard label={t('stats.online')} value={onlineCount} icon={Wifi} tone="ok" />
          <StatCard label={t('stats.fleets')} value={fleetCount} icon={Layers} />
        </div>
      )}

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
            <TableSkeleton />
          ) : data.length === 0 ? (
            <EmptyState icon={Server} title={t('empty')} />
          ) : (
            <>
              <div className="relative mb-4 max-w-xs">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('search')}
                  className="pl-8"
                />
              </div>

              {filtered.length === 0 ? (
                <EmptyState icon={SearchX} title={t('noMatch')} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>{t('columns.machine')}</TableHead>
                      <TableHead>{t('columns.fleet')}</TableHead>
                      <TableHead>{t('columns.address')}</TableHead>
                      <TableHead>{t('columns.status')}</TableHead>
                      <TableHead>{t('columns.lastSeen')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortNodes(filtered).map((node) => (
                      <TableRow
                        key={node.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedId(node.id)}
                      >
                        <TableCell className="font-medium">
                          {node.givenName || node.name}
                        </TableCell>
                        <TableCell>{parseFleetLabel(node.tags)}</TableCell>
                        <TableCell className="tabular-nums">
                          {node.ipAddresses.join(', ')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={node.online ? 'ok' : 'critical'}>
                            {node.online ? t('online') : t('offline')}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatLastSeen(node.lastSeen) ?? t('never')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {selectedNode && (
        <MachineDetailPanel
          node={selectedNode}
          knownTags={knownTags}
          open={selectedNode !== null}
          onOpenChange={(open) => !open && setSelectedId(null)}
        />
      )}
    </div>
  );
}
