import { getRequestConfig } from 'next-intl/server';

export const locales = ['fr', 'en'] as const;
export const defaultLocale = 'fr';
/** Parc installé en France : un fuseau fixe évite des dates différentes entre serveur et navigateur. */
export const timeZone = process.env.APP_TIMEZONE ?? 'Europe/Paris';

/**
 * Le français est la langue de travail du bureau d'études ; l'anglais existe
 * pour les affaires export. Le choix par affaire se fait ici, pas par un
 * routage /fr /en : les équipements sont livrés dans une seule langue.
 */
export default getRequestConfig(async () => {
  const locale = process.env.APP_LOCALE ?? defaultLocale;
  return {
    locale,
    timeZone,
    messages: (await import(`../../messages/.generated/${locale}.json`)).default,
  };
});
