"use client";

import { CreateFleetDialog } from "@/features/acl";
import { StatusDot, fleetSlug, isHypervision } from "@/features/fleets";
import type { MachineKind } from "@/features/keys";
import {
  AlertTriangle,
  ChevronRight,
  Inbox,
  Layers,
  Monitor,
  Search,
  Server,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  StatCard,
  usePagination,
  usePermissions,
} from "@/shared/ui";
import { cn } from "@/shared/lib";
import {
  nodeMatches,
  normalize,
  summarizeFleets,
  unassignedNodes,
  useNodes,
  usePolicy,
  type FleetSummary,
} from "../lib";
import { AddMachineDialog } from "./AddMachineDialog";

type Sort = "name" | "size" | "offline";

const CHIP_LIMIT = 40;

function Health({ fleet }: { fleet: FleetSummary }) {
  const t = useTranslations("parc");
  const total = fleet.nodes.length;
  if (total === 0)
    return (
      <span className="text-xs text-muted-foreground">{t("home.empty")}</span>
    );
  const offline = total - fleet.online;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs tabular-nums",
        offline === 0
          ? "text-emerald-700 dark:text-emerald-400"
          : "text-amber-700 dark:text-amber-400",
      )}
    >
      {offline === 0 ? (
        <StatusDot online label={t("home.allOnline")} />
      ) : (
        <WifiOff className="size-3.5" aria-hidden />
      )}
      {t("home.onlineRatio", { online: fleet.online, total })}
    </span>
  );
}

