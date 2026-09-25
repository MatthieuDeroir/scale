'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseFleetLabel } from '@/features/fleets';
import { KeyRound } from 'lucide-react';
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
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui';
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
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <EmptyState icon={KeyRound} title={t('empty')} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('columns.fleet')}</TableHead>
                <TableHead>{t('columns.reusable')}</TableHead>
                <TableHead>{t('columns.used')}</TableHead>
                <TableHead>{t('columns.expiration')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{parseFleetLabel(key.tags)}</TableCell>
                  <TableCell>
                    <Badge variant={key.reusable ? 'default' : 'outline'}>
                      {key.reusable ? t('yes') : t('no')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={key.used ? 'ok' : 'outline'}>
                      {key.used ? t('yes') : t('no')}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{formatDate(key.expiration)}</TableCell>
                  <TableCell className="text-right">
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
