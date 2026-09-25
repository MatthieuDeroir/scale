'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { SidebarButton } from '@/shared/ui';
import { logout } from '../api';

export function SignOutButton({ username }: { username: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <SidebarButton
      icon={<LogOut />}
      label={t('signOut')}
      detail={username}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await logout();
        router.replace('/login');
        router.refresh();
      }}
    />
  );
}
