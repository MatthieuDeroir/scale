import { checkPolicy, getPolicy, setPolicy } from './headscale';

type UpdateResult =
  | { ok: true; policy: string; updatedAt: string }
  | { ok: false; status: number; message: string };

/**
 * Modifie la politique Headscale : lecture, transformation, validation par
 * Headscale, puis écriture. Jamais d'écriture sans validation (CDC §7).
 */
export async function updatePolicy(transform: (raw: string) => string): Promise<UpdateResult> {
  const current = await getPolicy();
  if (!current.ok) return { ok: false, status: 502, message: 'Headscale indisponible' };
  const { policy: raw } = (await current.json()) as { policy: string };

  let updated: string;
  try {
    updated = transform(raw);
  } catch (error) {
    return { ok: false, status: 400, message: error instanceof Error ? error.message : 'Requête invalide' };
  }

  const checked = await checkPolicy(updated);
  if (!checked.ok) {
    const detail = (await checked.json().catch(() => ({}))) as { message?: string };
    return { ok: false, status: 400, message: detail.message ?? 'Politique invalide' };
  }
  const applied = await setPolicy(updated);
  if (!applied.ok) return { ok: false, status: 502, message: 'Application refusée par Headscale' };

  const { policy, updatedAt } = (await applied.json()) as { policy: string; updatedAt: string };
  return { ok: true, policy, updatedAt };
}
