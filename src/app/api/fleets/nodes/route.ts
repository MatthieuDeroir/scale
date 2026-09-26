import { mapNode, listNodes, prisma, type RawHeadscaleNode } from '@/core';
import { requireSession } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Proxy server-side vers l'API REST de Headscale : la clé d'API
 * (`HEADSCALE_API_KEY`) ne doit jamais atteindre le navigateur, donc jamais
 * d'appel direct depuis le composant client (F4 — le seul accès à l'UI est
 * Stramatel, authentifié par session).
 */
export async function GET() {
  const session = await requireSession();
  if (!session.ok) {
    return NextResponse.json({ message: 'Non authentifié' }, { status: session.status });
  }

  let response: Response;
  try {
    response = await listNodes();
  } catch {
    return NextResponse.json({ message: 'Parc non configuré' }, { status: 500 });
  }
  if (!response.ok) {
    return NextResponse.json({ message: 'Headscale indisponible' }, { status: 502 });
  }

  const { nodes } = (await response.json()) as { nodes: RawHeadscaleNode[] };
  // Enrôlement automatique relié par la clé émise : numéro de série et modèle
  // déclarés par la machine au premier démarrage.
  const devices = await prisma.provisioningDevice.findMany({ where: { keyId: { not: null } } });
  const byKey = new Map(devices.map((device) => [device.keyId, device]));
  const baseDomain = process.env.HEADSCALE_BASE_DOMAIN;
  return NextResponse.json(
    nodes.map((raw) => {
      const node = mapNode(raw);
      const device = node.keyId ? byKey.get(node.keyId) : undefined;
      return {
        ...node,
        // Nom MagicDNS : résolu seulement par les machines qui voient celle-ci (ACL).
        dnsName: baseDomain ? `${node.givenName || node.name}.${baseDomain}` : null,
        enrollment: device
          ? {
              deviceId: device.deviceId,
              serial: device.serial,
              model: device.model,
              enrolledAt: device.enrolledAt.toISOString(),
            }
          : null,
      };
    })
  );
}
