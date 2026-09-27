import { listNodes, prisma, resolveSlots, type RawHeadscaleNode } from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Avancement du plan de chaque flotte (tableau de bord). */
export async function GET() {
  const { denied } = await guardApi();
  if (denied) return denied;
  const response = await listNodes();
  const nodes = response.ok ? ((await response.json()) as { nodes: RawHeadscaleNode[] }).nodes : [];
  const tags = (await prisma.fleetSlot.findMany({ distinct: ['fleetTag'], select: { fleetTag: true } })).map(
    (item) => item.fleetTag
  );
  const plans = await Promise.all(
    tags.map(async (fleetTag) => {
      const slots = await resolveSlots(fleetTag, nodes);
      return {
        fleetTag,
        total: slots.length,
        filled: slots.filter((slot) => slot.machine).length,
        keyIssued: slots.filter((slot) => !slot.machine && slot.keyIssuedAt).length,
      };
    })
  );
  return NextResponse.json(plans);
}
