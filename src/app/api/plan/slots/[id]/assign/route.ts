import { assignNodeToSlot, logActivity } from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Affecte une machine en attente (« À assigner ») à un emplacement. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await guardApi('OPERATOR');
  if (denied) return denied;
  const id = Number((await params).id);
  const body = (await request.json().catch(() => null)) as { nodeId?: string } | null;
  if (!body?.nodeId) return NextResponse.json({ message: 'Machine requise' }, { status: 400 });
  try {
    const result = await assignNodeToSlot(id, body.nodeId);
    await logActivity({
      actor: session!.username,
      action: 'plan-assign',
      target: `${result.previous} #${body.nodeId} → ${result.fleetTag} : ${result.label}`,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Affectation refusée' }, { status: 400 });
  }
}
