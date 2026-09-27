import { logActivity, numberedLabels, prisma, resolveSlots } from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FLEET = /^tag:(interne|flotte-[a-z0-9-]+)$/;

/** Plan de la flotte : emplacements prévus et machine qui pourvoit chacun. */
export async function GET(_request: Request, { params }: { params: Promise<{ tag: string }> }) {
  const { denied } = await guardApi();
  if (denied) return denied;
  const tag = decodeURIComponent((await params).tag);
  if (!FLEET.test(tag)) return NextResponse.json({ message: 'Flotte invalide' }, { status: 400 });
  return NextResponse.json(await resolveSlots(tag));
}

interface NewSlots {
  kind?: string;
  productId?: number | null;
  count?: number;
  label?: string;
  reference?: string;
}

/** Ajoute des emplacements : `count` emplacements identiques, numérotés. */
export async function POST(request: Request, { params }: { params: Promise<{ tag: string }> }) {
  const { session, denied } = await guardApi('OPERATOR');
  if (denied) return denied;
  const tag = decodeURIComponent((await params).tag);
  if (!FLEET.test(tag)) return NextResponse.json({ message: 'Flotte invalide' }, { status: 400 });
  const body = (await request.json().catch(() => null)) as NewSlots | null;

  const kind = body?.kind === 'hypervision' ? 'hypervision' : 'equipment';
  const count = Math.min(Math.max(Number(body?.count ?? 1), 1), 50);
  const product = kind === 'equipment' && body?.productId ? await prisma.product.findUnique({ where: { id: body.productId } }) : null;
  if (kind === 'equipment' && !product) return NextResponse.json({ message: 'Choisissez un produit' }, { status: 400 });
  const label = (body?.label?.trim() || (kind === 'hypervision' ? "Poste d'hypervision" : product!.name)).slice(0, 60);

  const existing = await prisma.fleetSlot.findMany({ where: { fleetTag: tag }, select: { label: true, position: true } });
  const labels = numberedLabels(label, count, existing.map((slot) => slot.label));
  const start = existing.reduce((max, slot) => Math.max(max, slot.position), 0) + 1;
  await prisma.fleetSlot.createMany({
    data: labels.map((item, index) => ({
      fleetTag: tag,
      kind,
      productId: product?.id ?? null,
      label: item,
      reference: body?.reference?.trim().slice(0, 60) || null,
      position: start + index,
    })),
  });
  await logActivity({ actor: session!.username, action: 'plan-add', target: `${tag} : ${count} × ${label}` });
  return NextResponse.json(await resolveSlots(tag));
}
