'use client';

import { useQuery } from '@tanstack/react-query';
import { StatusDot, fleetSlug, formatLastSeen } from '@/features/fleets';
import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
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
  usePermissions,
} from '@/shared/ui';
import { fetchPlan } from '../api';
import { freeSlots, unassignedNodes, useAssignNodes, useFleetOptions, useNodes, usePolicy } from '../lib';
import { orderedSlots } from './FleetPlan';

/**
 * Boîte de réception des machines auto-enrôlées (`tag:a-assigner`) : elles
 * n'ont aucun accès sortant tant qu'on ne les a pas rangées. Sélection
 * multiple, pour affecter d'un coup un lot de NUC sortis d'atelier : elles
 * pourvoient dans l'ordre les emplacements libres du plan de la flotte, dont
 * elles prennent le nom, le produit et le rôle.
 */
export function UnassignedInbox() {
  const t = useTranslations('parc');
  const tf = useTranslations('fleets');
  const { operate } = usePermissions();
  const nodesQuery = useNodes();
  const policyQuery = usePolicy();

  const nodes = useMemo(() => unassignedNodes(nodesQuery.data ?? []), [nodesQuery.data]);
  const fleets = useFleetOptions();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState('');

  // Une machine assignée entre-temps (autre onglet, autre admin) sort de la sélection.
  const chosen = nodes.filter((node) => selected.has(node.id));
  const allChecked = nodes.length > 0 && chosen.length === nodes.length;

  const mutation = useAssignNodes(() => setSelected(new Set()));
  const plan = useQuery({
    queryKey: ['plan', target],
    queryFn: () => fetchPlan(target),
    enabled: Boolean(target),
  });
  const free = freeSlots(orderedSlots(plan.data ?? []));
  const missing = Math.max(0, chosen.length - free.length);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const header = <PageHeader title={t('inbox.title')} description={t('inbox.description')} />;

  if (nodesQuery.isPending || policyQuery.isPending) {
    return (
      <>
        {header}
        <Skeleton className="h-48 w-full" />
      </>
    );
  }

  const error = nodesQuery.error ?? policyQuery.error;
  if (error) {
    return (
      <>
        {header}
        <Badge variant="critical" role="alert" className="w-fit">
          {error.message}
        </Badge>
      </>
    );
  }

  if (nodes.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={CheckCircle2}
          title={t('inbox.empty')}
          description={t('inbox.emptyHint')}
        />
      </>
    );
  }

  return (
    <>
      {header}

      {operate && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3">
          <span className="text-sm text-muted-foreground tabular-nums">
            {t('inbox.selected', { count: chosen.length })}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="w-56" aria-label={t('inbox.targetFleet')}>
                <SelectValue placeholder={t('inbox.targetFleet')} />
              </SelectTrigger>
              <SelectContent>
                {fleets.map((fleet) => (
                  <SelectItem key={fleet.tag} value={fleet.tag}>
                    {fleet.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="brand"
              disabled={chosen.length === 0 || !target || missing > 0 || plan.isPending || mutation.isPending}
              onClick={() => mutation.mutate({ nodes: chosen, slots: free, fleetTag: target })}
            >
              {mutation.isPending
                ? t('inbox.assigning')
                : t('inbox.assign', { count: chosen.length })}
            </Button>
          </div>
          {target && plan.data && (
            <p className="basis-full text-xs text-muted-foreground" role="status">
              {missing > 0 ? (
                <>
                  {t('inbox.missingSlots', { count: missing })}{' '}
                  <Link className="font-medium text-foreground underline" href={`/flottes/${fleetSlug(target)}#plan`}>
                    {t('inbox.openPlan')}
                  </Link>
                </>
              ) : chosen.length > 0 ? (
                t('inbox.willFill', { slots: free.slice(0, chosen.length).map((slot) => slot.label).join(', ') })
              ) : (
                t('inbox.freeSlots', { count: free.length })
              )}
            </p>
          )}
        </div>
      )}

      <Card className="px-2">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {operate && (
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    aria-label={t('inbox.selectAll')}
                    className="size-4 accent-brand"
                    checked={allChecked}
                    onChange={() =>
                      setSelected(allChecked ? new Set() : new Set(nodes.map((node) => node.id)))
                    }
                  />
                </TableHead>
              )}
              <TableHead>{tf('columns.machine')}</TableHead>
              <TableHead>{tf('columns.address')}</TableHead>
              <TableHead className="text-right">{tf('columns.lastSeen')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nodes.map((node) => {
              const name = node.givenName || node.name;
              return (
                <TableRow
                  key={node.id}
                  className={operate ? 'cursor-pointer' : undefined}
                  onClick={operate ? () => toggle(node.id) : undefined}
                >
                  {operate && (
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={t('inbox.select', { name })}
                        className="size-4 accent-brand"
                        checked={selected.has(node.id)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => toggle(node.id)}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <span className="flex items-center gap-2.5">
                      <StatusDot
                        online={node.online}
                        label={node.online ? tf('online') : tf('offline')}
                      />
                      <span className="flex flex-col">
                        <span className="font-medium">{name}</span>
                        {(node.enrollment?.serial || node.enrollment?.model) && (
                          <span className="text-xs text-muted-foreground">
                            {[
                              node.enrollment.serial && t('inbox.serial', { serial: node.enrollment.serial }),
                              node.enrollment.model,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {node.ipAddresses[0] ?? '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {node.online ? tf('online') : (formatLastSeen(node.lastSeen) ?? tf('never'))}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
