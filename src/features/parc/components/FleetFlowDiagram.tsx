'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PolicyRule } from '@/features/acl';
import { fleetSlug, isHypervision, isMaster } from '@/features/fleets';
import { Cable, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@/shared/ui';
import { deleteLink, saveLink, type PlanSlot, type Product, type ProductLink } from '../api';
import type { FleetSummary } from '../lib';

const W = 960;
const BOX_W = 176;
const BOX_H = 42;
const ROW = 58;
const TOP = 40;
const MAX_COLUMN = 14;

type Tone = 'support' | 'server' | 'hub' | 'slave' | 'equipment' | 'hypervision' | 'external' | 'more';

/** Une machine du schéma, raccordée ou seulement prévue au plan. */
interface Entry {
  id: string;
  title: string;
  subtitle?: string;
  online: boolean | null;
  planned: boolean;
  productId: number | null;
  tone: Tone;
  /** REPLICA : entrée de son serveur. */
  serverId?: string | null;
  href?: string;
}

type Box = Entry & { x: number; y: number };

interface Edge {
  from: Box;
  to: Box;
  live: boolean;
  planned: boolean;
  tone: 'data' | 'support' | 'exception';
  label?: string;
  link?: ProductLink;
}

function truncate(value: string, max = 21): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function stack(items: Entry[], x: number, mid: number): Box[] {
  const top = mid - ((items.length - 1) * ROW) / 2;
  return items.map((item, index) => ({ ...item, x, y: top + index * ROW }));
}

function capped(items: Entry[], more: (count: number) => string): Entry[] {
  if (items.length <= MAX_COLUMN) return items;
  const rest = items.slice(MAX_COLUMN - 1);
  return [
    ...items.slice(0, MAX_COLUMN - 1),
    {
      id: `more-${items[0].id}`,
      title: more(rest.length),
      online: rest.some((item) => item.online),
      planned: false,
      productId: null,
      tone: 'more',
    },
  ];
}

const TONE: Record<Tone, string> = {
  support: 'fill-sidebar stroke-sidebar',
  server: 'fill-amber-500/10 stroke-amber-500',
  hub: 'fill-muted stroke-border',
  slave: 'fill-card stroke-border',
  equipment: 'fill-card stroke-violet-500',
  hypervision: 'fill-card stroke-sky-500',
  external: 'fill-card stroke-amber-500',
  more: 'fill-muted stroke-border',
};

function edgePath(from: Box, to: Box): string {
  if (Math.abs(from.x - to.x) < 1) {
    // Même colonne : courbe qui contourne par la droite.
    const x = from.x + BOX_W / 2;
    const bend = x + 36;
    return `M ${x} ${from.y} C ${bend} ${from.y}, ${bend} ${to.y}, ${x} ${to.y}`;
  }
  const [x1, x2] = from.x < to.x ? [from.x + BOX_W / 2, to.x - BOX_W / 2] : [from.x - BOX_W / 2, to.x + BOX_W / 2];
  const mid = (x1 + x2) / 2;
  return `M ${x1} ${from.y} C ${mid} ${from.y}, ${mid} ${to.y}, ${x2} ${to.y}`;
}

/** Étiquette de ports près de la source : chaque source a sa ligne, les étiquettes ne se chevauchent pas. */
function labelPosition(from: Box, to: Box): [number, number] {
  if (Math.abs(from.x - to.x) < 1) return [from.x + BOX_W / 2 + 27, (from.y + to.y) / 2];
  const [x1, x2] = from.x < to.x ? [from.x + BOX_W / 2, to.x - BOX_W / 2] : [from.x - BOX_W / 2, to.x + BOX_W / 2];
  return [x1 + (x2 - x1) * 0.3, from.y + (to.y - from.y) * 0.06];
}

/** Machines et emplacements à pourvoir de la flotte, classés par rôle. */
function entriesOf(fleet: FleetSummary, slots: PlanSlot[], products: Product[], t: (key: string) => string) {
  const productById = new Map(products.map((item) => [item.id, item]));
  const entries: Entry[] = [];
  // Dans le schéma d'une flotte, son préfixe (« piscine-sl-media ») n'apprend rien.
  const short = (name: string) => (name.startsWith(`${fleet.slug}-`) ? name.slice(fleet.slug.length + 1) : name);
  for (const node of fleet.nodes) {
    const product = node.product ? productById.get(node.product.id) : undefined;
    const hypervision = isHypervision(node.tags);
    const server = Boolean(product?.master) && isMaster(node.tags);
    entries.push({
      id: `n-${node.id}`,
      title: truncate(short(node.givenName || node.name)),
      subtitle: hypervision
        ? node.ipAddresses[0]
        : [product?.name ?? t('flow.noProduct'), node.ipAddresses[0]].filter(Boolean).join(' · '),
      online: node.online,
      planned: false,
      productId: product?.id ?? null,
      tone: hypervision ? 'hypervision' : server ? 'server' : product?.slaves ? 'slave' : 'equipment',
      serverId: product?.slaves && !server && node.product?.masterNodeId ? `n-${node.product.masterNodeId}` : null,
      href: `/machines/${node.id}`,
    });
  }
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  for (const slot of slots) {
    if (slot.machine) continue;
    const server = Boolean(slot.product?.master) && !slot.parentSlotId;
    const parent = slot.parentSlotId ? slotById.get(slot.parentSlotId) : undefined;
    entries.push({
      id: `s-${slot.id}`,
      title: truncate(slot.label),
      subtitle: t('flow.planned'),
      online: null,
      planned: true,
      productId: slot.product?.id ?? null,
      tone: slot.kind === 'hypervision' ? 'hypervision' : server ? 'server' : slot.product?.slaves ? 'slave' : 'equipment',
      serverId: parent ? (parent.machine ? `n-${parent.machine.id}` : `s-${parent.id}`) : null,
    });
  }
  return entries;
}

/**
 * Schéma des flux d'une flotte, en direct : les serveurs SL MEDIA au centre,
 * leurs REPLICA à droite, les autres équipements (SL TEMPO…) reliés selon les
 * flux définis entre produits, avec leurs ports ; support et postes
 * d'hypervision à gauche. Les emplacements du plan encore à pourvoir
 * apparaissent en pointillés. En mode « Définir un flux », on clique la
 * machine source puis la machine cible : le flux vaut pour leurs produits,
 * dans toutes les flottes.
 */
export function FleetFlowDiagram({
  fleet,
  rules,
  labelOf,
  slots = [],
  products = [],
  links = [],
  editable = false,
}: {
  fleet: FleetSummary;
  rules: PolicyRule[];
  labelOf: (tag: string) => string;
  slots?: PlanSlot[];
  products?: Product[];
  links?: ProductLink[];
  editable?: boolean;
}) {
  const t = useTranslations('parc');
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [source, setSource] = useState<Entry | null>(null);
  const [pair, setPair] = useState<{ from: Product; to: Product; link?: ProductLink } | null>(null);

  const entries = entriesOf(fleet, slots, products, t);
  const productById = new Map(products.map((item) => [item.id, item]));
  const hasSupport = !fleet.internal && rules.some((rule) => rule.kind === 'support');
  const outgoing = rules.filter((rule) => rule.kind === 'custom' && rule.from === fleet.tag);
  const incoming = rules.filter((rule) => rule.kind === 'custom' && rule.to === fleet.tag);
  const more = (count: number) => t('flow.moreShort', { count });

  const servers = entries.filter((entry) => entry.tone === 'server');
  const slavesRaw = entries.filter((entry) => entry.tone === 'slave');
  // REPLICA groupés sous leur serveur, pour que les liens ne se croisent pas.
  const slaves = [
    ...servers.flatMap((server) => slavesRaw.filter((entry) => entry.serverId === server.id)),
    ...slavesRaw.filter((entry) => !servers.some((server) => server.id === entry.serverId)),
  ];
  const others = entries.filter((entry) => entry.tone === 'equipment');
  // Support, postes et autres équipements dans la même colonne : leurs liens
  // vers les serveurs ne traversent aucune boîte.
  const left: Entry[] = [
    ...(hasSupport
      ? [{ id: 'support', title: t('flow.support'), subtitle: t('flow.supportHint'), online: null, planned: false, productId: null, tone: 'support' as const, href: '/flottes/interne' }]
      : []),
    ...entries.filter((entry) => entry.tone === 'hypervision'),
    ...others,
  ];
  const center: Entry[] =
    servers.length > 0
      ? servers
      : [{ id: 'hub', title: t('flow.hub'), subtitle: t('flow.hubHint'), online: null, planned: false, productId: null, tone: 'hub' }];

  const columns = [
    { key: 'left', items: capped(left, more), title: t('flow.colLeft') },
    { key: 'center', items: capped(center, more), title: servers.length > 0 ? t('flow.colServers') : t('flow.colHub') },
    { key: 'slaves', items: capped(slaves, more), title: 'REPLICA' },
  ].filter((column) => column.key === 'center' || column.items.length > 0);
  const xOf = (index: number) =>
    columns.length === 1 ? W / 2 : 100 + (index * (W - 200)) / (columns.length - 1);

  const rows = Math.max(1, ...columns.map((column) => column.items.length));
  const mid = TOP + ((rows - 1) * ROW) / 2 + BOX_H / 2;
  const placed = columns.map((column, index) => ({ ...column, x: xOf(index), boxes: stack(column.items, xOf(index), mid) }));
  const byId = new Map(placed.flatMap((column) => column.boxes).map((box) => [box.id, box]));
  const centerBoxes = placed.find((column) => column.key === 'center')!.boxes;

  const externalsRaw = [
    ...incoming.map((rule) => ({ rule, direction: 'in' as const, tag: rule.from! })),
    ...outgoing.map((rule) => ({ rule, direction: 'out' as const, tag: rule.to! })),
  ];
  const bottomY = mid + ((rows - 1) * ROW) / 2 + BOX_H / 2 + 70;
  const externals = externalsRaw.map((item, index) => ({
    ...item,
    box: {
      id: `ext-${item.rule.id}`,
      x: externalsRaw.length === 1 ? W / 2 : 110 + (index * (W - 220)) / Math.max(1, externalsRaw.length - 1),
      y: bottomY,
      title: truncate(labelOf(item.tag)),
      subtitle: item.rule.ports === '*' ? t('flow.allPorts') : t('flow.ports', { ports: item.rule.ports! }),
      online: null,
      planned: false,
      productId: null,
      tone: 'external' as const,
      href: `/flottes/${fleetSlug(item.tag)}`,
    } satisfies Box,
  }));
  const height = (externals.length > 0 ? bottomY + BOX_H / 2 : mid + ((rows - 1) * ROW) / 2 + BOX_H / 2) + 30;

  const edges: Edge[] = [];
  const edge = (from: Box | undefined, to: Box | undefined, extra: Partial<Edge> = {}) => {
    if (!from || !to || from.id === to.id) return;
    const planned = from.planned || to.planned;
    edges.push({ from, to, live: !planned && from.online !== false && to.online !== false, planned, tone: 'data', ...extra });
  };
  // Support et postes d'hypervision : vers les serveurs (ou le réseau de la flotte).
  for (const box of placed.find((column) => column.key === 'left')?.boxes ?? []) {
    if (box.tone !== 'support' && box.tone !== 'hypervision') continue;
    for (const target of centerBoxes) edge(box, target, { tone: box.tone === 'support' ? 'support' : 'data' });
  }
  // REPLICA → leur serveur, avec les ports du flux « produit → lui-même ».
  for (const box of placed.find((column) => column.key === 'slaves')?.boxes ?? []) {
    const link = links.find((item) => item.fromId === box.productId && item.toId === box.productId);
    edge(box, box.serverId ? byId.get(box.serverId) : undefined, { link, label: link && link.ports !== '*' ? link.ports : undefined });
  }
  // Flux entre produits : un produit à REPLICA est représenté par ses serveurs.
  const endpoints = (productId: number) => {
    const product = productById.get(productId);
    const boxes = [...byId.values()].filter(
      (box) => box.productId === productId && (!product?.slaves || box.tone === 'server')
    );
    return boxes.length === 0 && product?.slaves && servers.length === 0 ? centerBoxes : boxes;
  };
  for (const link of links) {
    if (link.fromId === link.toId) continue;
    for (const from of endpoints(link.fromId)) {
      for (const to of endpoints(link.toId)) edge(from, to, { link, label: link.ports !== '*' ? link.ports : undefined });
    }
  }
  for (const external of externals) {
    const anchor = centerBoxes[Math.floor(centerBoxes.length / 2)];
    edge(external.direction === 'in' ? external.box : anchor, external.direction === 'in' ? anchor : external.box, {
      tone: 'exception',
      live: anchor.online !== false,
    });
  }

  const boxes = [...byId.values(), ...externals.map((item) => item.box)];

  function pick(box: Box) {
    if (!editing) {
      if (box.href) router.push(box.href);
      return;
    }
    const product = box.productId ? productById.get(box.productId) : undefined;
    if (!product) {
      toast.info(t('flow.pickProduct'));
      return;
    }
    if (!source) {
      setSource(box);
      return;
    }
    const from = productById.get(source.productId!)!;
    if (from.id === product.id && !product.slaves) {
      toast.info(t('flow.sameProduct'));
      return;
    }
    setPair({ from, to: product, link: links.find((item) => item.fromId === from.id && item.toId === product.id) });
    setSource(null);
  }

  return (
    <figure className="flex flex-col gap-2">
      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={editing ? 'brand' : 'outline'}
            onClick={() => {
              setEditing(!editing);
              setSource(null);
            }}
          >
            {editing ? <X aria-hidden /> : <Cable aria-hidden />}
            {editing ? t('flow.editDone') : t('flow.edit')}
          </Button>
          {editing && (
            <span className="text-xs text-muted-foreground" role="status">
              {source ? t('flow.pickTarget', { name: source.title }) : t('flow.pickSource')}
            </span>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${height}`}
          className="min-w-[680px] text-foreground"
          role="img"
          aria-label={t('flow.aria', { fleet: fleet.label, count: fleet.nodes.length })}
        >
          <defs>
            <marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
            </marker>
          </defs>
          <style>{`
            .flow-live { stroke-dasharray: 6 6; animation: flow-move 1.2s linear infinite; }
            @keyframes flow-move { to { stroke-dashoffset: -24; } }
            @media (prefers-reduced-motion: reduce) { .flow-live { animation: none; } }
          `}</style>

          {edges.map((item, index) => (
            <path
              key={index}
              d={edgePath(item.from, item.to)}
              fill="none"
              markerEnd="url(#flow-arrow)"
              strokeWidth={item.tone === 'exception' ? 2 : 1.5}
              className={[
                item.live ? 'flow-live' : '',
                item.tone === 'support'
                  ? 'stroke-brand'
                  : item.tone === 'exception'
                    ? 'stroke-amber-500'
                    : item.live
                      ? 'stroke-emerald-500'
                      : 'stroke-muted-foreground/40',
              ].join(' ')}
              strokeDasharray={item.live ? undefined : item.planned ? '1 4' : '2 5'}
            />
          ))}
          {edges
            .filter((item) => item.label)
            .map((item, index) => {
              const [x, y] = labelPosition(item.from, item.to);
              const width = Math.max(28, item.label!.length * 6.2 + 10);
              return (
                <g key={`label-${index}`} transform={`translate(${x - width / 2} ${y - 9})`}>
                  <rect width={width} height={18} rx={4} className="fill-background stroke-border" strokeWidth={1} />
                  <text x={width / 2} y={12.5} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
                    {item.label}
                  </text>
                </g>
              );
            })}

          {boxes.map((box) => {
            const clickable = editing ? Boolean(box.productId) : Boolean(box.href);
            const selected = source?.id === box.id;
            return (
              <g
                key={box.id}
                transform={`translate(${box.x - BOX_W / 2} ${box.y - BOX_H / 2})`}
                {...(clickable
                  ? {
                      role: 'button',
                      tabIndex: 0,
                      'aria-label': box.tone === 'server' ? `SERVEUR : ${box.title}` : box.title,
                      'aria-pressed': editing ? selected : undefined,
                      className: 'group cursor-pointer outline-none',
                      onClick: () => pick(box),
                      onKeyDown: (event: React.KeyboardEvent) => {
                        if (event.key === 'Enter' || event.key === ' ') pick(box);
                      },
                    }
                  : {})}
              >
                <rect
                  width={BOX_W}
                  height={BOX_H}
                  rx={8}
                  strokeWidth={selected ? 3 : box.tone === 'server' ? 2 : 1.2}
                  strokeDasharray={box.planned ? '4 3' : undefined}
                  className={`${selected ? 'fill-brand/10 stroke-brand' : TONE[box.tone]} ${box.planned ? 'opacity-80' : ''} ${clickable ? 'transition-[filter] group-hover:brightness-95 group-focus-visible:stroke-ring dark:group-hover:brightness-125' : ''}`}
                />
                {box.online !== null && (
                  <circle cx={14} cy={BOX_H / 2} r={4} className={box.online ? 'fill-emerald-500' : 'fill-muted-foreground/50'} />
                )}
                <text
                  x={box.online !== null ? 26 : 12}
                  y={box.subtitle ? 18 : BOX_H / 2 + 4}
                  className={`text-[12px] font-medium ${box.tone === 'support' ? 'fill-sidebar-accent-foreground' : 'fill-foreground'}`}
                >
                  {box.tone === 'server' ? `♛ ${box.title}` : box.title}
                </text>
                {box.subtitle && (
                  <text
                    x={box.online !== null ? 26 : 12}
                    y={32}
                    className={`text-[10px] ${box.tone === 'support' ? 'fill-sidebar-muted' : 'fill-muted-foreground'}`}
                  >
                    {truncate(box.subtitle, 28)}
                  </text>
                )}
              </g>
            );
          })}

          {placed.map((column) => (
            <text
              key={column.key}
              x={column.x}
              y={16}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px] uppercase tracking-wider"
            >
              {column.title}
            </text>
          ))}
        </svg>
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 bg-emerald-500" /> {t('flow.legendLive')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 border-t-2 border-dotted border-muted-foreground/60" />{' '}
          {t('flow.legendDown')}
        </span>
        {entries.some((entry) => entry.planned) && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded-sm border border-dashed border-muted-foreground" />{' '}
            {t('flow.legendPlanned')}
          </span>
        )}
        {hasSupport && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 bg-brand" /> {t('flow.legendSupport')}
          </span>
        )}
        {externals.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 bg-amber-500" /> {t('flow.legendException')}
          </span>
        )}
        <span className="ml-auto">{t('flow.note')}</span>
      </figcaption>
      {pair && <FlowDialog pair={pair} onClose={() => setPair(null)} />}
    </figure>
  );
}

/** Ports d'un flux entre deux produits, défini depuis le schéma. */
function FlowDialog({
  pair,
  onClose,
}: {
  pair: { from: Product; to: Product; link?: ProductLink };
  onClose: () => void;
}) {
  const t = useTranslations('parc');
  const queryClient = useQueryClient();
  const [ports, setPorts] = useState(pair.link?.ports === '*' ? '' : (pair.link?.ports ?? ''));
  const [note, setNote] = useState(pair.link?.note ?? '');
  const self = pair.from.id === pair.to.id;
  const title = self
    ? t('flow.dialogSelf', { product: pair.from.name })
    : t('flow.dialogTitle', { from: pair.from.name, to: pair.to.name });
  const done = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['links'] });
    toast.success(message);
    onClose();
  };
  const save = useMutation({
    mutationFn: () => saveLink({ fromId: pair.from.id, toId: pair.to.id, ports: ports || '*', note }),
    onSuccess: () => done(t('catalog.flowSaved')),
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: () => deleteLink(pair.link!.id),
    onSuccess: () => done(t('catalog.flowDeleted')),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t('flow.dialogDescription')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="flow-dialog-ports">{t('catalog.ports')}</Label>
            <Input
              id="flow-dialog-ports"
              className="font-mono"
              placeholder="*"
              value={ports}
              onChange={(event) => setPorts(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('catalog.flowHint')}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="flow-dialog-note">{t('catalog.flowNote')}</Label>
            <Input id="flow-dialog-note" value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          {pair.link && (
            <Button variant="outline" className="mr-auto" disabled={remove.isPending} onClick={() => remove.mutate()}>
              <Trash2 aria-hidden />
              {t('catalog.delete')}
            </Button>
          )}
          <Button variant="brand" disabled={save.isPending} onClick={() => save.mutate()}>
            {t('catalog.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
