import { createSlots, logActivity, prisma, resolveSlots, type TemplateItem } from '@/core';
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

  const products = new Set((await prisma.product.findMany({ select: { id: true } })).map((product) => product.id));
  for (const item of JSON.parse(template.items) as TemplateItem[]) {
    // Un produit supprimé du catalogue depuis la création du modèle est ignoré.
    if (item.kind === 'equipment' && (!item.productId || !products.has(item.productId))) continue;
    await createSlots(tag, { ...item, productId: item.kind === 'equipment' ? item.productId : null });
  }
  await logActivity({ actor: session!.username, action: 'plan-template', target: `${tag} ← ${template.name}` });
  return NextResponse.json(await resolveSlots(tag));
}
