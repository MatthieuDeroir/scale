import { getTranslations } from 'next-intl/server';
import { AccountsScreen } from '@/features/auth';
import { PageHeader } from '@/shared/ui';
import { guard } from '../_components/guard';

export const metadata = { title: 'Comptes' };

export default async function ComptesPage() {
  await guard('ADMIN');
  const t = await getTranslations('accounts');
  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <AccountsScreen />
    </>
  );
}
