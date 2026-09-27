'use client';

import { useQuery } from '@tanstack/react-query';
import { fleetSlug, isHypervision, isMaster, type FleetNode } from '@/features/fleets';
import { Crosshair, LayoutGrid, Minus, Plus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button, Card, Input, PageHeader, Skeleton } from '@/shared/ui';
import { cn } from '@/shared/lib';
import { fetchLinks, fetchProducts, reaches, type ProductLink, type SupportPost } from '../api';
import { summarizeFleets, unassignedNodes, useNodes, usePolicy, useProfiles, type FleetSummary } from '../lib';
import { useSupportPosts } from './FleetSupportCard';

type Tone = 'server' | 'replica' | 'equipment' | 'hypervision' | 'support' | 'pending';

interface MapNode {
  id: string;
  label: string;
  tone: Tone;
  online: boolean | null;
  /** Grappe (flotte) à laquelle appartient le nœud ; `null` pour un poste support. */
  cluster: string | null;
  href: string;
  x: number;
  y: number;
}

interface Cluster {
  id: string;
  label: string;
  href: string;
  x: number;
  y: number;
  r: number;
  pending?: boolean;
}

interface MapEdge {
  id: string;
  from: string;
  to: string;
  kind: 'data' | 'support' | 'exception';
  /** Extrémités sur le bord d'une grappe plutôt qu'au centre d'une machine. */
  fromCluster?: boolean;
  toCluster?: boolean;
}

type Point = { x: number; y: number };
type Offsets = Record<string, Point>;

const NODE_R = 15;
const STORAGE_KEY = 'stramscale-carte-disposition';
const TONE: Record<Tone, string> = {
  server: 'fill-amber-500/15 stroke-amber-500',
  replica: 'fill-card stroke-border',
  equipment: 'fill-card stroke-violet-500',
  hypervision: 'fill-card stroke-sky-500',
  support: 'fill-sidebar stroke-sidebar',
  pending: 'fill-muted stroke-amber-500',
};

function clusterRadius(count: number): number {
  return Math.max(84, 50 + Math.sqrt(count) * 40);
}

function short(name: string, prefix: string): string {
  const cut = name.startsWith(`${prefix}-`) ? name.slice(prefix.length + 1) : name;
  return cut.length > 18 ? `${cut.slice(0, 17)}…` : cut;
}

