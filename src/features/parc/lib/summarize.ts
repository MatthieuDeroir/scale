import {
  INTERNAL_TAG,
  UNASSIGNED_TAG,
  fleetSlug,
  fleetTagOf,
  isHypervision,
  parseFleetLabel,
  type FleetNode,
} from '@/features/fleets';
import type { FleetProfile } from '../api';

export interface FleetSummary {
  tag: string;
  slug: string;
  /** Nom lisible de la fiche s'il existe, sinon le nom tiré du tag. */
  label: string;
  internal: boolean;
  profile: FleetProfile | null;
  /** Présente dans la politique ACL ; sinon, tag porté par des machines mais sans règle. */
  inPolicy: boolean;
  nodes: FleetNode[];
  online: number;
  hypervision: number;
}

/**
 * Croise les flottes de la politique ACL et les machines Headscale.
 * Une flotte sans machine apparaît (elle vient d'être créée) ; un tag de
 * flotte porté par des machines mais absent de la politique aussi (sinon ces
 * machines disparaîtraient de l'écran). L'interne est toujours en tête.
 */
export function summarizeFleets(
  policyFleets: Array<{ tag: string; label: string }>,
  nodes: FleetNode[],
  profiles: FleetProfile[] = []
): FleetSummary[] {
  const profileByTag = new Map(profiles.map((profile) => [profile.tag, profile]));
  const byTag = new Map<string, FleetNode[]>();
  for (const node of nodes) {
    const tag = fleetTagOf(node.tags);
    if (!tag || tag === UNASSIGNED_TAG) continue;
    byTag.set(tag, [...(byTag.get(tag) ?? []), node]);
  }

  const labels = new Map(policyFleets.map((fleet) => [fleet.tag, fleet.label]));
  const tags = new Set([...labels.keys(), ...byTag.keys()]);

  return [...tags]
    .map((tag) => {
      const fleetNodes = byTag.get(tag) ?? [];
      const profile = profileByTag.get(tag) ?? null;
      return {
        tag,
        slug: fleetSlug(tag),
        label: profile?.displayName || labels.get(tag) || parseFleetLabel([tag]),
        profile,
        internal: tag === INTERNAL_TAG,
        inPolicy: labels.has(tag),
        nodes: fleetNodes,
        online: fleetNodes.filter((node) => node.online).length,
        hypervision: fleetNodes.filter((node) => isHypervision(node.tags)).length,
      };
    })
    .sort((a, b) => Number(b.internal) - Number(a.internal) || a.label.localeCompare(b.label));
}

/** Machines qui attendent une flotte : auto-enrôlées, ou sans aucun tag de flotte. */
export function unassignedNodes(nodes: FleetNode[]): FleetNode[] {
  return nodes.filter((node) => {
    const tag = fleetTagOf(node.tags);
    return tag === null || tag === UNASSIGNED_TAG;
  });
}

export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function nodeMatches(node: FleetNode, query: string): boolean {
  if (!query) return true;
  const q = normalize(query);
  return (
    normalize(node.givenName || node.name).includes(q) ||
    node.ipAddresses.some((ip) => ip.includes(q))
  );
}

/** Libellé de flotte d'une machine, avec le nom lisible si la fiche en donne un. */
export function fleetLabelResolver(fleets: FleetSummary[]) {
  const byTag = new Map(fleets.map((fleet) => [fleet.tag, fleet.label]));
  return (node: FleetNode) => {
    const tag = fleetTagOf(node.tags);
    return (tag && byTag.get(tag)) || parseFleetLabel(node.tags);
  };
}

/** Recherche sur tout ce qui décrit une flotte : nom, tag, secteur, n° d'affaire, site. */
export function fleetMatches(fleet: FleetSummary, query: string): boolean {
  const q = normalize(query);
  const p = fleet.profile;
  return [fleet.label, fleet.tag, p?.sector, p?.reference, p?.site, p?.contact]
    .filter(Boolean)
    .some((value) => normalize(value!).includes(q));
}
