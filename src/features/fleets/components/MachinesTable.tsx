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
import { isHypervision, isMaster, parseFleetLabel } from '../lib';
import { MasterBadge } from './MasterBadge';
import { StatusDot } from './StatusDot';

export function formatLastSeen(lastSeen: string | null): string | null {
  if (!lastSeen) return null;
  return new Date(lastSeen).toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  });
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
  showSystem = false,
  fleetLabel = (node: FleetNode) => parseFleetLabel(node.tags),
  pageSize = 25,
  selection,
}: {
  nodes: FleetNode[];
  onSelect?: (node: FleetNode) => void;
  showFleet?: boolean;
  /** Colonne OS et mises à jour en attente (inventaire de l'agent). */
  showSystem?: boolean;
  /** Libellé de flotte à afficher (nom lisible de la fiche, par exemple). */
  fleetLabel?: (node: FleetNode) => string;
  pageSize?: number;
  /** Cases à cocher pour les actions groupées ; « tout » porte sur la page affichée. */
  selection?: {
    selected: Set<string>;
    onChange: (next: Set<string>) => void;
    label: (name: string) => string;
    allLabel: string;
  };
}) {
  const t = useTranslations('fleets');
  const pagination = usePagination(nodes, pageSize);

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {selection && (
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="size-4 accent-brand"
                  aria-label={selection.allLabel}
                  checked={
                    pagination.items.length > 0 &&
                    pagination.items.every((node) => selection.selected.has(node.id))
                  }
                  onChange={(event) => {
                    const next = new Set(selection.selected);
                    for (const node of pagination.items) {
                      if (event.target.checked) next.add(node.id);
                      else next.delete(node.id);
                    }
                    selection.onChange(next);
                  }}
                />
              </TableHead>
            )}
            <TableHead>{t('columns.machine')}</TableHead>
            {showFleet && <TableHead>{t('columns.fleet')}</TableHead>}
            {showSystem && <TableHead className="hidden lg:table-cell">{t('columns.system')}</TableHead>}
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
                {selection && (
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="size-4 accent-brand"
                      aria-label={selection.label(node.givenName || node.name)}
                      checked={selection.selected.has(node.id)}
                      onChange={() => {
                        const next = new Set(selection.selected);
                        if (next.has(node.id)) next.delete(node.id);
                        else next.add(node.id);
                        selection.onChange(next);
                      }}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <span className="flex items-center gap-2.5">
                    <StatusDot
                      online={node.online}
                      label={node.online ? t('online') : t('offline')}
                    />
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="font-medium">{node.givenName || node.name}</span>
                    {isMaster(node.tags) && <MasterBadge />}
                  </span>
                </TableCell>
                {showFleet && <TableCell>{fleetLabel(node)}</TableCell>}
                {showSystem && (
                  <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                    {node.inventory ? (
                      <span className="flex items-center gap-2">
                        {node.inventory.os}
                        {node.inventory.upgradableCount > 0 && (
                          <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-700 dark:text-amber-400">
                            {t('updates', { count: node.inventory.upgradableCount })}
                          </span>
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                )}
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
