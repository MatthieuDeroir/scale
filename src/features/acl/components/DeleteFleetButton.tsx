'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui';
import { deleteFleet } from '../api';

/**
 * Supprime la flotte de la politique (tagOwners + règle de cloisonnement).
 * Refusée tant que des machines y vivent : sans règle ACL, elles perdraient
 * silencieusement tout accès entre elles.
 */
export function DeleteFleetButton({
  tag,
  machineCount,
  onDeleted,
}: {
  tag: string;
  machineCount: number;
  onDeleted?: () => void;
}) {
  const t = useTranslations('acl');
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: () => deleteFleet(tag),
    onSuccess: (policy) => {
      queryClient.setQueryData(['acl', 'policy'], policy);
      toast.success(t('deleted'));
      onDeleted?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setConfirming(false);
    },
  });

  const blocked = machineCount > 0;

  return (
    <Button
      variant={confirming ? 'destructive' : 'outline'}
      disabled={blocked || mutation.isPending}
      title={blocked ? t('deleteBlocked') : undefined}
      onClick={() => (confirming ? mutation.mutate() : setConfirming(true))}
    >
      <Trash2 aria-hidden />
      {confirming ? t('confirmDelete') : t('delete')}
    </Button>
  );
}
