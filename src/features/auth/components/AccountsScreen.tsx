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
  Input,
  SecretReveal,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
      <TableRow>
        <TableCell colSpan={5}>
          <SecretReveal
            title={t('revealTitle', { username: user.username })}
            description={t('revealWarning')}
            value={revealedPassword}
            copyLabel={t('copy')}
            copiedLabel={t('copied')}
            dismissLabel={t('dismiss')}
            onDismiss={() => setRevealedPassword(null)}
          />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{user.username}</TableCell>
      <TableCell>{t(`role.${user.role}`)}</TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(user.lastLoginAt) ?? t('never')}
      </TableCell>
      <TableCell>
        <Badge variant={user.disabled ? 'critical' : 'ok'}>
          {user.disabled ? t('statusDisabled') : t('statusActive')}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={resetMutation.isPending}
            onClick={() => resetMutation.mutate()}
          >
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
      </TableCell>
    </TableRow>
  );
}

export function AccountsScreen() {
  const t = useTranslations('accounts');
  const queryClient = useQueryClient();
  const { data, error } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<Role>('OPERATOR');
  const [createdPassword, setCreatedPassword] = useState<{
    username: string;
    password: string;
  } | null>(null);

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
        <CardContent className="flex flex-col gap-4 pt-6">
          {error ? (
            <Badge variant="critical" role="alert">
              {error.message}
            </Badge>
          ) : !data ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 2 }, (_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t('columns.username')}</TableHead>
                  <TableHead>{t('columns.role')}</TableHead>
                  <TableHead>{t('lastLogin')}</TableHead>
                  <TableHead>{t('columns.status')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((user) => (
                  <UserRow key={user.id} user={user} />
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Input
              className="max-w-xs"
              placeholder={t('newUsernamePlaceholder')}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <Select value={role} onValueChange={(value) => setRole(value as Role)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`role.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
