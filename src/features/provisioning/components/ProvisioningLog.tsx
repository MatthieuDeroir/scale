'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui';
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
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-medium">{t('columns.deviceId')}</th>
                <th className="py-2 font-medium">{t('columns.enrolledAt')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((device) => (
                <tr key={device.deviceId} className="border-b last:border-0">
                  <td className="py-2 font-mono text-xs">{device.deviceId}</td>
                  <td className="py-2 tabular-nums">{formatDate(device.enrolledAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
