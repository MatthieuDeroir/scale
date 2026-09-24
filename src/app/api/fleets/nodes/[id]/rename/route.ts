import { mapNode, renameNode, type RawHeadscaleNode } from '@/core';
import { requireSession } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    return NextResponse.json({ message: 'Nom requis' }, { status: 400 });
  }

  const { id } = await params;
  const response = await renameNode(id, name);
  if (!response.ok) {
    return NextResponse.json({ message: 'Renommage refusé par Headscale' }, { status: 502 });
  }

  const { node } = (await response.json()) as { node: RawHeadscaleNode };
  return NextResponse.json(mapNode(node));
}
