import { hujsonToJson } from './hujson';

const INTERNAL_TAG = 'tag:interne';
const FLEET_TAG_PATTERN = /^tag:flotte-(.+)$/;

export interface FleetPolicy {
  tag: string;
  /** Nom de flotte extrait du tag, ou « Interne » — miroir de `parseFleetLabel` côté fleets. */
  label: string;
  /** L'interne ne se supprime jamais depuis cet écran : c'est la règle d'accès total. */
  deletable: boolean;
}

interface PolicyDocument {
  tagOwners: Record<string, string[]>;
  acls: Array<{ action: string; src: string[]; dst: string[] }>;
  [key: string]: unknown;
}

function parsePolicy(raw: string): PolicyDocument {
  const parsed = JSON.parse(hujsonToJson(raw)) as Partial<PolicyDocument>;
  return { tagOwners: parsed.tagOwners ?? {}, acls: parsed.acls ?? [], ...parsed };
}

/** Une flotte est une entrée `tagOwners` reconnue — `tag:interne` ou `tag:flotte-*`. */
export function parsePolicyFleets(raw: string): FleetPolicy[] {
  const { tagOwners } = parsePolicy(raw);

  return Object.keys(tagOwners)
    .filter((tag) => tag === INTERNAL_TAG || FLEET_TAG_PATTERN.test(tag))
    .map((tag) => ({
      tag,
      label: tag === INTERNAL_TAG ? 'Interne' : (FLEET_TAG_PATTERN.exec(tag)?.[1] ?? tag),
      deletable: tag !== INTERNAL_TAG,
    }));
}

export function fleetTagFromName(name: string): string {
  const slug = name
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacritiques : « Société » → « Societe », pas « Socit ».
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  return `tag:flotte-${slug}`;
}

/**
 * Ajoute une flotte : entrée `tagOwners` + règle ACL de cloisonnement, même
 * structure que `dev-local/policy.hujson` (référence vivante du pattern).
 */
export function addFleetToPolicy(raw: string, tag: string): string {
  const policy = parsePolicy(raw);
  if (policy.tagOwners[tag]) {
    throw new Error(`La flotte « ${tag} » existe déjà.`);
  }

  policy.tagOwners[tag] = ['stramatel@'];
  policy.acls.push({ action: 'accept', src: [tag], dst: [`${tag}:*`] });

  return JSON.stringify(policy, null, 2);
}

/** Retire la flotte et toute règle ACL qui la cite en source. `tag:interne` est protégé. */
export function removeFleetFromPolicy(raw: string, tag: string): string {
  if (tag === INTERNAL_TAG) {
    throw new Error("La flotte interne ne peut pas être supprimée depuis cet écran.");
  }

  const policy = parsePolicy(raw);
  delete policy.tagOwners[tag];
  policy.acls = policy.acls.filter((rule) => !rule.src.includes(tag));

  return JSON.stringify(policy, null, 2);
}
