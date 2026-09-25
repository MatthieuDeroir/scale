import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from '@/features/auth';
import { StramscaleMark, StramscaleWordmark } from '@/shared/ui';

export const metadata = { title: 'Connexion' };

export default async function LoginPage() {
  const t = await getTranslations('nav');
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-8 overflow-hidden bg-sidebar p-6">
      {/* Halo de marque discret derrière le formulaire. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/15 blur-3xl"
      />
      <div className="relative flex flex-col items-center gap-3 text-center">
        <StramscaleMark className="size-14 shadow-lg shadow-brand/30 rounded-2xl" />
        <h1>
          <StramscaleWordmark className="text-3xl text-sidebar-accent-foreground" />
        </h1>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-sidebar-muted">{t('tagline')}</p>
      </div>
      <div className="relative w-full max-w-sm">
        <LoginForm />
      </div>
      <footer className="relative flex items-center gap-2 text-xs text-sidebar-muted">
        <Image src="/images/Logo_Stramatel.png" alt="Stramatel" width={20} height={16} className="h-4 w-auto" />
        Bureau d&apos;études Stramatel
      </footer>
    </main>
  );
}
