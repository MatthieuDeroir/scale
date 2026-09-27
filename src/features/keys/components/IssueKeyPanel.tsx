'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HYPERVISION_TAG } from '@/features/fleets';
import { KeyRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, CopyField, DialogFooter, Input, Label } from '@/shared/ui';
import { cn } from '@/shared/lib';
import { createKey, type NewAccessKey } from '../api';
import { agentInstallCommand, installCommand, toHostname, type Platform } from '../lib/install-commands';

export type MachineKind = 'hypervision' | 'equipment';

const PRESETS = [1, 7, 30] as const;
const DEFAULT_VALIDITY_DAYS = 7;

function inDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-lg bg-muted p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
            value === option.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
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
  issue,
  fixedName,
}: {
  fleetTag: string;
  kind: MachineKind;
  onIssued?: () => void;
  onDone: () => void;
  /** Émission propre à l'appelant (clé d'un emplacement du plan, par exemple). */
  issue?: (expiration: string) => Promise<NewAccessKey>;
  /** Nom imposé par l'appelant : le champ de saisie disparaît. */
  fixedName?: string;
}) {
  const t = useTranslations('keys');
  const queryClient = useQueryClient();
  const [expiration, setExpiration] = useState(inDays(DEFAULT_VALIDITY_DAYS));
  const [name, setName] = useState('');
  const [issued, setIssued] = useState<NewAccessKey | null>(null);
  // Le poste du client est presque toujours un PC Windows ; un équipement, un Linux.
  const [platform, setPlatform] = useState<Platform>(kind === 'hypervision' ? 'windows' : 'linux');

  const hostname = toHostname(fixedName ?? name);
  const preset = PRESETS.find((days) => inDays(days) === expiration) ?? null;

  const mutation = useMutation({
    mutationFn: () => {
      const until = new Date(`${expiration}T23:59:59`).toISOString();
      if (issue) return issue(until);
      return createKey({
        tags: kind === 'hypervision' ? [fleetTag, HYPERVISION_TAG] : [fleetTag],
        expiration: until,
      });
    },
    onSuccess: async (key) => {
      await queryClient.invalidateQueries({ queryKey: ['keys'] });
      setIssued(key);
      onIssued?.();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (issued) {
    const withAgent = Boolean(issued.agentToken && issued.installUrl);
    const command = withAgent
      ? agentInstallCommand({
          installUrl: issued.installUrl!,
          token: issued.agentToken!,
          loginServer: issued.loginServer,
          key: issued.key,
          hostname: hostname || undefined,
        })
      : installCommand(platform, {
          loginServer: issued.loginServer,
          key: issued.key,
          hostname: hostname || undefined,
        });
    return (
      <>
        <div className="flex flex-col gap-4">
          <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm">
            <p className="font-medium">{t('issuedTitle')}</p>
            <p className="text-muted-foreground">{t('issuedWarning')}</p>
          </div>
          <CopyField label={t('key')} value={issued.key} copyLabel={t('copy')} copiedLabel={t('copied')} />
          <div className="flex flex-col gap-2">
            {!withAgent && (
              <Segmented
                label={t('platform')}
                value={platform}
                onChange={setPlatform}
                options={[
                  { value: 'windows', label: 'Windows' },
                  { value: 'linux', label: 'Linux' },
                  { value: 'installed', label: t('platformInstalled') },
                ]}
              />
            )}
            <CopyField label={t('command')} value={command} copyLabel={t('copy')} copiedLabel={t('copied')} />
            <p className="text-xs text-muted-foreground">
              {withAgent ? t('commandHint.agent') : t(`commandHint.${platform}`)}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="brand" onClick={onDone}>
            {t('done')}
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        {fixedName === undefined && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="key-name">{t('machineName')}</Label>
            <Input
              id="key-name"
              value={name}
              placeholder={kind === 'hypervision' ? t('machineNameHypervision') : t('machineNameEquipment')}
              onChange={(event) => setName(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {hostname ? t('machineNamePreview', { hostname }) : t('machineNameHint')}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="key-expiration">{t('expiration')}</Label>
          <Segmented
            label={t('expirationPresets')}
            value={preset}
            onChange={(days) => setExpiration(inDays(days))}
            options={PRESETS.map((days) => ({
              value: days,
              label: t('days', { count: days }),
            }))}
          />
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
      <DialogFooter>
        <Button variant="brand" disabled={!expiration || mutation.isPending} onClick={() => mutation.mutate()}>
          <KeyRound aria-hidden />
          {mutation.isPending ? t('issuing') : t(kind === 'hypervision' ? 'issueHypervision' : 'issueEquipment')}
        </Button>
      </DialogFooter>
    </>
  );
}
