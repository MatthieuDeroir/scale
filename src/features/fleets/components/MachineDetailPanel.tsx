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
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from '@/shared/ui';
import { deleteNode, expireNode, renameNode, retagNode, type FleetNode } from '../api';
import { parseFleetLabel } from '../lib';

const OTHER_TAG = '__other__';

function formatLastSeen(lastSeen: string | null): string | null {
  if (!lastSeen) return null;
  return new Date(lastSeen).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
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
          <div className="flex items-center gap-2">
            <DialogTitle>{node.givenName || node.name}</DialogTitle>
            <Badge variant={node.online ? 'ok' : 'critical'}>
              {node.online ? t('online') : t('offline')}
            </Badge>
          </div>
          <DialogDescription>{parseFleetLabel(node.tags)}</DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t('columns.address')}</dt>
          <dd className="tabular-nums">{node.ipAddresses.join(', ')}</dd>
          <dt className="text-muted-foreground">{t('columns.lastSeen')}</dt>
          <dd className="tabular-nums">{formatLastSeen(node.lastSeen) ?? t('never')}</dd>
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
          <Label htmlFor="machine-name">{t('detail.rename')}</Label>
          <div className="flex gap-2">
            <Input id="machine-name" value={name} onChange={(event) => setName(event.target.value)} />
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
          <Label htmlFor="machine-fleet">{t('detail.changeFleet')}</Label>
          <div className="flex gap-2">
            <Select value={tagChoice} onValueChange={setTagChoice}>
              <SelectTrigger id="machine-fleet" className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {node.tags[0] && <SelectItem value={node.tags[0]}>{node.tags[0]}</SelectItem>}
                {otherFleetTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER_TAG}>{t('detail.otherTag')}</SelectItem>
              </SelectContent>
            </Select>
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
            <Input
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
