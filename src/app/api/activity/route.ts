import { activityRetentionDays, prisma } from '@/core';
import { requireSession } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Filtrage côté écran : 1 000 événements tiennent sans pagination serveur.
const MAX_EVENTS = 1000;

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

  return NextResponse.json({
    retentionDays: activityRetentionDays(),
    total: await prisma.activityLog.count(),
    events: events.map((event) => ({
      id: event.id,
      at: event.at.toISOString(),
      actor: event.actor,
      action: event.action,
      target: event.target,
    })),
  });
}
