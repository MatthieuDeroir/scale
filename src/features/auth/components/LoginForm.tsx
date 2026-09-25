'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui';
import { login } from '../api';
import { loginSchema, type LoginValues } from '../lib/schema';

export function LoginForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t('signIn')}</CardTitle>
        <CardDescription>{t('signInHint')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit(async (values) => {
            try {
              await login(values);
              router.replace('/');
            } catch {
              // Message unique, quelle que soit la cause : distinguer « compte
              // inconnu » de « mot de passe faux » permet d'énumérer les comptes.
              toast.error(t('failed'));
            }
          })}
        >
          <label className="flex flex-col gap-1.5 text-sm">
            {t('username')}
            <input
              {...register('username')}
              autoComplete="username"
              className="h-9 rounded-md border border-input bg-background px-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
            {errors.username && (
              <span className="text-xs text-destructive">{errors.username.message}</span>
            )}
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            {t('password')}
            <input
              {...register('password')}
              type="password"
              autoComplete="current-password"
              className="h-9 rounded-md border border-input bg-background px-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
            {errors.password && (
              <span className="text-xs text-destructive">{errors.password.message}</span>
            )}
          </label>

          <Button type="submit" variant="brand" disabled={isSubmitting}>
            {isSubmitting ? t('signingIn') : t('signIn')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
