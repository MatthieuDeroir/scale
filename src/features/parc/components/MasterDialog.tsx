'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StatusDot, isMaster, retagNode, withMaster, type FleetNode } from '@/features/fleets';
import { Crown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui';

/**
 * Désigne le ou les MASTER d'une flotte parmi ses équipements Stramatel
 * (pas les postes d'hypervision du client). Seules les machines dont le rôle
 * change sont retaguées.
 */
export function MasterDialog({
  fleetLabel,
  equipment,
  open,
  onOpenChange,
}: {
  fleetLabel: string;
  equipment: FleetNode[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('parc');
  const tf = useTranslations('fleets');
  const queryClient = useQueryClient();
  const [masters, setMasters] = useState<Set<string>>(
    () => new Set(equipment.filter((node) => isMaster(node.tags)).map((node) => node.id))
  );

  const changed = equipment.filter((node) => isMaster(node.tags) !== masters.has(node.id));

  const mutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        changed.map((node) => retagNode(node.id, withMaster(node.tags, masters.has(node.id))))
      );
      return results.filter((result) => result.status === 'rejected').length;
    },
    onSuccess: async (failed) => {
      await queryClient.invalidateQueries({ queryKey: ['fleets', 'nodes'] });
      if (failed > 0) toast.error(t('master.failed', { count: failed }));
      else toast.success(t('master.saved'));
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function toggle(id: string) {
    setMasters((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('master.title')}</DialogTitle>
          <DialogDescription>{t('master.description', { fleet: fleetLabel })}</DialogDescription>
        </DialogHeader>
        {equipment.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('master.noEquipment')}</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {equipment.map((node) => {
              const name = node.givenName || node.name;
              const checked = masters.has(node.id);
              return (
                <li key={node.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/40">
                    <input
                      type="checkbox"
                      className="size-4 accent-brand"
                      checked={checked}
                      onChange={() => toggle(node.id)}
                      aria-label={t('master.toggle', { name })}
                    />
                    <StatusDot online={node.online} label={node.online ? tf('online') : tf('offline')} />
                    <span className="flex-1 text-sm font-medium">{name}</span>
                    <span className={checked ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground/40'}>
                      <Crown className="size-4" aria-hidden />
                    </span>
                    <span className="w-16 text-right text-xs text-muted-foreground">
                      {checked ? 'MASTER' : 'SLAVE'}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">{t('master.hint')}</p>
        <DialogFooter>
          <Button
            variant="brand"
            disabled={changed.length === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? t('master.saving') : t('master.save', { count: changed.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
