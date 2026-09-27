import { logActivity, prisma } from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await guardApi('OPERATOR');
  if (denied) return denied;
  const id = Number((await params).id);
  const body = (await request.json().catch(() => null)) as { name?: string; category?: string; role?: string | null } | null;
  const data: { name?: string; category?: string; role?: string | null } = {};
  if (body?.name !== undefined) {
    const name = body.name.trim();
    if (!name || name.length > 60) return NextResponse.json({ message: 'Nom invalide' }, { status: 400 });
    data.name = name;
  }
  if (body?.category !== undefined) data.category = body.category === 'sur-mesure' ? 'sur-mesure' : 'gamme';
  if (body?.role !== undefined) data.role = body.role === 'master' || body.role === 'slave' ? body.role : null;
  const product = await prisma.product.update({ where: { id }, data }).catch(() => null);
  if (!product) return NextResponse.json({ message: 'Produit introuvable ou nom déjà pris' }, { status: 400 });
  await logActivity({ actor: session!.username, action: 'product-update', target: product.name });
  return NextResponse.json(product);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await guardApi('OPERATOR');
  if (denied) return denied;
  const id = Number((await params).id);
  const product = await prisma.product.findUnique({ where: { id }, include: { _count: { select: { machines: true } } } });
  if (!product) return NextResponse.json({ message: 'Produit introuvable' }, { status: 404 });
  if (product._count.machines > 0) {
    return NextResponse.json({ message: 'Des machines portent ce produit : changez-les d’abord' }, { status: 409 });
  }
  await prisma.product.delete({ where: { id } });
  await logActivity({ actor: session!.username, action: 'product-delete', target: product.name });
  return NextResponse.json({ ok: true });
}
