'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';

/**
 * Fournisseurs client. Le QueryClient est créé dans un état React, pas au
 * niveau du module : sinon deux onglets d'un même serveur partagent le cache.
 */
export function Providers({
  children,
  locale,
  timeZone,
  messages,
}: {
  children: ReactNode;
  locale: string;
  timeZone: string;
  messages: Record<string, unknown>;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Un afficheur reste ouvert des heures : ne pas refetch sur focus,
            // l'état matériel arrive par Socket.io, pas par sondage.
            refetchOnWindowFocus: false,
            staleTime: 30_000,
            retry: 1,
          },
        },
      })
  );

  return (
    <NextIntlClientProvider locale={locale} timeZone={timeZone} messages={messages}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}
