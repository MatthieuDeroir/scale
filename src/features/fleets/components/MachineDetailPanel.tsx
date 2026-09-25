"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
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
  Separator,
  usePermissions,
} from "@/shared/ui";
import {
  deleteNode,
  expireNode,
  renameNode,
  retagNode,
  type FleetNode,
} from "../api";
import { fleetTagOf, isHypervision, parseFleetLabel, withFleet } from "../lib";
import { formatLastSeen } from "./MachinesTable";

export interface FleetOption {
  tag: string;
  label: string;
}

export function MachineDetailPanel({
  node,
  fleets,
  open,
  onOpenChange,
}: {
  node: FleetNode;
  /** Flottes connues de la politique ACL — cibles possibles d'un changement de flotte. */
  fleets: FleetOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("fleets");
  const { operate } = usePermissions();
  const queryClient = useQueryClient();
  const currentFleet = fleetTagOf(node.tags);

  const [name, setName] = useState(node.givenName || node.name);
  const [targetFleet, setTargetFleet] = useState(currentFleet ?? "");
  const [confirmExpire, setConfirmExpire] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["fleets", "nodes"] });
  }

  const renameMutation = useMutation({
    mutationFn: () => renameNode(node.id, name),
    onSuccess: async () => {
      await invalidate();
      toast.success(t("detail.renamed"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const retagMutation = useMutation({
    // `withFleet` garde les tags de type (ex. tag:hypervision) : changer une
    // machine de flotte ne doit pas lui faire perdre sa nature.
    mutationFn: () => retagNode(node.id, withFleet(node.tags, targetFleet)),
    onSuccess: async () => {
      await invalidate();
      toast.success(t("detail.retagged"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const expireMutation = useMutation({
    mutationFn: () => expireNode(node.id),
    onSuccess: async () => {
      await invalidate();
      setConfirmExpire(false);
      toast.success(t("detail.expired"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteNode(node.id),
    onSuccess: async () => {
      await invalidate();
      onOpenChange(false);
      toast.success(t("detail.deleted"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{node.givenName || node.name}</DialogTitle>
            <Badge variant={node.online ? "ok" : "critical"}>
              {node.online ? t("online") : t("offline")}
            </Badge>
          </div>
          <DialogDescription>
            {isHypervision(node.tags)
              ? t("kind.hypervision")
              : t("kind.equipment")}{" "}
            · {parseFleetLabel(node.tags)}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t("columns.address")}</dt>
          <dd className="font-mono text-xs leading-5">
            {node.ipAddresses.join(", ")}
          </dd>
          <dt className="text-muted-foreground">{t("columns.lastSeen")}</dt>
          <dd className="tabular-nums">
            {formatLastSeen(node.lastSeen) ?? t("never")}
          </dd>
          {node.createdAt && (
            <>
              <dt className="text-muted-foreground">{t("detail.joinedAt")}</dt>
              <dd className="tabular-nums">{formatLastSeen(node.createdAt)}</dd>
            </>
          )}
          {node.enrollment?.serial && (
            <>
              <dt className="text-muted-foreground">{t("detail.serial")}</dt>
              <dd className="font-mono text-xs leading-5">
                {node.enrollment.serial}
              </dd>
            </>
          )}
          {node.enrollment?.model && (
            <>
              <dt className="text-muted-foreground">{t("detail.model")}</dt>
              <dd>{node.enrollment.model}</dd>
            </>
          )}
          <dt className="text-muted-foreground">{t("detail.tags")}</dt>
          <dd className="flex flex-wrap gap-1">
            {node.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="font-mono">
                {tag}
              </Badge>
            ))}
          </dd>
        </dl>

        {operate && (
          <>
            <Separator />

            <div className="flex flex-col gap-2">
              <Label htmlFor="machine-name">{t("detail.rename")}</Label>
              <div className="flex gap-2">
                <Input
                  id="machine-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <Button
                  variant="outline"
                  disabled={
                    !name.trim() ||
                    name === node.givenName ||
                    renameMutation.isPending
                  }
                  onClick={() => renameMutation.mutate()}
                >
                  {t("detail.apply")}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="machine-fleet">{t("detail.changeFleet")}</Label>
              <div className="flex gap-2">
                <Select value={targetFleet} onValueChange={setTargetFleet}>
                  <SelectTrigger id="machine-fleet" className="flex-1">
                    <SelectValue placeholder={t("detail.chooseFleet")} />
                  </SelectTrigger>
                  <SelectContent>
                    {fleets.map((fleet) => (
                      <SelectItem key={fleet.tag} value={fleet.tag}>
                        {fleet.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  disabled={
                    !targetFleet ||
                    targetFleet === currentFleet ||
                    retagMutation.isPending
                  }
                  onClick={() => retagMutation.mutate()}
                >
                  {t("detail.apply")}
                </Button>
              </div>
            </div>

            <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:justify-between">
              <Button
                variant={confirmExpire ? "destructive" : "outline"}
                disabled={expireMutation.isPending}
                onClick={() =>
                  confirmExpire
                    ? expireMutation.mutate()
                    : setConfirmExpire(true)
                }
              >
                {confirmExpire ? t("detail.confirmExpire") : t("detail.expire")}
              </Button>
              <Button
                variant={confirmDelete ? "destructive" : "outline"}
                disabled={deleteMutation.isPending}
                onClick={() =>
                  confirmDelete
                    ? deleteMutation.mutate()
                    : setConfirmDelete(true)
                }
              >
                {confirmDelete ? t("detail.confirmDelete") : t("detail.delete")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
