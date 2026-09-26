/**
 * Client serveur pour l'API REST de Headscale. Partagé entre plusieurs
 * fonctionnalités (`fleets`, `keys`, et la Phase 3 d'enrôlement automatique) :
 * c'est le seul point qui parle au fork Headscale, pas une brique propre à
 * une feature. Importe des secrets côté serveur — jamais dans un bundle
 * client (seules les routes de `src/app/api/` l'importent).
 */
function config(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.HEADSCALE_API_URL;
  const apiKey = process.env.HEADSCALE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error('HEADSCALE_API_URL ou HEADSCALE_API_KEY absent.');
  }
  return { baseUrl, apiKey };
}

function headscaleFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { baseUrl, apiKey } = config();
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  });
}

// --- Nœuds -------------------------------------------------------------

export interface RawHeadscaleNode {
  id: string;
  name: string;
  givenName: string;
  ipAddresses: string[];
  online: boolean;
  lastSeen: string | null;
  tags: string[];
  createdAt?: string | null;
  /** Clé qui a enregistré la machine : relie une clé émise à la machine qui l'a utilisée. */
  preAuthKey?: { id: string } | null;
}

/** Champs exposés à l'UI — un sous-ensemble de ce que renvoie Headscale. */
export function mapNode(node: RawHeadscaleNode) {
  return {
    id: node.id,
    name: node.name,
    givenName: node.givenName,
    ipAddresses: node.ipAddresses,
    online: node.online,
    lastSeen: node.lastSeen,
    tags: node.tags,
    createdAt: node.createdAt ?? null,
    keyId: node.preAuthKey?.id ?? null,
  };
}

/**
 * Libellé lisible d'une machine pour le journal : « nom [flotte] #id ». Lu
 * AVANT l'action, pour qu'une entrée reste compréhensible une fois la machine
 * supprimée. Retombe sur « #id » si Headscale ne répond pas.
 */
export async function describeNode(id: string): Promise<string> {
  try {
    const response = await getNode(id);
    if (!response.ok) return `#${id}`;
    const { node } = (await response.json()) as { node: RawHeadscaleNode };
    const fleet = node.tags.find((tag) => /^tag:(interne|a-assigner|flotte-.+)$/.test(tag));
    return `${node.givenName || node.name}${fleet ? ` [${fleet.slice(4)}]` : ''} #${id}`;
  } catch {
    return `#${id}`;
  }
}

export function listNodes(): Promise<Response> {
  return headscaleFetch('/api/v1/node');
}

export function getNode(id: string): Promise<Response> {
  return headscaleFetch(`/api/v1/node/${id}`);
}

export function renameNode(id: string, name: string): Promise<Response> {
  return headscaleFetch(`/api/v1/node/${id}/rename/${encodeURIComponent(name)}`, {
    method: 'POST',
  });
}

/** Une machine taguée doit garder au moins un tag — refusé côté Headscale sinon. */
export function setNodeTags(id: string, tags: string[]): Promise<Response> {
  return headscaleFetch(`/api/v1/node/${id}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags }),
  });
}

export function deleteNode(id: string): Promise<Response> {
  return headscaleFetch(`/api/v1/node/${id}`, { method: 'DELETE' });
}

// --- Clés pré-authentifiées ---------------------------------------------

export interface RawHeadscalePreAuthKey {
  id: string;
  key: string;
  reusable: boolean;
  used: boolean;
  expiration: string;
  createdAt: string;
  aclTags: string[];
}

/**
 * Pour la liste : jamais `key` — Headscale la renvoie déjà masquée sur
 * `GET /api/v1/preauthkey` (vérifié dans `preAuthKeyToResponse`), l'exposer
 * n'apporterait rien.
 */
export function mapPreAuthKey(key: RawHeadscalePreAuthKey) {
  return {
    id: key.id,
    reusable: key.reusable,
    used: key.used,
    expiration: key.expiration,
    createdAt: key.createdAt,
    tags: key.aclTags,
  };
}

/** Pour la création seulement : la valeur en clair, montrée une seule fois. */
export function mapNewPreAuthKey(key: RawHeadscalePreAuthKey) {
  return { ...mapPreAuthKey(key), key: key.key };
}

/**
 * `POST /api/v1/preauthkey` exige un `user` numérique (`parsePreAuthKeyUser`
 * fait un `ParseUint` strict, pas un nom) — `HEADSCALE_USER` reste le nom
 * lisible en configuration, résolu ici via `GET /api/v1/user?name=`.
 */
async function resolveHeadscaleUserId(): Promise<string> {
  const name = process.env.HEADSCALE_USER;
  if (!name) throw new Error('HEADSCALE_USER absent.');

  const response = await headscaleFetch(`/api/v1/user?name=${encodeURIComponent(name)}`);
  if (!response.ok) throw new Error(`Utilisateur Headscale « ${name} » introuvable.`);

  const { users } = (await response.json()) as { users: { id: string }[] };
  if (users.length === 0) throw new Error(`Utilisateur Headscale « ${name} » introuvable.`);
  return users[0].id;
}

/**
 * Émet une clé. `user` est fixé par le serveur (`HEADSCALE_USER`), jamais un
 * choix exposé à l'UI — vérifié sur `dev-local` : Headscale n'a qu'un seul
 * utilisateur, `stramatel`, une clé = une machine taguée, pas un utilisateur
 * par client.
 */
export async function createPreAuthKey(options: {
  tags: string[];
  reusable: boolean;
  expiration: string;
}): Promise<Response> {
  const user = await resolveHeadscaleUserId();

  return headscaleFetch('/api/v1/preauthkey', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user,
      reusable: options.reusable,
      expiration: options.expiration,
      aclTags: options.tags,
    }),
  });
}

/**
 * Sans filtre côté Headscale (vérifié : `listPreAuthKeys` n'a pas de
 * paramètre `user`) — sans conséquence, un seul utilisateur Headscale existe
 * dans ce modèle (`stramatel`).
 */
export function listPreAuthKeys(): Promise<Response> {
  return headscaleFetch('/api/v1/preauthkey');
}

export function expirePreAuthKey(id: string): Promise<Response> {
  return headscaleFetch('/api/v1/preauthkey/expire', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
}

// --- Politique ACL --------------------------------------------------------

/**
 * Renvoie `{policy, updatedAt}` — `policy` est la politique brute (HuJSON).
 * `PUT` échoue en 400 si Headscale n'est pas configuré en `policy.mode:
 * database` (vérifié dans le fork : `setPolicy` refuse sinon) — condition
 * requise pour que cet éditeur fonctionne, documentée dans le CDC.
 */
export function getPolicy(): Promise<Response> {
  return headscaleFetch('/api/v1/policy');
}

export function setPolicy(policy: string): Promise<Response> {
  return headscaleFetch('/api/v1/policy', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ policy }),
  });
}

/** Valide sans appliquer — toujours appelé avant `setPolicy` (CDC §7). */
export function checkPolicy(policy: string): Promise<Response> {
  return headscaleFetch('/api/v1/policy/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ policy }),
  });
}
