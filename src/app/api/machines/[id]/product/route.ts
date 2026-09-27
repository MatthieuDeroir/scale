import {
  describeNode,
  ensureSystemTagsInPolicy,
  getNode,
  logActivity,
  prisma,
  setMachineProduct,
  setNodeTags,
  type RawHeadscaleNode,
} from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Produit d'une machine (gamme ou sur mesure + n° d'affaire). Un produit
 * « master » pose le tag MASTER, un produit « slave » le retire.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await guardApi('OPERATOR');
  if (denied) return denied;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { productId?: number | null; reference?: string } | null;

  const response = await getNode(id);
  if (!response.ok) return NextResponse.json({ message: 'Machine introuvable' }, { status: 404 });
  const { node } = (await response.json()) as { node: RawHeadscaleNode };
  if (node.tags.includes('tag:hypervision')) {
    return NextResponse.json({ message: 'Poste client : pas de produit Stramatel' }, { status: 409 });
  }

  const productId = body?.productId ?? null;
  const product = productId ? await prisma.product.findUnique({ where: { id: productId } }) : null;
  if (productId && !product) return NextResponse.json({ message: 'Produit inconnu' }, { status: 400 });
  const reference = body?.reference?.trim().slice(0, 60) || null;

  if (product?.role) {
    const master = product.role === 'master';
    if (master !== node.tags.includes('tag:master')) {
      if (master) await ensureSystemTagsInPolicy();
      const tags = master ? [...node.tags, 'tag:master'] : node.tags.filter((tag) => tag !== 'tag:master');
      const tagged = await setNodeTags(id, tags);
      if (!tagged.ok) return NextResponse.json({ message: 'Rôle refusé par Headscale' }, { status: 502 });
    }
  }
  await setMachineProduct(id, productId, reference);
  await logActivity({
    actor: session!.username,
    action: 'machine-product',
    target: `${await describeNode(id)} → ${product?.name ?? 'aucun'}${reference ? ` (${reference})` : ''}`,
  });
  return NextResponse.json({ ok: true });
}
