import type { Role } from '../lib/roles';

export interface AccountUser {
  id: number;
  username: string;
  role: Role;
  disabled: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

async function parseError(response: Response): Promise<never> {
  const payload = (await response.json().catch(() => ({}))) as { message?: string };
  throw new Error(payload.message ?? `Action refusée (${response.status})`);
}

export async function fetchUsers(): Promise<AccountUser[]> {
  const response = await fetch('/api/users');
  if (!response.ok) return parseError(response);
  return response.json();
}

export async function createUser(
  username: string,
  role: Role
): Promise<AccountUser & { password: string }> {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, role }),
  });
  if (!response.ok) return parseError(response);
  return response.json();
}

export async function disableUser(id: number): Promise<void> {
  const response = await fetch(`/api/users/${id}/disable`, { method: 'POST' });
  if (!response.ok) return parseError(response);
}

export async function enableUser(id: number): Promise<void> {
  const response = await fetch(`/api/users/${id}/enable`, { method: 'POST' });
  if (!response.ok) return parseError(response);
}

export async function resetUserPassword(id: number): Promise<{ password: string }> {
  const response = await fetch(`/api/users/${id}/reset-password`, { method: 'POST' });
  if (!response.ok) return parseError(response);
  return response.json();
}
