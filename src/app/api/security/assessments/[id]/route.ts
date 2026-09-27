import { logActivity, prisma } from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Retire une décision de tri : la faille redevient à traiter pour cette portée. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await guardApi('OPERATOR');
  if (denied) return denied;
  const id = Number((await params).id);
  const row = await prisma.vulnAssessment.findUnique({ where: { id }, include: { product: true } });
  if (!row) return NextResponse.json({ message: 'Décision introuvable' }, { status: 404 });
  await prisma.vulnAssessment.delete({ where: { id } });
  await logActivity({
    actor: session!.username,
    action: 'vuln-unassess',
    target: `${row.vulnKey} (${row.product?.name ?? 'tout le parc'})`,
  });
  return NextResponse.json({ ok: true });
}
