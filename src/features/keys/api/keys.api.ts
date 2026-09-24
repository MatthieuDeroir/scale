export interface AccessKey {
  id: string;
  reusable: boolean;
  used: boolean;
  expiration: string;
  createdAt: string;
  tags: string[];
}

export interface NewAccessKey extends AccessKey {
  /** En clair, présente uniquement dans la réponse de création — jamais revue ensuite. */
  key: string;
}

export interface CreateKeyInput {
  tags: string[];
  reusable: boolean;
  expiration: string;
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
    body: JSON.stringify(input),
  });
  if (!response.ok) return parseError(response);
  return response.json();
}

export async function revokeKey(id: string): Promise<void> {
  const response = await fetch(`/api/keys/${id}/expire`, { method: 'POST' });
  if (!response.ok) return parseError(response);
}
