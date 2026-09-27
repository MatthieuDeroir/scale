import { getPolicy, isSupportTag, logActivity, parseSupportPosts, planToTemplateItems, prisma, SUPPORT_PREFIX, type TemplateItem } from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { denied } = await guardApi();
  if (denied) return denied;
  const templates = await prisma.fleetTemplate.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(templates.map((template) => ({ ...template, items: JSON.parse(template.items) })));
}

/**
 * Crée un modèle, à partir d'une liste d'emplacements types ou du plan d'une
 * flotte existante (`fromFleet`).
 */
export async function POST(request: Request) {
  const { session, denied } = await guardApi('OPERATOR');
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    description?: string;
    items?: TemplateItem[];
    fromFleet?: string;
  } | null;
  const name = body?.name?.trim();
  if (!name || name.length > 60) return NextResponse.json({ message: 'Nom requis (60 caractères au plus)' }, { status: 400 });
  if (await prisma.fleetTemplate.findUnique({ where: { name } })) {
    return NextResponse.json({ message: 'Un modèle porte déjà ce nom' }, { status: 409 });
  }

  let items: TemplateItem[];
  if (body?.fromFleet) {
    const fleetTag = body.fromFleet;
    items = planToTemplateItems(await prisma.fleetSlot.findMany({ where: { fleetTag }, orderBy: { position: 'asc' } }));
    // Postes support qui prennent en charge la flotte (hors « tout le parc »).
    const policy = await getPolicy();
    if (policy.ok) {
      const { policy: raw } = (await policy.json()) as { policy: string };
      for (const post of parseSupportPosts(raw).filter((item) => item.targets.includes(fleetTag))) {
        items.push({ kind: 'support', productId: null, count: 1, label: post.tag.slice(SUPPORT_PREFIX.length), supportTag: post.tag });
      }
    }
  } else {
    items = (body?.items ?? [])
      .map((item): TemplateItem | null => {
        if (item.kind === 'support') {
          return item.supportTag && isSupportTag(item.supportTag)
            ? { kind: 'support', productId: null, count: 1, label: item.supportTag.slice(SUPPORT_PREFIX.length), supportTag: item.supportTag }
            : null;
        }
        return {
          kind: item.kind === 'hypervision' ? 'hypervision' : 'equipment',
          productId: item.kind === 'hypervision' ? null : Number(item.productId) || null,
          count: Math.min(Math.max(Number(item.count) || 1, 1), 50),
          label: String(item.label ?? '').trim().slice(0, 60),
          ...(item.kind !== 'hypervision' && Number(item.slaves) > 0 ? { slaves: Math.min(Number(item.slaves), 50) } : {}),
        };
      })
      .filter((item): item is TemplateItem => item !== null && Boolean(item.label) && (item.kind !== 'equipment' || Boolean(item.productId)));
  }
  if (items.length === 0) return NextResponse.json({ message: 'Le modèle est vide' }, { status: 400 });

  const template = await prisma.fleetTemplate.create({
    data: { name, description: body?.description?.trim().slice(0, 200) || null, items: JSON.stringify(items) },
  });
  await logActivity({ actor: session!.username, action: 'template-create', target: name });
  return NextResponse.json({ ...template, items });
}
