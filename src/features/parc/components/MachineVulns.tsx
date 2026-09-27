'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatLastSeen } from '@/features/fleets';
import { ChevronRight, ExternalLink, RefreshCw, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  usePermissions,
} from '@/shared/ui';
import { cn } from '@/shared/lib';
import { requestUpdate, rescanMachine, type MachineDetail, type Severity, type VulnPackage } from '../api';

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'unassigned', 'unimportant'];

const SEVERITY_STYLE: Record<Severity, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-red-500/15 text-red-700 dark:text-red-400',
  medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  low: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  unassigned: 'bg-muted text-muted-foreground',
  unimportant: 'border text-muted-foreground',
};

export function SeverityBadge({ severity, count }: { severity: Severity; count?: number }) {
  const t = useTranslations('parc');
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium', SEVERITY_STYLE[severity])}>
      {count !== undefined && <span className="tabular-nums">{count}</span>}
      {t(`severity.${severity}`)}
    </span>
  );
}

/** Pastilles « 3 élevées, 2 moyennes… » dans l'ordre de gravité, sans les « sans importance ». */
export function SeverityCounts({ counts, withUnimportant = false }: { counts: Partial<Record<Severity, number>>; withUnimportant?: boolean }) {
  const shown = SEVERITY_ORDER.filter((level) => counts[level] && (withUnimportant || level !== 'unimportant'));
  if (shown.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((level) => (
        <SeverityBadge key={level} severity={level} count={counts[level]} />
      ))}
    </span>
  );
}

function referenceUrl(id: string, cve: string | null, ecosystem: string | null): string {
  if (cve && ecosystem?.startsWith('Debian')) return `https://security-tracker.debian.org/tracker/${cve}`;
  if (cve && ecosystem?.startsWith('Ubuntu')) return `https://ubuntu.com/security/${cve}`;
  return `https://osv.dev/vulnerability/${id}`;
}

function countBySeverity(ids: string[], severityOf: (id: string) => Severity) {
  const out: Partial<Record<Severity, number>> = {};
  for (const id of ids) out[severityOf(id)] = (out[severityOf(id)] ?? 0) + 1;
  return out;
}

function worst(ids: string[], severityOf: (id: string) => Severity): number {
  return Math.max(-1, ...ids.map((id) => SEVERITY_ORDER.length - SEVERITY_ORDER.indexOf(severityOf(id))));
}

/**
 * Failles de la machine, par paquet source : ce que la version proposée par
 * apt corrige, ce qui restera. La mise à jour recommandée est celle qui fait
 * disparaître des failles.
 */