/** Disposition de départ : flottes en grille, postes support au-dessus, machines en attente à la suite. */
function buildLayout(fleets: FleetSummary[], pending: FleetNode[], posts: SupportPost[], links: ProductLink[], productSlaves: Map<number, boolean>) {
  const clusters: Cluster[] = [];
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const groups = [
    ...fleets.map((fleet) => ({ id: fleet.tag, label: fleet.label, href: `/flottes/${fleetSlug(fleet.tag)}`, nodes: fleet.nodes, prefix: fleetSlug(fleet.tag), pending: false })),
    ...(pending.length > 0 ? [{ id: 'tag:a-assigner', label: 'À assigner', href: '/a-assigner', nodes: pending, prefix: '', pending: true }] : []),
  ];
  const maxR = Math.max(90, ...groups.map((group) => clusterRadius(group.nodes.length)));
  const cell = maxR * 2 + 140;
  const columns = Math.max(1, Math.ceil(Math.sqrt(groups.length)));

  groups.forEach((group, index) => {
    const cx = (index % columns) * cell;
    const cy = Math.floor(index / columns) * cell;
    const r = clusterRadius(group.nodes.length);
    clusters.push({ id: group.id, label: group.label, href: group.href, x: cx, y: cy, r, pending: group.pending });

    const servers = group.nodes.filter((node) => isMaster(node.tags) && !isHypervision(node.tags));
    const serverIds = new Set(servers.map((node) => node.id));
    const replicasOf = (id: string) => group.nodes.filter((node) => node.product?.masterNodeId === id && !serverIds.has(node.id));
    const placedOuter = [
      ...servers.flatMap((server) => replicasOf(server.id)),
      ...group.nodes.filter(
        (node) => !serverIds.has(node.id) && !isHypervision(node.tags) && !servers.some((server) => node.product?.masterNodeId === server.id)
      ),
      ...group.nodes.filter((node) => isHypervision(node.tags)),
    ];
    const tone = (node: FleetNode): Tone =>
      group.pending
        ? 'pending'
        : isHypervision(node.tags)
          ? 'hypervision'
          : serverIds.has(node.id)
            ? 'server'
            : node.product?.slaves
              ? 'replica'
              : 'equipment';
    const add = (node: FleetNode, x: number, y: number) =>
      nodes.push({
        id: node.id,
        label: short(node.givenName || node.name, group.prefix),
        tone: tone(node),
        online: node.online,
        cluster: group.id,
        href: `/machines/${node.id}`,
        x,
        y,
      });
    // SERVEUR côte à côte au centre ; chaque machine autour, du côté de ce
    // qu'elle joint : REPLICA près de leur SERVEUR, postes d'hypervision en bas.
    const serverAngle = new Map<string, number>();
    servers.forEach((server, i) => {
      const angle = Math.PI + (i / Math.max(1, servers.length)) * Math.PI * 2;
      serverAngle.set(server.id, angle);
      const ring = servers.length === 1 ? 0 : r * 0.3;
      add(server, cx + Math.cos(angle) * ring, cy + Math.sin(angle) * ring);
    });
    const desired = (node: FleetNode) => {
      const master = node.product?.masterNodeId;
      if (master && serverAngle.has(master)) return serverAngle.get(master)!;
      return isHypervision(node.tags) ? Math.PI / 2 : (Math.PI * 3) / 2;
    };
    const outer = [...placedOuter].sort((x, y) => desired(x) - desired(y));
    const step = (Math.PI * 2) / Math.max(1, outer.length);
    // Décalage qui colle au mieux les angles réguliers aux angles souhaités.
    const shift = outer.length
      ? Math.atan2(
          outer.reduce((sum, node, i) => sum + Math.sin(desired(node) - i * step), 0),
          outer.reduce((sum, node, i) => sum + Math.cos(desired(node) - i * step), 0)
        )
      : 0;
    outer.forEach((node, i) => {
      const angle = shift + i * step;
      add(node, cx + Math.cos(angle) * r * 0.68, cy + Math.sin(angle) * r * 0.68);
    });

    // Liens dans la flotte : REPLICA → SERVEUR, postes → SERVEUR, flux produits.
    for (const node of group.nodes) {
      const master = node.product?.masterNodeId;
      if (master && serverIds.has(master) && !serverIds.has(node.id)) {
        edges.push({ id: `${node.id}>${master}`, from: node.id, to: master, kind: 'data' });
      }
      if (isHypervision(node.tags)) {
        for (const server of servers) edges.push({ id: `${node.id}>${server.id}`, from: node.id, to: server.id, kind: 'data' });
      }
    }
    for (const link of links) {
      if (link.fromId === link.toId) continue;
      const ends = (productId: number) =>
        group.nodes.filter((node) => node.product?.id === productId && (!productSlaves.get(productId) || serverIds.has(node.id)));
      for (const from of ends(link.fromId)) {
        for (const to of ends(link.toId)) {
          if (from.id !== to.id) edges.push({ id: `${from.id}>${to.id}`, from: from.id, to: to.id, kind: 'data' });
        }
      }
    }
  });

  // Postes support : une rangée au-dessus, un lien par flotte prise en charge.
  const width = (Math.min(columns, groups.length) - 1) * cell;
  const top = -maxR - 150;
  posts.forEach((post, index) => {
    const x = posts.length === 1 ? width / 2 : (index / (posts.length - 1)) * Math.max(width, (posts.length - 1) * 200);
    nodes.push({
      id: post.tag,
      label: post.name,
      tone: 'support',
      online: post.machines.length > 0 ? post.machines.some((machine) => machine.online) : null,
      cluster: null,
      href: '/support',
      x,
      y: top,
    });
    for (const cluster of clusters) {
      if (cluster.pending ? post.targets.includes('*') || post.targets.includes('tag:a-assigner') : reaches(post, cluster.id)) {
        edges.push({ id: `${post.tag}>${cluster.id}`, from: post.tag, to: cluster.id, kind: 'support', toCluster: true });
      }
    }
  });
  return { clusters, nodes, edges };
}

