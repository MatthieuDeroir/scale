import { deleteNode, isSupportTag, listNodes, logActivity, removeSupportPost, setSupportAccess, updatePolicy, type RawHeadscaleNode } from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Périmètre du poste : flottes jointes, « * » pour tout le parc, [] pour rien. */
export async function PUT(request: Request, { params }: { params: Promise<{ tag: string }> }) {
  const { session, denied } = await guardApi('OPERATOR');
  if (denied) return denied;
  const tag = decodeURIComponent((await params).tag);
  if (!isSupportTag(tag)) return NextResponse.json({ message: 'Poste support inconnu' }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { targets?: unknown } | null;
  const targets = Array.isArray(body?.targets) ? body.targets.filter((item): item is string => typeof item === 'string') : null;
  if (!targets) return NextResponse.json({ message: 'Périmètre invalide' }, { status: 400 });

  const result = await updatePolicy((raw) => setSupportAccess(raw, tag, targets));
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: result.status });
  await logActivity({
    actor: session!.username,
    action: 'support-access',
    target: `${tag} → ${targets.includes('*') ? 'tout le parc' : targets.length ? targets.join(', ') : 'aucune flotte'}`,
  });
  return NextResponse.json({ ok: true });
}

/** Supprime le poste : ses machines quittent le VPN, puis sa déclaration et sa règle. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ tag: string }> }) {
  const { session, denied } = await guardApi('OPERATOR');
  if (denied) return denied;
  const tag = decodeURIComponent((await params).tag);
  if (!isSupportTag(tag)) return NextResponse.json({ message: 'Poste support inconnu' }, { status: 400 });

  const listed = await listNodes();
  const nodes = listed.ok ? ((await listed.json()) as { nodes: RawHeadscaleNode[] }).nodes : [];
  for (const node of nodes.filter((item) => item.tags.includes(tag))) {
    const removed = await deleteNode(node.id);
    if (!removed.ok) return NextResponse.json({ message: 'Suppression de la machine refusée par Headscale' }, { status: 502 });
  }
  const result = await updatePolicy((raw) => removeSupportPost(raw, tag));
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: result.status });
  await logActivity({ actor: session!.username, action: 'support-delete', target: tag });
  return NextResponse.json({ ok: true });
}
