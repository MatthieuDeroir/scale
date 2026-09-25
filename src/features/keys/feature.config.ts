import type { FeatureConfig } from '../types';

export const config: FeatureConfig = {
  id: 'keys',
  name: 'Clés machine scopées à une flotte (F2)',
  requires: ['auth', 'fleets'],
  nav: [],
};

export default config;
