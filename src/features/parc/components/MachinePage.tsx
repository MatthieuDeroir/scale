'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MachineDetailPanel,
  MasterBadge,
  StatusDot,
  fleetSlug,
  fleetTagOf,
  formatLastSeen,
  isHypervision,
  isMaster,
  type FleetNode,
} from '@/features/fleets';
import {
  ArrowUpCircle,
  Cpu,
  HardDrive,
  History,
  Network,
  Package,
  Search,
  Settings2,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CopyField,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  usePagination,
  usePermissions,
} from '@/shared/ui';
import { cn } from '@/shared/lib';
import { fetchMachine, requestUpdate, type AgentJob, type MachineDetail } from '../api';
import { useFleetOptions } from '../lib';

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return days > 0 ? `${days} j ${hours} h` : `${hours} h ${Math.floor((seconds % 3600) / 60)} min`;
}

function Block({
  icon: Icon,
  title,
  action,
  children,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
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

function Facts({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

const JOB_TONE: Record<AgentJob['status'], 'secondary' | 'warning' | 'ok' | 'critical'> = {
  pending: 'secondary',
  running: 'warning',
  done: 'ok',
  failed: 'critical',
};

function Jobs({ jobs }: { jobs: AgentJob[] }) {
  const t = useTranslations('parc');
  if (jobs.length === 0) return <p className="text-sm text-muted-foreground">{t('machine.noJob')}</p>;
  return (
    <ul className="flex flex-col divide-y">
      {jobs.map((job) => (
        <li key={job.id} className="py-2.5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={JOB_TONE[job.status]}>{t(`machine.status.${job.status}`)}</Badge>
            <span className="font-medium">
              {job.kind === 'upgrade-system' ? t('machine.jobSystem') : t('machine.jobPackage', { name: job.package ?? '' })}
            </span>
            <span className="text-xs text-muted-foreground">
              {t('machine.jobBy', { user: job.createdBy, date: formatLastSeen(job.createdAt) ?? '' })}
            </span>
          </div>
          {job.output && (
            <details className="mt-1.5">
              <summary className="cursor-pointer text-xs text-muted-foreground">{t('machine.jobOutput')}</summary>
              <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-muted p-2 text-[11px] leading-4">{job.output}</pre>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

function Packages({ machine }: { machine: MachineDetail }) {
  const t = useTranslations('parc');
  const { operate } = usePermissions();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [onlyUpgradable, setOnlyUpgradable] = useState(machine.inventory!.upgradable.length > 0);

  const upgradable = useMemo(
    () => new Map(machine.inventory!.upgradable.map((item) => [item.name, item.candidate])),
    [machine.inventory]
  );
  const busy = new Set(
    machine.jobs.filter((job) => job.status === 'pending' || job.status === 'running').map((job) => job.package)
  );
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return machine
      .inventory!.packages.filter((item) => (!onlyUpgradable || upgradable.has(item.name)) && item.name.includes(q))
      .sort((a, b) => Number(upgradable.has(b.name)) - Number(upgradable.has(a.name)) || a.name.localeCompare(b.name));
  }, [machine.inventory, query, onlyUpgradable, upgradable]);
  const pagination = usePagination(rows, 50);

  const mutation = useMutation({
    mutationFn: (name: string) => requestUpdate(machine.id, { kind: 'upgrade-package', package: name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['machines', machine.id] });
      toast.success(t('machine.requested'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            aria-label={t('machine.searchPackage')}
            placeholder={t('machine.searchPackage')}
            className="pl-8"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              pagination.setPage(0);
            }}
          />
        </div>
        <Button
          size="sm"
          variant={onlyUpgradable ? 'secondary' : 'outline'}
          aria-pressed={onlyUpgradable}
          onClick={() => {
            setOnlyUpgradable(!onlyUpgradable);
            pagination.setPage(0);
          }}
        >
          <ArrowUpCircle aria-hidden />
          {t('machine.onlyUpgradable', { count: upgradable.size })}
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{t('machine.noPackage')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t('machine.package')}</TableHead>
              <TableHead>{t('machine.installed')}</TableHead>
              <TableHead>{t('machine.available')}</TableHead>
              {operate && machine.agent && <TableHead className="w-32" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.items.map((item) => {
              const candidate = upgradable.get(item.name);
              return (
                <TableRow key={item.name}>
                  <TableCell className="font-mono text-xs font-medium">{item.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{item.version}</TableCell>
                  <TableCell className={cn('font-mono text-xs', candidate ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>
                    {candidate ?? '—'}
                  </TableCell>
                  {operate && machine.agent && (
                    <TableCell className="text-right">
                      {candidate &&
                        (busy.has(item.name) ? (
                          <Badge variant="warning">{t('machine.status.pending')}</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={mutation.isPending}
                            onClick={() => mutation.mutate(item.name)}
                          >
                            {t('machine.update')}
                          </Button>
                        ))}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <Pagination {...pagination} label={(range) => t('machine.pagination', range)} />
    </>
  );
}

function SystemUpdateDialog({ machine, open, onOpenChange }: { machine: MachineDetail; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('parc');
  const queryClient = useQueryClient();
  const count = machine.inventory?.upgradable.length ?? 0;
  const mutation = useMutation({
    mutationFn: () => requestUpdate(machine.id, { kind: 'upgrade-system' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['machines', machine.id] });
      toast.success(t('machine.requested'));
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('machine.systemTitle')}</DialogTitle>
          <DialogDescription>{t('machine.systemDescription', { count, os: [machine.inventory?.osName, machine.inventory?.osVersion].filter(Boolean).join(' ') })}</DialogDescription>
        </DialogHeader>
        <ul className="max-h-72 overflow-auto rounded-lg border px-3 py-2 font-mono text-xs">
          {machine.inventory?.upgradable.map((item) => (
            <li key={item.name} className="flex justify-between gap-3 py-0.5">
              <span className="font-medium">{item.name}</span>
              <span className="text-muted-foreground">
                {item.current} → <span className="text-emerald-700 dark:text-emerald-400">{item.candidate}</span>
              </span>
            </li>
          ))}
        </ul>
        <div role="note" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm">
          {t('machine.systemWarning')}
        </div>
        <DialogFooter>
          <Button variant="brand" disabled={mutation.isPending || count === 0} onClick={() => mutation.mutate()}>
            {t('machine.systemConfirm', { count })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Page d'une machine : identité, réseau, matériel et système tels que
 * l'agent les a déclarés, paquets installés, mises à jour demandées et leur
 * compte rendu. Les mises à jour passent par l'agent de la machine, qui ne
 * connaît que deux actions.
 */
export function MachinePage({ id }: { id: string }) {
  const t = useTranslations('parc');
  const tf = useTranslations('fleets');
  const { operate } = usePermissions();
  const fleetOptions = useFleetOptions();
  const router = useRouter();
  const [managing, setManaging] = useState(false);
  const [updatingSystem, setUpdatingSystem] = useState(false);

  const { data: machine, error } = useQuery({
    queryKey: ['machines', id],
    queryFn: () => fetchMachine(id),
    // Plus vite tant qu'une mise à jour est en attente ou en cours.
    refetchInterval: (query) =>
      query.state.data?.jobs.some((job) => job.status === 'pending' || job.status === 'running') ? 5000 : 30000,
  });

  if (error) {
    return (
      <>
        <PageHeader title={t('machines.title')} back={{ href: '/machines', label: t('machines.title') }} />
        <EmptyState icon={Terminal} title={error.message} />
      </>
    );
  }
  if (!machine) return <Skeleton className="h-96 w-full" />;

  const fleetTag = fleetTagOf(machine.tags);
  const fleet = fleetOptions.find((option) => option.tag === fleetTag);
  const back = fleetTag && fleet ? { href: `/flottes/${fleetSlug(fleetTag)}`, label: fleet.label } : { href: '/machines', label: t('machines.title') };
  const inv = machine.inventory;
  const pendingSystem = machine.jobs.some((job) => job.kind === 'upgrade-system' && (job.status === 'pending' || job.status === 'running'));
  const kind = isHypervision(machine.tags) ? tf('kind.hypervision') : tf('kind.equipment');

  return (
    <>
      <PageHeader
        back={back}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {machine.givenName || machine.name}
            {isMaster(machine.tags) && <MasterBadge />}
            <Badge variant={machine.online ? 'ok' : 'critical'}>{machine.online ? tf('online') : tf('offline')}</Badge>
          </span>
        }
        description={`${kind} · ${fleet?.label ?? tf('detail.chooseFleet')}`}
        actions={
          <>
            {operate && machine.agent && inv && (
              <Button variant="brand" disabled={inv.upgradable.length === 0 || pendingSystem} onClick={() => setUpdatingSystem(true)}>
                <ArrowUpCircle aria-hidden />
                {pendingSystem ? t('machine.status.pending') : t('machine.updateSystem', { count: inv.upgradable.length })}
              </Button>
            )}
            <Button variant="outline" onClick={() => setManaging(true)}>
              <Settings2 aria-hidden />
              {t('machine.manage')}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Block icon={ShieldCheck} title={t('machine.identity')}>
          <Facts
            rows={[
              [t('machine.fleet'), fleet?.label],
              [t('machine.role'), isHypervision(machine.tags) ? '—' : isMaster(machine.tags) ? 'MASTER' : 'SLAVE'],
              [tf('detail.serial'), machine.enrollment?.serial],
              [tf('detail.model'), machine.enrollment?.model],
              [tf('detail.joinedAt'), formatLastSeen(machine.createdAt ?? null)],
              [tf('columns.lastSeen'), machine.online ? tf('online') : formatLastSeen(machine.lastSeen)],
            ]}
          />
        </Block>
        <Block icon={Network} title={t('machine.network')}>
          <div className="flex flex-col gap-3">
            <Facts rows={[[tf('columns.address'), <span className="font-mono text-xs" key="ip">{machine.ipAddresses.join(', ')}</span>]]} />
            {machine.dnsName && (
              <CopyField label={tf('detail.dnsName')} value={machine.dnsName} copyLabel={tf('detail.copy')} copiedLabel={tf('detail.copied')} />
            )}
          </div>
        </Block>
        {inv && (
          <>
            <Block icon={Cpu} title={t('machine.hardware')}>
              <Facts
                rows={[
                  [t('machine.cpu'), inv.cpu],
                  [t('machine.cores'), inv.cores],
                  [t('machine.memory'), inv.memoryMb != null ? `${(inv.memoryMb / 1024).toFixed(1)} Go` : null],
                  [t('machine.arch'), inv.arch],
                  [
                    t('machine.disk'),
                    inv.diskTotalGb != null && inv.diskFreeGb != null ? (
                      <span className="flex items-center gap-2" key="disk">
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full bg-brand"
                            style={{ width: `${Math.round(((inv.diskTotalGb - inv.diskFreeGb) / Math.max(1, inv.diskTotalGb)) * 100)}%` }}
                          />
                        </span>
                        {t('machine.diskFree', { free: inv.diskFreeGb, total: inv.diskTotalGb })}
                      </span>
                    ) : null,
                  ],
                ]}
              />
            </Block>
            <Block icon={HardDrive} title={t('machine.system')}>
              <Facts
                rows={[
                  [t('machine.os'), [inv.osName, inv.osVersion].filter(Boolean).join(' ')],
                  [t('machine.kernel'), inv.kernel],
                  [t('machine.uptime'), inv.uptimeSeconds != null ? formatDuration(inv.uptimeSeconds) : null],
                  [t('machine.reportedAt'), formatLastSeen(inv.reportedAt)],
                ]}
              />
            </Block>
          </>
        )}
      </div>

      {inv ? (
        <Block icon={Package} title={t('machine.packages', { count: inv.packages.length })}>
          <Packages machine={machine} />
        </Block>
      ) : (
        <EmptyState icon={Package} title={t('machine.noAgent')} description={t('machine.noAgentHint')} />
      )}

      {machine.agent && (
        <Block icon={History} title={t('machine.jobs')}>
          <Jobs jobs={machine.jobs} />
        </Block>
      )}

      {managing && (
        <MachineDetailPanel
          node={machine as unknown as FleetNode}
          fleets={fleetOptions}
          open
          onOpenChange={setManaging}
          onDeleted={() => router.push(back.href)}
        />
      )}
      {updatingSystem && <SystemUpdateDialog machine={machine} open onOpenChange={setUpdatingSystem} />}
    </>
  );
}
