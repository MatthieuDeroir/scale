import { logActivity, numberedLabels, prisma, resolveSlots, type TemplateItem } from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Applique un modèle à la flotte : ajoute ses emplacements au plan existant. */
export async function POST(request: Request, { params }: { params: Promise<{ tag: string }> }) {
  const { session, denied } = await guardApi('OPERATOR');
  if (denied) return denied;
  const tag = decodeURIComponent((await params).tag);
  const body = (await request.json().catch(() => null)) as { templateId?: number } | null;
  const template = body?.templateId ? await prisma.fleetTemplate.findUnique({ where: { id: body.templateId } }) : null;
  if (!template) return NextResponse.json({ message: 'Modèle introuvable' }, { status: 404 });

  const items = JSON.parse(template.items) as TemplateItem[];
  const existing = await prisma.fleetSlot.findMany({ where: { fleetTag: tag }, select: { label: true, position: true } });
  const taken = existing.map((slot) => slot.label);
  let position = existing.reduce((max, slot) => Math.max(max, slot.position), 0);
  const products = new Set((await prisma.product.findMany({ select: { id: true } })).map((product) => product.id));
  const data = [];
  for (const item of items) {
    // Un produit supprimé du catalogue depuis la création du modèle est ignoré.
    if (item.kind === 'equipment' && (!item.productId || !products.has(item.productId))) continue;
    for (const label of numberedLabels(item.label, item.count, taken)) {
      taken.push(label);
      data.push({ fleetTag: tag, kind: item.kind, productId: item.kind === 'equipment' ? item.productId : null, label, position: ++position });
    }
  }
  await prisma.fleetSlot.createMany({ data });
  await logActivity({ actor: session!.username, action: 'plan-template', target: `${tag} ← ${template.name}` });
  return NextResponse.json(await resolveSlots(tag));
}
