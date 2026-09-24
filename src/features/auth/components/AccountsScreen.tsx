'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  SecretReveal,
} from '@/shared/ui';
import {
  createUser,
  disableUser,
  enableUser,
  fetchUsers,
  resetUserPassword,
  type AccountUser,
} from '../api';
import { ROLES, type Role } from '../lib/roles';

function inputClass() {
  return 'h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function UserRow({ user }: { user: AccountUser }) {
  const t = useTranslations('accounts');
  const queryClient = useQueryClient();
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ['users'] });
  }

  const toggleMutation = useMutation({
    mutationFn: () => (user.disabled ? enableUser(user.id) : disableUser(user.id)),
    onSuccess: async () => {
      await invalidate();
      setConfirmingDisable(false);
      toast.success(user.disabled ? t('enabled') : t('disabled'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setConfirmingDisable(false);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetUserPassword(user.id),
    onSuccess: async ({ password }) => {
      await invalidate();
      setRevealedPassword(password);
      toast.success(t('resetDone'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (revealedPassword) {
    return (
      <div className="border-b py-3 last:border-0">
        <SecretReveal
          title={t('revealTitle', { username: user.username })}
          description={t('revealWarning')}
          value={revealedPassword}
          copyLabel={t('copy')}
          copiedLabel={t('copied')}
          dismissLabel={t('dismiss')}
          onDismiss={() => setRevealedPassword(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b py-3 last:border-0">
      <div>
        <p className="font-medium">{user.username}</p>
        <p className="text-xs text-muted-foreground">
          {t('role.' + user.role)} · {t('lastLogin')} : {formatDate(user.lastLoginAt) ?? t('never')}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={user.disabled ? 'critical' : 'ok'}>
          {user.disabled ? t('statusDisabled') : t('statusActive')}
        </Badge>
        <Button size="sm" variant="outline" disabled={resetMutation.isPending} onClick={() => resetMutation.mutate()}>
          {t('resetPassword')}
        </Button>
        <Button
          size="sm"
          variant={confirmingDisable ? 'destructive' : 'outline'}
          disabled={toggleMutation.isPending}
          onClick={() =>
            user.disabled || confirmingDisable
              ? toggleMutation.mutate()
              : setConfirmingDisable(true)
          }
        >
          {user.disabled ? t('enable') : confirmingDisable ? t('confirmDisable') : t('disable')}
        </Button>
      </div>
    </div>
  );
}

export function AccountsScreen() {
  const t = useTranslations('accounts');
  const queryClient = useQueryClient();
  const { data, error } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<Role>('OPERATOR');
  const [createdPassword, setCreatedPassword] = useState<{ username: string; password: string } | null>(
    null
  );

  const createMutation = useMutation({
    mutationFn: () => createUser(username, role),
    onSuccess: async (user) => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setCreatedPassword({ username: user.username, password: user.password });
      setUsername('');
      toast.success(t('created'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="flex flex-col gap-6">
      {createdPassword && (
        <SecretReveal
          title={t('revealTitle', { username: createdPassword.username })}
          description={t('revealWarning')}
          value={createdPassword.password}
          copyLabel={t('copy')}
          copiedLabel={t('copied')}
          dismissLabel={t('dismiss')}
          onDismiss={() => setCreatedPassword(null)}
        />
      )}

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
          ) : !data ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : (
            <div>
              {data.map((user) => (
                <UserRow key={user.id} user={user} />
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <input
              className={inputClass()}
              placeholder={t('newUsernamePlaceholder')}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <select
              className={inputClass()}
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t('role.' + r)}
                </option>
              ))}
            </select>
            <Button
              variant="brand"
              disabled={!username.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? t('creating') : t('create')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
