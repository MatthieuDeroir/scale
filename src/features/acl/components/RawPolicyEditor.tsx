'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Code2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui';
import { applyRawPolicy, fetchPolicy, type AclPolicy } from '../api';

export function RawPolicyEditor({ policy }: { policy: AclPolicy }) {
  const t = useTranslations('acl');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState(policy.raw);

  // Resynchronisé pendant le rendu, pas dans un effet (pattern React :
  // « Adjusting state when a prop changes ») — l'éditeur guidé écrit dans le
  // même cache React Query, sans ça ce champ resterait figé sur l'ancienne
  // politique et une application ultérieure écraserait un changement fait
  // ailleurs.
  const [syncedAt, setSyncedAt] = useState(policy.updatedAt);
  if (policy.updatedAt !== syncedAt) {
    setSyncedAt(policy.updatedAt);
    setRaw(policy.raw);
  }

  const mutation = useMutation({
    mutationFn: () => applyRawPolicy(raw),
    onSuccess: (updated) => {
      queryClient.setQueryData(['acl', 'policy'], updated);
      setRaw(updated.raw);
      toast.success(t('applied'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <Code2 className="size-4" aria-hidden />
        {t('openRaw')}
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('rawTitle')}</CardTitle>
        <CardDescription>{t('rawDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <textarea
          className="h-80 w-full rounded-md border border-input bg-background p-3 font-mono text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          spellCheck={false}
        />
        <div className="flex gap-2">
          <Button
            variant="brand"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? t('applying') : t('applyRaw')}
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const current = await fetchPolicy();
              queryClient.setQueryData(['acl', 'policy'], current);
              setRaw(current.raw);
            }}
          >
            {t('reset')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
