import { getNode, isSupportTag, logActivity, setNodeTags, type RawHeadscaleNode } from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Rattache au poste une machine déjà raccordée (en attente, ou de l'ancienne
 * flotte Interne) : elle prend le tag du poste, et lui seul — plus de flotte.
 */
export async function POST(request: Request, { params }: { params: Promise<{ tag: string }> }) {
  const { session, denied } = await guardApi('OPERATOR');
  if (denied) return denied;
  const tag = decodeURIComponent((await params).tag);
  if (!isSupportTag(tag)) return NextResponse.json({ message: 'Poste support inconnu' }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { nodeId?: string } | null;
  if (!body?.nodeId) return NextResponse.json({ message: 'Machine requise' }, { status: 400 });

  const response = await getNode(body.nodeId);
  if (!response.ok) return NextResponse.json({ message: 'Machine introuvable' }, { status: 404 });
  const { node } = (await response.json()) as { node: RawHeadscaleNode };
  if (!node.tags.some((item) => item === 'tag:a-assigner' || item === 'tag:interne')) {
    return NextResponse.json({ message: 'Seule une machine en attente ou de l’ancienne flotte Interne devient poste support' }, { status: 409 });
  }
  const tagged = await setNodeTags(node.id, [tag]);
  if (!tagged.ok) return NextResponse.json({ message: 'Refusé par Headscale' }, { status: 502 });
  await logActivity({ actor: session!.username, action: 'support-attach', target: `${node.givenName || node.name} → ${tag}` });
  return NextResponse.json({ ok: true });
}
