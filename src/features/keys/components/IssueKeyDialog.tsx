'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HYPERVISION_TAG, INTERNAL_TAG } from '@/features/fleets';
import { KeyRound, Monitor, Server } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  CopyField,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@/shared/ui';
import { cn } from '@/shared/lib';
import { createKey, type NewAccessKey } from '../api';

type Kind = 'hypervision' | 'equipment';

const DEFAULT_VALIDITY_DAYS = 7;

function defaultExpiration(): string {
  const date = new Date();
  date.setDate(date.getDate() + DEFAULT_VALIDITY_DAYS);
  return date.toISOString().slice(0, 10);
}

function KindOption({
  selected,
  onSelect,
  icon: Icon,
  title,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: typeof Monitor;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex flex-1 items-start gap-3 rounded-lg border p-3 text-left transition-colors',
        selected ? 'border-brand bg-brand/5' : 'hover:bg-muted/50'
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', selected ? 'text-brand' : 'text-muted-foreground')} />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

/**
 * Émet une clé pour UNE machine, déjà scopée à la flotte de la page (F2) :
 * on ne choisit plus la flotte ici, on est dedans. Par défaut, un poste
 * d'hypervision client — le cas d'usage courant ; les équipements Stramatel
 * arrivent surtout par l'enrôlement automatique.
 */
export function IssueKeyDialog({ fleetTag, fleetLabel }: { fleetTag: string; fleetLabel: string }) {
  const t = useTranslations('keys');
  const queryClient = useQueryClient();
  const internal = fleetTag === INTERNAL_TAG;

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>(internal ? 'equipment' : 'hypervision');
  const [expiration, setExpiration] = useState(defaultExpiration());
  const [issued, setIssued] = useState<NewAccessKey | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createKey({
        tags: kind === 'hypervision' ? [fleetTag, HYPERVISION_TAG] : [fleetTag],
        expiration: new Date(`${expiration}T23:59:59`).toISOString(),
      }),
    onSuccess: async (key) => {
      await queryClient.invalidateQueries({ queryKey: ['keys'] });
      setIssued(key);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function close(next: boolean) {
    setOpen(next);
    if (!next) {
      setIssued(null);
      setKind(internal ? 'equipment' : 'hypervision');
      setExpiration(defaultExpiration());
    }
  }

  const command = issued
    ? `tailscale up --login-server=${issued.loginServer} --authkey=${issued.key}`
    : '';

  return (
    <>
      <Button variant="brand" onClick={() => setOpen(true)}>
        <KeyRound aria-hidden />
        {internal ? t('issueEquipment') : t('issueHypervision')}
      </Button>

      <Dialog open={open} onOpenChange={close}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{issued ? t('issuedTitle') : t('dialogTitle')}</DialogTitle>
            <DialogDescription>
              {issued ? t('issuedWarning') : t('dialogDescription', { fleet: fleetLabel })}
            </DialogDescription>
          </DialogHeader>

          {issued ? (
            <div className="flex flex-col gap-4">
              <CopyField label={t('key')} value={issued.key} copyLabel={t('copy')} copiedLabel={t('copied')} />
              <CopyField
                label={t('command')}
                value={command}
                copyLabel={t('copy')}
                copiedLabel={t('copied')}
              />
              <p className="text-xs text-muted-foreground">{t('commandHint')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {!internal && (
                <div className="flex flex-col gap-2">
                  <Label>{t('kind')}</Label>
                  <div role="radiogroup" aria-label={t('kind')} className="flex flex-col gap-2">
                    <KindOption
                      selected={kind === 'hypervision'}
                      onSelect={() => setKind('hypervision')}
                      icon={Monitor}
                      title={t('kindHypervision')}
                      description={t('kindHypervisionHint')}
                    />
                    <KindOption
                      selected={kind === 'equipment'}
                      onSelect={() => setKind('equipment')}
                      icon={Server}
                      title={t('kindEquipment')}
                      description={t('kindEquipmentHint')}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="key-expiration">{t('expiration')}</Label>
                <Input
                  id="key-expiration"
                  type="date"
                  value={expiration}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setExpiration(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t('expirationHint')}</p>
              </div>
            </div>
          )}

          <DialogFooter>
            {issued ? (
              <Button variant="brand" onClick={() => close(false)}>
                {t('done')}
              </Button>
            ) : (
              <Button
                variant="brand"
                disabled={!expiration || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? t('issuing') : t('issue')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
