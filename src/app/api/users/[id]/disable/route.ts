import { prisma } from '@/core';
import { requireSession } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession('ADMIN');
  if (!session.ok) {
    return NextResponse.json(
      { message: session.status === 401 ? 'Non authentifié' : 'Droits insuffisants' },
      { status: session.status }
    );
  }

  const { id } = await params;
  const userId = Number.parseInt(id, 10);
  if (userId === session.session.userId) {
    return NextResponse.json(
      { message: 'Impossible de désactiver son propre compte' },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({ where: { id: userId }, data: { disabled: true } });
  return NextResponse.json({ id: user.id, disabled: user.disabled });
}
