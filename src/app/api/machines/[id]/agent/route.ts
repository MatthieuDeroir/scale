import {
  describeNode,
  generateAgentToken,
  getNode,
  logActivity,
  prisma,
  publicStramscaleUrl,
  type RawHeadscaleNode,
} from '@/core';
import { requireSession } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Commande d'installation de l'agent pour un équipement déjà raccordé. Émet un
 * nouveau jeton (l'ancien, s'il existait, cesse de fonctionner). Refusé pour
 * un poste d'hypervision : ce n'est pas une machine Stramatel.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession('OPERATOR');
  if (!session.ok) {
    return NextResponse.json(
      { message: session.status === 401 ? 'Non authentifié' : 'Droits insuffisants' },
      { status: session.status }
    );
  }

  const { id } = await params;
  const response = await getNode(id);
  if (!response.ok) return NextResponse.json({ message: 'Machine introuvable' }, { status: 404 });
  const { node } = (await response.json()) as { node: RawHeadscaleNode };
  if (node.tags.includes('tag:hypervision')) {
    return NextResponse.json({ message: "Poste client : pas d'agent Stramscale" }, { status: 409 });
  }
  const keyId = node.preAuthKey?.id;
  if (!keyId) {
    return NextResponse.json({ message: "Machine sans clé d'enregistrement : impossible de la relier" }, { status: 409 });
  }

  const agent = generateAgentToken();
  const existing = await prisma.provisioningDevice.findFirst({ where: { keyId } });
  if (existing) {
    await prisma.provisioningDevice.update({
      where: { deviceId: existing.deviceId },
      data: { agentTokenHash: agent.hash },
    });
  } else {
    await prisma.provisioningDevice.create({
      data: { deviceId: `key-${keyId}`, keyId, agentTokenHash: agent.hash },
    });
  }
  await logActivity({ actor: session.session.username, action: 'agent-install', target: await describeNode(id) });
  return NextResponse.json({
    token: agent.token,
    installUrl: `${publicStramscaleUrl(request)}/api/agent/install`,
  });
}
