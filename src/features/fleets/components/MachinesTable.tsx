'use client';

import { Monitor, Server } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  usePagination,
} from '@/shared/ui';
import type { FleetNode } from '../api';
import { isHypervision, parseFleetLabel } from '../lib';
import { StatusDot } from './StatusDot';

export function formatLastSeen(lastSeen: string | null): string | null {
  if (!lastSeen) return null;
  return new Date(lastSeen).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Tableau de machines, purement présentationnel : la page qui l'utilise
 * décide de ce qu'il affiche (une flotte, tout le parc, les « à assigner »).
 * Paginé — une flotte peut avoir une machine ou trois cents.
 */
export function MachinesTable({
  nodes,
  onSelect,
  showFleet = false,
  pageSize = 25,
}: {
  nodes: FleetNode[];
  onSelect?: (node: FleetNode) => void;
  showFleet?: boolean;
  pageSize?: number;
}) {
  const t = useTranslations('fleets');
  const pagination = usePagination(nodes, pageSize);

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{t('columns.machine')}</TableHead>
            {showFleet && <TableHead>{t('columns.fleet')}</TableHead>}
            <TableHead>{t('columns.address')}</TableHead>
            <TableHead className="text-right">{t('columns.lastSeen')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagination.items.map((node) => {
            const Icon = isHypervision(node.tags) ? Monitor : Server;
            return (
              <TableRow
                key={node.id}
                className={onSelect ? 'cursor-pointer' : undefined}
                onClick={onSelect ? () => onSelect(node) : undefined}
              >
                <TableCell>
                  <span className="flex items-center gap-2.5">
                    <StatusDot online={node.online} label={node.online ? t('online') : t('offline')} />
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="font-medium">{node.givenName || node.name}</span>
                  </span>
                </TableCell>
                {showFleet && <TableCell>{parseFleetLabel(node.tags)}</TableCell>}
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {node.ipAddresses[0] ?? '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {node.online ? t('online') : (formatLastSeen(node.lastSeen) ?? t('never'))}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Pagination {...pagination} label={(range) => t('pagination', range)} />
    </div>
  );
}
