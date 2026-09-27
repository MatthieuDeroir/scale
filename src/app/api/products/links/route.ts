import { logActivity, normalizePorts, prisma } from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { denied } = await guardApi();
  if (denied) return denied;
  const links = await prisma.productLink.findMany({ orderBy: { id: 'asc' } });
  return NextResponse.json(links.map(({ id, fromId, toId, ports, note }) => ({ id, fromId, toId, ports, note })));
}

/** Crée ou met à jour le flux d'un produit vers un autre (un seul par sens). */
export async function POST(request: Request) {
  const { session, denied } = await guardApi('OPERATOR');
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { fromId?: number; toId?: number; ports?: string; note?: string } | null;
  const [from, to] = await Promise.all([
    prisma.product.findUnique({ where: { id: Number(body?.fromId) || 0 } }),
    prisma.product.findUnique({ where: { id: Number(body?.toId) || 0 } }),
  ]);
  if (!from || !to) return NextResponse.json({ message: 'Produit inconnu' }, { status: 400 });
  if (from.id === to.id && !from.slaves) {
    return NextResponse.json({ message: 'Un produit ne se joint lui-même que pour relier ses REPLICA à leur serveur' }, { status: 400 });
  }
  let ports: string;
  try {
    ports = normalizePorts(body?.ports ?? '*');
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Ports invalides' }, { status: 400 });
  }
  const note = body?.note?.trim().slice(0, 120) || null;
  const link = await prisma.productLink.upsert({
    where: { fromId_toId: { fromId: from.id, toId: to.id } },
    create: { fromId: from.id, toId: to.id, ports, note },
    update: { ports, note },
  });
  await logActivity({ actor: session!.username, action: 'product-link', target: `${from.name} → ${to.name} : ${ports}` });
  return NextResponse.json({ id: link.id, fromId: link.fromId, toId: link.toId, ports: link.ports, note: link.note });
}
