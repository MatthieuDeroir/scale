"use client";

import { StatusDot, formatLastSeen, type FleetNode } from "@/features/fleets";
import { IssueKeyPanel, type MachineKind } from "@/features/keys";
import { Inbox, KeyRound, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
} from "@/shared/ui";
import { cn } from "@/shared/lib";
import { nodeMatches, unassignedNodes, useAssignNodes, useNodes } from "../lib";

type Source = "pending" | "key";

function SourceOption({
  selected,
  onSelect,
  icon: Icon,
  title,
  description,
  badge,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: typeof Inbox;
  title: string;
  description: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex flex-1 items-start gap-2.5 rounded-lg border p-3 text-left transition-colors",
        selected ? "border-brand bg-brand/5" : "hover:bg-muted/50",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          selected ? "text-brand" : "text-muted-foreground",
        )}
      />
      <span className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {title}
          {badge !== undefined && (
            <Badge variant={badge > 0 ? "warning" : "secondary"}>{badge}</Badge>
          )}
        </span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

function PendingPicker({
  nodes,
  fleetTag,
  fleetLabel,
  onDone,
}: {
  nodes: FleetNode[];
  fleetTag: string;
  fleetLabel: string;
  onDone: () => void;
}) {
  const t = useTranslations("parc");
  const tf = useTranslations("fleets");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const mutation = useAssignNodes(onDone);

  const shown = nodes.filter((node) => nodeMatches(node, query.trim()));
  const chosen = nodes.filter((node) => selected.has(node.id));

  if (nodes.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title={t("add.noPending")}
        description={t("add.noPendingHint")}
      />
    );
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {nodes.length > 6 && (
          <div className="relative">
            <Search
              className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              aria-label={t("add.search")}
              placeholder={t("add.search")}
              className="pl-8"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        )}
        <ul className="flex flex-col divide-y rounded-lg border">
          {shown.map((node) => {
            const name = node.givenName || node.name;
            return (
              <li key={node.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/40">
                  <input
                    type="checkbox"
                    className="size-4 accent-brand"
                    checked={selected.has(node.id)}
                    onChange={() => toggle(node.id)}
                    aria-label={t("inbox.select", { name })}
                  />
                  <StatusDot
                    online={node.online}
                    label={node.online ? tf("online") : tf("offline")}
                  />
                  <span className="flex-1 text-sm font-medium">{name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {node.online
                      ? tf("online")
                      : (formatLastSeen(node.lastSeen) ?? tf("never"))}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
      <DialogFooter>
        <Button
          variant="brand"
          disabled={chosen.length === 0 || mutation.isPending}
          onClick={() => mutation.mutate({ nodes: chosen, fleetTag })}
        >
          {mutation.isPending
            ? t("inbox.assigning")
            : t("add.assign", { count: chosen.length, fleet: fleetLabel })}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Ajout d'une machine à une flotte, un dialogue par nature de machine pour
 * que les deux ne se confondent jamais :
 * - poste d'hypervision client : toujours par une clé (le client l'installe) ;
 * - équipement Stramatel : soit une machine déjà auto-enrôlée qui attend
 *   dans « À assigner », soit une clé pour une installation manuelle.
 */
export function AddMachineDialog({
  fleetTag,
  fleetLabel,
  kind,
  open,
  onOpenChange,
}: {
  fleetTag: string;
  fleetLabel: string;
  kind: MachineKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("parc");
  const nodesQuery = useNodes();
  const pending = useMemo(
    () => unassignedNodes(nodesQuery.data ?? []),
    [nodesQuery.data],
  );
  const [source, setSource] = useState<Source | null>(null);
  const [keyIssued, setKeyIssued] = useState(false);

  // Par défaut, piocher dans « À assigner » s'il y a de quoi : c'est le cas nominal d'une NUC.
  const effectiveSource: Source =
    kind === "hypervision"
      ? "key"
      : (source ?? (pending.length > 0 ? "pending" : "key"));

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setSource(null);
      setKeyIssued(false);
    }
  }

  const hypervision = kind === "hypervision";

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {hypervision ? t("add.hypervisionTitle") : t("add.equipmentTitle")}
          </DialogTitle>
          <DialogDescription>
            {hypervision
              ? t("add.hypervisionIntro", { fleet: fleetLabel })
              : t("add.equipmentIntro", { fleet: fleetLabel })}
          </DialogDescription>
        </DialogHeader>

        {!hypervision && !keyIssued && (
          <div
            role="radiogroup"
            aria-label={t("add.source")}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <SourceOption
              selected={effectiveSource === "pending"}
              onSelect={() => setSource("pending")}
              icon={Inbox}
              title={t("add.fromPending")}
              description={t("add.fromPendingHint")}
              badge={pending.length}
            />
            <SourceOption
              selected={effectiveSource === "key"}
              onSelect={() => setSource("key")}
              icon={KeyRound}
              title={t("add.fromKey")}
              description={t("add.fromKeyHint")}
            />
          </div>
        )}

        {effectiveSource === "pending" ? (
          <PendingPicker
            nodes={pending}
            fleetTag={fleetTag}
            fleetLabel={fleetLabel}
            onDone={() => close(false)}
          />
        ) : (
          <IssueKeyPanel
            fleetTag={fleetTag}
            kind={kind}
            onIssued={() => setKeyIssued(true)}
            onDone={() => close(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
