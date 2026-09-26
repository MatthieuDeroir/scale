import type { FleetNode } from './fleets.api';

async function postNode(path: string, body?: unknown): Promise<FleetNode> {
  const response = await fetch(path, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? `Action refusée (${response.status})`);
  }
  return response.json();
}

export async function fetchNode(id: string): Promise<FleetNode> {
  const response = await fetch(`/api/fleets/nodes/${id}`);
  if (!response.ok) throw new Error(`Machine indisponible (${response.status})`);
  return response.json();
}

export function renameNode(id: string, name: string): Promise<FleetNode> {
  return postNode(`/api/fleets/nodes/${id}/rename`, { name });
}

export function retagNode(id: string, tags: string[]): Promise<FleetNode> {
  return postNode(`/api/fleets/nodes/${id}/tags`, { tags });
}

export async function deleteNode(id: string): Promise<void> {
  const response = await fetch(`/api/fleets/nodes/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? `Suppression refusée (${response.status})`);
  }
}
