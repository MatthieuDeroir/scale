'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator,
} from '@/shared/ui';
import { deleteNode, expireNode, renameNode, retagNode, type FleetNode } from '../api';
import { parseFleetLabel } from '../lib';

const OTHER_TAG = '__other__';

function inputClass() {
  return 'h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';
}

export function MachineDetailPanel({
  node,
  knownTags,
  open,
  onOpenChange,
}: {
  node: FleetNode;
  knownTags: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('fleets');
  const queryClient = useQueryClient();

  const [name, setName] = useState(node.givenName || node.name);
  const [tagChoice, setTagChoice] = useState(node.tags[0] ?? OTHER_TAG);
  const [customTag, setCustomTag] = useState('');
  const [confirmExpire, setConfirmExpire] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ['fleets', 'nodes'] });
  }

  const renameMutation = useMutation({
    mutationFn: () => renameNode(node.id, name),
    onSuccess: async () => {
      await invalidate();
      toast.success(t('detail.renamed'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const retagMutation = useMutation({
    mutationFn: () => retagNode(node.id, [tagChoice === OTHER_TAG ? customTag.trim() : tagChoice]),
    onSuccess: async () => {
      await invalidate();
      toast.success(t('detail.retagged'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const expireMutation = useMutation({
    mutationFn: () => expireNode(node.id),
    onSuccess: async () => {
      await invalidate();
      setConfirmExpire(false);
      toast.success(t('detail.expired'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteNode(node.id),
    onSuccess: async () => {
      await invalidate();
      onOpenChange(false);
      toast.success(t('detail.deleted'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const otherFleetTags = knownTags.filter((tag) => tag !== node.tags[0]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{node.givenName || node.name}</DialogTitle>
          <DialogDescription>
            {parseFleetLabel(node.tags)} · {node.online ? t('online') : t('offline')}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t('columns.address')}</dt>
          <dd className="tabular-nums">{node.ipAddresses.join(', ')}</dd>
          <dt className="text-muted-foreground">{t('columns.lastSeen')}</dt>
          <dd className="tabular-nums">{node.lastSeen ?? t('never')}</dd>
          <dt className="text-muted-foreground">{t('detail.tags')}</dt>
          <dd className="flex flex-wrap gap-1">
            {node.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </dd>
        </dl>

        <Separator />

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="machine-name">
            {t('detail.rename')}
          </label>
          <div className="flex gap-2">
            <input
              id="machine-name"
              className={inputClass()}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Button
              variant="outline"
              disabled={!name.trim() || name === node.givenName || renameMutation.isPending}
              onClick={() => renameMutation.mutate()}
            >
              {t('detail.apply')}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="machine-fleet">
            {t('detail.changeFleet')}
          </label>
          <div className="flex gap-2">
            <select
              id="machine-fleet"
              className={inputClass()}
              value={tagChoice}
              onChange={(event) => setTagChoice(event.target.value)}
            >
              {node.tags[0] && <option value={node.tags[0]}>{node.tags[0]}</option>}
              {otherFleetTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
              <option value={OTHER_TAG}>{t('detail.otherTag')}</option>
            </select>
            <Button
              variant="outline"
              disabled={
                retagMutation.isPending ||
                (tagChoice === OTHER_TAG ? !customTag.trim() : tagChoice === node.tags[0])
              }
              onClick={() => retagMutation.mutate()}
            >
              {t('detail.apply')}
            </Button>
          </div>
          {tagChoice === OTHER_TAG && (
            <input
              className={inputClass()}
              placeholder="tag:flotte-nouveauclient"
              value={customTag}
              onChange={(event) => setCustomTag(event.target.value)}
            />
          )}
        </div>

        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:justify-between">
          <Button
            variant={confirmExpire ? 'destructive' : 'outline'}
            disabled={expireMutation.isPending}
            onClick={() => (confirmExpire ? expireMutation.mutate() : setConfirmExpire(true))}
          >
            {confirmExpire ? t('detail.confirmExpire') : t('detail.expire')}
          </Button>
          <Button
            variant={confirmDelete ? 'destructive' : 'outline'}
            disabled={deleteMutation.isPending}
            onClick={() => (confirmDelete ? deleteMutation.mutate() : setConfirmDelete(true))}
          >
            {confirmDelete ? t('detail.confirmDelete') : t('detail.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
