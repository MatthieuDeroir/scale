'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusDot } from '@/features/fleets';
import {
  Download,
  ExternalLink,
  FileJson,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Trash2,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  StatCard,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  usePagination,
  usePermissions,
} from '@/shared/ui';
import { cn, datedFilename, downloadFile, toCsv } from '@/shared/lib';
import {
  VEX_JUSTIFICATIONS,
  deleteAssessment,
  fetchProducts,
  fetchSecurity,
  fetchVulnDetail,
  saveAssessment,
  vulnLinks,
  type Assessment,
  type ParkVuln,
  type ParkVulnItem,
  type Severity,
  type VexJustification,
  type VexStatus,
  type VulnState,
} from '../api';
import { useFleetOptions } from '../lib';
import { SEVERITY_ORDER, SeverityBadge } from './MachineVulns';

const ALL = 'all';
const PARK = 'park';
const PAGE_SIZE = 25;
type StateFilter = 'todo' | VulnState | typeof ALL;

const STATE_TONE: Record<VulnState, 'critical' | 'warning' | 'secondary' | 'ok'> = {
  open: 'critical',
  affected: 'critical',
  investigating: 'warning',
  excluded: 'ok',
};

export const securityKey = ['security'] as const;

function StateBadge({ state }: { state: VulnState }) {
  const t = useTranslations('parc.security');
  return <Badge variant={STATE_TONE[state]}>{t(`state.${state}`)}</Badge>;
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Déclaration VEX (OpenVEX) des décisions prises : ce que le CRA attend qu'on sache fournir. */
function toOpenVex(vulns: ParkVulnItem[]) {
  const now = new Date().toISOString();
  const slug = (name: string) =>
    normalize(name)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return {
    '@context': 'https://openvex.dev/ns/v0.2.0',
    '@id': `urn:stramatel:stramscale:vex:${now}`,
    author: 'Stramatel',
    timestamp: now,
    version: 1,
    statements: vulns.flatMap((vuln) =>
      vuln.assessments.map((item) => ({
        vulnerability: { name: vuln.key, ...(vuln.ids.length > 0 ? { aliases: vuln.ids } : {}) },
        products: [
          { '@id': item.productName ? `urn:stramatel:product:${slug(item.productName)}` : 'urn:stramatel:parc' },
        ],
        status: item.status,
        ...(item.justification ? { justification: item.justification } : {}),
        ...(item.note ? { status_notes: item.note } : {}),
        timestamp: item.updatedAt,
      })),
    ),
  };
}

function AssessmentForm({ vuln, onSaved }: { vuln: ParkVuln; onSaved: () => void }) {
  const t = useTranslations('parc.security');
  const queryClient = useQueryClient();
  const products = useQuery({ queryKey: ['products'], queryFn: fetchProducts });
  const concerned = new Set(vuln.occurrences.flatMap((item) => (item.productId ? [item.productId] : [])));
  const [scope, setScope] = useState(PARK);
  const [status, setStatus] = useState<VexStatus>('not_affected');
  const [justification, setJustification] = useState<VexJustification | ''>('');
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      saveAssessment({
        vulnKey: vuln.key,
        productId: scope === PARK ? null : Number(scope),
        status,
        justification: status === 'not_affected' ? (justification as VexJustification) : null,
        note,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: securityKey }),
        queryClient.invalidateQueries({ queryKey: ['security', 'summary'] }),
      ]);
      toast.success(t('saved'));
      setNote('');
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed p-3">
      <p className="text-sm font-medium">{t('decide')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>{t('scope')}</Label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger aria-label={t('scope')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PARK}>{t('wholePark')}</SelectItem>
              {(products.data ?? [])
                .filter((item) => concerned.has(item.id))
                .map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t('status')}</Label>
          <div role="radiogroup" aria-label={t('status')} className="flex gap-1 rounded-lg bg-muted p-1">
            {(['not_affected', 'under_investigation', 'affected'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={status === value}
                onClick={() => setStatus(value)}
                className={cn(
                  'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                  status === value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(`vex.${value}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
      {status === 'not_affected' && (
        <div className="flex flex-col gap-1.5">
          <Label>{t('justification')}</Label>
          <Select value={justification} onValueChange={(value) => setJustification(value as VexJustification)}>
            <SelectTrigger aria-label={t('justification')}>
              <SelectValue placeholder={t('chooseJustification')} />
            </SelectTrigger>
            <SelectContent>
              {VEX_JUSTIFICATIONS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`justifications.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {justification && <p className="text-xs text-muted-foreground">{t(`justificationHints.${justification}`)}</p>}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="assessment-note">{t('note')}</Label>
        <textarea
          id="assessment-note"
          rows={3}
          value={note}
          placeholder={t('notePlaceholder')}
          onChange={(event) => setNote(event.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <Button
        variant="brand"
        className="w-fit self-end"
        disabled={mutation.isPending || (status === 'not_affected' && !justification)}
        onClick={() => mutation.mutate()}
      >
        {t('save')}
      </Button>
    </div>
  );
}

function Decisions({ vuln }: { vuln: ParkVuln }) {
  const t = useTranslations('parc.security');
  const { operate } = usePermissions();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: (item: Assessment) => deleteAssessment(item.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: securityKey });
      toast.success(t('removed'));
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (vuln.assessments.length === 0) return <p className="text-sm text-muted-foreground">{t('noDecision')}</p>;
  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {vuln.assessments.map((item) => (
        <li key={item.id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2">
              <Badge
                variant={item.status === 'not_affected' ? 'ok' : item.status === 'affected' ? 'critical' : 'warning'}
              >
                {t(`vex.${item.status}`)}
              </Badge>
              <span className="font-medium">{item.productName ?? t('wholePark')}</span>
            </span>
            {item.justification && <span className="text-xs">{t(`justifications.${item.justification}`)}</span>}
            {item.note && <span className="whitespace-pre-wrap text-xs text-muted-foreground">{item.note}</span>}
            <span className="text-[11px] text-muted-foreground">
              {t('by', { author: item.author, date: new Date(item.updatedAt).toLocaleString() })}
            </span>
          </span>
          {operate && (
            <Button
              size="icon"
              variant="ghost"
              aria-label={t('removeDecision')}
              title={t('removeDecision')}
              disabled={remove.isPending}
              onClick={() => remove.mutate(item)}
            >
              <Trash2 aria-hidden />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function VulnDetail({ item, onClose }: { item: ParkVulnItem; onClose: () => void }) {
  const t = useTranslations('parc.security');
  const { data: vuln, error } = useQuery({
    queryKey: [...securityKey, 'detail', item.key],
    queryFn: () => fetchVulnDetail(item.key),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        {vuln ? (
          <VulnDetailBody vuln={vuln} onClose={onClose} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-mono">{item.key}</DialogTitle>
              <DialogDescription>{error ? error.message : t('loading')}</DialogDescription>
            </DialogHeader>
            {!error && <Skeleton className="h-64 w-full" />}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VulnDetailBody({ vuln, onClose }: { vuln: ParkVuln; onClose: () => void }) {
  const t = useTranslations('parc.security');
  const { operate } = usePermissions();
  const fleets = useFleetOptions();
  const fleetLabel = (tag: string | null) => (tag ? (fleets.find((item) => item.tag === tag)?.label ?? tag) : '—');

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{vuln.key}</span>
          <SeverityBadge severity={vuln.severity} />
          {vuln.cvss !== null && <Badge variant="secondary">CVSS {vuln.cvss.toFixed(1)}</Badge>}
          <StateBadge state={vuln.state} />
        </DialogTitle>
        <DialogDescription>{vuln.summary ?? t('noSummary')}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-5 overflow-y-auto">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {vuln.published && <span>{t('published', { date: new Date(vuln.published).toLocaleDateString() })}</span>}
          <span>{t('packagesLabel', { packages: vuln.packages.join(', ') })}</span>
          {vulnLinks(vuln).map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline"
            >
              {link.label}
              <ExternalLink className="size-3" aria-hidden />
            </a>
          ))}
        </div>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            {vuln.active === 0 ? t('allExcluded') : t('machinesTitle', { active: vuln.active, fixable: vuln.fixableOn })}
          </h3>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t('machine')}</TableHead>
                  <TableHead>{t('fleet')}</TableHead>
                  <TableHead>{t('product')}</TableHead>
                  <TableHead>{t('package')}</TableHead>
                  <TableHead>{t('fix')}</TableHead>
                  <TableHead>{t('decision')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vuln.occurrences.map((item) => (
                  <TableRow key={`${item.nodeId}-${item.package}`} className={cn(item.excluded && 'opacity-60')}>
                    <TableCell>
                      <Link
                        href={`/machines/${item.nodeId}`}
                        className="flex items-center gap-2 font-medium hover:underline"
                      >
                        <StatusDot online={item.online} label={item.machine} />
                        {item.machine}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">{fleetLabel(item.fleetTag)}</TableCell>
                    <TableCell className="text-xs">{item.productName ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{item.package}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.fixable ? (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          {item.installed} → {item.candidate}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{t('noFix')}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{item.status ? t(`vex.${item.status}`) : t('state.open')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t('decisions')}</h3>
          <Decisions vuln={vuln} />
        </section>

        {operate && <AssessmentForm vuln={vuln} onSaved={() => undefined} />}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('close')}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Cybersécurité du parc : toutes les failles, regroupées par CVE, avec les
 * machines touchées et la mise à jour qui les corrige. Le tri (VEX) écarte
 * une faille — même critique — quand elle ne nous concerne pas (composant
 * absent, code non exécuté, contexte non exploitable…), pour tout le parc ou
 * pour un produit, avec sa justification. Les failles écartées sortent des
 * décomptes, ici comme sur le tableau de bord.
 */
export function SecurityScreen() {
  const t = useTranslations('parc.security');
  const tp = useTranslations('parc');
  const { data, error, isPending } = useQuery({
    queryKey: securityKey,
    queryFn: fetchSecurity,
    refetchInterval: 60000,
  });
  const products = useQuery({ queryKey: ['products'], queryFn: fetchProducts });
  const [query, setQuery] = useState('');
  const [state, setState] = useState<StateFilter>('todo');
  const [severity, setSeverity] = useState<Severity | typeof ALL>(ALL);
  const [product, setProduct] = useState(ALL);
  const [fixableOnly, setFixableOnly] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const vulns = useMemo(() => data?.vulns ?? [], [data]);
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return vulns.filter((vuln) => {
      if (
        state === 'todo'
          ? vuln.state === 'excluded' || vuln.severity === 'unimportant'
          : state !== ALL && vuln.state !== state
      )
        return false;
      if (severity !== ALL && vuln.severity !== severity) return false;
      if (fixableOnly && vuln.fixableOn === 0) return false;
      if (product !== ALL && !vuln.productIds.includes(Number(product))) return false;
      if (!q) return true;
      return [vuln.key, ...vuln.ids, ...vuln.packages, vuln.summary ?? ''].some((value) =>
        normalize(value).includes(q),
      );
    });
  }, [vulns, query, state, severity, product, fixableOnly]);
  const pagination = usePagination(filtered, PAGE_SIZE);
  const opened = vulns.find((vuln) => vuln.key === openKey);

  const header = <PageHeader title={t('title')} description={t('description')} />;
  if (isPending) {
    return (
      <>
        {header}
        <Skeleton className="h-96 w-full" />
      </>
    );
  }
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

  const summary = data!.summary;
  const todo = vulns.filter((vuln) => vuln.state !== 'excluded' && vuln.severity !== 'unimportant');
  const serious = todo.filter((vuln) => vuln.severity === 'critical' || vuln.severity === 'high').length;
  const fixable = todo.filter((vuln) => vuln.fixableOn > 0).length;

  function exportCsv() {
    downloadFile(
      datedFilename('failles'),
      toCsv([
        ['Faille', 'Gravité', 'CVSS', 'État', 'Paquets', 'Machines touchées', 'Corrigeable sur', 'Décisions'],
        ...filtered.map((vuln) => [
          vuln.key,
          tp(`severity.${vuln.severity}`),
          vuln.cvss?.toFixed(1) ?? '',
          t(`state.${vuln.state}`),
          vuln.packages.join(' '),
          String(vuln.active),
          String(vuln.fixableOn),
          vuln.assessments
            .map(
              (item) =>
                `${item.productName ?? t('wholePark')} : ${t(`vex.${item.status}`)}${item.justification ? ` (${t(`justifications.${item.justification}`)})` : ''}`,
            )
            .join(' ; '),
        ]),
      ]),
    );
  }
  function exportVex() {
    const blob = new Blob([JSON.stringify(toOpenVex(vulns), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stramscale-vex-${new Date().toISOString().slice(0, 10)}.openvex.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download aria-hidden />
              {t('exportCsv')}
            </Button>
            <Button variant="outline" onClick={exportVex} title={t('exportVexHint')}>
              <FileJson aria-hidden />
              {t('exportVex')}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label={t('kpi.todo')}
          value={todo.length}
          icon={ShieldAlert}
          tone={serious > 0 ? 'critical' : 'default'}
        />
        <StatCard label={t('kpi.serious')} value={serious} icon={ShieldAlert} tone={serious > 0 ? 'critical' : 'ok'} />
        <StatCard label={t('kpi.fixable')} value={fixable} icon={Wrench} />
        <StatCard
          label={t('kpi.triaged', { investigating: summary.investigating })}
          value={summary.excluded}
          icon={summary.investigating > 0 ? ShieldQuestion : ShieldCheck}
          tone="ok"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            aria-label={t('search')}
            placeholder={t('search')}
            className="pl-8"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Select value={state} onValueChange={(value) => setState(value as StateFilter)}>
          <SelectTrigger aria-label={t('filterState')} className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todo">{t('filter.todo')}</SelectItem>
            <SelectItem value="open">{t('state.open')}</SelectItem>
            <SelectItem value="investigating">{t('state.investigating')}</SelectItem>
            <SelectItem value="affected">{t('state.affected')}</SelectItem>
            <SelectItem value="excluded">{t('state.excluded')}</SelectItem>
            <SelectItem value={ALL}>{t('filter.all')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severity} onValueChange={(value) => setSeverity(value as Severity | typeof ALL)}>
          <SelectTrigger aria-label={t('filterSeverity')} className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('filter.allSeverities')}</SelectItem>
            {SEVERITY_ORDER.map((level) => (
              <SelectItem key={level} value={level}>
                {tp(`severity.${level}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={product} onValueChange={setProduct}>
          <SelectTrigger aria-label={t('filterProduct')} className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('filter.allProducts')}</SelectItem>
            {(products.data ?? []).map((item) => (
              <SelectItem key={item.id} value={String(item.id)}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={fixableOnly} onCheckedChange={setFixableOnly} aria-label={t('fixableOnly')} />
          {t('fixableOnly')}
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={vulns.length === 0 ? t('emptyPark') : t('emptyFilter')} />
      ) : (
        <div className="flex flex-col gap-3">
          <Card className="px-2">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t('vuln')}</TableHead>
                  <TableHead>{t('severity')}</TableHead>
                  <TableHead>{t('package')}</TableHead>
                  <TableHead className="text-right">{t('machines')}</TableHead>
                  <TableHead>{t('stateLabel')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.items.map((vuln) => (
                  <TableRow key={vuln.key} className="cursor-pointer" onClick={() => setOpenKey(vuln.key)}>
                    <TableCell className="max-w-md">
                      <button type="button" className="text-left" onClick={() => setOpenKey(vuln.key)}>
                        <span className="block font-mono text-sm font-medium">{vuln.key}</span>
                        <span className="line-clamp-1 text-xs text-muted-foreground">
                          {vuln.summary ?? t('noSummary')}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <SeverityBadge severity={vuln.severity} />
                        {vuln.cvss !== null && (
                          <span className="text-xs tabular-nums text-muted-foreground">{vuln.cvss.toFixed(1)}</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{vuln.packages.join(', ')}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {vuln.active}
                      {vuln.fixableOn > 0 && (
                        <span className="ml-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                          {t('fixableOn', { count: vuln.fixableOn })}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StateBadge state={vuln.state} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Pagination {...pagination} label={(range) => t('pagination', range)} />
        </div>
      )}

      {opened && <VulnDetail item={opened} onClose={() => setOpenKey(null)} />}
    </>
  );
}
