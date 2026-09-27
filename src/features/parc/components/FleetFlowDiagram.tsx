'use client';

import type { PolicyRule } from '@/features/acl';
import { isHypervision, isMaster, type FleetNode } from '@/features/fleets';
import { useTranslations } from 'next-intl';
import type { FleetSummary } from '../lib';

const W = 920;
const BOX_W = 170;
const BOX_H = 42;
const ROW = 58;
const COL = { left: 110, center: W / 2, right: W - 110 };
const MAX_SIDE = 7;
const MAX_MASTERS = 4;

type Box = {
  id: string;
  x: number;
  y: number;
  title: string;
  subtitle?: string;
  online: boolean | null;
  tone: 'support' | 'master' | 'hub' | 'slave' | 'hypervision' | 'external' | 'more';
};

type Edge = { from: Box; to: Box; live: boolean; label?: string; tone: 'data' | 'support' | 'exception' };

function truncate(value: string, max = 20): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Empile des boîtes centrées verticalement sur `mid`. */
function stack(items: Omit<Box, 'x' | 'y'>[], x: number, mid: number): Box[] {
  const top = mid - ((items.length - 1) * ROW) / 2;
  return items.map((item, index) => ({ ...item, x, y: top + index * ROW }));
}

/** Au-delà de `max`, les suivantes sont regroupées en une boîte « + N autres ». */
function capped(nodes: FleetNode[], max: number, tone: Box['tone'], more: (count: number, online: number) => string) {
  const shown: Omit<Box, 'x' | 'y'>[] = nodes.slice(0, max).map((node) => ({
    id: node.id,
    title: truncate(node.givenName || node.name),
    subtitle: node.ipAddresses[0],
    online: node.online,
    tone,
  }));
  const rest = nodes.slice(max);
  if (rest.length > 0) {
    shown.push({
      id: `${tone}-more`,
      title: more(rest.length, rest.filter((node) => node.online).length),
      online: rest.some((node) => node.online),
      tone: 'more',
    });
  }
  return shown;
}

const TONE: Record<Box['tone'], string> = {
  support: 'fill-sidebar stroke-sidebar',
  master: 'fill-amber-500/10 stroke-amber-500',
  hub: 'fill-muted stroke-border',
  slave: 'fill-card stroke-border',
  hypervision: 'fill-card stroke-sky-500',
  external: 'fill-card stroke-amber-500',
  more: 'fill-muted stroke-border',
};

function edgePath(from: Box, to: Box): string {
  const [x1, x2] = from.x < to.x ? [from.x + BOX_W / 2, to.x - BOX_W / 2] : [from.x - BOX_W / 2, to.x + BOX_W / 2];
  if (Math.abs(from.x - to.x) < 1) {
    // Même colonne (exceptions en bas) : courbe verticale.
    const [y1, y2] = from.y < to.y ? [from.y + BOX_H / 2, to.y - BOX_H / 2] : [from.y - BOX_H / 2, to.y + BOX_H / 2];
    return `M ${from.x} ${y1} L ${to.x} ${y2}`;
  }
  const mid = (x1 + x2) / 2;
  return `M ${x1} ${from.y} C ${mid} ${from.y}, ${mid} ${to.y}, ${x2} ${to.y}`;
}

/**
 * Schéma des flux d'une flotte, en direct : qui peut joindre qui (politique
 * d'accès) et qui est connecté (Headscale). Les SLAVE et les postes
 * d'hypervision convergent vers le ou les MASTER. Headscale ne mesure pas les
 * volumes échangés : le schéma montre les chemins autorisés et leur état.
 */
