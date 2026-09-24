import { mapNode, getNode, deleteNode, type RawHeadscaleNode } from '@/core';
import { requireSession } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session.ok) {
    return NextResponse.json({ message: 'Non authentifié' }, { status: session.status });
  }

  const { id } = await params;
  const response = await getNode(id);
  if (response.status === 404) {
    return NextResponse.json({ message: 'Machine introuvable' }, { status: 404 });
  }
  if (!response.ok) {
    return NextResponse.json({ message: 'Headscale indisponible' }, { status: 502 });
  }

  const { node } = (await response.json()) as { node: RawHeadscaleNode };
  return NextResponse.json(mapNode(node));
}

/** Suppression définitive — réservée aux opérateurs et administrateurs. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession('OPERATOR');
  if (!session.ok) {
    return NextResponse.json(
      { message: session.status === 401 ? 'Non authentifié' : 'Droits insuffisants' },
      { status: session.status }
    );
  }

  const { id } = await params;
  const response = await deleteNode(id);
  if (!response.ok) {
    return NextResponse.json({ message: 'Suppression refusée par Headscale' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
