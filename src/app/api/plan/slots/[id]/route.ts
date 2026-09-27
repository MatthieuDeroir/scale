import { logActivity, prisma } from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Retire un emplacement du plan (la machine qui le pourvoyait n'est pas touchée). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await guardApi('OPERATOR');
  if (denied) return denied;
  const id = Number((await params).id);
  const slot = await prisma.fleetSlot.findUnique({ where: { id } });
  if (!slot) return NextResponse.json({ message: 'Emplacement introuvable' }, { status: 404 });
  await prisma.fleetSlot.delete({ where: { id } });
  await logActivity({ actor: session!.username, action: 'plan-remove', target: `${slot.fleetTag} : ${slot.label}` });
  return NextResponse.json({ ok: true });
}
