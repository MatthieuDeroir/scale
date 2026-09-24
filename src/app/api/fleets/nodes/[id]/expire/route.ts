import { mapNode, expireNode, type RawHeadscaleNode } from '@/features/fleets/lib/headscale-client';
import { requireSession } from '@/features/fleets/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession('OPERATOR');
  if (!session.ok) {
    return NextResponse.json(
      { message: session.status === 401 ? 'Non authentifié' : 'Droits insuffisants' },
      { status: session.status }
    );
  }

  const { id } = await params;
  const response = await expireNode(id);
  if (!response.ok) {
    return NextResponse.json({ message: 'Expiration refusée par Headscale' }, { status: 502 });
  }

  const { node } = (await response.json()) as { node: RawHeadscaleNode };
  return NextResponse.json(mapNode(node));
}
