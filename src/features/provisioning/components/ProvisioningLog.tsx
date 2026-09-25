'use client';

import { useQuery } from '@tanstack/react-query';
import { UploadCloud } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Badge,
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
import { fetchDevices } from '../api';

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

export function ProvisioningLog() {
  const t = useTranslations('provisioning');
  const { data, error } = useQuery({
    queryKey: ['provisioning', 'devices'],
    queryFn: fetchDevices,
    refetchInterval: 15000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
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
          <EmptyState icon={UploadCloud} title={t('empty')} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('columns.deviceId')}</TableHead>
                <TableHead>{t('columns.enrolledAt')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((device) => (
                <TableRow key={device.deviceId}>
                  <TableCell className="font-mono text-xs">{device.deviceId}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(device.enrolledAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
