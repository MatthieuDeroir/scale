import {
  addFleetToPolicy,
  checkPolicy,
  fleetTagFromName,
  getPolicy,
  logActivity,
  parsePolicyFleets,
  setPolicy,
} from '@/core';
import { requireSession } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await requireSession('OPERATOR');
  if (!session.ok) {
    return NextResponse.json(
      { message: session.status === 401 ? 'Non authentifié' : 'Droits insuffisants' },
      { status: session.status }
    );
  }

  const body = (await request.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim();
  if (!name) {
    return NextResponse.json({ message: 'Nom de flotte requis' }, { status: 400 });
  }

  const current = await getPolicy();
  if (!current.ok) {
    return NextResponse.json({ message: 'Headscale indisponible' }, { status: 502 });
  }
  const { policy: raw } = (await current.json()) as { policy: string };

  const tag = fleetTagFromName(name);
  let updated: string;
  try {
    updated = addFleetToPolicy(raw, tag);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Requête invalide' },
      { status: 409 }
    );
  }

  const checked = await checkPolicy(updated);
  if (!checked.ok) {
    const detail = (await checked.json().catch(() => ({}))) as { message?: string };
    return NextResponse.json(
      { message: detail.message ?? 'Politique invalide' },
      { status: 400 }
    );
  }

  const applied = await setPolicy(updated);
  if (!applied.ok) {
    return NextResponse.json({ message: 'Application refusée par Headscale' }, { status: 502 });
  }

  await logActivity({ actor: session.session.username, action: 'acl-fleet-create', target: tag });

  const { policy, updatedAt } = (await applied.json()) as { policy: string; updatedAt: string };
  return NextResponse.json({ fleets: parsePolicyFleets(policy), raw: policy, updatedAt });
}
