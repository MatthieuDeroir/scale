'use client';

import { isHypervision, type FleetNode } from '@/features/fleets';
import { Layers, Monitor, Search, Server } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, SidebarButton } from '@/shared/ui';
import { cn } from '@/shared/lib';
import {
  fleetLabelResolver,
  fleetMatches,
  nodeMatches,
  normalize,
  summarizeFleets,
  useNodes,
  usePolicy,
  useProfiles,
  type FleetSummary,
} from '../lib';

const MAX_RESULTS = 8;

type Result =
  | { kind: 'fleet'; fleet: FleetSummary }
  | { kind: 'machine'; node: FleetNode; fleetLabel: string; href: string };

function machineMatches(node: FleetNode, q: string): boolean {
  return (
    nodeMatches(node, q) ||
    [node.enrollment?.serial, node.enrollment?.model].some(
      (value) => value && normalize(value).includes(normalize(q))
    )
  );
}

/**
 * Recherche globale (Ctrl+K ou ⌘K) : une flotte ou une machine depuis
 * n'importe quel écran, au clavier. Mène à la page de la flotte concernée.
 */
export function GlobalSearch() {
  const t = useTranslations('parc');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const nodes = useNodes().data;
  const policy = usePolicy().data;
  const profiles = useProfiles().data;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo<Result[]>(() => {
    const q = query.trim();
    if (!q) return [];
    const fleets = summarizeFleets(policy?.fleets ?? [], nodes ?? [], profiles ?? []);
    const label = fleetLabelResolver(fleets);
    const slugOf = new Map(fleets.map((fleet) => [fleet.tag, fleet.slug]));
    const fleetResults: Result[] = fleets
      .filter((fleet) => fleetMatches(fleet, q))
      .map((fleet) => ({ kind: 'fleet', fleet }));
    const machineResults: Result[] = (nodes ?? [])
      .filter((node) => machineMatches(node, q))
      .map((node) => {
        return {
          kind: 'machine',
          node,
          fleetLabel: label(node),
          href: `/machines/${node.id}`,
        };
      });
    return [...fleetResults, ...machineResults].slice(0, MAX_RESULTS);
  }, [query, nodes, policy, profiles]);

  function go(result: Result | undefined) {
    if (!result) return;
    router.push(result.kind === 'fleet' ? `/flottes/${result.fleet.slug}` : result.href);
    setOpen(false);
    setQuery('');
  }

  return (
    <>
      <SidebarButton icon={<Search />} label={t('search.open')} detail="Ctrl K" onClick={() => setOpen(true)} />
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery('');
        }}
      >
        <DialogContent className="top-[12vh] right-auto left-1/2 h-auto max-h-[70vh] max-w-lg -translate-x-1/2 gap-0 rounded-xl border p-0">
          <DialogTitle className="sr-only">{t('search.open')}</DialogTitle>
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="size-4 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="global-search-results"
              aria-label={t('search.placeholder')}
              placeholder={t('search.placeholder')}
              className="h-12 flex-1 bg-transparent text-sm outline-none"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setActive((index) => Math.min(index + 1, results.length - 1));
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setActive((index) => Math.max(index - 1, 0));
                } else if (event.key === 'Enter') {
                  go(results[active]);
                }
              }}
            />
          </div>
          <ul id="global-search-results" role="listbox" className="overflow-y-auto p-2">
            {query.trim() && results.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">{t('search.none')}</li>
            )}
            {!query.trim() && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">{t('search.hint')}</li>
            )}
            {results.map((result, index) => {
              const Icon =
                result.kind === 'fleet' ? Layers : isHypervision(result.node.tags) ? Monitor : Server;
              return (
                <li key={result.kind === 'fleet' ? result.fleet.tag : result.node.id} role="option" aria-selected={index === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(result)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm',
                      index === active && 'bg-muted'
                    )}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    {result.kind === 'fleet' ? (
                      <span className="flex-1 truncate font-medium">{result.fleet.label}</span>
                    ) : (
                      <>
                        <span className="flex-1 truncate">
                          <span className="font-medium">{result.node.givenName || result.node.name}</span>
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {result.node.ipAddresses[0]}
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground">{result.fleetLabel}</span>
                      </>
                    )}
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {result.kind === 'fleet' ? t('search.fleet') : t('search.machine')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
