import type { NewAccessKey } from '@/features/keys';

/** Poste support : un PC (ou plusieurs) d'une personne de Stramatel, et les flottes qu'il joint. */
export interface SupportPost {
  tag: string;
  name: string;
  /** Flottes jointes (tags), « * » pour tout le parc ; vide = aucun accès. */
  targets: string[];
  machines: Array<{ id: string; name: string; online: boolean; ip: string | null; lastSeen: string | null }>;
}

async function call<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const response = await fetch(url, {
    ...init,
    ...(init?.json !== undefined
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(init.json) }
      : {}),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? `Refusé (${response.status})`);
  }
  return response.json();
}

const postUrl = (tag: string) => `/api/support/${encodeURIComponent(tag)}`;

export const fetchSupportPosts = () => call<SupportPost[]>('/api/support');
export const createSupportPost = (name: string) => call<{ tag: string; name: string }>('/api/support', { method: 'POST', json: { name } });
export const setSupportTargets = (tag: string, targets: string[]) =>
  call<{ ok: true }>(postUrl(tag), { method: 'PUT', json: { targets } });
export const deleteSupportPost = (tag: string) => call<{ ok: true }>(postUrl(tag), { method: 'DELETE' });
export const issueSupportKey = (tag: string, expiration: string) =>
  call<NewAccessKey>(`${postUrl(tag)}/key`, { method: 'POST', json: { expiration } });
export const attachToSupport = (tag: string, nodeId: string) =>
  call<{ ok: true }>(`${postUrl(tag)}/attach`, { method: 'POST', json: { nodeId } });

/** Le poste joint-il cette flotte ? */
export function reaches(post: Pick<SupportPost, 'targets'>, fleetTag: string): boolean {
  return post.targets.includes('*') || post.targets.includes(fleetTag);
}

/** Périmètre du poste avec (ou sans) cette flotte ; « tout le parc » reste tel quel. */
export function withFleetTarget(post: Pick<SupportPost, 'targets'>, fleetTag: string, on: boolean): string[] {
  if (post.targets.includes('*')) return post.targets;
  const rest = post.targets.filter((item) => item !== fleetTag);
  return on ? [...rest, fleetTag] : rest;
}
