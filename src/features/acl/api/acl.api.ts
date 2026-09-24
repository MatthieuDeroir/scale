export interface Fleet {
  tag: string;
  label: string;
  deletable: boolean;
}

export interface AclPolicy {
  fleets: Fleet[];
  raw: string;
  updatedAt: string;
}

async function parseError(response: Response): Promise<never> {
  const payload = (await response.json().catch(() => ({}))) as { message?: string };
  throw new Error(payload.message ?? `Action refusée (${response.status})`);
}

export async function fetchPolicy(): Promise<AclPolicy> {
  const response = await fetch('/api/acl/policy');
  if (!response.ok) return parseError(response);
  return response.json();
}

export async function createFleet(name: string): Promise<AclPolicy> {
  const response = await fetch('/api/acl/fleets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) return parseError(response);
  return response.json();
}

export async function deleteFleet(tag: string): Promise<AclPolicy> {
  const response = await fetch(`/api/acl/fleets/${encodeURIComponent(tag)}`, {
    method: 'DELETE',
  });
  if (!response.ok) return parseError(response);
  return response.json();
}

export async function applyRawPolicy(raw: string): Promise<AclPolicy> {
  const response = await fetch('/api/acl/raw', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ policy: raw }),
  });
  if (!response.ok) return parseError(response);
  return response.json();
}
