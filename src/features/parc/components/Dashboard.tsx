'use client';

import { useQuery } from '@tanstack/react-query';
import { StatusDot, formatLastSeen, isHypervision, isMaster, type FleetNode } from '@/features/fleets';
import { fetchKeys, isPending } from '@/features/keys';
import {
  ArrowRight,
  ArrowUpCircle,
  Bot,
  Boxes,
  ChevronRight,
  ClipboardList,
  History,
  Inbox,
  KeyRound,
  PackageX,
  ServerCrash,
  ShieldAlert,
  TriangleAlert,
  Wifi,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo, type ComponentType, type ReactNode } from 'react';
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader, Skeleton, StatCard } from '@/shared/ui';
import { cn } from '@/shared/lib';
import { fetchPlansProgress, fetchRecentJobs, fetchSecuritySummary, type Severity } from '../api';
import { fleetLabelResolver, summarizeFleets, unassignedNodes, useNodes, usePolicy, useProfiles } from '../lib';
import { SEVERITY_ORDER, SeverityBadge, SeverityCounts } from './MachineVulns';

const RANK: Record<Severity, number> = { critical: 5, high: 4, medium: 3, low: 2, unassigned: 1, unimportant: 0 };
const BAR: Record<Severity, string> = {
  critical: 'bg-red-600',
  high: 'bg-red-400',
  medium: 'bg-amber-400',
  low: 'bg-slate-400',
  unassigned: 'bg-muted-foreground/40',
  unimportant: 'bg-muted-foreground/20',
};
const LIST_SIZE = 6;
/** L'agent envoie son inventaire toutes les heures : au-delà de deux, il ne répond plus. */
const SILENT_AFTER_MS = 2 * 60 * 60 * 1000;

function Panel({
  icon: Icon,
  title,
  action,
  className,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 px-5 pt-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="px-5 pb-4">{children}</CardContent>
    </Card>
  );
}

function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
      {children}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

function MachineLink({ node, children }: { node: FleetNode; children?: ReactNode }) {
  return (
    <Link href={`/machines/${node.id}`} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
      {children}
    </Link>
  );
}

function Progress({ value, total }: { value: number; total: number }) {
  return (
    <span className="block h-2 w-full overflow-hidden rounded-full bg-muted">
      <span
        className={cn('block h-full rounded-full', value === total ? 'bg-emerald-500' : 'bg-brand')}
        style={{ width: `${total ? (value / total) * 100 : 0}%` }}
      />
    </span>
  );
}

/**
 * Tableau de bord : l'état du parc d'un coup d'œil (flottes, plans, failles,
 * composition) et ce qui demande de l'attention. Les failles viennent du même
 * calcul que l'onglet Cybersécurité : une faille écartée (non concernée) n'y
 * compte pas. Chaque ligne mène à la page concernée.
 */
