'use client';

import { StatusDot, formatLastSeen } from '@/features/fleets';
import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
} from '@/shared/ui';
import { unassignedNodes, useAssignNodes, useNodes, usePolicy } from '../lib';

/**
 * Boîte de réception des machines auto-enrôlées (`tag:a-assigner`) : elles
 * n'ont aucun accès sortant tant qu'on ne les a pas rangées. Sélection
 * multiple, pour affecter d'un coup un lot de NUC sortis d'atelier.
 */
export function UnassignedInbox() {
  const t = useTranslations('parc');
  const tf = useTranslations('fleets');
  const nodesQuery = useNodes();
  const policyQuery = usePolicy();

  const nodes = useMemo(() => unassignedNodes(nodesQuery.data ?? []), [nodesQuery.data]);
  const fleets = policyQuery.data?.fleets ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState('');

  // Une machine assignée entre-temps (autre onglet, autre admin) sort de la sélection.
  const chosen = nodes.filter((node) => selected.has(node.id));
  const allChecked = nodes.length > 0 && chosen.length === nodes.length;

  const mutation = useAssignNodes(() => setSelected(new Set()));

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
        <EmptyState icon={CheckCircle2} title={t('inbox.empty')} description={t('inbox.emptyHint')} />
      </>
    );
  }

  return (
    <>
      {header}

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
            disabled={chosen.length === 0 || !target || mutation.isPending}
            onClick={() => mutation.mutate({ nodes: chosen, fleetTag: target })}
          >
            {mutation.isPending ? t('inbox.assigning') : t('inbox.assign', { count: chosen.length })}
          </Button>
        </div>
      </div>

      <Card className="px-2">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
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
              <TableHead>{tf('columns.machine')}</TableHead>
              <TableHead>{tf('columns.address')}</TableHead>
              <TableHead className="text-right">{tf('columns.lastSeen')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nodes.map((node) => {
              const name = node.givenName || node.name;
              return (
                <TableRow key={node.id} className="cursor-pointer" onClick={() => toggle(node.id)}>
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
                  <TableCell>
                    <span className="flex items-center gap-2.5">
                      <StatusDot online={node.online} label={node.online ? tf('online') : tf('offline')} />
                      <span className="font-medium">{name}</span>
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
