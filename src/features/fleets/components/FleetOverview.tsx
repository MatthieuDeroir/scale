'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui';
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
          <>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('search')}
              className="mb-4 h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />

            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noMatch')}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 font-medium">{t('columns.machine')}</th>
                    <th className="py-2 font-medium">{t('columns.fleet')}</th>
                    <th className="py-2 font-medium">{t('columns.address')}</th>
                    <th className="py-2 font-medium">{t('columns.status')}</th>
                    <th className="py-2 font-medium">{t('columns.lastSeen')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortNodes(filtered).map((node) => (
                    <tr
                      key={node.id}
                      className="cursor-pointer border-b last:border-0 hover:bg-accent"
                      onClick={() => setSelectedId(node.id)}
                    >
                      <td className="py-2">{node.givenName || node.name}</td>
                      <td className="py-2">{parseFleetLabel(node.tags)}</td>
                      <td className="py-2 tabular-nums">{node.ipAddresses.join(', ')}</td>
                      <td className="py-2">
                        <Badge variant={node.online ? 'ok' : 'critical'}>
                          {node.online ? t('online') : t('offline')}
                        </Badge>
                      </td>
                      <td className="py-2 tabular-nums">
                        {formatLastSeen(node.lastSeen) ?? t('never')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </CardContent>

      {selectedNode && (
        <MachineDetailPanel
          node={selectedNode}
          knownTags={knownTags}
          open={selectedNode !== null}
          onOpenChange={(open) => !open && setSelectedId(null)}
        />
      )}
    </Card>
  );
}
