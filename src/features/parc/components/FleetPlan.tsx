'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MasterBadge, StatusDot, formatLastSeen, type FleetNode } from '@/features/fleets';
import { IssueKeyPanel } from '@/features/keys';
import { BookmarkPlus, ClipboardList, CornerDownRight, Inbox, KeyRound, LayoutTemplate, Monitor, Plus, Server, Trash2 } from 'lucide-react';
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
  usePermissions,
} from '@/shared/ui';
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
} from '../api';
import { unassignedNodes, useNodes } from '../lib';
import { slotHostname } from '@/core/hostname';
import { cn } from '@/shared/lib';
import { SlotLinesEditor, describeItem, emptyLine, linesToItems, type SlotLine } from './SlotLinesEditor';

type Open =
  | { kind: 'add' }
  | { kind: 'template' }
  | { kind: 'save' }
  | { kind: 'key'; slot: PlanSlot }
  | { kind: 'assign'; slot: PlanSlot }
  | null;

export const planKey = (tag: string) => ['plan', tag] as const;

/** Chaque serveur suivi de ses REPLICA, dans l'ordre du plan. */
export function orderedSlots(slots: PlanSlot[]): PlanSlot[] {
  const ids = new Set(slots.map((slot) => slot.id));
  const out: PlanSlot[] = [];
  for (const slot of slots) {
    if (slot.parentSlotId && ids.has(slot.parentSlotId)) continue;
    out.push(slot, ...slots.filter((item) => item.parentSlotId === slot.id));
  }
  return out;
}

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
  const [lines, setLines] = useState<SlotLine[]>([emptyLine()]);
  const [reference, setReference] = useState('');
  const items = linesToItems(lines, products.data ?? [], t('hypervision'));

  const mutation = useMutation({
    mutationFn: async () => {
      let slots: PlanSlot[] = [];
      // Dans l'ordre saisi : le plan garde la composition telle qu'elle a été pensée.
      for (const item of items) {
        if (item.kind === 'support') continue;
        slots = await addSlots(fleetTag, {
          kind: item.kind,
          productId: item.productId,
          count: item.count,
          label: item.label,
          slaves: item.slaves,
          reference: item.kind === 'equipment' ? reference : undefined,
        });
      }
      return slots;
    },
    onSuccess: (slots) => {
      queryClient.setQueryData(planKey(fleetTag), slots);
      toast.success(t('added', { count: items.reduce((sum, item) => sum + item.count * (1 + (item.slaves ?? 0)), 0) }));
      onDone();
    },
    onError: async (error: Error) => {
      toast.error(error.message);
      await queryClient.invalidateQueries({ queryKey: planKey(fleetTag) });
    },
  });

  return (
    <>
      <div className="flex flex-col gap-4">
        <SlotLinesEditor lines={lines} onChange={setLines} products={products.data ?? []} />
        <p className="text-xs text-muted-foreground">{t('labelHint')}</p>
        <Field id="slot-reference" label={t('reference')}>
          <Input id="slot-reference" value={reference} onChange={(event) => setReference(event.target.value)} />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="brand" disabled={mutation.isPending || items.length === 0} onClick={() => mutation.mutate()}>
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
                    `${describeItem(item)}${item.kind === 'equipment' && !names.has(item.productId ?? -1) ? ` (${tc('unknownProduct')})` : ''}`
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

  const addSlave = useMutation({
    mutationFn: (parentSlotId: number) => addSlots(fleetTag, { parentSlotId, count: 1 }),
    onSuccess: (next) => queryClient.setQueryData(planKey(fleetTag), next),
    onError: (error: Error) => toast.error(error.message),
  });

  const slots = orderedSlots(plan.data ?? []);
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
              fixedName={slotHostname(fleetTag, open.slot.label)}
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
    <Card id="plan" className="scroll-mt-4">
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
              const server = Boolean(slot.product?.master) && !slot.parentSlotId;
              const withSlaves = server && Boolean(slot.product?.slaves);
              const slaveCount = slots.filter((item) => item.parentSlotId === slot.id).length;
              return (
                <li
                  key={slot.id}
                  className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-2.5', slot.parentSlotId && 'pl-9')}
                >
                  {slot.parentSlotId ? (
                    <CornerDownRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className="flex min-w-40 flex-1 flex-col">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {slot.label}
                      {server && <MasterBadge />}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {[
                        slot.kind === 'hypervision' ? t('hypervision') : slot.product?.name,
                        withSlaves ? t('slaveCount', { count: slaveCount }) : slot.parentSlotId ? 'REPLICA' : null,
                        slot.reference,
                      ]
                        .filter((part) => part && part !== slot.label)
                        .join(' · ')}
                    </span>
                  </span>
                  <SlotStatus slot={slot} />
                  {operate && withSlaves && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={addSlave.isPending}
                      onClick={() => addSlave.mutate(slot.id)}
                    >
                      <Plus aria-hidden />
                      {t('addSlave')}
                    </Button>
                  )}
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
                      title={server && slaveCount > 0 ? t('removeWithSlaves') : t('remove')}
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
