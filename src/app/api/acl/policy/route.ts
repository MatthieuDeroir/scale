import { getPolicy, parsePolicyFleets, parsePolicyRules } from '@/core';
import { requireSession } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireSession();
  if (!session.ok) {
    return NextResponse.json({ message: 'Non authentifié' }, { status: session.status });
  }

  const response = await getPolicy();
  if (!response.ok) {
    return NextResponse.json({ message: 'Headscale indisponible' }, { status: 502 });
  }

  const { policy, updatedAt } = (await response.json()) as { policy: string; updatedAt: string };
  return NextResponse.json({
    fleets: parsePolicyFleets(policy),
    ...parsePolicyRules(policy),
    raw: policy,
    updatedAt,
  });
}
