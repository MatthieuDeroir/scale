import type { FeatureConfig } from '../types';

export const config: FeatureConfig = {
  id: 'parc',
  name: 'Parc : flottes, machines, machines à assigner',
  requires: ['auth', 'fleets', 'keys', 'acl'],
  nav: [],
};

export default config;
