import type { FeatureConfig } from '../types';

export const config: FeatureConfig = {
  id: 'acl',
  name: 'Politique ACL par flotte',
  requires: ['auth', 'fleets'],
  nav: [{ href: '/acl', labelKey: 'nav.acl' }],
};

export default config;
