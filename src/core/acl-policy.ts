import { hujsonToJson } from './hujson';

const INTERNAL_TAG = 'tag:interne';
const FLEET_TAG_PATTERN = /^tag:flotte-(.+)$/;

/**
 * Tags qui ne sont pas des flottes mais que Headscale doit connaître
 * (`tagOwners`), sinon une machine qui les porte est refusée à
 * l'enregistrement :
 * - `tag:a-assigner` : machine auto-enrôlée pas encore rangée. Aucune règle
 *   ACL ne l'a en source → aucun accès sortant ; l'interne (`*:*`) la joint.
 * - `tag:hypervision` : poste d'hypervision client, toujours porté en plus d'un
 *   tag de flotte — c'est ce dernier qui décide du cloisonnement.
 */
export const SYSTEM_TAGS = ['tag:a-assigner', 'tag:hypervision'] as const;

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
  addSystemTags(policy);

  return JSON.stringify(policy, null, 2);
}

function addSystemTags(policy: PolicyDocument): boolean {
  let changed = false;
  for (const tag of SYSTEM_TAGS) {
    if (!policy.tagOwners[tag]) {
      policy.tagOwners[tag] = ['stramatel@'];
      changed = true;
    }
  }
  return changed;
}

/** Politique avec les tags système déclarés, ou `null` si déjà le cas. */
export function ensureSystemTags(raw: string): string | null {
  const policy = parsePolicy(raw);
  return addSystemTags(policy) ? JSON.stringify(policy, null, 2) : null;
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
