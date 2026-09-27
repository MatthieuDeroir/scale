import { createSlots, logActivity, parseSupportPosts, prisma, resolveSlots, setSupportAccess, updatePolicy, type TemplateItem } from '@/core';
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
  const items = JSON.parse(template.items) as TemplateItem[];
  // Support : les postes cités prennent en charge la flotte (un poste supprimé depuis est ignoré).
  const supportTags = items.flatMap((item) => (item.kind === 'support' && item.supportTag ? [item.supportTag] : []));
  if (supportTags.length > 0) {
    const result = await updatePolicy((raw) => {
      let next = raw;
      for (const post of parseSupportPosts(raw).filter((item) => supportTags.includes(item.tag))) {
        if (post.targets.includes('*') || post.targets.includes(tag)) continue;
        next = setSupportAccess(next, post.tag, [...post.targets, tag]);
      }
      return next;
    });
    if (!result.ok) return NextResponse.json({ message: result.message }, { status: result.status });
  }
  for (const item of items) {
    if (item.kind !== 'equipment' && item.kind !== 'hypervision') continue;
    // Un produit supprimé du catalogue depuis la création du modèle est ignoré.
    if (item.kind === 'equipment' && (!item.productId || !products.has(item.productId))) continue;
    await createSlots(tag, {
      kind: item.kind,
      productId: item.kind === 'equipment' ? item.productId : null,
      count: item.count,
      label: item.label,
      slaves: item.slaves,
    });
  }
  await logActivity({ actor: session!.username, action: 'plan-template', target: `${tag} ← ${template.name}` });
  return NextResponse.json(await resolveSlots(tag));
}
