'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MachinesTable,
  UNASSIGNED_TAG,
  deleteNode,
  fleetTagOf,
  formatLastSeen,
  isHypervision,
  retagNode,
  withFleet,
  type FleetNode,
} from '@/features/fleets';
import { Download, Search, Server } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  usePermissions,
} from '@/shared/ui';
import { datedFilename, downloadFile, toCsv } from '@/shared/lib';
import {
  fleetLabelResolver,
  nodeMatches,
  summarizeFleets,
  useFleetOptions,
  useNodes,
  usePolicy,
  useProfiles,
} from '../lib';

const ALL = 'all';
const STALE_DAYS = 30;

/** Hors ligne depuis plus de 30 jours : candidate au nettoyage (fantôme, machine démontée). */
export function isStale(node: FleetNode, now = Date.now()): boolean {
  if (node.online) return false;
  const seen = node.lastSeen ? new Date(node.lastSeen).getTime() : 0;
  return now - seen > STALE_DAYS * 24 * 60 * 60 * 1000;
}

type BulkAction = 'retag' | 'delete';

/** Tout le parc à plat : retrouver une machine sans savoir dans quelle flotte elle vit. */
export function MachinesDirectory() {
  const t = useTranslations('parc');
  const router = useRouter();
  const { operate } = usePermissions();
  const queryClient = useQueryClient();
  const nodesQuery = useNodes();
  const policyQuery = usePolicy();
  const profilesQuery = useProfiles();
  const fleetOptions = useFleetOptions();

  const [query, setQuery] = useState('');
  const [fleet, setFleet] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [kind, setKind] = useState(ALL);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState('');
  const [confirming, setConfirming] = useState<BulkAction | null>(null);

  const fleetLabel = useMemo(
    () =>
      fleetLabelResolver(
        summarizeFleets(policyQuery.data?.fleets ?? [], nodesQuery.data ?? [], profilesQuery.data ?? [])
      ),
    [policyQuery.data, nodesQuery.data, profilesQuery.data]
  );
  const nodes = useMemo(() => {
    const q = query.trim();
    return (nodesQuery.data ?? [])
      .filter((node) => nodeMatches(node, q))
      .filter((node) => fleet === ALL || fleetTagOf(node.tags) === fleet)
      .filter((node) =>
        status === ALL ? true : status === 'stale' ? isStale(node) : node.online === (status === 'online')
      )
      .filter((node) => kind === ALL || isHypervision(node.tags) === (kind === 'hypervision'))
      .sort((a, b) => (a.givenName || a.name).localeCompare(b.givenName || b.name));
  }, [nodesQuery.data, query, fleet, status, kind]);

  const chosen = (nodesQuery.data ?? []).filter((node) => checked.has(node.id));

  const bulk = useMutation({
    mutationFn: async (action: BulkAction) => {
      const results = await Promise.allSettled(
        chosen.map((node) =>
          action === 'retag'
            ? retagNode(node.id, withFleet(node.tags, target))
            : deleteNode(node.id)
        )
      );
      return { total: chosen.length, failed: results.filter((r) => r.status === 'rejected').length };
    },
    onSuccess: async ({ total, failed }) => {
      await queryClient.invalidateQueries({ queryKey: ['fleets', 'nodes'] });
      if (total - failed > 0) toast.success(t('machines.bulkDone', { count: total - failed }));
      if (failed > 0) toast.error(t('machines.bulkFailed', { count: failed }));
      setChecked(new Set());
      setConfirming(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function run(action: BulkAction) {
    if (confirming === action) bulk.mutate(action);
    else setConfirming(action);
  }

  function exportCsv() {
    downloadFile(
      datedFilename('machines-stramscale'),
      toCsv([
        ['Machine', 'Flotte', 'Type', 'Adresse', 'État', 'Dernière connexion', 'N° de série', 'Modèle'],
        ...nodes.map((node) => [
          node.givenName || node.name,
          fleetLabel(node),
          isHypervision(node.tags) ? t('machines.hypervision') : t('machines.equipment'),
          node.ipAddresses.join(' '),
          node.online ? t('machines.online') : t('machines.offline'),
          formatLastSeen(node.lastSeen) ?? '',
          node.enrollment?.serial ?? '',
          node.enrollment?.model ?? '',
        ]),
      ])
    );
  }

  const header = (
    <PageHeader
      title={t('machines.title')}
      description={t('machines.description')}
      actions={
        nodes.length > 0 && (
          <Button variant="outline" onClick={exportCsv}>
            <Download aria-hidden />
            {t('machines.export')}
          </Button>
        )
      }
    />
  );
  if (nodesQuery.isPending || policyQuery.isPending) {
    return (
      <>
        {header}
        <Skeleton className="h-96 w-full" />
      </>
    );
  }

  const error = nodesQuery.error ?? policyQuery.error;
  const total = nodesQuery.data?.length ?? 0;
  const staleCount = (nodesQuery.data ?? []).filter((node) => isStale(node)).length;

  return (
    <>
      {header}
      {error && (
        <Badge variant="critical" role="alert" className="w-fit">
          {error.message}
        </Badge>
      )}

      {operate && staleCount > 0 && status !== 'stale' && (
        <button
          type="button"
          onClick={() => setStatus('stale')}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed px-4 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted/40"
        >
          {t('machines.staleHint', { count: staleCount, days: STALE_DAYS })}
        </button>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            aria-label={t('machines.search')}
            placeholder={t('machines.search')}
            className="pl-8"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Select value={fleet} onValueChange={setFleet}>
          <SelectTrigger className="w-44" aria-label={t('machines.filterFleet')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('machines.allFleets')}</SelectItem>
            <SelectItem value={UNASSIGNED_TAG}>{t('machines.unassigned')}</SelectItem>
            {fleetOptions.map((item) => (
              <SelectItem key={item.tag} value={item.tag}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44" aria-label={t('machines.filterStatus')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('machines.allStatus')}</SelectItem>
            <SelectItem value="online">{t('machines.online')}</SelectItem>
            <SelectItem value="offline">{t('machines.offline')}</SelectItem>
            <SelectItem value="stale">{t('machines.stale', { days: STALE_DAYS })}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-44" aria-label={t('machines.filterKind')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('machines.allKinds')}</SelectItem>
            <SelectItem value="hypervision">{t('machines.hypervision')}</SelectItem>
            <SelectItem value="equipment">{t('machines.equipment')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {operate && chosen.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-2.5">
          <span className="mr-auto text-sm tabular-nums">
            {t('machines.selected', { count: chosen.length })}
          </span>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="w-48" aria-label={t('inbox.targetFleet')}>
              <SelectValue placeholder={t('inbox.targetFleet')} />
            </SelectTrigger>
            <SelectContent>
              {fleetOptions.map((item) => (
                <SelectItem key={item.tag} value={item.tag}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant={confirming === 'retag' ? 'brand' : 'outline'}
            disabled={!target || bulk.isPending}
            onClick={() => run('retag')}
          >
            {confirming === 'retag' ? t('machines.confirm') : t('machines.bulkRetag')}
          </Button>
          <Button
            size="sm"
            variant={confirming === 'delete' ? 'destructive' : 'outline'}
            disabled={bulk.isPending}
            onClick={() => run('delete')}
          >
            {confirming === 'delete' ? t('machines.confirm') : t('machines.bulkDelete')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setChecked(new Set())}>
            {t('machines.clearSelection')}
          </Button>
        </div>
      )}

      {operate && confirming === 'delete' && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm">
          {t('machines.bulkDeleteWarning')}
        </p>
      )}

      {nodes.length === 0 ? (
        <EmptyState icon={Server} title={total === 0 ? t('machines.none') : t('machines.noResult')} />
      ) : (
        <Card className="px-4 pt-1 pb-3">
          {/* key : revenir en page 1 dès qu'un filtre change. */}
          <MachinesTable
            key={`${query}|${fleet}|${status}|${kind}`}
            nodes={nodes}
            onSelect={(node) => router.push(`/machines/${node.id}`)}
            showFleet
            showSystem
            fleetLabel={fleetLabel}
            pageSize={50}
            selection={
              operate
                ? {
                    selected: checked,
                    onChange: (next) => {
                      setChecked(next);
                      setConfirming(null);
                    },
                    label: (name) => t('inbox.select', { name }),
                    allLabel: t('inbox.selectAll'),
                  }
                : undefined
            }
          />
        </Card>
      )}

    </>
  );
}
