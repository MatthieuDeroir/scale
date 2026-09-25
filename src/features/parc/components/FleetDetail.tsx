'use client';

import { useQuery } from '@tanstack/react-query';
import { DeleteFleetButton } from '@/features/acl';
import {
  MachineDetailPanel,
  MachinesTable,
  isHypervision,
  tagFromSlug,
  formatLastSeen,
} from '@/features/fleets';
import {
  PendingKeys,
  UsedKeys,
  fetchKeys,
  isPending,
  recentlyUsed,
  type MachineKind,
} from '@/features/keys';
import { Download, KeyRound, Monitor, Plus, Search, Server, ShieldCheck } from 'lucide-react';
import { datedFilename, downloadFile, toCsv } from '@/shared/lib';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  PageHeader,
  Skeleton,
  usePermissions,
} from '@/shared/ui';
import { nodeMatches, summarizeFleets, useFleetOptions, useNodes, usePolicy, useProfiles } from '../lib';
import { FleetProfileCard } from './FleetProfileCard';
import { AddMachineDialog } from './AddMachineDialog';

/** Au-delà, un champ de recherche apparaît : inutile pour trois machines. */
const SEARCH_THRESHOLD = 10;

function Section({
  icon: Icon,
  title,
  description,
  count,
  action,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="px-5 pt-5 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="flex items-center gap-2 text-base">
              <Icon className="size-4 text-muted-foreground" aria-hidden />
              {title}
              {count !== undefined && <Badge variant="secondary">{count}</Badge>}
            </CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">{children}</CardContent>
    </Card>
  );
}

/**
 * Une flotte = un réseau client cloisonné. On y voit ce qui la compose
 * (postes d'hypervision du client, équipements Stramatel), on y ajoute une
 * machine en émettant une clé, et on suit les clés pas encore utilisées.
 */
