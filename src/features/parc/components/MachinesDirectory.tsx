'use client';

import {
  MachineDetailPanel,
  MachinesTable,
  UNASSIGNED_TAG,
  fleetTagOf,
  isHypervision,
  type FleetNode,
} from '@/features/fleets';
import { Search, Server } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import {
  Badge,
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
} from '@/shared/ui';
import { nodeMatches, useNodes, usePolicy } from '../lib';

const ALL = 'all';

/** Tout le parc à plat : retrouver une machine sans savoir dans quelle flotte elle vit. */
export function MachinesDirectory() {
  const t = useTranslations('parc');
  const nodesQuery = useNodes();
  const policyQuery = usePolicy();

  const [query, setQuery] = useState('');
  const [fleet, setFleet] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [kind, setKind] = useState(ALL);
  const [selected, setSelected] = useState<FleetNode | null>(null);

  const policyFleets = useMemo(() => policyQuery.data?.fleets ?? [], [policyQuery.data]);
  const nodes = useMemo(() => {
    const q = query.trim();
    return (nodesQuery.data ?? [])
      .filter((node) => nodeMatches(node, q))
      .filter((node) => fleet === ALL || fleetTagOf(node.tags) === fleet)
      .filter((node) => status === ALL || node.online === (status === 'online'))
      .filter((node) => kind === ALL || isHypervision(node.tags) === (kind === 'hypervision'))
      .sort((a, b) => (a.givenName || a.name).localeCompare(b.givenName || b.name));
  }, [nodesQuery.data, query, fleet, status, kind]);

  const header = <PageHeader title={t('machines.title')} description={t('machines.description')} />;
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

  return (
    <>
      {header}
      {error && (
        <Badge variant="critical" role="alert" className="w-fit">
          {error.message}
        </Badge>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
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
            {policyFleets.map((item) => (
              <SelectItem key={item.tag} value={item.tag}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36" aria-label={t('machines.filterStatus')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('machines.allStatus')}</SelectItem>
            <SelectItem value="online">{t('machines.online')}</SelectItem>
            <SelectItem value="offline">{t('machines.offline')}</SelectItem>
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

      {nodes.length === 0 ? (
        <EmptyState icon={Server} title={total === 0 ? t('machines.none') : t('machines.noResult')} />
      ) : (
        <Card className="px-4 pt-1 pb-3">
          {/* key : revenir en page 1 dès qu'un filtre change. */}
          <MachinesTable
            key={`${query}|${fleet}|${status}|${kind}`}
            nodes={nodes}
            onSelect={setSelected}
            showFleet
            pageSize={50}
          />
        </Card>
      )}

      {selected && (
        <MachineDetailPanel
          key={selected.id}
          node={selected}
          fleets={policyFleets}
          open
          onOpenChange={(open) => !open && setSelected(null)}
        />
      )}
    </>
  );
}