export function Dashboard() {
  const t = useTranslations('parc');
  const tf = useTranslations('fleets');
  const nodesQuery = useNodes();
  const policyQuery = usePolicy();
  const profilesQuery = useProfiles();
  const jobsQuery = useQuery({ queryKey: ['jobs', 'recent'], queryFn: fetchRecentJobs, refetchInterval: 15000 });
  const securityQuery = useQuery({ queryKey: ['security', 'summary'], queryFn: fetchSecuritySummary, refetchInterval: 60000 });
  const plansQuery = useQuery({ queryKey: ['plan', 'progress'], queryFn: fetchPlansProgress, refetchInterval: 30000 });
  const keysQuery = useQuery({ queryKey: ['keys'], queryFn: fetchKeys });

  const nodes = useMemo(() => nodesQuery.data ?? [], [nodesQuery.data]);
  const fleets = useMemo(
    () => summarizeFleets(policyQuery.data?.fleets ?? [], nodes, profilesQuery.data ?? []),
    [policyQuery.data, nodes, profilesQuery.data]
  );
  const fleetLabel = useMemo(() => fleetLabelResolver(fleets), [fleets]);

  if (nodesQuery.isPending || policyQuery.isPending) return <Skeleton className="h-96 w-full" />;

  // Heure du dernier chargement des machines : avance avec le rafraîchissement.
  const now = nodesQuery.dataUpdatedAt;
  const security = securityQuery.data;
  const perNode = security?.perNode ?? {};
  const equipment = nodes.filter((node) => !isHypervision(node.tags));
  const online = nodes.filter((node) => node.online).length;
  const pending = unassignedNodes(nodes);
  const withAgent = equipment.filter((node) => node.agent);
  const withoutAgent = equipment.filter((node) => !node.agent);
  const silent = withAgent.filter(
    (node) => node.online && (!node.inventory || now - new Date(node.inventory.reportedAt).getTime() > SILENT_AFTER_MS)
  );
  // Toute machine Stramatel rangée porte un produit ; celles en attente le recevront à l'affectation.
  const withoutProduct = equipment.filter((node) => !node.product && !node.tags.includes('tag:a-assigner'));
  const pendingKeys = (keysQuery.data ?? []).filter((key) => isPending(key));
  const updates = nodes.reduce((sum, node) => sum + (node.inventory?.upgradableCount ?? 0), 0);
  const machinesWithUpdates = nodes.filter((node) => (node.inventory?.upgradableCount ?? 0) > 0).length;
  const offline = nodes
    .filter((node) => !node.online)
    .sort((a, b) => new Date(a.lastSeen ?? 0).getTime() - new Date(b.lastSeen ?? 0).getTime());
  const exposed = nodes
    .filter((node) => perNode[node.id]?.fixable)
    .sort(
      (a, b) =>
        RANK[perNode[b.id].worstFixable ?? 'unimportant'] - RANK[perNode[a.id].worstFixable ?? 'unimportant'] ||
        perNode[b.id].fixable - perNode[a.id].fixable
    );
  const seriousOpen = (security?.openBySeverity.critical ?? 0) + (security?.openBySeverity.high ?? 0);
  const severities = SEVERITY_ORDER.filter((level) => level !== 'unimportant');
  const maxBar = Math.max(1, ...severities.map((level) => security?.openBySeverity[level] ?? 0));
  const nodeByDevice = new Map(nodes.filter((node) => node.enrollment).map((node) => [node.enrollment!.deviceId, node]));
  const planOf = new Map((plansQuery.data ?? []).map((plan) => [plan.fleetTag, plan]));

  // Composition : produit et rôle des machines rangées.
  const none = t('dashboard.compositionNone');
  const composition = new Map<string, number>();
  for (const node of equipment) {
    if (node.tags.includes('tag:a-assigner')) continue;
    const key = !node.product
      ? none
      : node.product.slaves
        ? `${node.product.name} ${isMaster(node.tags) ? 'SERVEUR' : 'REPLICA'}`
        : node.product.name;
    composition.set(key, (composition.get(key) ?? 0) + 1);
  }
  const stations = nodes.length - equipment.length;

  const checks = silent.length + withoutAgent.length + withoutProduct.length + pendingKeys.length;

  return (
    <>
      <PageHeader title={t('dashboard.title')} description={t('dashboard.description')} />

      {pending.length > 0 && (
        <Link
          href="/a-assigner"
          className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm hover:bg-amber-500/15"
        >
          <Inbox className="size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <span className="flex-1 font-medium">{t('home.unassignedBanner', { count: pending.length })}</span>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label={t('dashboard.online')}
          value={`${online}/${nodes.length}`}
          icon={Wifi}
          tone={online === nodes.length ? 'ok' : 'default'}
        />
        <StatCard
          label={t('dashboard.seriousOpen')}
          value={security ? seriousOpen : '…'}
          icon={ShieldAlert}
          tone={seriousOpen > 0 ? 'critical' : 'ok'}
        />
        <StatCard label={t('dashboard.updates', { machines: machinesWithUpdates })} value={updates} icon={ArrowUpCircle} />
        <StatCard
          label={t('dashboard.agents', { silent: silent.length })}
          value={`${withAgent.length}/${equipment.length}`}
          icon={Bot}
          tone={withoutAgent.length === 0 && silent.length === 0 ? 'ok' : 'default'}
        />
      </div>

      <Panel
        icon={ClipboardList}
        title={t('dashboard.fleetsTitle')}
        action={<PanelLink href="/flottes">{t('dashboard.allFleets')}</PanelLink>}
      >
        {fleets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.noFleet')}</p>
        ) : (
          <ul className="-mx-2 flex flex-col" aria-label={t('dashboard.fleetsTitle')}>
            {fleets.map((fleet) => {
              const plan = planOf.get(fleet.tag);
              const worst = fleet.nodes
                .map((node) => perNode[node.id]?.worstFixable)
                .filter((level): level is Severity => Boolean(level))
                .sort((a, b) => RANK[b] - RANK[a])[0];
              return (
                <li key={fleet.tag}>
                  <Link
                    href={`/flottes/${fleet.slug}`}
                    className="grid grid-cols-[minmax(7rem,1fr)_minmax(9rem,1.6fr)_4.5rem_6.5rem] items-center gap-4 rounded-md px-2 py-2 text-sm hover:bg-muted/60"
                  >
                    <span className="min-w-0 truncate font-medium">{fleet.label}</span>
                    <span className="flex items-center gap-2">
                      {plan ? (
                        <>
                          <Progress value={plan.filled} total={plan.total} />
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {t('dashboard.planProgress', { filled: plan.filled, total: plan.total })}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t('dashboard.noPlan')}</span>
                      )}
                    </span>
                    <span
                      className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground"
                      title={t('dashboard.fleetOnline', { online: fleet.online, total: fleet.nodes.length })}
                    >
                      <Wifi className="size-3.5" aria-hidden />
                      {fleet.online}/{fleet.nodes.length}
                    </span>
                    <span className="justify-self-end">
                      {worst ? <SeverityBadge severity={worst} /> : <span className="text-xs text-muted-foreground">—</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel
          icon={ShieldAlert}
          title={t('dashboard.faultsTitle')}
          action={<PanelLink href="/cybersecurite">{t('dashboard.openSecurity')}</PanelLink>}
        >
          {!security ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="flex flex-col gap-2.5">
              <ul className="flex flex-col gap-2" aria-label={t('dashboard.faultsTitle')}>
                {severities.map((level) => {
                  const value = security.openBySeverity[level] ?? 0;
                  const fixable = security.fixableBySeverity[level] ?? 0;
                  return (
                    <li
                      key={level}
                      className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-3 text-sm"
                      title={t('dashboard.faultsBar', { total: value, fixable })}
                    >
                      <span className="text-muted-foreground first-letter:uppercase">{t(`severity.${level}`)}</span>
                      <span className="relative h-2.5 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn('absolute inset-y-0 left-0 rounded-full opacity-35', BAR[level])}
                          style={{ width: `${(value / maxBar) * 100}%` }}
                        />
                        <span
                          className={cn('absolute inset-y-0 left-0 rounded-full', BAR[level])}
                          style={{ width: `${(fixable / maxBar) * 100}%` }}
                        />
                      </span>
                      <span className="text-right tabular-nums">
                        {value}
                        {fixable > 0 && <span className="ml-1 text-xs text-muted-foreground">({fixable})</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-muted-foreground">
                {t('dashboard.faultsHint', { excluded: security.excluded, investigating: security.investigating })}
              </p>
            </div>
          )}
        </Panel>

        <Panel icon={Wrench} title={t('dashboard.topPackages')}>
          {!security ? (
            <Skeleton className="h-40 w-full" />
          ) : security.topPackages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dashboard.noFault')}</p>
          ) : (
            <ul className="flex flex-col divide-y" aria-label={t('dashboard.topPackages')}>
              {security.topPackages.map((item) => (
                <li key={item.package} className="flex items-center gap-3 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate font-mono">{item.package}</span>
                  <SeverityBadge severity={item.worst} />
                  <span className="w-44 text-right text-xs text-muted-foreground">
                    {t('dashboard.packageFixes', { fixes: item.fixes, machines: item.machines })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel icon={ShieldAlert} title={t('dashboard.priority')}>
          {exposed.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dashboard.noFault')}</p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {exposed.slice(0, LIST_SIZE).map((node) => (
                <li key={node.id}>
                  <MachineLink node={node}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{node.givenName || node.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{fleetLabel(node)}</span>
                    </span>
                    <SeverityCounts counts={perNode[node.id].fixableBySeverity} />
                  </MachineLink>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          icon={Boxes}
          title={t('dashboard.composition')}
          action={<PanelLink href="/produits">{t('dashboard.catalog')}</PanelLink>}
        >
          <ul className="flex flex-col divide-y" aria-label={t('dashboard.composition')}>
            {[...composition.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([label, count]) => (
                <li key={label} className="flex items-center justify-between py-1.5 text-sm">
                  <span className={cn(label === none && 'text-amber-700 dark:text-amber-400')}>{label}</span>
                  <span className="tabular-nums">{count}</span>
                </li>
              ))}
            <li className="flex items-center justify-between py-1.5 text-sm">
              <span>{t('dashboard.compositionStations')}</span>
              <span className="tabular-nums">{stations}</span>
            </li>
            {pending.length > 0 && (
              <li className="flex items-center justify-between py-1.5 text-sm">
                <span>{t('dashboard.compositionPending')}</span>
                <span className="tabular-nums">{pending.length}</span>
              </li>
            )}
          </ul>
        </Panel>

        <Panel icon={ServerCrash} title={t('dashboard.offlineTitle', { count: offline.length })}>
          {offline.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dashboard.allOnline')}</p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {offline.slice(0, LIST_SIZE).map((node) => (
                <li key={node.id}>
                  <MachineLink node={node}>
                    <StatusDot online={false} label={tf('offline')} />
                    <span className="min-w-0 flex-1 truncate font-medium">{node.givenName || node.name}</span>
                    <span className="text-xs text-muted-foreground">{fleetLabel(node)}</span>
                    <span className="w-28 text-right text-xs tabular-nums text-muted-foreground">
                      {formatLastSeen(node.lastSeen) ?? tf('never')}
                    </span>
                  </MachineLink>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel icon={History} title={t('dashboard.jobsTitle')}>
          {(jobsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('machine.noJob')}</p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {jobsQuery.data!.map((job) => {
                const node = nodeByDevice.get(job.deviceId);
                const label =
                  job.kind === 'upgrade-system' ? t('machine.jobSystem') : t('machine.jobPackage', { name: job.package ?? '' });
                const content = (
                  <>
                    <Badge
                      variant={
                        job.status === 'done'
                          ? 'ok'
                          : job.status === 'failed'
                            ? 'critical'
                            : job.status === 'running'
                              ? 'warning'
                              : 'secondary'
                      }
                    >
                      {t(`machine.status.${job.status}`)}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{node ? node.givenName || node.name : '—'}</span>
                      <span className="text-muted-foreground"> · {label}</span>
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">{formatLastSeen(job.createdAt)}</span>
                  </>
                );
                return (
                  <li key={job.id}>
                    {node ? (
                      <MachineLink node={node}>{content}</MachineLink>
                    ) : (
                      <div className="flex items-center gap-2.5 px-2 py-1.5 text-sm">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {checks > 0 && (
          <Panel icon={TriangleAlert} title={t('dashboard.checksTitle', { count: checks })} className="md:col-span-2">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { key: 'silent', icon: Bot, items: silent, hint: t('dashboard.silentHint') },
                { key: 'noAgent', icon: Bot, items: withoutAgent, hint: t('dashboard.noAgentHint') },
                { key: 'noProduct', icon: PackageX, items: withoutProduct, hint: t('dashboard.noProductHint') },
              ]
                .filter((group) => group.items.length > 0)
                .map((group) => (
                  <section key={group.key} className="flex flex-col gap-1">
                    <h3 className="flex items-center gap-1.5 text-sm font-medium">
                      <group.icon className="size-3.5 text-muted-foreground" aria-hidden />
                      {t(`dashboard.check.${group.key}`, { count: group.items.length })}
                    </h3>
                    <p className="text-xs text-muted-foreground">{group.hint}</p>
                    <ul className="-mx-2 flex flex-col">
                      {group.items.slice(0, 4).map((node) => (
                        <li key={node.id}>
                          <MachineLink node={node}>
                            <StatusDot online={node.online} label={node.online ? tf('online') : tf('offline')} />
                            <span className="min-w-0 flex-1 truncate">{node.givenName || node.name}</span>
                          </MachineLink>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              {pendingKeys.length > 0 && (
                <section className="flex flex-col gap-1">
                  <h3 className="flex items-center gap-1.5 text-sm font-medium">
                    <KeyRound className="size-3.5 text-muted-foreground" aria-hidden />
                    {t('dashboard.check.pendingKeys', { count: pendingKeys.length })}
                  </h3>
                  <p className="text-xs text-muted-foreground">{t('dashboard.pendingKeysHint')}</p>
                  <ul className="flex flex-col gap-1 pt-1 text-sm">
                    {pendingKeys.slice(0, 4).map((key) => (
                      <li key={key.id} className="flex justify-between gap-2">
                        <span className="truncate">{fleetLabel({ tags: key.tags } as FleetNode)}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {t('dashboard.expires', { date: new Date(key.expiration).toLocaleDateString() })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
