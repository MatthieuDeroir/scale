import type { FeatureConfig } from '../types';

export const config: FeatureConfig = {
  id: 'health',
  name: "État de la source matérielle",
  requires: [],
  nav: [{ href: '/', labelKey: 'nav.overview' }],
};

export default config;
