import { logActivity, prisma } from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await guardApi('OPERATOR');
  if (denied) return denied;
  const id = Number((await params).id);
  const template = await prisma.fleetTemplate.findUnique({ where: { id } });
  if (!template) return NextResponse.json({ message: 'Modèle introuvable' }, { status: 404 });
  await prisma.fleetTemplate.delete({ where: { id } });
  await logActivity({ actor: session!.username, action: 'template-delete', target: template.name });
  return NextResponse.json({ ok: true });
}
