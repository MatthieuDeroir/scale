'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseFleetLabel } from '@/features/fleets';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui';
import { fetchKeys, revokeKey } from '../api';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function KeyList() {
  const t = useTranslations('keys');
  const queryClient = useQueryClient();
  const { data, error } = useQuery({ queryKey: ['keys'], queryFn: fetchKeys });
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeKey(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['keys'] });
      setConfirmingId(null);
      toast.success(t('revoked'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('listTitle')}</CardTitle>
        <CardDescription>{t('listDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <Badge variant="critical" role="alert">
            {error.message}
          </Badge>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-medium">{t('columns.fleet')}</th>
                <th className="py-2 font-medium">{t('columns.reusable')}</th>
                <th className="py-2 font-medium">{t('columns.used')}</th>
                <th className="py-2 font-medium">{t('columns.expiration')}</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {data.map((key) => (
                <tr key={key.id} className="border-b last:border-0">
                  <td className="py-2">{parseFleetLabel(key.tags)}</td>
                  <td className="py-2">
                    <Badge variant={key.reusable ? 'default' : 'outline'}>
                      {key.reusable ? t('yes') : t('no')}
                    </Badge>
                  </td>
                  <td className="py-2">
                    <Badge variant={key.used ? 'ok' : 'outline'}>{key.used ? t('yes') : t('no')}</Badge>
                  </td>
                  <td className="py-2 tabular-nums">{formatDate(key.expiration)}</td>
                  <td className="py-2 text-right">
                    <Button
                      size="sm"
                      variant={confirmingId === key.id ? 'destructive' : 'outline'}
                      disabled={revokeMutation.isPending}
                      onClick={() =>
                        confirmingId === key.id
                          ? revokeMutation.mutate(key.id)
                          : setConfirmingId(key.id)
                      }
                    >
                      {confirmingId === key.id ? t('confirmRevoke') : t('revoke')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
