import { getNode, mapNode, prisma, severityOf, type RawHeadscaleNode } from '@/core';
import { requireSession } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Fiche complète d'une machine : Headscale + enrôlement + inventaire + mises à jour. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session.ok) {
    return NextResponse.json({ message: 'Non authentifié' }, { status: session.status });
  }

  const { id } = await params;
  const response = await getNode(id);
  if (response.status === 404) return NextResponse.json({ message: 'Machine introuvable' }, { status: 404 });
  if (!response.ok) return NextResponse.json({ message: 'Headscale indisponible' }, { status: 502 });

  const { node: raw } = (await response.json()) as { node: RawHeadscaleNode };
  const node = mapNode(raw);
  const device = node.keyId
    ? await prisma.provisioningDevice.findFirst({
        where: { keyId: node.keyId },
        include: { inventory: true, vulnScan: true, jobs: { orderBy: { createdAt: 'desc' }, take: 20 } },
      })
    : null;
  const baseDomain = process.env.HEADSCALE_BASE_DOMAIN;
  const product = await prisma.machineProduct.findUnique({ where: { nodeId: node.id }, include: { product: true } });

  // Failles : résultat de la dernière analyse + fiches des failles citées.
  let vulns = null;
  if (device?.vulnScan) {
    const scan = device.vulnScan;
    const parsed = JSON.parse(scan.results || '{}') as { summary?: unknown; packages?: Array<{ fixed: string[]; remaining: string[] }> };
    const ids = [...new Set((parsed.packages ?? []).flatMap((item) => [...item.fixed, ...item.remaining]))];
    const records = await prisma.osvVuln.findMany({ where: { id: { in: ids } } });
    vulns = {
      scannedAt: scan.scannedAt.toISOString(),
      ecosystem: scan.ecosystem,
      error: scan.error,
      summary: parsed.summary ?? null,
      packages: parsed.packages ?? [],
      details: Object.fromEntries(
        records.map((record) => [
          record.id,
          {
            summary: record.summary,
            aliases: JSON.parse(record.aliases),
            severity: severityOf(
              (JSON.parse(record.urgency) as Record<string, string>)[scan.ecosystem ?? ''],
              record.cvssScore
            ),
            cve: record.cve,
            cvss: record.cvssScore,
            published: record.published?.toISOString() ?? null,
          },
        ])
      ),
    };
  }

  return NextResponse.json({
    ...node,
    dnsName: baseDomain ? `${node.givenName || node.name}.${baseDomain}` : null,
    enrollment: device
      ? {
          deviceId: device.deviceId,
          serial: device.serial,
          model: device.model,
          enrolledAt: device.enrolledAt.toISOString(),
        }
      : null,
    agent: Boolean(device?.agentTokenHash),
    product: product
      ? {
          id: product.productId,
          name: product.product.name,
          reference: product.reference,
          master: product.product.master,
          slaves: product.product.slaves,
          masterNodeId: product.masterNodeId,
        }
      : null,
    vulns,
    inventory: device?.inventory
      ? {
          ...device.inventory,
          reportedAt: device.inventory.reportedAt.toISOString(),
          packages: JSON.parse(device.inventory.packages),
          upgradable: JSON.parse(device.inventory.upgradable),
        }
      : null,
    jobs: (device?.jobs ?? []).map((job) => ({
      ...job,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
      finishedAt: job.finishedAt?.toISOString() ?? null,
    })),
  });
}
