export interface Fleet {
  tag: string;
  label: string;
  deletable: boolean;
}

export type RuleKind = 'support' | 'isolation' | 'custom' | 'other';

export interface PolicyRule {
  id: string;
  kind: RuleKind;
  src: string[];
  dst: string[];
  from?: string;
  to?: string;
  ports?: string;
  /** Pour `support` : flottes jointes par le poste, « * » pour tout le parc. */
  targets?: string[];
}

export interface PolicyWarning {
  code: 'no-isolation';
  tag?: string;
}

export interface AclPolicy {
  fleets: Fleet[];
  rules: PolicyRule[];
  ssh: Array<{ src: string[]; dst: string[]; users: string[] }>;
  warnings: PolicyWarning[];
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

export async function addAccess(input: { from: string; to: string; ports: string }): Promise<AclPolicy> {
  const response = await fetch('/api/acl/rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) return parseError(response);
  return response.json();
}

export async function removeAccess(id: string): Promise<AclPolicy> {
  const response = await fetch(`/api/acl/rules?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!response.ok) return parseError(response);
  return response.json();
}
