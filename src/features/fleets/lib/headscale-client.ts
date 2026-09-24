/**
 * Client serveur pour l'API REST de Headscale. Volontairement pas exporté
 * depuis `lib/index.ts` : ce fichier importe des secrets côté serveur, il ne
 * doit jamais finir dans un bundle client (les routes de `src/app/api/`
 * l'importent directement via `@/features/fleets/lib/headscale-client`).
 */
function config(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.HEADSCALE_API_URL;
  const apiKey = process.env.HEADSCALE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error('HEADSCALE_API_URL ou HEADSCALE_API_KEY absent.');
  }
  return { baseUrl, apiKey };
}

export interface RawHeadscaleNode {
  id: string;
  name: string;
  givenName: string;
  ipAddresses: string[];
  online: boolean;
  lastSeen: string | null;
  tags: string[];
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
  };
}

function headscaleFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { baseUrl, apiKey } = config();
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  });
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

/** Corps vide = expiration immédiate (comportement Headscale par défaut). */
export function expireNode(id: string): Promise<Response> {
  return headscaleFetch(`/api/v1/node/${id}/expire`, { method: 'POST' });
}

export function deleteNode(id: string): Promise<Response> {
  return headscaleFetch(`/api/v1/node/${id}`, { method: 'DELETE' });
}
