import {
  describeNode,
  ensureSystemTagsInPolicy,
  logActivity,
  mapNode,
  setNodeTags,
  SYSTEM_TAGS,
  type RawHeadscaleNode,
} from '@/core';
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
  const label = await describeNode(id);
  // Un tag système (ex. tag:master) doit être déclaré, sinon Headscale refuse.
  if (tags.some((tag) => (SYSTEM_TAGS as readonly string[]).includes(tag))) {
    await ensureSystemTagsInPolicy();
  }
  const response = await setNodeTags(id, tags);
  if (!response.ok) {
    return NextResponse.json({ message: 'Changement de flotte refusé par Headscale' }, { status: 502 });
  }

  await logActivity({
    actor: session.session.username,
    action: 'fleets-node-retag',
    target: `${label} → ${tags.join(',')}`,
  });

  const { node } = (await response.json()) as { node: RawHeadscaleNode };
  return NextResponse.json(mapNode(node));
}
