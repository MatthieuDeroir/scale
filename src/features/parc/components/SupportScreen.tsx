'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StatusDot, fleetSlug, type FleetNode } from '@/features/fleets';
import { IssueKeyPanel } from '@/features/keys';
import { Globe, Headset, Inbox, KeyRound, Link2, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState, type ReactNode } from 'react';
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
  EmptyState,
  Input,
  Label,
  PageHeader,
  Skeleton,
  Switch,
  usePermissions,
} from '@/shared/ui';
import { cn } from '@/shared/lib';
import {
  attachToSupport,
  createSupportPost,
  deleteSupportPost,
  issueSupportKey,
  setSupportTargets,
  type SupportPost,
} from '../api';
import { summarizeFleets, unassignedNodes, useNodes, usePolicy, useProfiles, type FleetSummary } from '../lib';
import { supportKey, useSupportPosts } from './FleetSupportCard';

const UNASSIGNED = 'tag:a-assigner';
const W = 760;
const BOX_W = 180;
const BOX_H = 40;
const ROW = 52;

function truncate(value: string, max = 22): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Schéma d'un poste support : ses PC à gauche, les flottes qu'il prend en
 * charge à droite, liens vivants quand les deux bouts sont en ligne. Chaque
 * lien vaut pour toutes les machines de la flotte.
 */
