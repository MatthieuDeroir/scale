import { logActivity, prisma, VEX_JUSTIFICATIONS, VEX_STATUSES, type VexJustification, type VexStatus } from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,80}$/;

/**
 * Décision de tri d'une faille (VEX), pour tout le parc (`productId` nul) ou
 * pour un produit. Une seule décision par faille et par portée : la nouvelle
 * remplace l'ancienne, le journal garde la trace.
 */
export async function POST(request: Request) {
  const { session, denied } = await guardApi('OPERATOR');
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as {
    vulnKey?: string;
    productId?: number | null;
    status?: string;
    justification?: string | null;
    note?: string;
  } | null;

  const vulnKey = body?.vulnKey?.trim() ?? '';
  if (!KEY.test(vulnKey)) return NextResponse.json({ message: 'Faille invalide' }, { status: 400 });
  const status = body?.status as VexStatus;
  if (!VEX_STATUSES.includes(status)) return NextResponse.json({ message: 'Statut invalide' }, { status: 400 });
  const justification = (body?.justification || null) as VexJustification | null;
  if (status === 'not_affected' && (!justification || !VEX_JUSTIFICATIONS.includes(justification))) {
    return NextResponse.json({ message: 'Un « non concerné » demande une justification' }, { status: 400 });
  }
  const note = body?.note?.trim().slice(0, 1000) || null;
  const productId = body?.productId ? Number(body.productId) : null;
  const product = productId ? await prisma.product.findUnique({ where: { id: productId } }) : null;
  if (productId && !product) return NextResponse.json({ message: 'Produit inconnu' }, { status: 400 });

  const data = {
    status,
    justification: status === 'not_affected' ? justification : null,
    note,
    author: session!.username,
  };
  const existing = await prisma.vulnAssessment.findFirst({ where: { vulnKey, productId } });
  const saved = existing
    ? await prisma.vulnAssessment.update({ where: { id: existing.id }, data })
    : await prisma.vulnAssessment.create({ data: { vulnKey, productId, ...data } });

  await logActivity({
    actor: session!.username,
    action: 'vuln-assess',
    target: `${vulnKey} (${product?.name ?? 'tout le parc'}) : ${status}${data.justification ? `, ${data.justification}` : ''}`,
  });
  return NextResponse.json({ id: saved.id });
}
