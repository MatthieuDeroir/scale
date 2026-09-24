import { prisma } from '@/core';
import { requireSession } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAX_EVENTS = 200;

export async function GET() {
  const session = await requireSession('ADMIN');
  if (!session.ok) {
    return NextResponse.json(
      { message: session.status === 401 ? 'Non authentifié' : 'Droits insuffisants' },
      { status: session.status }
    );
  }

  const events = await prisma.activityLog.findMany({
    orderBy: { at: 'desc' },
    take: MAX_EVENTS,
  });

  return NextResponse.json(
    events.map((event) => ({
      id: event.id,
      at: event.at.toISOString(),
      actor: event.actor,
      action: event.action,
      target: event.target,
    }))
  );
}
