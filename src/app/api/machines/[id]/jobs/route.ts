import { describeNode, getNode, JOB_KINDS, logActivity, PACKAGE_NAME, prisma, type JobKind, type RawHeadscaleNode } from '@/core';
import { requireSession } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Demande une mise à jour à l'agent de la machine. Deux actions seulement :
 * un paquet précis parmi ceux qui ont une mise à jour, ou tous les paquets de
 * la version installée. Jamais de commande libre, jamais de changement de
 * version majeure de l'OS.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession('OPERATOR');
  if (!session.ok) {
    return NextResponse.json(
      { message: session.status === 401 ? 'Non authentifié' : 'Droits insuffisants' },
      { status: session.status }
    );
  }

  const body = (await request.json().catch(() => null)) as { kind?: string; package?: string } | null;
  const kind = body?.kind as JobKind | undefined;
  if (!kind || !(JOB_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ message: 'Action inconnue' }, { status: 400 });
  }

  const { id } = await params;
  const response = await getNode(id);
  if (!response.ok) return NextResponse.json({ message: 'Machine introuvable' }, { status: 404 });
  const { node } = (await response.json()) as { node: RawHeadscaleNode };
  const keyId = node.preAuthKey?.id;
  const device = keyId
    ? await prisma.provisioningDevice.findFirst({ where: { keyId }, include: { inventory: true } })
    : null;
  if (!device?.agentTokenHash) {
    return NextResponse.json({ message: "Pas d'agent Stramscale sur cette machine" }, { status: 409 });
  }

  let packageName: string | null = null;
  if (kind === 'upgrade-package') {
    packageName = body?.package ?? '';
    const upgradable = JSON.parse(device.inventory?.upgradable ?? '[]') as Array<{ name: string }>;
    if (!PACKAGE_NAME.test(packageName) || !upgradable.some((item) => item.name === packageName)) {
      return NextResponse.json({ message: "Ce paquet n'a pas de mise à jour connue" }, { status: 400 });
    }
  }

  const duplicate = await prisma.agentJob.findFirst({
    where: { deviceId: device.deviceId, kind, package: packageName, status: { in: ['pending', 'running'] } },
  });
  if (duplicate) return NextResponse.json({ message: 'Cette mise à jour est déjà demandée' }, { status: 409 });

  const job = await prisma.agentJob.create({
    data: { deviceId: device.deviceId, kind, package: packageName, createdBy: session.session.username },
  });
  await logActivity({
    actor: session.session.username,
    action: kind === 'upgrade-package' ? 'agent-job-package' : 'agent-job-system',
    target: `${await describeNode(id)}${packageName ? ` : ${packageName}` : ''}`,
  });
  return NextResponse.json({ id: job.id, status: job.status });
}
