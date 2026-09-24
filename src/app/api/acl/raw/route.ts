import { checkPolicy, logActivity, parsePolicyFleets, setPolicy } from '@/core';
import { requireSession } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Secours pour ce que l'éditeur guidé ne couvre pas (CDC §3) — écrit la
 * politique telle quelle, mais toujours après validation, jamais en direct.
 */
export async function PUT(request: Request) {
  const session = await requireSession('OPERATOR');
  if (!session.ok) {
    return NextResponse.json(
      { message: session.status === 401 ? 'Non authentifié' : 'Droits insuffisants' },
      { status: session.status }
    );
  }

  const body = (await request.json().catch(() => null)) as { policy?: string } | null;
  const policy = body?.policy;
  if (!policy) {
    return NextResponse.json({ message: 'Politique requise' }, { status: 400 });
  }

  const checked = await checkPolicy(policy);
  if (!checked.ok) {
    const detail = (await checked.json().catch(() => ({}))) as { message?: string };
    return NextResponse.json(
      { message: detail.message ?? 'Politique invalide' },
      { status: 400 }
    );
  }

  const applied = await setPolicy(policy);
  if (!applied.ok) {
    return NextResponse.json({ message: 'Application refusée par Headscale' }, { status: 502 });
  }

  await logActivity({ actor: session.session.username, action: 'acl-raw-apply' });

  const { policy: appliedPolicy, updatedAt } = (await applied.json()) as {
    policy: string;
    updatedAt: string;
  };
  return NextResponse.json({
    fleets: parsePolicyFleets(appliedPolicy),
    raw: appliedPolicy,
    updatedAt,
  });
}
