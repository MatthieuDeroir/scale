import type { FeatureConfig } from '../types';

export const config: FeatureConfig = {
  id: 'activity',
  name: "Journal d'activité",
  requires: ['auth'],
  nav: [{ href: '/activite', labelKey: 'nav.activity' }],
};

export default config;