function FleetRow({
  fleet,
  query,
  expanded,
  onToggle,
  onAdd,
}: {
  fleet: FleetSummary;
  query: string;
  expanded: boolean;
  onToggle: () => void;
  onAdd: (kind: MachineKind) => void;
}) {
  const t = useTranslations("parc");
  const tf = useTranslations("fleets");
  const { operate } = usePermissions();
  const shown = fleet.nodes.filter((node) => nodeMatches(node, query));
  const href = `/flottes/${fleet.slug}`;
  const equipment = fleet.nodes.length - fleet.hypervision;

  return (
    <li className="border-b last:border-b-0">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2 sm:grid-cols-[auto_1fr_auto_auto_7rem]">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={
            expanded
              ? t("home.collapse", { name: fleet.label })
              : t("home.expand", { name: fleet.label })
          }
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronRight
            className={cn(
              "size-4 transition-transform",
              expanded && "rotate-90",
            )}
            aria-hidden
          />
        </button>
        <span className="flex min-w-0 items-center gap-2">
          <Link href={href} className="truncate font-medium hover:underline">
            {fleet.label}
          </Link>
          {fleet.internal && (
            <Badge variant="secondary">{t("home.internal")}</Badge>
          )}
          {!fleet.inPolicy && (
            <Badge variant="warning" title={t("home.notInPolicyHint")}>
              {t("home.notInPolicy")}
            </Badge>
          )}
        </span>
        <span className="hidden items-center gap-3 text-xs text-muted-foreground tabular-nums sm:flex">
          <span
            className="inline-flex items-center gap-1"
            title={t("home.hypervisionCount")}
          >
            <Monitor className="size-3.5" aria-hidden />
            <span className="sr-only">{t("home.hypervisionCount")}</span>
            {fleet.hypervision}
          </span>
          <span
            className="inline-flex items-center gap-1"
            title={t("home.equipmentCount")}
          >
            <Server className="size-3.5" aria-hidden />
            <span className="sr-only">{t("home.equipmentCount")}</span>
            {equipment}
          </span>
        </span>
        <span className="text-right">
          <Health fleet={fleet} />
        </span>
      </div>

      {expanded && (
        <div className="border-t bg-muted/30 px-3 py-3 sm:pl-12">
          {fleet.nodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("home.noMachine")}
            </p>
          ) : (
            <>
              {(["hypervision", "equipment"] as const).map((kind) => {
                const group = shown.filter(
                  (node) =>
                    isHypervision(node.tags) === (kind === "hypervision"),
                );
                if (group.length === 0) return null;
                const Icon = kind === "hypervision" ? Monitor : Server;
                return (
                  <div key={kind} className="mb-2 flex flex-col gap-1.5">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Icon className="size-3.5" aria-hidden />
                      {kind === "hypervision"
                        ? t("home.hypervisionCount")
                        : t("home.equipmentCount")}
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {group.slice(0, CHIP_LIMIT).map((node) => (
                        <li
                          key={node.id}
                          className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs"
                        >
                          <StatusDot
                            online={node.online}
                            label={node.online ? tf("online") : tf("offline")}
                          />
                          <span className="font-medium">
                            {node.givenName || node.name}
                          </span>
                          <span className="font-mono text-muted-foreground">
                            {node.ipAddresses[0]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {shown.length > CHIP_LIMIT && (
                <Link
                  href={href}
                  className="mt-2 inline-block text-xs font-medium hover:underline"
                >
                  {t("home.seeAll", { count: shown.length })}
                </Link>
              )}
            </>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {operate && !fleet.internal && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAdd("hypervision")}
              >
                <Monitor aria-hidden />
                {t("fleet.addHypervision")}
              </Button>
            )}
            {operate && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAdd("equipment")}
              >
                <Server aria-hidden />
                {t("fleet.addEquipment")}
              </Button>
            )}
            <Link
              href={href}
              className="inline-flex h-8 items-center px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {t("home.openFleet")}
            </Link>
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * Accueil : toutes les flottes sur une liste dense, dépliable ligne à ligne.
 * Pensé pour 3 comme pour 150 flottes : recherche (flotte ou machine), tri,
 * filtre « hors ligne », pagination. Chercher une machine déplie les flottes
 * qui la contiennent.
 */
export function FleetsHome() {
  const t = useTranslations("parc");
  const { operate } = usePermissions();
  const router = useRouter();
  const nodesQuery = useNodes();
  const policyQuery = usePolicy();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [offlineOnly, setOfflineOnly] = useState(false);
  const [toggled, setToggled] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<{
    fleet: FleetSummary;
    kind: MachineKind;
  } | null>(null);

  const nodes = useMemo(() => nodesQuery.data ?? [], [nodesQuery.data]);
  const fleets = useMemo(
    () => summarizeFleets(policyQuery.data?.fleets ?? [], nodes),
    [policyQuery.data, nodes],
  );
  const pending = useMemo(() => unassignedNodes(nodes), [nodes]);

  const q = query.trim();
  const { visible, machineHits } = useMemo(() => {
    const hits = new Set<string>();
    const filtered = fleets.filter((fleet) => {
      if (offlineOnly && fleet.online === fleet.nodes.length) return false;
      if (!q) return true;
      if (
        normalize(fleet.label).includes(normalize(q)) ||
        fleet.tag.includes(normalize(q))
      )
        return true;
      if (fleet.nodes.some((node) => nodeMatches(node, q))) {
        hits.add(fleet.tag);
        return true;
      }
      return false;
    });
    const offline = (fleet: FleetSummary) => fleet.nodes.length - fleet.online;
    const sorted = [...filtered].sort((a, b) => {
      if (a.internal !== b.internal) return a.internal ? -1 : 1;
      if (sort === "size")
        return (
          b.nodes.length - a.nodes.length || a.label.localeCompare(b.label)
        );
      if (sort === "offline")
        return offline(b) - offline(a) || a.label.localeCompare(b.label);
      return a.label.localeCompare(b.label);
    });
    return { visible: sorted, machineHits: hits };
  }, [fleets, q, sort, offlineOnly]);

  const pagination = usePagination(visible, 25);
  const error = nodesQuery.error ?? policyQuery.error;
  const loading = nodesQuery.isPending || policyQuery.isPending;

  const onlineCount = nodes.filter((node) => node.online).length;
  const offlineFleets = fleets.filter(
    (fleet) => fleet.online < fleet.nodes.length,
  ).length;

  function toggle(tag: string) {
    setToggled((current) => {
      const next = new Set(current);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  return (
    <>
      <PageHeader
        title={t("home.title")}
        description={t("home.description")}
        actions={
          operate && (
            <CreateFleetDialog
              onCreated={(tag) => router.push(`/flottes/${fleetSlug(tag)}`)}
            />
          )
        }
      />

      {error && (
        <Badge variant="critical" role="alert" className="w-fit">
          {error.message}
        </Badge>
      )}

      {pending.length > 0 && (
        <Link
          href="/a-assigner"
          className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm hover:bg-amber-500/15"
        >
          <Inbox
            className="size-5 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden
          />
          <span className="flex-1">
            <span className="font-medium">
              {t("home.unassignedBanner", { count: pending.length })}
            </span>{" "}
            <span className="text-muted-foreground">
              {t("home.unassignedHint")}
            </span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label={t("stats.fleets")}
          value={loading ? "…" : fleets.length}
          icon={Layers}
        />
        <StatCard
          label={t("stats.machines")}
          value={loading ? "…" : nodes.length}
          icon={Server}
        />
        <StatCard
          label={t("stats.online")}
          value={loading ? "…" : `${onlineCount}/${nodes.length}`}
          icon={Monitor}
          tone="ok"
        />
        <StatCard
          label={t("stats.fleetsWithOffline")}
          value={loading ? "…" : offlineFleets}
          icon={AlertTriangle}
          tone={offlineFleets > 0 ? "critical" : "default"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            aria-label={t("home.search")}
            placeholder={t("home.search")}
            className="pl-8"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              pagination.setPage(0);
            }}
          />
        </div>
        <Button
          variant={offlineOnly ? "secondary" : "outline"}
          aria-pressed={offlineOnly}
          onClick={() => {
            setOfflineOnly(!offlineOnly);
            pagination.setPage(0);
          }}
        >
          <WifiOff aria-hidden />
          {t("home.offlineOnly")}
        </Button>
        <Select value={sort} onValueChange={(value) => setSort(value as Sort)}>
          <SelectTrigger className="w-44" aria-label={t("home.sort")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">{t("home.sortName")}</SelectItem>
            <SelectItem value="size">{t("home.sortSize")}</SelectItem>
            <SelectItem value="offline">{t("home.sortOffline")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Layers}
          title={fleets.length === 0 ? t("home.noFleet") : t("home.noResult")}
          description={fleets.length === 0 ? t("home.noFleetHint") : undefined}
        />
      ) : (
        <div>
          <Card className="overflow-hidden">
            <ul aria-label={t("home.title")}>
              {pagination.items.map((fleet) => {
                // Un clic inverse l'état par défaut : ouvert si la recherche a trouvé une machine dedans.
                const byDefault = machineHits.has(fleet.tag);
                return (
                  <FleetRow
                    key={fleet.tag}
                    fleet={fleet}
                    query={byDefault ? q : ""}
                    expanded={byDefault !== toggled.has(fleet.tag)}
                    onToggle={() => toggle(fleet.tag)}
                    onAdd={(kind) => setAdding({ fleet, kind })}
                  />
                );
              })}
            </ul>
          </Card>
          <Pagination
            {...pagination}
            label={(range) => t("home.pagination", range)}
          />
        </div>
      )}
      {adding && (
        <AddMachineDialog
          fleetTag={adding.fleet.tag}
          fleetLabel={adding.fleet.label}
          kind={adding.kind}
          open
          onOpenChange={(open) => !open && setAdding(null)}
        />
      )}
    </>
  );
}
