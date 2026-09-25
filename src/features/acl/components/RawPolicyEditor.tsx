'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Card, CardContent, Skeleton } from '@/shared/ui';
import { applyRawPolicy, fetchPolicy, type AclPolicy } from '../api';

function Editor({ policy }: { policy: AclPolicy }) {
  const t = useTranslations('acl');
  const queryClient = useQueryClient();
  const [raw, setRaw] = useState(policy.raw);

  // Resynchronisé pendant le rendu, pas dans un effet (pattern React :
  // « Adjusting state when a prop changes ») — une autre action (création de
  // flotte…) écrit dans le même cache React Query ; sans ça, ce champ resterait
  // figé et une application ultérieure écraserait ce changement.
  const [syncedAt, setSyncedAt] = useState(policy.updatedAt);
  if (policy.updatedAt !== syncedAt) {
    setSyncedAt(policy.updatedAt);
    setRaw(policy.raw);
  }

  const mutation = useMutation({
    mutationFn: () => applyRawPolicy(raw),
    onSuccess: (updated) => {
      queryClient.setQueryData(['acl', 'policy'], updated);
      toast.success(t('applied'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const dirty = raw !== policy.raw;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <textarea
          aria-label={t('rawTitle')}
          className="h-[28rem] w-full resize-y rounded-md border border-input bg-background p-3 font-mono text-xs leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          spellCheck={false}
        />
        <div className="flex items-center gap-2">
          <Button variant="brand" disabled={!dirty || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? t('applying') : t('applyRaw')}
          </Button>
          <Button variant="outline" disabled={!dirty} onClick={() => setRaw(policy.raw)}>
            {t('reset')}
          </Button>
          {dirty && <Badge variant="warning">{t('unsaved')}</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Secours pour ce que les écrans guidés ne couvrent pas : la politique HuJSON
 * brute. Toujours validée par Headscale avant application, jamais écrite en
 * direct (CDC §7).
 */
export function RawPolicyEditor() {
  const { data: policy, error } = useQuery({ queryKey: ['acl', 'policy'], queryFn: fetchPolicy });
  if (error) {
    return (
      <Badge variant="critical" role="alert">
        {error.message}
      </Badge>
    );
  }
  if (!policy) return <Skeleton className="h-[28rem] w-full" />;
  return <Editor policy={policy} />;
}
