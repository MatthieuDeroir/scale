'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusDot } from '@/features/fleets';
import { Globe, Headset, Plus, Settings2, X } from 'lucide-react';
import Link from 'next/link';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  usePermissions,
} from '@/shared/ui';
import { fetchSupportPosts, reaches, setSupportTargets, withFleetTarget, type SupportPost } from '../api';

export const supportKey = ['support'] as const;

export function useSupportPosts() {
  return useQuery({ queryKey: supportKey, queryFn: fetchSupportPosts, refetchInterval: 30000 });
}

/**
 * Support d'une flotte : les postes des personnes de Stramatel qui la
 * prennent en charge. Chacun joint toutes les machines de la flotte ; les
 * postes « tout le parc » y figurent aussi, mais se règlent depuis la page
 * Support.
 */
export function FleetSupportCard({ fleetTag, fleetLabel }: { fleetTag: string; fleetLabel: string }) {
  const t = useTranslations('parc.support');
  const { operate } = usePermissions();
  const queryClient = useQueryClient();
  const posts = useSupportPosts();
  const [adding, setAdding] = useState(false);

  const mutation = useMutation({
    mutationFn: ({ post, on }: { post: SupportPost; on: boolean }) =>
      setSupportTargets(post.tag, withFleetTarget(post, fleetTag, on)),
    onSuccess: async (_result, { post, on }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: supportKey }),
        queryClient.invalidateQueries({ queryKey: ['acl', 'policy'] }),
      ]);
      toast.success(on ? t('added', { name: post.name, fleet: fleetLabel }) : t('removed', { name: post.name, fleet: fleetLabel }));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const all = posts.data ?? [];
  const assigned = all.filter((post) => reaches(post, fleetTag));
  const available = all.filter((post) => !reaches(post, fleetTag));

  return (
    <Card>
      <CardHeader className="px-5 pt-5 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="flex items-center gap-2 text-base">
              <Headset className="size-4 text-muted-foreground" aria-hidden />
              {t('cardTitle')}
              <Badge variant="secondary">{assigned.length}</Badge>
            </CardTitle>
            <CardDescription>{t('cardDescription')}</CardDescription>
          </div>
          {operate && (
            <span className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/support">
                  <Settings2 aria-hidden />
                  {t('manage')}
                </Link>
              </Button>
              <Button variant="brand" size="sm" disabled={available.length === 0} onClick={() => setAdding(true)}>
                <Plus aria-hidden />
                {t('add')}
              </Button>
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        {assigned.length === 0 ? (
          <p className="text-sm text-muted-foreground">{all.length === 0 ? t('noPostYet') : t('none')}</p>
        ) : (
          <ul className="-mx-2 flex flex-col divide-y">
            {assigned.map((post) => {
              const everywhere = post.targets.includes('*');
              return (
                <li key={post.tag} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-2.5">
                  <Headset className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-32 font-medium">{post.name}</span>
                  {everywhere && (
                    <Badge variant="warning" className="gap-1">
                      <Globe className="size-3" aria-hidden />
                      {t('everywhere')}
                    </Badge>
                  )}
                  <span className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {post.machines.length === 0
                      ? t('noMachine')
                      : post.machines.map((machine) => (
                          <span key={machine.id} className="inline-flex items-center gap-1.5">
                            <StatusDot online={machine.online} label={machine.name} />
                            {machine.name}
                          </span>
                        ))}
                  </span>
                  {operate && !everywhere && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('removeFrom', { name: post.name })}
                      title={t('removeFrom', { name: post.name })}
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ post, on: false })}
                    >
                      <X aria-hidden />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addTitle', { fleet: fleetLabel })}</DialogTitle>
            <DialogDescription>{t('addDescription')}</DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-2">
            {available.map((post) => (
              <li key={post.tag}>
                <button
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ post, on: true }, { onSuccess: () => setAdding(false) })}
                  className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50"
                >
                  <Headset className="size-4 text-muted-foreground" aria-hidden />
                  <span className="flex-1 text-sm font-medium">{post.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t('machineCount', { count: post.machines.length })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
