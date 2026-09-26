import { getLocale, getMessages, getTimeZone } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Providers } from '@/shared/providers';
import { themeInitScript } from '@/shared/theme';
import './globals.css';

export const metadata = {
  title: { default: 'Stramscale', template: '%s · Stramscale' },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const timeZone = await getTimeZone();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        {/* Applique le thème avant le premier rendu : pas de flash blanc. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Providers locale={locale} timeZone={timeZone} messages={messages as Record<string, unknown>}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
