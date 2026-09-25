'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { renameNode, retagNode, withFleet, type FleetNode } from '@/features/fleets';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

/** Range des machines dans une flotte ; renvoie le nombre d'échecs. */
export function useAssignNodes(onDone?: () => void) {
  const t = useTranslations('parc');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      nodes,
      fleetTag,
      name,
    }: {
      nodes: FleetNode[];
      fleetTag: string;
      /** Nouveau nom, pour une affectation unitaire seulement. */
      name?: string;
    }) => {
      const results = await Promise.allSettled(
        // `withFleet` garde les tags de type (hypervision) et remplace a-assigner.
        nodes.map(async (node) => {
          await retagNode(node.id, withFleet(node.tags, fleetTag));
          if (name && nodes.length === 1) await renameNode(node.id, name);
        })
      );
      return { total: nodes.length, failed: results.filter((r) => r.status === 'rejected').length };
    },
    onSuccess: async ({ total, failed }) => {
      await queryClient.invalidateQueries({ queryKey: ['fleets', 'nodes'] });
      if (total - failed > 0) toast.success(t('inbox.assigned', { count: total - failed }));
      if (failed > 0) toast.error(t('inbox.failed', { count: failed }));
      onDone?.();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
