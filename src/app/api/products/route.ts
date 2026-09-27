import { ensureDefaultProducts, logActivity, prisma } from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { denied } = await guardApi();
  if (denied) return denied;
  await ensureDefaultProducts();
  const products = await prisma.product.findMany({
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { machines: true } } },
  });
  return NextResponse.json(
    products.map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      master: product.master,
      slaves: product.slaves,
      machines: product._count.machines,
    }))
  );
}

export async function POST(request: Request) {
  const { session, denied } = await guardApi('OPERATOR');
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { name?: string; category?: string; master?: boolean; slaves?: boolean } | null;
  const name = body?.name?.trim();
  if (!name || name.length > 60) return NextResponse.json({ message: 'Nom requis (60 caractères au plus)' }, { status: 400 });
  const category = body?.category === 'sur-mesure' ? 'sur-mesure' : 'gamme';
  const slaves = body?.slaves === true;
  // Un produit à REPLICA est forcément maître.
  const master = slaves || body?.master === true;
  if (await prisma.product.findUnique({ where: { name } })) {
    return NextResponse.json({ message: 'Ce produit existe déjà' }, { status: 409 });
  }
  const product = await prisma.product.create({ data: { name, category, master, slaves } });
  await logActivity({ actor: session!.username, action: 'product-create', target: name });
  return NextResponse.json(product);
}
