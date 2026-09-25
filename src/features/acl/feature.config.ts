import type { FeatureConfig } from '../types';

export const config: FeatureConfig = {
  id: 'acl',
  name: 'Politique ACL par flotte',
  requires: ['auth'],
  nav: [{ href: '/politique', labelKey: 'nav.policy' }],
};

export default config;
