import type { FeatureConfig } from '../types';

export const config: FeatureConfig = {
  id: 'provisioning',
  name: 'Enrôlement automatique des machines Stramatel',
  requires: ['auth'],
  nav: [{ href: '/provisioning', labelKey: 'nav.provisioning' }],
};

export default config;
