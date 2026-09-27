import {
  describeNode,
  ensureSystemTagsInPolicy,
  getNode,
  listNodes,
  logActivity,
  prisma,
  setMachineProduct,
  setNodeTags,
  SERVER_TAG,
  type RawHeadscaleNode,
} from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FLEET_TAG = /^tag:(interne|flotte-.+)$/;

/**
 * Produit d'une machine (gamme ou produit spécifique) et n° d'affaire. Un
 * produit maître pose le tag SERVEUR ; pour un produit à REPLICA (SL MEDIA), le
 * rôle : maître, ou REPLICA rattaché à un maître de la même flotte.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await guardApi('OPERATOR');
  if (denied) return denied;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    productId?: number;
    reference?: string;
    role?: 'server' | 'slave';
    masterNodeId?: string | null;
  } | null;

  const response = await getNode(id);
  if (!response.ok) return NextResponse.json({ message: 'Machine introuvable' }, { status: 404 });
  const { node } = (await response.json()) as { node: RawHeadscaleNode };
  if (node.tags.includes('tag:hypervision')) {
    return NextResponse.json({ message: 'Poste client : pas de produit Stramatel' }, { status: 409 });
  }

  const product = await prisma.product.findUnique({ where: { id: Number(body?.productId) || 0 } });
  if (!product) return NextResponse.json({ message: 'Choisissez un produit' }, { status: 400 });
  const reference = body?.reference?.trim().slice(0, 60) || null;
  const master = product.master && !(product.slaves && body?.role === 'slave');

  let masterNodeId: string | null = null;
  if (product.slaves && !master && body?.masterNodeId) {
    // Le serveur doit être un SL MEDIA serveur de la même flotte.
    const fleet = node.tags.find((tag) => FLEET_TAG.test(tag));
    const listed = await listNodes();
    const nodes = listed.ok ? ((await listed.json()) as { nodes: RawHeadscaleNode[] }).nodes : [];
    const server = nodes.find((item) => item.id === body.masterNodeId);
    const serverProduct = server ? await prisma.machineProduct.findUnique({ where: { nodeId: server.id } }) : null;
    if (!server || server.id === id || !fleet || !server.tags.includes(fleet) || !server.tags.includes(SERVER_TAG) || serverProduct?.productId !== product.id) {
      return NextResponse.json({ message: `Serveur ${product.name} introuvable dans cette flotte` }, { status: 400 });
    }
    masterNodeId = server.id;
  }

  if (master !== node.tags.includes(SERVER_TAG)) {
    if (master) await ensureSystemTagsInPolicy();
    const tags = master ? [...node.tags, SERVER_TAG] : node.tags.filter((tag) => tag !== SERVER_TAG);
    const tagged = await setNodeTags(id, tags);
    if (!tagged.ok) return NextResponse.json({ message: 'Rôle refusé par Headscale' }, { status: 502 });
  }
  await setMachineProduct(id, product.id, reference, masterNodeId);
  // Une machine qui cesse d'être serveur libère ses REPLICA.
  if (!master) await prisma.machineProduct.updateMany({ where: { masterNodeId: id }, data: { masterNodeId: null } });

  await logActivity({
    actor: session!.username,
    action: 'machine-product',
    target: `${await describeNode(id)} → ${product.name}${product.slaves ? (master ? ' maître' : ' REPLICA') : ''}${reference ? ` (${reference})` : ''}`,
  });
  return NextResponse.json({ ok: true });
}
