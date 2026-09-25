import { INTERNAL_TAG, UNASSIGNED_TAG, fleetTagOf } from './tags';

/**
 * Une machine appartient à sa flotte via son tag Headscale — il n'y a pas de
 * champ « flotte » dédié côté API, juste des tags (F2 du cahier des charges).
 */
export function parseFleetLabel(tags: string[]): string {
  const tag = fleetTagOf(tags);
  if (tag === INTERNAL_TAG) return 'Interne';
  if (tag === UNASSIGNED_TAG) return 'À assigner';
  if (tag) return tag.slice('tag:flotte-'.length);
  return 'Sans flotte';
}
