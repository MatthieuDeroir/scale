'use client';

import { useQuery } from '@tanstack/react-query';
import { DeleteFleetButton } from '@/features/acl';
import {
  MachineDetailPanel,
  MachinesTable,
  isHypervision,
  tagFromSlug,
  type FleetNode,
} from '@/features/fleets';
import { IssueKeyDialog, PendingKeys, fetchKeys, isPending } from '@/features/keys';
import { KeyRound, Monitor, Search, Server, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  PageHeader,
  Skeleton,
} from '@/shared/ui';
import { nodeMatches, summarizeFleets, useNodes, usePolicy } from '../lib';

/** Au-delà, un champ de recherche apparaît : inutile pour trois machines. */
const SEARCH_THRESHOLD = 10;

function Section({
  icon: Icon,
  title,
  description,
  count,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="px-5 pt-5 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          {title}
          {count !== undefined && <Badge variant="secondary">{count}</Badge>}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
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
  const router = useRouter();
  const tag = tagFromSlug(slug);
  const nodesQuery = useNodes();
  const policyQuery = usePolicy();
  const keysQuery = useQuery({ queryKey: ['keys'], queryFn: fetchKeys });

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<FleetNode | null>(null);

  const policyFleets = useMemo(() => policyQuery.data?.fleets ?? [], [policyQuery.data]);
  const fleet = useMemo(
    () => summarizeFleets(policyFleets, nodesQuery.data ?? []).find((item) => item.tag === tag),
    [policyFleets, nodesQuery.data, tag]
  );
  const pendingKeys = useMemo(
    () => (keysQuery.data ?? []).filter((key) => isPending(key) && key.tags.includes(tag)),
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
  const deletable = fleet.inPolicy && !fleet.internal;

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
            {deletable && (
              <DeleteFleetButton
                tag={fleet.tag}
                machineCount={fleet.nodes.length}
                onDeleted={() => router.push('/')}
              />
            )}
            <IssueKeyDialog fleetTag={fleet.tag} fleetLabel={fleet.label} />
          </>
        }
      />

      <div className="flex items-start gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
        <p className="text-muted-foreground">
          {fleet.internal ? t('fleet.isolationInternal') : t('fleet.isolation')}
        </p>
      </div>

      {!fleet.inPolicy && (
        <Badge variant="warning" className="w-fit" role="status">
          {t('home.notInPolicyHint')}
        </Badge>
      )}

      {fleet.nodes.length > SEARCH_THRESHOLD && (
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
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
        >
          {hypervision.length > 0 ? (
            <MachinesTable nodes={hypervision} onSelect={setSelected} pageSize={10} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {query ? t('fleet.noMatch') : t('fleet.noHypervision')}
            </p>
          )}
        </Section>
      )}

      <Section
        icon={Server}
        title={fleet.internal ? t('fleet.internalTitle') : t('fleet.equipmentTitle')}
        count={equipment.length}
      >
        {equipment.length > 0 ? (
          <MachinesTable nodes={equipment} onSelect={setSelected} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {query ? t('fleet.noMatch') : t('fleet.noEquipment')}
          </p>
        )}
      </Section>

      {pendingKeys.length > 0 && (
        <Section
          icon={KeyRound}
          title={t('fleet.pendingKeysTitle')}
          description={t('fleet.pendingKeysDescription')}
          count={pendingKeys.length}
        >
          <PendingKeys keys={pendingKeys} />
        </Section>
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
