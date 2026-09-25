'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchNodes } from '@/features/fleets';
import { Layers } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Skeleton,
} from '@/shared/ui';
import { createFleet, deleteFleet, fetchPolicy, type Fleet } from '../api';

function FleetCard({ fleet, machineCount }: { fleet: Fleet; machineCount: number }) {
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
    <Card className="shadow-xs">
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand">
              <Layers className="size-4" aria-hidden />
            </div>
            <div>
              <p className="font-medium leading-tight">{fleet.label}</p>
              <p className="font-mono text-xs text-muted-foreground">{fleet.tag}</p>
            </div>
          </div>
          <Badge variant="outline">{t('machineCount', { count: machineCount })}</Badge>
        </div>
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
      </CardContent>
    </Card>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </div>
        ) : policy.fleets.length === 0 ? (
          <EmptyState icon={Layers} title={t('empty')} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {policy.fleets.map((fleet) => (
              <FleetCard key={fleet.tag} fleet={fleet} machineCount={machineCountFor(fleet.tag)} />
            ))}
          </div>
        )}

        <div className="flex gap-2 border-t pt-4">
          <Input
            className="max-w-xs"
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
