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

interface AclRule {
  action: string;
  src: string[];
  dst: string[];
}

interface SshRule {
  action: string;
  src: string[];
  dst: string[];
  users: string[];
}

interface PolicyDocument {
  tagOwners: Record<string, string[]>;
  acls: AclRule[];
  ssh?: SshRule[];
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

const targetsTag = (entry: string, tag: string) => entry === tag || entry.startsWith(`${tag}:`);

/**
 * Retire la flotte : sa déclaration, les règles qui l'ont en source, et les
 * destinations qui la visent dans les autres règles (accès inter-flottes,
 * SSH). Sans ce dernier point, la politique citerait un tag inexistant et
 * Headscale refuserait de l'appliquer. `tag:interne` est protégé.
 */
export function removeFleetFromPolicy(raw: string, tag: string): string {
  if (tag === INTERNAL_TAG) {
    throw new Error("La flotte interne ne peut pas être supprimée depuis cet écran.");
  }

  const policy = parsePolicy(raw);
  delete policy.tagOwners[tag];
  policy.acls = policy.acls
    .filter((rule) => !rule.src.includes(tag))
    .map((rule) => ({ ...rule, dst: rule.dst.filter((entry) => !targetsTag(entry, tag)) }))
    .filter((rule) => rule.dst.length > 0);
  if (policy.ssh) {
    policy.ssh = policy.ssh
      .filter((rule) => !rule.src.includes(tag))
      .map((rule) => ({ ...rule, dst: rule.dst.filter((entry) => entry !== tag) }))
      .filter((rule) => rule.dst.length > 0);
  }

  return JSON.stringify(policy, null, 2);
}

// --- Lecture guidée des règles ------------------------------------------

export type RuleKind = 'support' | 'isolation' | 'custom' | 'other';

export interface PolicyRule {
  /** Empreinte stable de la règle (sources > destinations), sert à la retirer. */
  id: string;
  kind: RuleKind;
  src: string[];
  dst: string[];
  /** Pour `custom` : flotte source, flotte cible, ports (« * » = tous). */
  from?: string;
  to?: string;
  ports?: string;
}

export interface PolicyWarning {
  code: 'no-support' | 'no-isolation';
  tag?: string;
}

const isFleet = (tag: string) => tag === INTERNAL_TAG || FLEET_TAG_PATTERN.test(tag);

function ruleId(rule: { src: string[]; dst: string[] }): string {
  return `${rule.src.join(',')}>${rule.dst.join(',')}`;
}

function classify(rule: AclRule): PolicyRule {
  const base = { id: ruleId(rule), src: rule.src, dst: rule.dst };
  if (rule.src.length === 1 && rule.src[0] === INTERNAL_TAG && rule.dst.length === 1 && rule.dst[0] === '*:*') {
    return { ...base, kind: 'support' };
  }
  if (rule.src.length === 1 && rule.dst.length === 1 && rule.dst[0] === `${rule.src[0]}:*`) {
    return { ...base, kind: 'isolation' };
  }
  const target = /^(tag:[^:]+):(.+)$/.exec(rule.dst[0] ?? '');
  const sameTarget =
    target && rule.dst.every((entry) => entry.startsWith(`${target[1]}:`)) && isFleet(target[1]);
  if (rule.src.length === 1 && isFleet(rule.src[0]) && sameTarget) {
    const ports = rule.dst.map((entry) => entry.slice(target![1].length + 1)).join(',');
    return { ...base, kind: 'custom', from: rule.src[0], to: target![1], ports };
  }
  return { ...base, kind: 'other' };
}

/** Règles de la politique, classées, et ce qui manque au cloisonnement. */
export function parsePolicyRules(raw: string): {
  rules: PolicyRule[];
  ssh: Array<{ src: string[]; dst: string[]; users: string[] }>;
  warnings: PolicyWarning[];
} {
  const policy = parsePolicy(raw);
  const rules = policy.acls.filter((rule) => rule.action === 'accept').map(classify);
  const warnings: PolicyWarning[] = [];
  if (!rules.some((rule) => rule.kind === 'support')) warnings.push({ code: 'no-support' });
  for (const tag of Object.keys(policy.tagOwners).filter((item) => FLEET_TAG_PATTERN.test(item))) {
    if (!rules.some((rule) => rule.kind === 'isolation' && rule.src[0] === tag)) {
      warnings.push({ code: 'no-isolation', tag });
    }
  }
  const ssh = (policy.ssh ?? []).map((rule) => ({ src: rule.src, dst: rule.dst, users: rule.users ?? [] }));
  return { rules, ssh, warnings };
}

const PORTS_PATTERN = /^(\*|\d{1,5}(-\d{1,5})?(,\d{1,5}(-\d{1,5})?)*)$/;

/** « 22, 443,5900-5910 » → « 22,443,5900-5910 » ; « » ou « * » → « * ». */
export function normalizePorts(input: string): string {
  const compact = input.replace(/\s+/g, '') || '*';
  if (!PORTS_PATTERN.test(compact)) {
    throw new Error('Ports invalides : « * », ou une liste comme 22,443,5900-5910.');
  }
  for (const part of compact === '*' ? [] : compact.split(',')) {
    const [low, high = low] = part.split('-').map(Number);
    if (low < 1 || high > 65535 || low > high) throw new Error(`Port hors limites : ${part}.`);
  }
  return compact;
}

/**
 * Autorise la flotte `from` à joindre la flotte `to` (entorse volontaire au
 * cloisonnement, à sens unique). Les deux flottes doivent exister ; l'interne
 * voit déjà tout et n'a pas besoin d'accès supplémentaire.
 */
export function addAccessRule(raw: string, input: { from: string; to: string; ports: string }): string {
  const policy = parsePolicy(raw);
  const { from, to } = input;
  if (from === to) throw new Error('La source et la destination sont la même flotte.');
  if (from === INTERNAL_TAG) throw new Error('Le support Stramatel joint déjà tout le parc.');
  for (const tag of [from, to]) {
    if (!isFleet(tag) || !policy.tagOwners[tag]) throw new Error(`Flotte inconnue : ${tag}.`);
  }
  const ports = normalizePorts(input.ports);
  const rule: AclRule = { action: 'accept', src: [from], dst: ports.split(',').map((port) => `${to}:${port}`) };
  if (policy.acls.some((existing) => ruleId(existing) === ruleId(rule))) {
    throw new Error('Cet accès existe déjà.');
  }
  policy.acls.push(rule);
  return JSON.stringify(policy, null, 2);
}

/** Retire un accès ajouté ; les règles de base (support, cloisonnement) restent. */
export function removeAccessRule(raw: string, id: string): string {
  const policy = parsePolicy(raw);
  const index = policy.acls.findIndex((rule) => ruleId(rule) === id);
  if (index < 0) throw new Error('Règle introuvable (déjà retirée ?).');
  if (classify(policy.acls[index]).kind !== 'custom') {
    throw new Error("Cette règle fait partie du cloisonnement de base : elle ne se retire pas d'ici.");
  }
  policy.acls.splice(index, 1);
  return JSON.stringify(policy, null, 2);
}
