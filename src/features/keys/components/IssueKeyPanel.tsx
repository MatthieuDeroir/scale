"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HYPERVISION_TAG } from "@/features/fleets";
import { KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button, CopyField, DialogFooter, Input, Label } from "@/shared/ui";
import { createKey, type NewAccessKey } from "../api";

export type MachineKind = "hypervision" | "equipment";

const DEFAULT_VALIDITY_DAYS = 7;

function defaultExpiration(): string {
  const date = new Date();
  date.setDate(date.getDate() + DEFAULT_VALIDITY_DAYS);
  return date.toISOString().slice(0, 10);
}

/**
 * Émet une clé pour UNE machine d'un type donné, déjà scopée à la flotte (F2).
 * Le type est fixé par l'appelant : poste d'hypervision client et équipement
 * Stramatel ne se confondent jamais dans l'interface. Sans cadre propre :
 * s'insère dans un dialogue.
 */
export function IssueKeyPanel({
  fleetTag,
  kind,
  onIssued,
  onDone,
}: {
  fleetTag: string;
  kind: MachineKind;
  onIssued?: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("keys");
  const queryClient = useQueryClient();
  const [expiration, setExpiration] = useState(defaultExpiration());
  const [issued, setIssued] = useState<NewAccessKey | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createKey({
        tags: kind === "hypervision" ? [fleetTag, HYPERVISION_TAG] : [fleetTag],
        expiration: new Date(`${expiration}T23:59:59`).toISOString(),
      }),
    onSuccess: async (key) => {
      await queryClient.invalidateQueries({ queryKey: ["keys"] });
      setIssued(key);
      onIssued?.();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (issued) {
    const command = `tailscale up --login-server=${issued.loginServer} --authkey=${issued.key}`;
    return (
      <>
        <div className="flex flex-col gap-4">
          <div
            role="alert"
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm"
          >
            <p className="font-medium">{t("issuedTitle")}</p>
            <p className="text-muted-foreground">{t("issuedWarning")}</p>
          </div>
          <CopyField
            label={t("key")}
            value={issued.key}
            copyLabel={t("copy")}
            copiedLabel={t("copied")}
          />
          <CopyField
            label={t("command")}
            value={command}
            copyLabel={t("copy")}
            copiedLabel={t("copied")}
          />
          <p className="text-xs text-muted-foreground">{t("commandHint")}</p>
        </div>
        <DialogFooter>
          <Button variant="brand" onClick={onDone}>
            {t("done")}
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="key-expiration">{t("expiration")}</Label>
          <Input
            id="key-expiration"
            type="date"
            value={expiration}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(event) => setExpiration(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t("expirationHint")}</p>
        </div>
      </div>
      <DialogFooter>
        <Button
          variant="brand"
          disabled={!expiration || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          <KeyRound aria-hidden />
          {mutation.isPending
            ? t("issuing")
            : t(kind === "hypervision" ? "issueHypervision" : "issueEquipment")}
        </Button>
      </DialogFooter>
    </>
  );
}