export function FleetDetail({ slug }: { slug: string }) {
  const t = useTranslations('parc');
  const { operate } = usePermissions();
  const router = useRouter();
  const tag = tagFromSlug(slug);
  const nodesQuery = useNodes();
  const policyQuery = usePolicy();
  const profilesQuery = useProfiles();
  const fleetOptions = useFleetOptions();
  const keysQuery = useQuery({ queryKey: ['keys'], queryFn: fetchKeys });

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState<MachineKind | null>(null);

  const policyFleets = useMemo(() => policyQuery.data?.fleets ?? [], [policyQuery.data]);
  const fleet = useMemo(
    () =>
      summarizeFleets(policyFleets, nodesQuery.data ?? [], profilesQuery.data ?? []).find(
        (item) => item.tag === tag
      ),
    [policyFleets, nodesQuery.data, profilesQuery.data, tag]
  );
  const pendingKeys = useMemo(
    () => (keysQuery.data ?? []).filter((key) => isPending(key) && key.tags.includes(tag)),
    [keysQuery.data, tag]
  );
  const usedKeys = useMemo(
    () => recentlyUsed((keysQuery.data ?? []).filter((key) => key.tags.includes(tag))),
    [keysQuery.data, tag]
  );

  if (nodesQuery.isPending || policyQuery.isPending) return <Skeleton className="h-96 w-full" />;

  const back = { href: '/', label: t('fleet.back') };
  const error = nodesQuery.error ?? policyQuery.error;
  if (error) {
    return (
      <>
        <PageHeader title={slug} back={back} />
        <Badge variant="critical" role="alert" className="w-fit">
          {error.message}
        </Badge>
      </>
    );
  }
  if (!fleet) {
    return (
      <>
        <PageHeader title={slug} back={back} />
        <EmptyState icon={ShieldCheck} title={t('fleet.notFound')} />
      </>
    );
  }

  const shown = fleet.nodes.filter((node) => nodeMatches(node, query.trim()));
  const hypervision = shown.filter((node) => isHypervision(node.tags));
  const equipment = shown.filter((node) => !isHypervision(node.tags));
  function exportCsv() {
    if (!fleet) return;
    downloadFile(
      datedFilename(`flotte-${fleet.slug}`),
      toCsv([
        ['Machine', 'Type', 'Adresse', 'État', 'Dernière connexion', 'N° de série', 'Modèle'],
        ...fleet.nodes.map((node) => [
          node.givenName || node.name,
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

  const selected = fleet.nodes.find((node) => node.id === selectedId) ?? null;
  const deletable = operate && fleet.inPolicy && !fleet.internal;

  const addButton = (kind: MachineKind) => (
    <Button
      variant={kind === 'hypervision' ? 'brand' : 'outline'}
      size="sm"
      onClick={() => setAdding(kind)}
    >
      <Plus aria-hidden />
      {kind === 'hypervision' ? t('fleet.addHypervision') : t('fleet.addEquipment')}
    </Button>
  );

  const pendingBlock = (kind: MachineKind) => {
    const ofKind = (key: (typeof pendingKeys)[number]) => isHypervision(key.tags) === (kind === 'hypervision');
    const pending = pendingKeys.filter(ofKind);
    const used = usedKeys.filter(ofKind);
    if (pending.length === 0 && used.length === 0) return null;
    return (
      <div className="mt-4 rounded-lg border border-dashed px-3 pt-2">
        {pending.length > 0 && (
          <>
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <KeyRound className="size-3.5" aria-hidden />
              {t('fleet.pendingKeys', { count: pending.length })}
            </p>
            <PendingKeys keys={pending} />
          </>
        )}
        {used.length > 0 && <UsedKeys keys={used} />}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        back={back}
        title={fleet.label}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <code className="font-mono text-xs">{fleet.tag}</code>
            <span className="tabular-nums">
              {t('fleet.summary', {
                total: fleet.nodes.length,
                online: fleet.online,
              })}
            </span>
          </span>
        }
        actions={
          <>
            {fleet.nodes.length > 0 && (
              <Button variant="outline" onClick={exportCsv}>
                <Download aria-hidden />
                {t('machines.export')}
              </Button>
            )}
            {deletable && (
              <DeleteFleetButton
                tag={fleet.tag}
                machineCount={fleet.nodes.length}
                onDeleted={() => router.push('/')}
              />
            )}
          </>
        }
      />

      <div className="flex items-start gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
        <p className="text-muted-foreground">
          {fleet.internal ? t('fleet.isolationInternal') : t('fleet.isolation')}
        </p>
      </div>

      {!fleet.internal && <FleetProfileCard tag={fleet.tag} profile={fleet.profile} />}

      {!fleet.inPolicy && (
        <Badge variant="warning" className="w-fit" role="status">
          {t('home.notInPolicyHint')}
        </Badge>
      )}

      {fleet.nodes.length > SEARCH_THRESHOLD && (
        <div className="relative">
          <Search
            className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            aria-label={t('fleet.search')}
            placeholder={t('fleet.search')}
            className="pl-8"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      )}

      {!fleet.internal && (
        <Section
          icon={Monitor}
          title={t('fleet.hypervisionTitle')}
          description={t('fleet.hypervisionDescription')}
          count={hypervision.length}
          action={operate && addButton('hypervision')}
        >
          {hypervision.length > 0 ? (
            <MachinesTable nodes={hypervision} onSelect={(node) => setSelectedId(node.id)} pageSize={10} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {query ? t('fleet.noMatch') : t('fleet.noHypervision')}
            </p>
          )}
          {pendingBlock('hypervision')}
        </Section>
      )}

      <Section
        icon={Server}
        title={fleet.internal ? t('fleet.internalTitle') : t('fleet.equipmentTitle')}
        description={t('fleet.equipmentDescription')}
        count={equipment.length}
        action={operate && addButton('equipment')}
      >
        {equipment.length > 0 ? (
          <MachinesTable nodes={equipment} onSelect={(node) => setSelectedId(node.id)} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {query ? t('fleet.noMatch') : t('fleet.noEquipment')}
          </p>
        )}
        {pendingBlock('equipment')}
      </Section>

      <AddMachineDialog
        fleetTag={fleet.tag}
        fleetLabel={fleet.label}
        kind={adding ?? 'equipment'}
        open={adding !== null}
        onOpenChange={(open) => !open && setAdding(null)}
      />

      {selected && (
        <MachineDetailPanel
          key={selected.id}
          node={selected}
          fleets={fleetOptions}
          open
          onOpenChange={(open) => !open && setSelectedId(null)}
        />
      )}
    </>
  );
}
