import type { FeatureConfig } from '../types';

export const config: FeatureConfig = {
  id: 'fleets',
  name: 'Gestion des flottes clients',
  requires: ['auth'],
  nav: [{ href: '/', labelKey: 'nav.overview' }],
};

export default config;
