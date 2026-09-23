/** Rôles, du plus large au plus restreint. */
export const ROLES = ['ADMIN', 'OPERATOR', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = { ADMIN: 3, OPERATOR: 2, VIEWER: 1 };

/**
 * Vrai si `role` couvre `required`. Le contrôle est hiérarchique et se fait
 * **côté serveur** : un filtrage d'affichage n'est pas un contrôle d'accès.
 */
export function covers(role: Role, required: Role): boolean {
  return RANK[role] >= RANK[required];
}
