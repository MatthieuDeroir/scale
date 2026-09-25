'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@/shared/ui';
import { changePassword } from '../api';
import {
  changePasswordSchema,
  PASSWORD_MIN_LENGTH,
  type ChangePasswordValues,
} from '../lib/schema';

/** `forced` : premier accès ou mot de passe réinitialisé, pas de retour possible sans changer. */
export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
  });

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t('password.title')}</CardTitle>
        <CardDescription>
          {forced ? t('password.forced') : t('password.voluntary')}{' '}
          {t('password.rule', { min: PASSWORD_MIN_LENGTH })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit(async (values) => {
            try {
              await changePassword(values);
              toast.success(t('password.changed'));
              router.replace('/');
              router.refresh();
            } catch (error) {
              toast.error((error as Error).message);
            }
          })}
        >
          {(['current', 'next', 'confirm'] as const).map((field) => (
            <div key={field} className="flex flex-col gap-2">
              <Label htmlFor={`password-${field}`}>{t(`passwordChange.${field}`)}</Label>
              <Input
                id={`password-${field}`}
                type="password"
                autoComplete={field === 'current' ? 'current-password' : 'new-password'}
                aria-invalid={Boolean(errors[field])}
                {...register(field)}
              />
              {errors[field] && (
                <p className="text-xs text-destructive">{errors[field]?.message}</p>
              )}
            </div>
          ))}
          <Button type="submit" variant="brand" disabled={isSubmitting}>
            {isSubmitting ? t('password.saving') : t('password.save')}
          </Button>
          {!forced && (
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              {t('password.cancel')}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
