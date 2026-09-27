import { prisma } from '@/core';
import { requireSession } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Dernières mises à jour demandées sur tout le parc (tableau de bord). */
export async function GET() {
  const session = await requireSession();
  if (!session.ok) {
    return NextResponse.json({ message: 'Non authentifié' }, { status: session.status });
  }
  const jobs = await prisma.agentJob.findMany({ orderBy: { createdAt: 'desc' }, take: 8 });
  return NextResponse.json(
    jobs.map((job) => ({
      id: job.id,
      deviceId: job.deviceId,
      kind: job.kind,
      package: job.package,
      status: job.status,
      createdBy: job.createdBy,
      createdAt: job.createdAt.toISOString(),
      finishedAt: job.finishedAt?.toISOString() ?? null,
    }))
  );
}
