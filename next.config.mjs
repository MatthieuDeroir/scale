import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Le lecteur série n'est jamais bundlé côté client : il vit dans server/.
  serverExternalPackages: ['serialport', '@prisma/client'],
  poweredByHeader: false,
  // Où qu'il soit, l'indicateur de dev masque un bouton (repli de la sidebar,
  // validation des panneaux latéraux).
  devIndicators: false,
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
