'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui';
import { fetchNodes, type FleetNode } from '../api';
import { parseFleetLabel } from '../lib';

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

export function FleetOverview() {
  const t = useTranslations('fleets');
  const { data, error } = useQuery({
    queryKey: ['fleets', 'nodes'],
    queryFn: fetchNodes,
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
                <th className="py-2 font-medium">{t('columns.machine')}</th>
                <th className="py-2 font-medium">{t('columns.fleet')}</th>
                <th className="py-2 font-medium">{t('columns.address')}</th>
                <th className="py-2 font-medium">{t('columns.status')}</th>
                <th className="py-2 font-medium">{t('columns.lastSeen')}</th>
              </tr>
            </thead>
            <tbody>
              {sortNodes(data).map((node) => (
                <tr key={node.id} className="border-b last:border-0">
                  <td className="py-2">{node.givenName || node.name}</td>
                  <td className="py-2">{parseFleetLabel(node.tags)}</td>
                  <td className="py-2 tabular-nums">{node.ipAddresses.join(', ')}</td>
                  <td className="py-2">
                    <Badge variant={node.online ? 'ok' : 'critical'}>
                      {node.online ? t('online') : t('offline')}
                    </Badge>
                  </td>
                  <td className="py-2 tabular-nums">{formatLastSeen(node.lastSeen) ?? t('never')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
