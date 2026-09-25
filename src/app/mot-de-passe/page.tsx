import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ChangePasswordForm } from '@/features/auth';
import { currentUser } from '@/features/auth/lib/require-session';
import { StramscaleMark, StramscaleWordmark } from '@/shared/ui';

export const metadata = { title: 'Mot de passe' };

// Hors du groupe (app) : la garde de ce groupe renvoie ici tant que le mot de
// passe est provisoire, la page ne doit donc pas en dépendre.
export default async function MotDePassePage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const t = await getTranslations('nav');

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-8 overflow-hidden bg-sidebar p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/15 blur-3xl"
      />
      <div className="relative flex flex-col items-center gap-3 text-center">
        <StramscaleMark className="size-12 rounded-2xl" />
        <StramscaleWordmark className="text-2xl text-sidebar-accent-foreground" />
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-sidebar-muted">
          {t('tagline')}
        </p>
      </div>
      <div className="relative w-full max-w-sm">
        <ChangePasswordForm forced={user.mustChangePassword} />
      </div>
    </main>
  );
}
