import { authenticateAgent, prisma } from '@/core';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * L'agent vient chercher son prochain ordre (le plus ancien en attente) ; il
 * passe « en cours » dès qu'il est remis, pour ne jamais être exécuté deux fois.
 */
export async function GET(request: Request) {
  const device = await authenticateAgent(request);
  if (!device) return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });

  const job = await prisma.agentJob.findFirst({
    where: { deviceId: device.deviceId, status: 'pending' },
    orderBy: { createdAt: 'asc' },
  });
  if (!job) return new NextResponse(null, { status: 204 });

  const claimed = await prisma.agentJob.updateMany({
    where: { id: job.id, status: 'pending' },
    data: { status: 'running', startedAt: new Date() },
  });
  if (claimed.count === 0) return new NextResponse(null, { status: 204 });

  return NextResponse.json({ id: job.id, kind: job.kind, package: job.package });
}
