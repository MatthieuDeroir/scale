'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Lock, Plus, ShieldCheck, Terminal, Trash2, Waypoints } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  usePermissions,
} from '@/shared/ui';
import { cn } from '@/shared/lib';
import { addAccess, fetchPolicy, removeAccess, type AclPolicy, type PolicyRule } from '../api';

type FleetOption = { tag: string; label: string };

const INTERNAL = 'tag:interne';
const CHIP_LIMIT = 30;

function Name({ children }: { children: ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>;
}

function RuleRow({ icon, children, action }: { icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&>svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0 flex-1 text-sm text-muted-foreground">{children}</div>
      {action}
    </li>
  );
}

function RemoveButton({ rule }: { rule: PolicyRule }) {
  const t = useTranslations('acl');
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const mutation = useMutation({
    mutationFn: () => removeAccess(rule.id),
    onSuccess: (policy) => {
      queryClient.setQueryData(['acl', 'policy'], policy);
      toast.success(t('rules.removed'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setConfirming(false);
    },
  });
  return (
    <Button
      size="sm"
      variant={confirming ? 'destructive' : 'ghost'}
      disabled={mutation.isPending}
      onClick={() => (confirming ? mutation.mutate() : setConfirming(true))}
    >
      {confirming ? t('rules.confirmRemove') : <Trash2 aria-label={t('rules.remove')} />}
    </Button>
  );
}

function AddAccessDialog({
  fleets,
  open,
  onOpenChange,
}: {
  fleets: FleetOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('acl');
  const queryClient = useQueryClient();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [allPorts, setAllPorts] = useState(true);
  const [ports, setPorts] = useState('');
  const label = (tag: string) => fleets.find((fleet) => fleet.tag === tag)?.label ?? tag;

  const mutation = useMutation({
    mutationFn: () => addAccess({ from, to, ports: allPorts ? '*' : ports }),
    onSuccess: (policy) => {
      queryClient.setQueryData(['acl', 'policy'], policy);
      toast.success(t('rules.added'));
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sources = fleets.filter((fleet) => fleet.tag !== INTERNAL);
  const ready = from && to && from !== to && (allPorts || ports.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('rules.addTitle')}</DialogTitle>
          <DialogDescription>{t('rules.addDescription')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-from">{t('rules.from')}</Label>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger id="rule-from">
                <SelectValue placeholder={t('rules.chooseFleet')} />
              </SelectTrigger>
              <SelectContent>
                {sources.map((fleet) => (
                  <SelectItem key={fleet.tag} value={fleet.tag}>
                    {fleet.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-to">{t('rules.to')}</Label>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger id="rule-to">
                <SelectValue placeholder={t('rules.chooseFleet')} />
              </SelectTrigger>
              <SelectContent>
                {fleets
                  .filter((fleet) => fleet.tag !== from)
                  .map((fleet) => (
                    <SelectItem key={fleet.tag} value={fleet.tag}>
                      {fleet.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t('rules.ports')}</Label>
            <div role="radiogroup" aria-label={t('rules.ports')} className="flex gap-1 rounded-lg bg-muted p-1">
              {[true, false].map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  role="radio"
                  aria-checked={allPorts === value}
                  onClick={() => setAllPorts(value)}
                  className={cn(
                    'flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium',
                    allPorts === value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {value ? t('rules.allPorts') : t('rules.somePorts')}
                </button>
              ))}
            </div>
            {!allPorts && (
              <>
                <Input
                  aria-label={t('rules.portsList')}
                  placeholder="22, 443, 5900-5910"
                  value={ports}
                  onChange={(event) => setPorts(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t('rules.portsHint')}</p>
              </>
            )}
          </div>
          {from && to && from !== to && (
            <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm">
              {t('rules.warning', { from: label(from), to: label(to) })}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="brand" disabled={!ready || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? t('rules.adding') : t('rules.addConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Rules({ policy, fleets }: { policy: AclPolicy; fleets: FleetOption[] }) {
  const t = useTranslations('acl');
  const { operate } = usePermissions();
  const [adding, setAdding] = useState(false);
  const [showAllIsolated, setShowAllIsolated] = useState(false);
  const label = (tag: string) =>
    fleets.find((fleet) => fleet.tag === tag)?.label ??
    (tag === INTERNAL
      ? 'Interne'
      : tag === 'tag:a-assigner'
        ? t('rules.unassigned')
        : tag.replace(/^tag:flotte-/, ''));

  const support = policy.rules.filter((rule) => rule.kind === 'support');
  const isolated = policy.rules.filter((rule) => rule.kind === 'isolation').map((rule) => rule.src[0]);
  const custom = policy.rules.filter((rule) => rule.kind === 'custom');
  const other = policy.rules.filter((rule) => rule.kind === 'other');
  const shownIsolated = showAllIsolated ? isolated : isolated.slice(0, CHIP_LIMIT);

  return (
    <>
      {policy.warnings.length > 0 && (
        <div role="alert" className="flex flex-col gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          {policy.warnings.map((warning) => (
            <p key={`${warning.code}-${warning.tag ?? ''}`} className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden />
              {t('rules.warnNoIsolation', { fleet: label(warning.tag!) })}
            </p>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-1">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="text-base">{t('rules.title')}</CardTitle>
            <CardDescription>{t('rules.description')}</CardDescription>
          </div>
          {operate && (
            <Button variant="brand" size="sm" onClick={() => setAdding(true)}>
              <Plus aria-hidden />
              {t('rules.add')}
            </Button>
          )}
        </CardHeader>
        <CardContent className="px-5 pb-3">
          <ul className="divide-y">
            {support.map((rule) => (
              <RuleRow
                key={rule.id}
                icon={<ShieldCheck />}
                action={
                  <Link href="/support" className="text-xs font-medium text-muted-foreground hover:text-foreground">
                    {t('rules.supportManage')}
                  </Link>
                }
              >
                <span className="flex flex-wrap items-center gap-1.5">
                  <Name>{t('rules.supportPost', { name: rule.from!.replace(/^tag:support-/, '') })}</Name>
                  <ArrowRight className="size-3.5" aria-label={t('rules.canReach')} />
                  {rule.targets?.includes('*') ? (
                    <Badge variant="warning">{t('rules.supportEverywhere')}</Badge>
                  ) : (
                    rule.targets?.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {label(tag)}
                      </Badge>
                    ))
                  )}
                </span>
              </RuleRow>
            ))}
            <RuleRow icon={<Lock />} action={<Badge variant="secondary">{t('rules.base')}</Badge>}>
              <p>{t.rich('rules.isolation', { count: isolated.length, name: (chunks) => <Name>{chunks}</Name> })}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {shownIsolated.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {label(tag)}
                  </Badge>
                ))}
                {isolated.length > CHIP_LIMIT && (
                  <button
                    type="button"
                    className="text-xs font-medium text-foreground hover:underline"
                    onClick={() => setShowAllIsolated(!showAllIsolated)}
                  >
                    {showAllIsolated ? t('rules.showLess') : t('rules.showAll', { count: isolated.length })}
                  </button>
                )}
              </div>
            </RuleRow>
            {custom.map((rule) => (
              <RuleRow
                key={rule.id}
                icon={<Waypoints />}
                action={
                  <span className="flex items-center gap-2">
                    <Badge variant="warning">{t('rules.exception')}</Badge>
                    {operate && <RemoveButton rule={rule} />}
                  </span>
                }
              >
                <span className="flex flex-wrap items-center gap-1.5">
                  <Name>{label(rule.from!)}</Name>
                  <ArrowRight className="size-3.5" aria-label={t('rules.canReach')} />
                  <Name>{label(rule.to!)}</Name>
                  <span className="text-xs">
                    {rule.ports === '*' ? t('rules.onAllPorts') : t('rules.onPorts', { ports: rule.ports!.replace(/,/g, ', ') })}
                  </span>
                </span>
              </RuleRow>
            ))}
            {other.map((rule) => (
              <RuleRow key={rule.id} icon={<AlertTriangle />} action={<Badge variant="outline">{t('rules.advanced')}</Badge>}>
                <span className="font-mono text-xs">
                  {rule.src.join(', ')} → {rule.dst.join(', ')}
                </span>
              </RuleRow>
            ))}
          </ul>
          {custom.length === 0 && <p className="pb-2 text-xs text-muted-foreground">{t('rules.noException')}</p>}
        </CardContent>
      </Card>

      {policy.ssh.length > 0 && (
        <Card>
          <CardHeader className="px-5 pt-5 pb-1">
            <CardTitle className="text-base">{t('rules.sshTitle')}</CardTitle>
            <CardDescription>{t('rules.sshDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-3">
            <ul className="divide-y">
              {policy.ssh.map((rule, index) => (
                <RuleRow key={index} icon={<Terminal />}>
                  {t.rich('rules.ssh', {
                    from: rule.src.map(label).join(', '),
                    to: rule.dst.map(label).join(', '),
                    users: rule.users.join(', '),
                    name: (chunks) => <Name>{chunks}</Name>,
                  })}
                </RuleRow>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {adding && <AddAccessDialog fleets={fleets} open onOpenChange={setAdding} />}
    </>
  );
}

/**
 * Lecture guidée de la politique : qui peut joindre qui, en phrases, avec les
 * noms de flottes. Les exceptions au cloisonnement s'ajoutent et se retirent
 * ici ; le reste passe par l'éditeur brut.
 */
export function AccessRules({ fleets }: { fleets: FleetOption[] }) {
  const { data: policy, error } = useQuery({ queryKey: ['acl', 'policy'], queryFn: fetchPolicy });
  if (error) {
    return (
      <Badge variant="critical" role="alert" className="w-fit">
        {error.message}
      </Badge>
    );
  }
  if (!policy) return <Skeleton className="h-64 w-full" />;
  return <Rules policy={policy} fleets={fleets} />;
}
