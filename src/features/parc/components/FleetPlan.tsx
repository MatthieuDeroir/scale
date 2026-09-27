'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MasterBadge, StatusDot, formatLastSeen, type FleetNode } from '@/features/fleets';
import { IssueKeyPanel } from '@/features/keys';
import { BookmarkPlus, ClipboardList, Inbox, KeyRound, LayoutTemplate, Monitor, Plus, Server, Trash2 } from 'lucide-react';
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
  usePermissions,
} from '@/shared/ui';
import { cn } from '@/shared/lib';
import {
  addSlots,
  applyTemplate,
  assignToSlot,
  createTemplate,
  deleteSlot,
  fetchPlan,
  fetchProducts,
  fetchTemplates,
  issueSlotKey,
  type PlanSlot,
  type SlotKind,
} from '../api';
import { unassignedNodes, useNodes } from '../lib';

type Open =
  | { kind: 'add' }
  | { kind: 'template' }
  | { kind: 'save' }
  | { kind: 'key'; slot: PlanSlot }
  | { kind: 'assign'; slot: PlanSlot }
  | null;

export const planKey = (tag: string) => ['plan', tag] as const;

function Field({ id, label, hint, children }: { id?: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function AddSlotsForm({ fleetTag, onDone }: { fleetTag: string; onDone: () => void }) {
  const t = useTranslations('parc.plan');
  const queryClient = useQueryClient();
  const products = useQuery({ queryKey: ['products'], queryFn: fetchProducts });
  const [kind, setKind] = useState<SlotKind>('equipment');
  const [productId, setProductId] = useState<string>('');
  const [count, setCount] = useState(1);
  const [label, setLabel] = useState('');
  const [reference, setReference] = useState('');
  const product = products.data?.find((item) => String(item.id) === productId);

  const mutation = useMutation({
    mutationFn: () =>
      addSlots(fleetTag, {
        kind,
        productId: kind === 'equipment' ? Number(productId) : null,
        count,
        label: label.trim() || (kind === 'hypervision' ? t('hypervision') : product?.name ?? ''),
        reference,
      }),
    onSuccess: (slots) => {
      queryClient.setQueryData(planKey(fleetTag), slots);
      toast.success(t('added', { count }));
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <div className="flex flex-col gap-4">
        <div role="radiogroup" aria-label={t('kind')} className="flex gap-1 rounded-lg bg-muted p-1">
          {(['equipment', 'hypervision'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={kind === value}
              onClick={() => setKind(value)}
              className={cn(
                'flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                kind === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {value === 'equipment' ? t('equipment') : t('hypervision')}
            </button>
          ))}
        </div>
        {kind === 'equipment' && (
          <Field label={t('product')}>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger aria-label={t('product')}>
                <SelectValue placeholder={t('chooseProduct')} />
              </SelectTrigger>
              <SelectContent>
                {(products.data ?? []).map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-[6rem_1fr] gap-3">
          <Field id="slot-count" label={t('count')}>
            <Input
              id="slot-count"
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(event) => setCount(Math.min(50, Math.max(1, Number(event.target.value) || 1)))}
            />
          </Field>
          <Field id="slot-label" label={t('label')}>
            <Input
              id="slot-label"
              value={label}
              placeholder={kind === 'hypervision' ? t('hypervision') : product?.name ?? ''}
              onChange={(event) => setLabel(event.target.value)}
            />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">{t('labelHint')}</p>
        {kind === 'equipment' && (
          <Field id="slot-reference" label={t('reference')}>
            <Input id="slot-reference" value={reference} onChange={(event) => setReference(event.target.value)} />
          </Field>
        )}
      </div>
      <DialogFooter>
        <Button
          variant="brand"
          disabled={mutation.isPending || (kind === 'equipment' && !productId)}
          onClick={() => mutation.mutate()}
        >
          <Plus aria-hidden />
          {t('add')}
        </Button>
      </DialogFooter>
    </>
  );
}

function TemplatePicker({ fleetTag, onDone }: { fleetTag: string; onDone: () => void }) {
  const t = useTranslations('parc.plan');
  const tc = useTranslations('parc.catalog');
  const queryClient = useQueryClient();
  const templates = useQuery({ queryKey: ['templates'], queryFn: fetchTemplates });
  const products = useQuery({ queryKey: ['products'], queryFn: fetchProducts });
  const names = new Map((products.data ?? []).map((item) => [item.id, item.name]));
  const mutation = useMutation({
    mutationFn: (id: number) => applyTemplate(fleetTag, id),
    onSuccess: (slots) => {
      queryClient.setQueryData(planKey(fleetTag), slots);
      toast.success(t('templateApplied'));
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if ((templates.data ?? []).length === 0) {
    return <p className="text-sm text-muted-foreground">{t('noTemplate')}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {templates.data!.map((template) => (
        <li key={template.id}>
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(template.id)}
            className="flex w-full flex-col gap-1 rounded-lg border p-3 text-left hover:bg-muted/50"
          >
            <span className="text-sm font-medium">{template.name}</span>
            {template.description && <span className="text-xs text-muted-foreground">{template.description}</span>}
            <span className="text-xs text-muted-foreground">
              {template.items
                .map(
                  (item) =>
                    `${item.count} × ${item.kind === 'hypervision' ? item.label : names.has(item.productId ?? -1) ? item.label : `${item.label} (${tc('unknownProduct')})`}`
                )
                .join(' · ')}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function SaveTemplateForm({ fleetTag, onDone }: { fleetTag: string; onDone: () => void }) {
  const t = useTranslations('parc.plan');
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const mutation = useMutation({
    mutationFn: () => createTemplate({ name: name.trim(), fromFleet: fleetTag }),
    onSuccess: async (template) => {
      await queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success(t('templateSaved', { name: template.name }));
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <>
      <Field id="template-name" label={t('templateName')}>
        <Input id="template-name" value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <DialogFooter>
        <Button variant="brand" disabled={!name.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
          <BookmarkPlus aria-hidden />
          {t('saveTemplate')}
        </Button>
      </DialogFooter>
    </>
  );
}

function AssignPicker({ slot, fleetTag, onDone }: { slot: PlanSlot; fleetTag: string; onDone: () => void }) {
  const t = useTranslations('parc.plan');
  const tf = useTranslations('fleets');
  const queryClient = useQueryClient();
  const pending = unassignedNodes(useNodes().data ?? []);
  const mutation = useMutation({
    mutationFn: (node: FleetNode) => assignToSlot(slot.id, node.id).then(() => node),
    onSuccess: async (node) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: planKey(fleetTag) }),
        queryClient.invalidateQueries({ queryKey: ['fleets', 'nodes'] }),
      ]);
      toast.success(t('assigned', { name: node.givenName || node.name, label: slot.label }));
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (pending.length === 0) return <p className="text-sm text-muted-foreground">{t('noPending')}</p>;
  return (
    <ul className="-mx-2 flex max-h-80 flex-col overflow-y-auto">
      {pending.map((node) => (
        <li key={node.id}>
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(node)}
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm hover:bg-muted/60"
          >
            <StatusDot online={node.online} label={node.online ? tf('online') : tf('offline')} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{node.givenName || node.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {[node.enrollment?.model, node.enrollment?.serial, node.ipAddresses[0]].filter(Boolean).join(' · ')}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function SlotStatus({ slot }: { slot: PlanSlot }) {
  const t = useTranslations('parc.plan');
  const tf = useTranslations('fleets');
  if (slot.machine) {
    return (
      <Link href={`/machines/${slot.machine.id}`} className="flex items-center gap-2 text-sm hover:underline">
        <StatusDot online={slot.machine.online} label={slot.machine.online ? tf('online') : tf('offline')} />
        <span className="font-medium">{slot.machine.name}</span>
        {slot.machine.ip && <span className="font-mono text-xs text-muted-foreground">{slot.machine.ip}</span>}
      </Link>
    );
  }
  if (slot.keyIssuedAt) {
    return <Badge variant="warning">{t('keyIssued', { date: formatLastSeen(slot.keyIssuedAt) ?? '' })}</Badge>;
  }
  return <Badge variant="secondary">{t('toFill')}</Badge>;
}

/**
 * Plan d'une flotte : on prépare ce qui doit la composer (produits, postes
 * d'hypervision), puis on pourvoit chaque emplacement en émettant sa clé ou
 * en y affectant une machine en attente.
 */
export function FleetPlan({ fleetTag, fleetLabel }: { fleetTag: string; fleetLabel: string }) {
  const t = useTranslations('parc.plan');
  const { operate } = usePermissions();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<Open>(null);
  const plan = useQuery({ queryKey: planKey(fleetTag), queryFn: () => fetchPlan(fleetTag), refetchInterval: 15000 });
  const pendingCount = unassignedNodes(useNodes().data ?? []).length;

  const removal = useMutation({
    mutationFn: deleteSlot,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: planKey(fleetTag) });
      toast.success(t('removed'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const slots = plan.data ?? [];
  const filled = slots.filter((slot) => slot.machine).length;
  const close = () => setOpen(null);

  const actions = operate && (
    <span className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => setOpen({ kind: 'template' })}>
        <LayoutTemplate aria-hidden />
        {t('applyTemplate')}
      </Button>
      {slots.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => setOpen({ kind: 'save' })}>
          <BookmarkPlus aria-hidden />
          {t('saveTemplate')}
        </Button>
      )}
      <Button variant="brand" size="sm" onClick={() => setOpen({ kind: 'add' })}>
        <Plus aria-hidden />
        {t('add')}
      </Button>
    </span>
  );

  const dialog = (() => {
    if (!open) return null;
    switch (open.kind) {
      case 'add':
        return { title: t('add'), description: fleetLabel, body: <AddSlotsForm fleetTag={fleetTag} onDone={close} /> };
      case 'template':
        return {
          title: t('templateTitle'),
          description: t('templateDescription'),
          body: <TemplatePicker fleetTag={fleetTag} onDone={close} />,
        };
      case 'save':
        return {
          title: t('saveTitle'),
          description: t('saveDescription'),
          body: <SaveTemplateForm fleetTag={fleetTag} onDone={close} />,
        };
      case 'key':
        return {
          title: t('keyTitle', { label: open.slot.label }),
          description: t('keyDescription'),
          body: (
            <IssueKeyPanel
              fleetTag={fleetTag}
              kind={open.slot.kind}
              fixedName={open.slot.label}
              issue={(expiration) => issueSlotKey(open.slot.id, expiration)}
              onIssued={() => queryClient.invalidateQueries({ queryKey: planKey(fleetTag) })}
              onDone={close}
            />
          ),
        };
      case 'assign':
        return {
          title: t('assignTitle', { label: open.slot.label }),
          description: t('assignDescription'),
          body: <AssignPicker slot={open.slot} fleetTag={fleetTag} onDone={close} />,
        };
    }
  })();

  return (
    <Card>
      <CardHeader className="px-5 pt-5 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4 text-muted-foreground" aria-hidden />
              {t('title')}
              {slots.length > 0 && (
                <Badge variant={filled === slots.length ? 'ok' : 'secondary'}>
                  {t('progress', { done: filled, total: slots.length })}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </div>
          {actions}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        {slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <ul className="-mx-2 flex flex-col divide-y">
            {slots.map((slot) => {
              const Icon = slot.kind === 'hypervision' ? Monitor : Server;
              return (
                <li key={slot.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-2.5">
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="flex min-w-40 flex-1 flex-col">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {slot.label}
                      {slot.product?.role === 'master' && <MasterBadge />}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {[slot.kind === 'hypervision' ? t('hypervision') : slot.product?.name, slot.reference]
                        .filter((part) => part && part !== slot.label)
                        .join(' · ')}
                    </span>
                  </span>
                  <SlotStatus slot={slot} />
                  {operate && !slot.machine && (
                    <span className="flex gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => setOpen({ kind: 'key', slot })}>
                        <KeyRound aria-hidden />
                        {t('issueKey')}
                      </Button>
                      {slot.kind === 'equipment' && pendingCount > 0 && (
                        <Button variant="outline" size="sm" onClick={() => setOpen({ kind: 'assign', slot })}>
                          <Inbox aria-hidden />
                          {t('assign')}
                        </Button>
                      )}
                    </span>
                  )}
                  {operate && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${t('remove')} : ${slot.label}`}
                      title={t('remove')}
                      disabled={removal.isPending}
                      onClick={() => removal.mutate(slot.id)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      <Dialog open={dialog !== null} onOpenChange={(value) => !value && close()}>
        {dialog && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{dialog.title}</DialogTitle>
              <DialogDescription>{dialog.description}</DialogDescription>
            </DialogHeader>
            {dialog.body}
          </DialogContent>
        )}
      </Dialog>
    </Card>
  );
}
