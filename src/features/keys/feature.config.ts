import type { FeatureConfig } from '../types';

export const config: FeatureConfig = {
  id: 'keys',
  name: 'Émission et révocation de clés',
  requires: ['auth', 'fleets'],
  nav: [{ href: '/keys', labelKey: 'nav.keys' }],
};

export default config;