export function FleetFlowDiagram({
  fleet,
  rules,
  labelOf,
}: {
  fleet: FleetSummary;
  rules: PolicyRule[];
  labelOf: (tag: string) => string;
}) {
  const t = useTranslations('parc');

  const masters = fleet.nodes.filter((node) => isMaster(node.tags) && !isHypervision(node.tags));
  const slaves = fleet.nodes.filter((node) => !isMaster(node.tags) && !isHypervision(node.tags));
  const stations = fleet.nodes.filter((node) => isHypervision(node.tags));
  const hasSupport = !fleet.internal && rules.some((rule) => rule.kind === 'support');
  const outgoing = rules.filter((rule) => rule.kind === 'custom' && rule.from === fleet.tag);
  const incoming = rules.filter((rule) => rule.kind === 'custom' && rule.to === fleet.tag);

  const more = (count: number, online: number) => t('flow.more', { count, online });
  const leftItems: Omit<Box, 'x' | 'y'>[] = [
    ...(hasSupport ? [{ id: 'support', title: t('flow.support'), subtitle: t('flow.supportHint'), online: null, tone: 'support' as const }] : []),
    ...capped(stations, MAX_SIDE - (hasSupport ? 1 : 0), 'hypervision', more),
  ];
  const rightItems = capped(slaves, MAX_SIDE, 'slave', more);
  const centerItems: Omit<Box, 'x' | 'y'>[] =
    masters.length > 0
      ? capped(masters, MAX_MASTERS, 'master', more)
      : [{ id: 'hub', title: t('flow.hub'), subtitle: t('flow.hubHint'), online: null, tone: 'hub' }];

  const rows = Math.max(leftItems.length, rightItems.length, centerItems.length, 1);
  const mid = 40 + ((rows - 1) * ROW) / 2 + BOX_H / 2;
  const left = stack(leftItems, COL.left, mid);
  const right = stack(rightItems, COL.right, mid);
  const center = stack(centerItems, COL.center, mid);

  const externalsRaw = [
    ...incoming.map((rule) => ({ rule, direction: 'in' as const, tag: rule.from! })),
    ...outgoing.map((rule) => ({ rule, direction: 'out' as const, tag: rule.to! })),
  ];
  const bottomY = mid + ((rows - 1) * ROW) / 2 + BOX_H / 2 + 70;
  const externals = externalsRaw.map((item, index) => ({
    ...item,
    box: {
      id: `ext-${item.rule.id}`,
      x: externalsRaw.length === 1 ? COL.center : 110 + (index * (W - 220)) / Math.max(1, externalsRaw.length - 1),
      y: bottomY,
      title: truncate(labelOf(item.tag)),
      subtitle: item.rule.ports === '*' ? t('flow.allPorts') : t('flow.ports', { ports: item.rule.ports! }),
      online: null,
      tone: 'external' as const,
    },
  }));
  const height = (externals.length > 0 ? bottomY + BOX_H / 2 : mid + ((rows - 1) * ROW) / 2 + BOX_H / 2) + 30;

  const liveBetween = (a: Box, b: Box) => a.online !== false && b.online !== false;
  const edges: Edge[] = [];
  for (const target of center) {
    for (const source of left) {
      edges.push({
        from: source,
        to: target,
        live: liveBetween(source, target),
        tone: source.tone === 'support' ? 'support' : 'data',
      });
    }
    for (const source of right) {
      edges.push({ from: source, to: target, live: liveBetween(source, target), tone: 'data' });
    }
  }
  for (const external of externals) {
    const anchor = center[Math.floor(center.length / 2)];
    edges.push({
      from: external.direction === 'in' ? external.box : anchor,
      to: external.direction === 'in' ? anchor : external.box,
      live: anchor.online !== false,
      tone: 'exception',
    });
  }

  const boxes = [...left, ...center, ...right, ...externals.map((item) => item.box)];

  return (
    <figure className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${height}`}
          className="min-w-[640px] text-foreground"
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

          {edges.map((edge, index) => (
            <path
              key={index}
              d={edgePath(edge.from, edge.to)}
              fill="none"
              markerEnd="url(#flow-arrow)"
              strokeWidth={edge.tone === 'exception' ? 2 : 1.5}
              className={[
                edge.live ? 'flow-live' : '',
                edge.tone === 'support'
                  ? 'stroke-brand'
                  : edge.tone === 'exception'
                    ? 'stroke-amber-500'
                    : edge.live
                      ? 'stroke-emerald-500'
                      : 'stroke-muted-foreground/40',
              ].join(' ')}
              strokeDasharray={edge.live ? undefined : '2 5'}
            />
          ))}

          {boxes.map((box) => (
            <g key={box.id} transform={`translate(${box.x - BOX_W / 2} ${box.y - BOX_H / 2})`}>
              <rect width={BOX_W} height={BOX_H} rx={8} strokeWidth={box.tone === 'master' ? 2 : 1.2} className={TONE[box.tone]} />
              {box.online !== null && (
                <circle cx={14} cy={BOX_H / 2} r={4} className={box.online ? 'fill-emerald-500' : 'fill-muted-foreground/50'} />
              )}
              <text
                x={box.online !== null ? 26 : 12}
                y={box.subtitle ? 18 : BOX_H / 2 + 4}
                className={`text-[12px] font-medium ${box.tone === 'support' ? 'fill-sidebar-accent-foreground' : 'fill-foreground'}`}
              >
                {box.tone === 'master' ? `♛ ${box.title}` : box.title}
              </text>
              {box.subtitle && (
                <text
                  x={box.online !== null ? 26 : 12}
                  y={32}
                  className={`text-[10px] ${box.tone === 'support' ? 'fill-sidebar-muted' : 'fill-muted-foreground'}`}
                >
                  {box.subtitle}
                </text>
              )}
            </g>
          ))}

          <text x={COL.left} y={16} textAnchor="middle" className="fill-muted-foreground text-[10px] uppercase tracking-wider">
            {t('flow.colLeft')}
          </text>
          <text x={COL.center} y={16} textAnchor="middle" className="fill-muted-foreground text-[10px] uppercase tracking-wider">
            {masters.length > 0 ? 'MASTER' : t('flow.colHub')}
          </text>
          <text x={COL.right} y={16} textAnchor="middle" className="fill-muted-foreground text-[10px] uppercase tracking-wider">
            {masters.length > 0 ? 'SLAVE' : t('flow.colRight')}
          </text>
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
    </figure>
  );
}