function SupportDiagram({ post, fleets, pending }: { post: SupportPost; fleets: FleetSummary[]; pending: number }) {
  const t = useTranslations('parc.support');
  const router = useRouter();
  const everywhere = post.targets.includes('*');
  const targets = [
    ...fleets
      .filter((fleet) => everywhere || post.targets.includes(fleet.tag))
      .map((fleet) => ({
        id: fleet.tag,
        title: fleet.label,
        subtitle: t('diagramFleet', { online: fleet.online, total: fleet.nodes.length }),
        online: fleet.nodes.length > 0 ? fleet.online > 0 : null,
        href: `/flottes/${fleetSlug(fleet.tag)}`,
      })),
    ...(everywhere || post.targets.includes(UNASSIGNED)
      ? [{ id: UNASSIGNED, title: t('unassigned'), subtitle: t('diagramPending', { count: pending }), online: null, href: '/a-assigner' }]
      : []),
  ];
  const machines =
    post.machines.length > 0
      ? post.machines.map((machine) => ({ id: machine.id, title: machine.name, subtitle: machine.ip ?? '', online: machine.online, href: `/machines/${machine.id}` }))
      : [{ id: 'none', title: t('noMachine'), subtitle: t('noMachineHint'), online: null as boolean | null, href: undefined as string | undefined }];

  if (targets.length === 0) return <p className="text-sm text-muted-foreground">{t('noAccess')}</p>;

  const rows = Math.max(machines.length, targets.length);
  const height = rows * ROW + 20;
  const place = <T,>(items: T[], x: number) =>
    items.map((item, index) => ({ ...item, x, y: height / 2 - ((items.length - 1) * ROW) / 2 + index * ROW }));
  const left = place(machines, 110);
  const right = place(targets, W - 110);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${height}`} className="min-w-[560px]" role="img" aria-label={t('diagramAria', { name: post.name })}>
        <defs>
          <marker id={`support-arrow-${post.tag}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
          </marker>
        </defs>
        <style>{`
          .flow-live { stroke-dasharray: 6 6; animation: flow-move 1.2s linear infinite; }
          @keyframes flow-move { to { stroke-dashoffset: -24; } }
          @media (prefers-reduced-motion: reduce) { .flow-live { animation: none; } }
        `}</style>
        {left.flatMap((from) =>
          right.map((to) => {
            const live = from.online === true && to.online !== false && to.online !== null;
            const x1 = from.x + BOX_W / 2;
            const x2 = to.x - BOX_W / 2;
            const mid = (x1 + x2) / 2;
            return (
              <path
                key={`${from.id}-${to.id}`}
                d={`M ${x1} ${from.y} C ${mid} ${from.y}, ${mid} ${to.y}, ${x2} ${to.y}`}
                fill="none"
                strokeWidth={1.5}
                markerEnd={`url(#support-arrow-${post.tag})`}
                className={cn('stroke-brand', live ? 'flow-live' : 'opacity-40')}
                strokeDasharray={live ? undefined : '2 5'}
              />
            );
          })
        )}
        {[...left.map((box) => ({ ...box, side: 'left' })), ...right.map((box) => ({ ...box, side: 'right' }))].map((box) => (
          <g
            key={`${box.side}-${box.id}`}
            transform={`translate(${box.x - BOX_W / 2} ${box.y - BOX_H / 2})`}
            {...(box.href
              ? {
                  role: 'link',
                  tabIndex: 0,
                  'aria-label': box.title,
                  className: 'cursor-pointer outline-none',
                  onClick: () => router.push(box.href!),
                  onKeyDown: (event: React.KeyboardEvent) => {
                    if (event.key === 'Enter') router.push(box.href!);
                  },
                }
              : {})}
          >
            <rect
              width={BOX_W}
              height={BOX_H}
              rx={8}
              strokeWidth={1.2}
              strokeDasharray={box.id === 'none' ? '4 3' : undefined}
              className={box.side === 'left' ? 'fill-sidebar stroke-sidebar' : 'fill-card stroke-border'}
            />
            {box.online !== null && (
              <circle cx={14} cy={BOX_H / 2} r={4} className={box.online ? 'fill-emerald-500' : 'fill-muted-foreground/50'} />
            )}
            <text
              x={box.online !== null ? 26 : 12}
              y={16}
              className={cn('text-[12px] font-medium', box.side === 'left' ? 'fill-sidebar-accent-foreground' : 'fill-foreground')}
            >
              {truncate(box.title)}
            </text>
            <text x={box.online !== null ? 26 : 12} y={30} className={cn('text-[10px]', box.side === 'left' ? 'fill-sidebar-muted' : 'fill-muted-foreground')}>
              {truncate(box.subtitle, 28)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Périmètre d'un poste : flottes cochées, « À assigner », ou tout le parc. */
function ScopeDialog({ post, fleets, onClose }: { post: SupportPost; fleets: FleetSummary[]; onClose: () => void }) {
  const t = useTranslations('parc.support');
  const queryClient = useQueryClient();
  const [everywhere, setEverywhere] = useState(post.targets.includes('*'));
  const [selected, setSelected] = useState(new Set(post.targets.filter((item) => item !== '*')));
  const [query, setQuery] = useState('');
  const mutation = useMutation({
    mutationFn: () => setSupportTargets(post.tag, everywhere ? ['*'] : [...selected]),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: supportKey }),
        queryClient.invalidateQueries({ queryKey: ['acl', 'policy'] }),
      ]);
      toast.success(t('scopeSaved', { name: post.name }));
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const toggle = (tag: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  const options = [
    ...fleets.filter((fleet) => fleet.label.toLowerCase().includes(query.trim().toLowerCase())).map((fleet) => ({ tag: fleet.tag, label: fleet.label })),
    { tag: UNASSIGNED, label: t('unassigned') },
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('scopeTitle', { name: post.name })}</DialogTitle>
          <DialogDescription>{t('scopeDescription')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <label className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
            <Switch checked={everywhere} onCheckedChange={setEverywhere} aria-label={t('everywhere')} />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{t('everywhere')}</span>
              <span className="text-xs text-muted-foreground">{t('everywhereHint')}</span>
            </span>
          </label>
          {!everywhere && (
            <>
              {fleets.length > 8 && (
                <div className="relative">
                  <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input className="pl-8" aria-label={t('searchFleet')} placeholder={t('searchFleet')} value={query} onChange={(event) => setQuery(event.target.value)} />
                </div>
              )}
              <ul className="flex max-h-80 flex-col divide-y overflow-y-auto rounded-lg border">
                {options.map((option) => (
                  <li key={option.tag}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/40">
                      <input
                        type="checkbox"
                        className="size-4 accent-brand"
                        checked={selected.has(option.tag)}
                        onChange={() => toggle(option.tag)}
                      />
                      <span className={cn(option.tag === UNASSIGNED && 'text-muted-foreground')}>{option.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="brand" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {t('saveScope')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Nouveau poste : un nom (la personne), puis la clé de son PC, ou une machine déjà raccordée. */
function NewPostDialog({ pending, onClose }: { pending: FleetNode[]; onClose: () => void }) {
  const t = useTranslations('parc.support');
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [post, setPost] = useState<{ tag: string; name: string } | null>(null);
  const create = useMutation({
    mutationFn: () => createSupportPost(name),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: supportKey });
      setPost(created);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{post ? t('connectTitle', { name: post.name }) : t('newTitle')}</DialogTitle>
          <DialogDescription>{post ? t('connectDescription') : t('newDescription')}</DialogDescription>
        </DialogHeader>
        {post ? (
          <ConnectMachine post={post} pending={pending} onDone={onClose} />
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="support-name">{t('name')}</Label>
              <Input id="support-name" placeholder={t('namePlaceholder')} value={name} onChange={(event) => setName(event.target.value)} />
              <p className="text-xs text-muted-foreground">{t('nameHint')}</p>
            </div>
            <DialogFooter>
              <Button variant="brand" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
                <Plus aria-hidden />
                {t('create')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Raccorde un PC au poste : clé à installer, ou machine en attente rattachée. */
function ConnectMachine({ post, pending, onDone }: { post: { tag: string; name: string }; pending: FleetNode[]; onDone: () => void }) {
  const t = useTranslations('parc.support');
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'key' | 'attach'>('key');
  const attach = useMutation({
    mutationFn: (node: FleetNode) => attachToSupport(post.tag, node.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: supportKey }),
        queryClient.invalidateQueries({ queryKey: ['fleets', 'nodes'] }),
      ]);
      toast.success(t('attached', { name: post.name }));
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="flex flex-col gap-4">
      {pending.length > 0 && (
        <div role="radiogroup" aria-label={t('connectMode')} className="flex gap-1 rounded-lg bg-muted p-1">
          {(['key', 'attach'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                mode === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {value === 'key' ? <KeyRound className="size-3.5" aria-hidden /> : <Inbox className="size-3.5" aria-hidden />}
              {value === 'key' ? t('modeKey') : t('modeAttach', { count: pending.length })}
            </button>
          ))}
        </div>
      )}
      {mode === 'key' ? (
        <IssueKeyPanel
          fleetTag={post.tag}
          kind="hypervision"
          fixedName={`support-${post.name}`}
          issueLabel={t('issueKey')}
          issue={(expiration) => issueSupportKey(post.tag, expiration)}
          onIssued={() => queryClient.invalidateQueries({ queryKey: supportKey })}
          onDone={onDone}
        />
      ) : (
        <ul className="-mx-2 flex max-h-80 flex-col overflow-y-auto">
          {pending.map((node) => (
            <li key={node.id}>
              <button
                type="button"
                disabled={attach.isPending}
                onClick={() => attach.mutate(node)}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm hover:bg-muted/60"
              >
                <StatusDot online={node.online} label={node.givenName || node.name} />
                <span className="flex-1 font-medium">{node.givenName || node.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{node.ipAddresses[0]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PostCard({
  post,
  fleets,
  pending,
  children,
}: {
  post: SupportPost;
  fleets: FleetSummary[];
  pending: number;
  children: ReactNode;
}) {
  const t = useTranslations('parc.support');
  const everywhere = post.targets.includes('*');
  const count = everywhere ? fleets.length : post.targets.filter((item) => item !== UNASSIGNED).length;
  return (
    <Card>
      <CardHeader className="px-5 pt-5 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="flex items-center gap-2 text-base">
              <Headset className="size-4 text-muted-foreground" aria-hidden />
              {post.name}
              {everywhere ? (
                <Badge variant="warning" className="gap-1">
                  <Globe className="size-3" aria-hidden />
                  {t('everywhere')}
                </Badge>
              ) : (
                <Badge variant="secondary">{t('fleetCount', { count })}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              <code className="font-mono text-xs">{post.tag}</code>
              {' · '}
              {t('machineCount', { count: post.machines.length })}
            </CardDescription>
          </div>
          {children}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        <SupportDiagram post={post} fleets={fleets} pending={pending} />
      </CardContent>
    </Card>
  );
}

/**
 * Support : les postes des personnes de Stramatel et les flottes que chacun
 * prend en charge. Moindre privilège : un poste ne joint que les flottes de
 * son périmètre (toutes leurs machines) ; « tout le parc » est une exception
 * explicite. Les flottes ne joignent jamais un poste support.
 */
export function SupportScreen() {
  const t = useTranslations('parc.support');
  const { operate } = usePermissions();
  const queryClient = useQueryClient();
  const posts = useSupportPosts();
  const nodesQuery = useNodes();
  const policyQuery = usePolicy();
  const profilesQuery = useProfiles();
  const [creating, setCreating] = useState(false);
  const [scoping, setScoping] = useState<SupportPost | null>(null);
  const [connecting, setConnecting] = useState<SupportPost | null>(null);
  const [deleting, setDeleting] = useState<SupportPost | null>(null);

  const nodes = useMemo(() => nodesQuery.data ?? [], [nodesQuery.data]);
  const fleets = useMemo(
    () =>
      summarizeFleets(policyQuery.data?.fleets ?? [], nodes, profilesQuery.data ?? []).filter(
        (fleet) => fleet.tag.startsWith('tag:flotte-')
      ),
    [policyQuery.data, nodes, profilesQuery.data]
  );
  const pending = unassignedNodes(nodes);
  const remove = useMutation({
    mutationFn: (post: SupportPost) => deleteSupportPost(post.tag),
    onSuccess: async (_result, post) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: supportKey }),
        queryClient.invalidateQueries({ queryKey: ['fleets', 'nodes'] }),
        queryClient.invalidateQueries({ queryKey: ['acl', 'policy'] }),
      ]);
      toast.success(t('deleted', { name: post.name }));
      setDeleting(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          operate && (
            <Button variant="brand" onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              {t('new')}
            </Button>
          )
        }
      />

      {posts.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : posts.error ? (
        <Badge variant="critical" role="alert" className="w-fit">
          {posts.error.message}
        </Badge>
      ) : (posts.data ?? []).length === 0 ? (
        <EmptyState icon={Headset} title={t('empty')} description={t('emptyHint')} />
      ) : (
        posts.data!.map((post) => (
          <PostCard key={post.tag} post={post} fleets={fleets} pending={pending.length}>
            {operate && (
              <span className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setScoping(post)}>
                  <SlidersHorizontal aria-hidden />
                  {t('editScope')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConnecting(post)}>
                  <Link2 aria-hidden />
                  {t('connect')}
                </Button>
                <Button variant="ghost" size="icon" aria-label={t('delete', { name: post.name })} title={t('delete', { name: post.name })} onClick={() => setDeleting(post)}>
                  <Trash2 aria-hidden />
                </Button>
              </span>
            )}
          </PostCard>
        ))
      )}

      <p className="text-xs text-muted-foreground">
        {t('footer')}{' '}
        <Link href="/politique" className="underline">
          {t('footerLink')}
        </Link>
      </p>

      {creating && <NewPostDialog pending={pending} onClose={() => setCreating(false)} />}
      {scoping && <ScopeDialog post={scoping} fleets={fleets} onClose={() => setScoping(null)} />}
      {connecting && (
        <Dialog open onOpenChange={(open) => !open && setConnecting(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('connectTitle', { name: connecting.name })}</DialogTitle>
              <DialogDescription>{t('connectDescription')}</DialogDescription>
            </DialogHeader>
            <ConnectMachine post={connecting} pending={pending} onDone={() => setConnecting(null)} />
          </DialogContent>
        </Dialog>
      )}
      {deleting && (
        <Dialog open onOpenChange={(open) => !open && setDeleting(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('deleteTitle', { name: deleting.name })}</DialogTitle>
              <DialogDescription>{t('deleteDescription', { count: deleting.machines.length })}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleting(null)}>
                {t('cancel')}
              </Button>
              <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate(deleting)}>
                <Trash2 aria-hidden />
                {t('confirmDelete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
