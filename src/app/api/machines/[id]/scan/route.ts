import { getNode, prisma, scanDevice, type RawHeadscaleNode } from '@/core';
import { requireSession } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Relance l'analyse des failles d'une machine (sur son dernier inventaire). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession('OPERATOR');
  if (!session.ok) {
    return NextResponse.json(
      { message: session.status === 401 ? 'Non authentifié' : 'Droits insuffisants' },
      { status: session.status }
    );
  }
  const response = await getNode((await params).id);
  if (!response.ok) return NextResponse.json({ message: 'Machine introuvable' }, { status: 404 });
  const { node } = (await response.json()) as { node: RawHeadscaleNode };
  const keyId = node.preAuthKey?.id;
  const device = keyId ? await prisma.provisioningDevice.findFirst({ where: { keyId } }) : null;
  if (!device) return NextResponse.json({ message: "Pas d'inventaire pour cette machine" }, { status: 409 });
  await scanDevice(device.deviceId);
  return NextResponse.json({ ok: true });
}
