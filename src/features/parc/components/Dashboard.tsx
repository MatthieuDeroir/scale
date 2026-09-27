'use client';

import { useQuery } from '@tanstack/react-query';
import { StatusDot, formatLastSeen, isHypervision, type FleetNode } from '@/features/fleets';
import { ArrowUpCircle, Bot, ChevronRight, History, Inbox, ServerCrash, ShieldAlert, Wifi } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo, type ComponentType, type ReactNode } from 'react';
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader, Skeleton, StatCard } from '@/shared/ui';
import { cn } from '@/shared/lib';
import { fetchRecentJobs, type Severity } from '../api';
import { fleetLabelResolver, summarizeFleets, unassignedNodes, useNodes, usePolicy, useProfiles } from '../lib';
import { SEVERITY_ORDER, SeverityCounts } from './MachineVulns';

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

function Panel({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
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

function MachineLink({ node, children }: { node: FleetNode; children?: ReactNode }) {
  return (
    <Link
      href={`/machines/${node.id}`}
      className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
    >
      {children}
    </Link>
  );
}

/**
 * Tableau de bord : ce qui demande de l'attention sur tout le parc — machines
 * hors ligne, failles corrigeables, mises à jour, machines sans agent. Chaque
 * ligne mène à la page de la machine concernée.
 */
export function Dashboard() {
  const t = useTranslations('parc');
  const tf = useTranslations('fleets');
  const nodesQuery = useNodes();
  const policyQuery = usePolicy();
  const profilesQuery = useProfiles();
  const jobsQuery = useQuery({ queryKey: ['jobs', 'recent'], queryFn: fetchRecentJobs, refetchInterval: 15000 });

  const nodes = useMemo(() => nodesQuery.data ?? [], [nodesQuery.data]);
  const fleets = useMemo(
    () => summarizeFleets(policyQuery.data?.fleets ?? [], nodes, profilesQuery.data ?? []),
    [policyQuery.data, nodes, profilesQuery.data]
  );
  const fleetLabel = useMemo(() => fleetLabelResolver(fleets), [fleets]);

  if (nodesQuery.isPending || policyQuery.isPending) return <Skeleton className="h-96 w-full" />;

  const equipment = nodes.filter((node) => !isHypervision(node.tags));
  const online = nodes.filter((node) => node.online).length;
  const pending = unassignedNodes(nodes);
  const withAgent = equipment.filter((node) => node.agent);
  const withoutAgent = equipment.filter((node) => !node.agent);
  const exposed = nodes
    .filter((node) => node.vulns && node.vulns.fixable > 0)
    .sort(
      (a, b) =>
        RANK[b.vulns!.worstFixable ?? 'unimportant'] - RANK[a.vulns!.worstFixable ?? 'unimportant'] ||
        b.vulns!.fixable - a.vulns!.fixable
    );
  const seriouslyExposed = exposed.filter((node) => ['critical', 'high'].includes(node.vulns!.worstFixable ?? ''));
  const updates = nodes.reduce((sum, node) => sum + (node.inventory?.upgradableCount ?? 0), 0);
  const machinesWithUpdates = nodes.filter((node) => (node.inventory?.upgradableCount ?? 0) > 0).length;
  const offline = nodes
    .filter((node) => !node.online)
    .sort((a, b) => new Date(a.lastSeen ?? 0).getTime() - new Date(b.lastSeen ?? 0).getTime());

  const bySeverity: Partial<Record<Severity, number>> = {};
  for (const node of exposed) {
    for (const [level, count] of Object.entries(node.vulns!.fixableBySeverity) as Array<[Severity, number]>) {
      bySeverity[level] = (bySeverity[level] ?? 0) + count;
    }
  }
  const severities = SEVERITY_ORDER.filter((level) => level !== 'unimportant');
  const maxBar = Math.max(1, ...severities.map((level) => bySeverity[level] ?? 0));
  const nodeByDevice = new Map(nodes.filter((node) => node.enrollment).map((node) => [node.enrollment!.deviceId, node]));

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
        <StatCard label={t('dashboard.online')} value={`${online}/${nodes.length}`} icon={Wifi} tone={online === nodes.length ? 'ok' : 'default'} />
        <StatCard
          label={t('dashboard.exposed')}
          value={seriouslyExposed.length}
          icon={ShieldAlert}
          tone={seriouslyExposed.length > 0 ? 'critical' : 'ok'}
        />
        <StatCard label={t('dashboard.updates', { machines: machinesWithUpdates })} value={updates} icon={ArrowUpCircle} />
        <StatCard
          label={t('dashboard.agents')}
          value={`${withAgent.length}/${equipment.length}`}
          icon={Bot}
          tone={withoutAgent.length === 0 ? 'ok' : 'default'}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel icon={ShieldAlert} title={t('dashboard.faultsTitle')}>
          {exposed.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dashboard.noFault')}</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              <ul className="flex flex-col gap-2" aria-label={t('dashboard.faultsTitle')}>
                {severities.map((level) => {
                  const value = bySeverity[level] ?? 0;
                  return (
                    <li key={level} className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-3 text-sm" title={`${t(`severity.${level}`)} : ${value}`}>
                      <span className="text-muted-foreground first-letter:uppercase">{t(`severity.${level}`)}</span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn('block h-full rounded-full', BAR[level])}
                          style={{ width: `${(value / maxBar) * 100}%` }}
                        />
                      </span>
                      <span className="text-right tabular-nums">{value}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-muted-foreground">{t('dashboard.faultsHint', { machines: exposed.length })}</p>
            </div>
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
                    <SeverityCounts counts={node.vulns!.fixableBySeverity} />
                  </MachineLink>
                </li>
              ))}
            </ul>
          )}
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
                const label = job.kind === 'upgrade-system' ? t('machine.jobSystem') : t('machine.jobPackage', { name: job.package ?? '' });
                const content = (
                  <>
                    <Badge
                      variant={job.status === 'done' ? 'ok' : job.status === 'failed' ? 'critical' : job.status === 'running' ? 'warning' : 'secondary'}
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
                    {node ? <MachineLink node={node}>{content}</MachineLink> : <div className="flex items-center gap-2.5 px-2 py-1.5 text-sm">{content}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {withoutAgent.length > 0 && (
          <Panel icon={Bot} title={t('dashboard.noAgentTitle', { count: withoutAgent.length })}>
            <p className="mb-2 text-xs text-muted-foreground">{t('dashboard.noAgentHint')}</p>
            <ul className="-mx-2 flex flex-col">
              {withoutAgent.slice(0, LIST_SIZE).map((node) => (
                <li key={node.id}>
                  <MachineLink node={node}>
                    <StatusDot online={node.online} label={node.online ? tf('online') : tf('offline')} />
                    <span className="min-w-0 flex-1 truncate font-medium">{node.givenName || node.name}</span>
                    <span className="text-xs text-muted-foreground">{fleetLabel(node)}</span>
                  </MachineLink>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </>
  );
}