function readOffsets(): Offsets {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Offsets;
  } catch {
    return {};
  }
}

function writeOffsets(offsets: Offsets) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(offsets));
  } catch {
    // Stockage indisponible (navigation privée) : la disposition ne sera pas gardée.
  }
}

/** Point sur le bord d'un cercle, vers une cible. */
function toward(from: Point, to: Point, distance: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: from.x + (dx / length) * distance, y: from.y + (dy / length) * distance };
}

type Drag =
  | { kind: 'pan'; start: Point; origin: Point; moved: boolean }
  | { kind: 'node' | 'cluster'; id: string; start: Point; origin: Point; moved: boolean; href: string };

/**
 * Carte de l'écosystème : toutes les flottes en grappes, les postes support
 * au-dessus, les machines en attente à part. On s'y déplace (glisser le fond,
 * molette pour zoomer), on déplace une flotte (par son nom) ou une machine ;
 * un clic ouvre sa page. La disposition est gardée dans ce navigateur.
 */
export function EcosystemMap() {
  const t = useTranslations('parc.map');
  const router = useRouter();
  const nodesQuery = useNodes();
  const policyQuery = usePolicy();
  const profilesQuery = useProfiles();
  const postsQuery = useSupportPosts();
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: fetchProducts });
  const linksQuery = useQuery({ queryKey: ['links'], queryFn: fetchLinks });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  // `null` tant qu'on n'a ni zoomé ni déplacé : la vue cadre alors tout le parc.
  const [userView, setView] = useState<{ x: number; y: number; k: number } | null>(null);
  // Disposition gardée d'une visite à l'autre (confort personnel, dans ce navigateur).
  const [offsets, setOffsets] = useState<Offsets>(readOffsets);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const nodes = useMemo(() => nodesQuery.data ?? [], [nodesQuery.data]);
  const fleets = useMemo(
    () => summarizeFleets(policyQuery.data?.fleets ?? [], nodes, profilesQuery.data ?? []).filter((fleet) => fleet.tag.startsWith('tag:flotte-')),
    [policyQuery.data, nodes, profilesQuery.data]
  );
  const layout = useMemo(
    () =>
      buildLayout(
        fleets,
        unassignedNodes(nodes),
        postsQuery.data ?? [],
        linksQuery.data ?? [],
        new Map((productsQuery.data ?? []).map((product) => [product.id, product.slaves]))
      ),
    [fleets, nodes, postsQuery.data, linksQuery.data, productsQuery.data]
  );

  const clusterAt = (cluster: Cluster): Point => {
    const shift = offsets[`c:${cluster.id}`] ?? { x: 0, y: 0 };
    return { x: cluster.x + shift.x, y: cluster.y + shift.y };
  };
  const nodeAt = (node: MapNode): Point => {
    const own = offsets[`n:${node.id}`] ?? { x: 0, y: 0 };
    const group = node.cluster ? (offsets[`c:${node.cluster}`] ?? { x: 0, y: 0 }) : { x: 0, y: 0 };
    return { x: node.x + own.x + group.x, y: node.y + own.y + group.y };
  };
  const clusterById = new Map(layout.clusters.map((cluster) => [cluster.id, cluster]));
  const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));

  function fitView(width: number, height: number) {
    const points = [
      ...layout.clusters.flatMap((cluster) => {
        const at = clusterAt(cluster);
        return [
          { x: at.x - cluster.r, y: at.y - cluster.r },
          { x: at.x + cluster.r, y: at.y + cluster.r },
        ];
      }),
      ...layout.nodes.filter((node) => !node.cluster).map(nodeAt),
    ];
    if (points.length === 0) return { x: 0, y: 0, k: 0.8 };
    const minX = Math.min(...points.map((point) => point.x)) - 60;
    const maxX = Math.max(...points.map((point) => point.x)) + 60;
    const minY = Math.min(...points.map((point) => point.y)) - 60;
    const maxY = Math.max(...points.map((point) => point.y)) + 60;
    const k = Math.min(1.4, Math.max(0.15, Math.min(width / (maxX - minX), height / (maxY - minY))));
    return { k, x: width / 2 - ((minX + maxX) / 2) * k, y: height / 2 - ((minY + maxY) / 2) * k };
  }
  const view = userView ?? (size ? fitView(size.width, size.height) : { x: 0, y: 0, k: 0.8 });
  const fit = () => setView(null);
  // Mesure de la zone au montage du SVG (pas d'effet : rappel de référence).
  const measure = (element: SVGSVGElement | null) => {
    svgRef.current = element;
    if (element && !size) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0) setSize({ width: rect.width, height: rect.height });
    }
  };

  // Molette : zoom centré sur le pointeur (écouteur non passif pour bloquer le défilement de la page).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      setView((previous) => {
        const current = previous ?? view;
        const k = Math.min(3, Math.max(0.1, current.k * Math.exp(-event.deltaY * 0.0015)));
        return { k, x: px - ((px - current.x) / current.k) * k, y: py - ((py - current.y) / current.k) * k };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  });

  function zoom(factor: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const { width, height } = svg.getBoundingClientRect();
    setView((previous) => {
      const current = previous ?? view;
      const k = Math.min(3, Math.max(0.1, current.k * factor));
      return { k, x: width / 2 - ((width / 2 - current.x) / current.k) * k, y: height / 2 - ((height / 2 - current.y) / current.k) * k };
    });
  }

  function start(event: ReactPointerEvent, next: Drag) {
    event.stopPropagation();
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    setDrag(next);
  }

  function move(event: ReactPointerEvent) {
    if (!drag) return;
    const dx = event.clientX - drag.start.x;
    const dy = event.clientY - drag.start.y;
    const moved = drag.moved || Math.hypot(dx, dy) > 3;
    if (drag.kind === 'pan') {
      setView({ k: view.k, x: drag.origin.x + dx, y: drag.origin.y + dy });
    } else {
      const key = `${drag.kind === 'cluster' ? 'c' : 'n'}:${drag.id}`;
      setOffsets((current) => ({ ...current, [key]: { x: drag.origin.x + dx / view.k, y: drag.origin.y + dy / view.k } }));
    }
    if (moved !== drag.moved) setDrag({ ...drag, moved });
  }

  function end() {
    if (!drag) return;
    if (drag.kind !== 'pan' && !drag.moved) router.push(drag.href);
    if (drag.kind !== 'pan' && drag.moved) writeOffsets(offsets);
    setDrag(null);
  }

  function focus(fleetTag: string) {
    const svg = svgRef.current;
    const cluster = clusterById.get(fleetTag);
    if (!svg || !cluster) return;
    const at = clusterAt(cluster);
    const { width, height } = svg.getBoundingClientRect();
    const k = Math.min(1.6, Math.max(0.5, Math.min(width, height) / (cluster.r * 3)));
    setView({ k, x: width / 2 - at.x * k, y: height / 2 - at.y * k });
    setHover(fleetTag);
  }

  if (nodesQuery.isPending || policyQuery.isPending) {
    return (
      <>
        <PageHeader title={t('title')} description={t('description')} />
        <Skeleton className="h-[70vh] w-full" />
      </>
    );
  }

  // Mise en avant : ce qui touche l'élément survolé.
  const related = (edge: MapEdge) => {
    if (!hover) return true;
    const ends = [edge.from, edge.to];
    if (ends.includes(hover)) return true;
    return ends.some((id) => nodeById.get(id)?.cluster === hover);
  };
  const matches = query.trim()
    ? fleets.filter((fleet) => fleet.label.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
    : [];

  const endpoint = (id: string, cluster: boolean, other: Point): Point | null => {
    if (cluster) {
      const target = clusterById.get(id);
      if (!target) return null;
      const at = clusterAt(target);
      return toward(at, other, target.r);
    }
    const node = nodeById.get(id);
    if (!node) return null;
    return toward(nodeAt(node), other, NODE_R + 3);
  };
  const centerOf = (id: string, cluster: boolean): Point | null => {
    if (cluster) {
      const target = clusterById.get(id);
      return target ? clusterAt(target) : null;
    }
    const node = nodeById.get(id);
    return node ? nodeAt(node) : null;
  };

  // Exceptions entre flottes (politique) : de grappe à grappe.
  const exceptions: MapEdge[] = (policyQuery.data?.rules ?? [])
    .filter((rule) => rule.kind === 'custom' && rule.from && rule.to && clusterById.has(rule.from) && clusterById.has(rule.to))
    .map((rule) => ({ id: rule.id, from: rule.from!, to: rule.to!, kind: 'exception', fromCluster: true, toCluster: true }));

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <Card className="relative overflow-hidden p-0">
        <div className="absolute top-3 left-3 z-10 flex w-72 flex-col gap-1">
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              aria-label={t('search')}
              placeholder={t('search')}
              className="bg-background/95 pl-8"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {matches.length > 0 && (
            <ul className="rounded-md border bg-background/95 py-1 text-sm shadow-sm">
              {matches.map((fleet) => (
                <li key={fleet.tag}>
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-left hover:bg-muted"
                    onClick={() => {
                      focus(fleet.tag);
                      setQuery('');
                    }}
                  >
                    {fleet.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
          <Button size="icon" variant="outline" className="bg-background/95" aria-label={t('zoomIn')} title={t('zoomIn')} onClick={() => zoom(1.25)}>
            <Plus aria-hidden />
          </Button>
          <Button size="icon" variant="outline" className="bg-background/95" aria-label={t('zoomOut')} title={t('zoomOut')} onClick={() => zoom(0.8)}>
            <Minus aria-hidden />
          </Button>
          <Button size="icon" variant="outline" className="bg-background/95" aria-label={t('fit')} title={t('fit')} onClick={fit}>
            <Crosshair aria-hidden />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="bg-background/95"
            aria-label={t('resetLayout')}
            title={t('resetLayout')}
            onClick={() => {
              setOffsets({});
              writeOffsets({});
            }}
          >
            <LayoutGrid aria-hidden />
          </Button>
        </div>

        <svg
          ref={measure}
          className={cn('h-[calc(100vh-15rem)] min-h-[480px] w-full touch-none select-none bg-muted/20', drag?.kind === 'pan' ? 'cursor-grabbing' : 'cursor-grab')}
          role="img"
          aria-label={t('aria', { fleets: fleets.length, machines: nodes.length })}
          onPointerDown={(event) => start(event, { kind: 'pan', start: { x: event.clientX, y: event.clientY }, origin: { x: view.x, y: view.y }, moved: false })}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        >
          <defs>
            <pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" className="stroke-border/60" strokeWidth={0.6} />
            </pattern>
            <marker id="map-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
            </marker>
          </defs>
          <style>{`
            .map-live { stroke-dasharray: 6 6; animation: map-move 1.2s linear infinite; }
            @keyframes map-move { to { stroke-dashoffset: -24; } }
            @media (prefers-reduced-motion: reduce) { .map-live { animation: none; } }
          `}</style>
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            <rect x={-100000} y={-100000} width={200000} height={200000} fill="url(#map-grid)" />

            {layout.clusters.map((cluster) => {
              const at = clusterAt(cluster);
              const dim = hover !== null && hover !== cluster.id && !layout.edges.concat(exceptions).some((edge) => related(edge) && (edge.to === cluster.id || edge.from === cluster.id));
              return (
                <g key={cluster.id} opacity={dim ? 0.45 : 1} onPointerEnter={() => setHover(cluster.id)} onPointerLeave={() => setHover(null)}>
                  <circle
                    cx={at.x}
                    cy={at.y}
                    r={cluster.r}
                    className={cn(cluster.pending ? 'fill-amber-500/5 stroke-amber-500/60' : 'fill-background stroke-border')}
                    strokeWidth={1.5}
                    strokeDasharray={cluster.pending ? '6 5' : undefined}
                  />
                  <g
                    role="link"
                    tabIndex={0}
                    aria-label={t('fleetLink', { name: cluster.label })}
                    className="cursor-move outline-none"
                    onPointerDown={(event) =>
                      start(event, {
                        kind: 'cluster',
                        id: cluster.id,
                        start: { x: event.clientX, y: event.clientY },
                        origin: offsets[`c:${cluster.id}`] ?? { x: 0, y: 0 },
                        moved: false,
                        href: cluster.href,
                      })
                    }
                    onKeyDown={(event) => event.key === 'Enter' && router.push(cluster.href)}
                  >
                    <rect x={at.x - 70} y={at.y - cluster.r - 16} width={140} height={24} rx={12} className="fill-card stroke-border" />
                    <text x={at.x} y={at.y - cluster.r} textAnchor="middle" className="fill-foreground text-[12px] font-semibold">
                      {cluster.label.length > 20 ? `${cluster.label.slice(0, 19)}…` : cluster.label}
                    </text>
                  </g>
                </g>
              );
            })}

            {[...layout.edges, ...exceptions].map((edge) => {
              const a = centerOf(edge.from, Boolean(edge.fromCluster));
              const b = centerOf(edge.to, Boolean(edge.toCluster));
              if (!a || !b) return null;
              const from = endpoint(edge.from, Boolean(edge.fromCluster), b);
              const to = endpoint(edge.to, Boolean(edge.toCluster), a);
              if (!from || !to) return null;
              const fromNode = nodeById.get(edge.from);
              const toNode = nodeById.get(edge.to);
              const live = fromNode?.online === true && (edge.toCluster || toNode?.online === true);
              const on = related(edge);
              return (
                <line
                  key={edge.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  markerEnd="url(#map-arrow)"
                  strokeWidth={edge.kind === 'data' ? 1.4 : 1.8}
                  opacity={on ? 1 : 0.12}
                  strokeDasharray={live ? undefined : edge.kind === 'exception' ? '8 4' : '2 5'}
                  className={cn(
                    live && 'map-live',
                    edge.kind === 'support' ? 'stroke-brand' : edge.kind === 'exception' ? 'stroke-amber-500' : live ? 'stroke-emerald-500' : 'stroke-muted-foreground/60'
                  )}
                />
              );
            })}

            {layout.nodes.map((node) => {
              const at = nodeAt(node);
              const support = node.tone === 'support';
              return (
                <g
                  key={node.id}
                  role="link"
                  tabIndex={0}
                  aria-label={node.label}
                  className="cursor-pointer outline-none"
                  onPointerEnter={() => setHover(node.id)}
                  onPointerLeave={() => setHover(null)}
                  onPointerDown={(event) =>
                    start(event, {
                      kind: 'node',
                      id: node.id,
                      start: { x: event.clientX, y: event.clientY },
                      origin: offsets[`n:${node.id}`] ?? { x: 0, y: 0 },
                      moved: false,
                      href: node.href,
                    })
                  }
                  onKeyDown={(event) => event.key === 'Enter' && router.push(node.href)}
                >
                  <title>{node.label}</title>
                  {support ? (
                    <rect x={at.x - 55} y={at.y - 16} width={110} height={32} rx={8} strokeWidth={1.2} className={TONE.support} />
                  ) : (
                    <circle cx={at.x} cy={at.y} r={NODE_R} strokeWidth={node.tone === 'server' ? 2.2 : 1.4} className={TONE[node.tone]} />
                  )}
                  {node.online !== null && (
                    <circle
                      cx={support ? at.x - 42 : at.x + NODE_R * 0.7}
                      cy={support ? at.y : at.y - NODE_R * 0.7}
                      r={4}
                      className={node.online ? 'fill-emerald-500' : 'fill-muted-foreground/60'}
                    />
                  )}
                  {node.tone === 'server' && (
                    <text x={at.x} y={at.y + 4} textAnchor="middle" className="fill-amber-600 text-[11px]">
                      ♛
                    </text>
                  )}
                  <text
                    x={support ? at.x + 6 : at.x}
                    y={support ? at.y + 4 : at.y + NODE_R + 13}
                    textAnchor="middle"
                    className={cn('text-[10px]', support ? 'fill-sidebar-accent-foreground font-medium' : 'fill-foreground')}
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-xs text-muted-foreground">
          {(['server', 'replica', 'equipment', 'hypervision', 'support', 'pending'] as const).map((tone) => (
            <span key={tone} className="inline-flex items-center gap-1.5">
              <svg width="14" height="14" aria-hidden>
                <circle cx="7" cy="7" r="6" strokeWidth={1.5} className={TONE[tone]} />
              </svg>
              {t(`legend.${tone}`)}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 bg-brand" /> {t('legend.supportLink')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 bg-amber-500" /> {t('legend.exception')}
          </span>
          <span className="ml-auto">{t('help')}</span>
        </div>
      </Card>
    </>
  );
}