export function MachineVulns({ machine }: { machine: MachineDetail }) {
  const t = useTranslations('parc');
  const { operate } = usePermissions();
  const queryClient = useQueryClient();
  const vulns = machine.vulns!;
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [showUnfixable, setShowUnfixable] = useState(false);

  const severityOf = (id: string): Severity => vulns.details[id]?.severity ?? 'unassigned';
  const busy = new Set(
    machine.jobs
      .filter((job) => job.status === 'pending' || job.status === 'running')
      .flatMap((job) => job.package?.split(' ') ?? [])
  );

  const rows = useMemo(
    () =>
      vulns.packages
        .filter((item) => showUnfixable || item.fixed.length > 0)
        .sort(
          (a, b) =>
            worst(b.fixed, severityOf) - worst(a.fixed, severityOf) ||
            b.fixed.length - a.fixed.length ||
            worst(b.remaining, severityOf) - worst(a.remaining, severityOf)
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vulns, showUnfixable]
  );

  const update = useMutation({
    mutationFn: (item: VulnPackage) => requestUpdate(machine.id, { kind: 'upgrade-package', packages: item.upgradable }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['machines', machine.id] });
      toast.success(t('machine.requested'));
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const rescan = useMutation({
    mutationFn: () => rescanMachine(machine.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['machines', machine.id] });
      toast.success(t('vulns.rescanned'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function toggle(source: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  }

  const summary = vulns.summary;
  const unfixableCount = vulns.packages.filter((item) => item.fixed.length === 0).length;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-2">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="size-4 text-muted-foreground" aria-hidden />
            {t('vulns.title')}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {t('vulns.scannedAt', { date: formatLastSeen(vulns.scannedAt) ?? '', base: vulns.ecosystem ?? '—' })}
          </p>
        </div>
        {operate && (
          <Button size="sm" variant="ghost" disabled={rescan.isPending} onClick={() => rescan.mutate()}>
            <RefreshCw className={cn(rescan.isPending && 'animate-spin')} aria-hidden />
            {t('vulns.rescan')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-5 pb-4">
        {vulns.error ? (
          <Badge variant="warning" className="w-fit">
            {vulns.error}
          </Badge>
        ) : summary ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
              <p className="text-sm font-medium">{t('vulns.fixable', { count: summary.fixable })}</p>
              <div className="mt-1.5">
                <SeverityCounts counts={summary.fixableBySeverity} />
              </div>
            </div>
            <div className="rounded-lg border px-4 py-3">
              <p className="text-sm font-medium">{t('vulns.unfixed', { count: summary.total - summary.fixable })}</p>
              <div className="mt-1.5">
                <SeverityCounts counts={summary.remainingBySeverity} withUnimportant />
              </div>
            </div>
          </div>
        ) : null}

        {vulns.packages.length > 0 && (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{t('vulns.hint')}</p>
              {unfixableCount > 0 && (
                <Button
                  size="sm"
                  variant={showUnfixable ? 'secondary' : 'outline'}
                  aria-pressed={showUnfixable}
                  onClick={() => setShowUnfixable(!showUnfixable)}
                >
                  {t('vulns.showUnfixable', { count: unfixableCount })}
                </Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-8" />
                  <TableHead>{t('machine.package')}</TableHead>
                  <TableHead>{t('machine.installed')}</TableHead>
                  <TableHead>{t('vulns.recommended')}</TableHead>
                  <TableHead>{t('vulns.fixedColumn')}</TableHead>
                  <TableHead className="text-right">{t('vulns.remainingColumn')}</TableHead>
                  {operate && machine.agent && <TableHead className="w-28" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => {
                  const expanded = open.has(item.source);
                  const ids = [...item.fixed, ...item.remaining].sort(
                    (a, b) => SEVERITY_ORDER.indexOf(severityOf(a)) - SEVERITY_ORDER.indexOf(severityOf(b))
                  );
                  const fixedSet = new Set(item.fixed);
                  const pending = item.upgradable.some((name) => busy.has(name));
                  return (
                    <Fragment key={item.source}>
                      <TableRow className="cursor-pointer" onClick={() => toggle(item.source)}>
                        <TableCell>
                          <ChevronRight
                            className={cn('size-4 text-muted-foreground transition-transform', expanded && 'rotate-90')}
                            aria-label={expanded ? t('vulns.collapse') : t('vulns.expand')}
                          />
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs font-medium">{item.source}</span>
                          {item.binaries.length > 1 || item.binaries[0] !== item.source ? (
                            <span className="block text-[11px] text-muted-foreground">{item.binaries.join(', ')}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{item.installed}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.candidate && item.fixed.length > 0 ? (
                            <span className="text-emerald-700 dark:text-emerald-400">{item.candidate}</span>
                          ) : (
                            <span className="text-muted-foreground">{t('vulns.noFix')}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <SeverityCounts counts={countBySeverity(item.fixed, severityOf)} />
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {item.remaining.length || '—'}
                        </TableCell>
                        {operate && machine.agent && (
                          <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                            {item.fixed.length > 0 &&
                              (pending ? (
                                <Badge variant="warning">{t('machine.status.pending')}</Badge>
                              ) : (
                                <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => update.mutate(item)}>
                                  {t('machine.update')}
                                </Button>
                              ))}
                          </TableCell>
                        )}
                      </TableRow>
                      {expanded && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell />
                          <TableCell colSpan={operate && machine.agent ? 6 : 5} className="pb-3">
                            <ul className="flex flex-col gap-1.5">
                              {ids.map((id) => {
                                const detail = vulns.details[id];
                                return (
                                  <li key={id} className="flex flex-wrap items-start gap-2 text-xs">
                                    <SeverityBadge severity={severityOf(id)} />
                                    <a
                                      href={referenceUrl(id, detail?.cve ?? null, vulns.ecosystem)}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                      className="inline-flex items-center gap-1 font-mono font-medium hover:underline"
                                    >
                                      {detail?.cve ?? id}
                                      <ExternalLink className="size-3" aria-hidden />
                                    </a>
                                    {typeof detail?.cvss === 'number' && (
                                      <span className="text-muted-foreground tabular-nums">CVSS {detail.cvss.toFixed(1)}</span>
                                    )}
                                    <span className={fixedSet.has(id) ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}>
                                      {fixedSet.has(id) ? t('vulns.fixedBy', { version: item.candidate ?? '' }) : t('vulns.noFixYet')}
                                    </span>
                                    {detail?.summary && (
                                      <span className="basis-full text-muted-foreground">{detail.summary}</span>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
