'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchNodes } from '@/features/fleets';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui';
import { createFleet, deleteFleet, fetchPolicy, type Fleet } from '../api';

function inputClass() {
  return 'h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';
}

function FleetRow({ fleet, machineCount }: { fleet: Fleet; machineCount: number }) {
  const t = useTranslations('acl');
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: () => deleteFleet(fleet.tag),
    onSuccess: (policy) => {
      queryClient.setQueryData(['acl', 'policy'], policy);
      toast.success(t('deleted'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setConfirming(false);
    },
  });

  return (
    <div className="flex items-center justify-between gap-4 border-b py-3 last:border-0">
      <div>
        <p className="font-medium">{fleet.label}</p>
        <p className="text-xs text-muted-foreground">{fleet.tag}</p>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="outline">{t('machineCount', { count: machineCount })}</Badge>
        {fleet.deletable && (
          <Button
            size="sm"
            variant={confirming ? 'destructive' : 'outline'}
            disabled={mutation.isPending}
            onClick={() => (confirming ? mutation.mutate() : setConfirming(true))}
          >
            {confirming ? t('confirmDelete') : t('delete')}
          </Button>
        )}
      </div>
    </div>
  );
}

export function FleetPolicyList() {
  const t = useTranslations('acl');
  const queryClient = useQueryClient();
  const { data: policy, error } = useQuery({ queryKey: ['acl', 'policy'], queryFn: fetchPolicy });
  const { data: nodes } = useQuery({ queryKey: ['fleets', 'nodes'], queryFn: fetchNodes });
  const [newFleetName, setNewFleetName] = useState('');

  const createMutation = useMutation({
    mutationFn: () => createFleet(newFleetName),
    onSuccess: (updated) => {
      queryClient.setQueryData(['acl', 'policy'], updated);
      setNewFleetName('');
      toast.success(t('created'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function machineCountFor(tag: string): number {
    if (!nodes) return 0;
    return nodes.filter((node) => node.tags[0] === tag).length;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <Badge variant="critical" role="alert">
            {error.message}
          </Badge>
        ) : !policy ? (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        ) : (
          <div>
            {policy.fleets.map((fleet) => (
              <FleetRow key={fleet.tag} fleet={fleet} machineCount={machineCountFor(fleet.tag)} />
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <input
            className={inputClass()}
            placeholder={t('newFleetPlaceholder')}
            value={newFleetName}
            onChange={(event) => setNewFleetName(event.target.value)}
          />
          <Button
            variant="brand"
            disabled={!newFleetName.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? t('creating') : t('create')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
