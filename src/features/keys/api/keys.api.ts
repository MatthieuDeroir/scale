export interface AccessKey {
  id: string;
  reusable: boolean;
  used: boolean;
  expiration: string;
  createdAt: string;
  tags: string[];
  /** Machine enregistrée avec cette clé, si elle a servi. */
  usedBy?: { id: string; name: string; at: string | null } | null;
}

export interface NewAccessKey extends AccessKey {
  /** En clair, présente uniquement dans la réponse de création — jamais revue ensuite. */
  key: string;
  /** Adresse Headscale que la machine à enrôler doit joindre. */
  loginServer: string;
  /** Équipement Stramatel : jeton de l'agent et installateur (jamais pour un poste client). */
  agentToken?: string | null;
  installUrl?: string | null;
}

export interface CreateKeyInput {
  tags: string[];
  expiration: string;
}

/** Clé encore utilisable : pas consommée, pas expirée (ni révoquée — révoquer = expirer). */
export function isPending(key: AccessKey, now = new Date()): boolean {
  return !key.used && new Date(key.expiration) > now;
}

async function parseError(response: Response): Promise<never> {
  const payload = (await response.json().catch(() => ({}))) as { message?: string };
  throw new Error(payload.message ?? `Action refusée (${response.status})`);
}

export async function fetchKeys(): Promise<AccessKey[]> {
  const response = await fetch('/api/keys');
  if (!response.ok) return parseError(response);
  return response.json();
}

export async function createKey(input: CreateKeyInput): Promise<NewAccessKey> {
  const response = await fetch('/api/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Jamais réutilisable : une clé = une machine (CDC F2).
    body: JSON.stringify({ ...input, reusable: false }),
  });
  if (!response.ok) return parseError(response);
  return response.json();
}

export async function revokeKey(id: string): Promise<void> {
  const response = await fetch(`/api/keys/${id}/expire`, { method: 'POST' });
  if (!response.ok) return parseError(response);
}
