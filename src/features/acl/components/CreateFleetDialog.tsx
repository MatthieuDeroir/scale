'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
// Module pur (pas le barrel `@/core`, qui tire Prisma et le client Headscale côté serveur).
import { fleetTagFromName } from '@/core/acl-policy';
import { Plus } from 'lucide-react';
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
  Input,
  Label,
} from '@/shared/ui';
import { createFleet } from '../api';

/**
 * Crée une flotte client : entrée `tagOwners` + règle de cloisonnement
 * (validée par Headscale avant écriture). `onCreated` reçoit le tag créé,
 * pour enchaîner directement sur la page de la flotte.
 */
export function CreateFleetDialog({ onCreated }: { onCreated?: (tag: string) => void }) {
  const t = useTranslations('acl');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const mutation = useMutation({
    mutationFn: () => createFleet(name),
    onSuccess: (policy) => {
      queryClient.setQueryData(['acl', 'policy'], policy);
      toast.success(t('created'));
      setOpen(false);
      setName('');
      onCreated?.(fleetTagFromName(name));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <Button variant="brand" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        {t('create')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createTitle')}</DialogTitle>
            <DialogDescription>{t('createDescription')}</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (name.trim()) mutation.mutate();
            }}
          >
            <Label htmlFor="fleet-name">{t('clientName')}</Label>
            <Input
              id="fleet-name"
              autoFocus
              placeholder={t('clientNamePlaceholder')}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            {name.trim() && (
              <p className="text-xs text-muted-foreground">
                {t('tagPreview', { tag: fleetTagFromName(name) })}
              </p>
            )}
          </form>
          <DialogFooter>
            <Button
              variant="brand"
              disabled={!name.trim() || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? t('creating') : t('createConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
