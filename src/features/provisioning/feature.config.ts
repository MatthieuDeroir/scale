import type { FeatureConfig } from '../types';

export const config: FeatureConfig = {
  id: 'provisioning',
  name: 'Enrôlement automatique des machines Stramatel',
  requires: ['auth'],
  nav: [],
};

export default config;
