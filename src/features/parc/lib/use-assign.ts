'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FleetNode } from '@/features/fleets';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { assignToSlot, type PlanSlot } from '../api';

/** Emplacements d'équipement encore libres, dans l'ordre du plan ; ceux sans clé émise d'abord. */
export function freeSlots(slots: PlanSlot[]): PlanSlot[] {
  const free = slots.filter((slot) => slot.kind === 'equipment' && !slot.machine);
  return [...free.filter((slot) => !slot.keyIssuedAt), ...free.filter((slot) => slot.keyIssuedAt)];
}

/**
 * Range des machines en attente dans une flotte en pourvoyant ses
 * emplacements libres, un par machine, dans l'ordre : chacune prend le nom,
 * le produit et le rôle de son emplacement. Renvoie le nombre d'échecs.
 */
export function useAssignNodes(onDone?: () => void) {
  const t = useTranslations('parc');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nodes, slots }: { nodes: FleetNode[]; slots: PlanSlot[]; fleetTag: string }) => {
      let failed = 0;
      // Une à une : un serveur doit être rangé avant ses SLAVE pour qu'ils s'y rattachent.
      for (const [index, node] of nodes.entries()) {
        const slot = slots[index];
        if (!slot) {
          failed++;
          continue;
        }
        await assignToSlot(slot.id, node.id).catch(() => failed++);
      }
      return { total: nodes.length, failed };
    },
    onSuccess: async ({ total, failed }, { fleetTag }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['fleets', 'nodes'] }),
        queryClient.invalidateQueries({ queryKey: ['plan', fleetTag] }),
      ]);
      if (total - failed > 0) toast.success(t('inbox.assigned', { count: total - failed }));
      if (failed > 0) toast.error(t('inbox.failed', { count: failed }));
      onDone?.();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
