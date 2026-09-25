import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Le lecteur série n'est jamais bundlé côté client : il vit dans server/.
  serverExternalPackages: ['serialport', '@prisma/client'],
  poweredByHeader: false,
  // En bas à gauche, l'indicateur de dev masque le bouton de repli de la sidebar.
  devIndicators: { position: 'bottom-right' },
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
      ],
    },
  ],
};

export default withNextIntl(nextConfig);
