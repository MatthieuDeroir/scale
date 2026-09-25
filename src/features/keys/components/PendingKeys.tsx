'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HYPERVISION_TAG } from '@/features/fleets';
import { Monitor, Server } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui';
import { revokeKey, type AccessKey } from '../api';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function PendingKeyRow({ accessKey }: { accessKey: AccessKey }) {
  const t = useTranslations('keys');
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const hypervision = accessKey.tags.includes(HYPERVISION_TAG);
  const Icon = hypervision ? Monitor : Server;

  const mutation = useMutation({
    mutationFn: () => revokeKey(accessKey.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['keys'] });
      toast.success(t('revoked'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setConfirming(false);
    },
  });

  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <span className="flex min-w-0 items-center gap-2.5">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex flex-col">
          <span className="text-sm">{hypervision ? t('pendingHypervision') : t('pendingEquipment')}</span>
          <span className="text-xs text-muted-foreground">
            {t('pendingSince', {
              created: formatDate(accessKey.createdAt),
              expires: formatDate(accessKey.expiration),
            })}
          </span>
        </span>
      </span>
      <Button
        size="sm"
        variant={confirming ? 'destructive' : 'ghost'}
        disabled={mutation.isPending}
        onClick={() => (confirming ? mutation.mutate() : setConfirming(true))}
      >
        {confirming ? t('confirmRevoke') : t('revoke')}
      </Button>
    </li>
  );
}

/**
 * Clés émises mais pas encore consommées par une machine. Les clés utilisées
 * n'apparaissent pas : la machine correspondante est dans la liste, c'est
 * elle qu'on gère ensuite (expirer, supprimer).
 */
export function PendingKeys({ keys }: { keys: AccessKey[] }) {
  return (
    <ul className="divide-y">
      {keys.map((accessKey) => (
        <PendingKeyRow key={accessKey.id} accessKey={accessKey} />
      ))}
    </ul>
  );
}
