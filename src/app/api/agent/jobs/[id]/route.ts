import { authenticateAgent, logActivity, MAX_JOB_OUTPUT, prisma } from '@/core';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Compte rendu d'un ordre exécuté : statut et fin de la sortie de la commande. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const device = await authenticateAgent(request);
  if (!device) return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });

  const id = Number((await params).id);
  const body = (await request.json().catch(() => null)) as { status?: string; output?: string } | null;
  if (!Number.isInteger(id) || (body?.status !== 'done' && body?.status !== 'failed')) {
    return NextResponse.json({ message: 'Compte rendu invalide' }, { status: 400 });
  }

  // Un agent ne peut clore que ses propres ordres, et seulement ceux en cours.
  const updated = await prisma.agentJob.updateMany({
    where: { id, deviceId: device.deviceId, status: 'running' },
    data: {
      status: body.status,
      finishedAt: new Date(),
      output: typeof body.output === 'string' ? body.output.slice(-MAX_JOB_OUTPUT) : null,
    },
  });
  if (updated.count === 0) return NextResponse.json({ message: 'Ordre introuvable' }, { status: 404 });

  await logActivity({
    actor: `agent:${device.hostname ?? device.deviceId}`,
    action: body.status === 'done' ? 'agent-job-done' : 'agent-job-failed',
    target: `#${id}`,
  });
  return NextResponse.json({ ok: true });
}
