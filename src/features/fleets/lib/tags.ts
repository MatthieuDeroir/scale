/**
 * Vocabulaire des tags Headscale utilisé par l'interface.
 *
 * Une machine porte exactement un « tag de flotte » (où elle vit) et,
 * éventuellement, des « tags de type » (ce qu'elle est). Le cloisonnement ACL
 * ne regarde que le tag de flotte ; le type sert à l'affichage (équipement
 * Stramatel ou poste d'hypervision client).
 */
export const INTERNAL_TAG = 'tag:interne';
/** Machine auto-enrôlée pas encore rangée dans une flotte — aucun accès sortant. */
export const UNASSIGNED_TAG = 'tag:a-assigner';
/** Poste d'hypervision appartenant au client (pas un équipement Stramatel). */
export const HYPERVISION_TAG = 'tag:hypervision';

const FLEET_PREFIX = 'tag:flotte-';

export function isFleetTag(tag: string): boolean {
  return tag === INTERNAL_TAG || tag === UNASSIGNED_TAG || tag.startsWith(FLEET_PREFIX);
}

export function fleetTagOf(tags: string[]): string | null {
  return tags.find(isFleetTag) ?? null;
}

export function isHypervision(tags: string[]): boolean {
  return tags.includes(HYPERVISION_TAG);
}

/** Remplace le tag de flotte en conservant les tags de type. */
export function withFleet(tags: string[], fleetTag: string): string[] {
  return [fleetTag, ...tags.filter((tag) => !isFleetTag(tag))];
}

/** `tag:flotte-clienta` → `clienta`, `tag:interne` → `interne` (segment d'URL). */
export function fleetSlug(tag: string): string {
  if (tag === INTERNAL_TAG) return 'interne';
  return tag.startsWith(FLEET_PREFIX) ? tag.slice(FLEET_PREFIX.length) : tag;
}

export function tagFromSlug(slug: string): string {
  return slug === 'interne' ? INTERNAL_TAG : `${FLEET_PREFIX}${slug}`;
}
