'use client';

import { IssueKeyPanel } from '@/features/keys';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui';

/**
 * Ajout d'un poste d'hypervision client à une flotte : toujours par une clé,
 * que le client installe lui-même. Les équipements Stramatel, eux, entrent
 * par le plan de la flotte (produit obligatoire).
 */
export function AddMachineDialog({
  fleetTag,
  fleetLabel,
  open,
  onOpenChange,
}: {
  fleetTag: string;
  fleetLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('parc');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('add.hypervisionTitle')}</DialogTitle>
          <DialogDescription>{t('add.hypervisionIntro', { fleet: fleetLabel })}</DialogDescription>
        </DialogHeader>
        <IssueKeyPanel fleetTag={fleetTag} kind="hypervision" onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
