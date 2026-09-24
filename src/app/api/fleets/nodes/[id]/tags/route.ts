import { mapNode, setNodeTags, type RawHeadscaleNode } from '@/core';
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

  const body = (await request.json().catch(() => null)) as { tags?: string[] } | null;
  const tags = body?.tags?.filter(Boolean) ?? [];
  if (tags.length === 0) {
    return NextResponse.json({ message: 'Au moins un tag est requis' }, { status: 400 });
  }

  const { id } = await params;
  const response = await setNodeTags(id, tags);
  if (!response.ok) {
    return NextResponse.json({ message: 'Changement de flotte refusé par Headscale' }, { status: 502 });
  }

  const { node } = (await response.json()) as { node: RawHeadscaleNode };
  return NextResponse.json(mapNode(node));
}
