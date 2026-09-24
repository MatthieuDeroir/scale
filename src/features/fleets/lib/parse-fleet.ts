/**
 * Une machine appartient à sa flotte via son tag Headscale — il n'y a pas de
 * champ « flotte » dédié côté API, juste des tags (F2 du cahier des charges).
 */
export function parseFleetLabel(tags: string[]): string {
  if (tags.includes('tag:interne')) return 'Interne';

  const flotte = tags.map((tag) => /^tag:flotte-(.+)$/.exec(tag)?.[1]).find(Boolean);
  if (flotte) return flotte;

  return 'Sans flotte';
}
