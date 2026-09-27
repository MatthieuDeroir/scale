import { isServerSlot, issueMachineKey, KeyIssueError, logActivity, prisma, toHostname } from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Clé pour pourvoir un emplacement : tags de la flotte, `hypervision` pour un
 * poste client, MASTER pour un serveur SL MEDIA ; nom de la machine tiré du
 * libellé. La machine qui s'en servira remplira l'emplacement.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await guardApi('OPERATOR');
  if (denied) return denied;
  const id = Number((await params).id);
  const slot = await prisma.fleetSlot.findUnique({ where: { id }, include: { product: true } });
  if (!slot) return NextResponse.json({ message: 'Emplacement introuvable' }, { status: 404 });
  if (slot.nodeId) return NextResponse.json({ message: 'Emplacement déjà pourvu' }, { status: 409 });

  const body = (await request.json().catch(() => null)) as { expiration?: string } | null;
  const expiration = body?.expiration ? new Date(body.expiration) : null;
  if (!expiration || Number.isNaN(expiration.getTime()) || expiration <= new Date()) {
    return NextResponse.json({ message: 'Date d’expiration invalide' }, { status: 400 });
  }

  const tags = [
    slot.fleetTag,
    ...(slot.kind === 'hypervision' ? ['tag:hypervision'] : []),
    ...(isServerSlot(slot) ? ['tag:master'] : []),
  ];
  try {
    const issued = await issueMachineKey({ tags, expiration, request });
    await prisma.fleetSlot.update({ where: { id }, data: { keyId: issued.id, keyIssuedAt: new Date() } });
    await logActivity({ actor: session!.username, action: 'keys-create', target: `${slot.fleetTag} : ${slot.label}` });
    return NextResponse.json({ ...issued, hostname: toHostname(slot.label) });
  } catch (error) {
    if (error instanceof KeyIssueError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('slot key', error);
    return NextResponse.json({ message: 'Parc non configuré' }, { status: 500 });
  }
}
