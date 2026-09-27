import { logActivity, prisma } from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await guardApi('OPERATOR');
  if (denied) return denied;
  const id = Number((await params).id);
  const link = await prisma.productLink.findUnique({ where: { id }, include: { from: true, to: true } });
  if (!link) return NextResponse.json({ message: 'Flux introuvable' }, { status: 404 });
  await prisma.productLink.delete({ where: { id } });
  await logActivity({ actor: session!.username, action: 'product-unlink', target: `${link.from.name} → ${link.to.name}` });
  return NextResponse.json({ ok: true });
}
