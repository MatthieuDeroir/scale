import { authenticateAgent, inventorySchema, prisma } from '@/core';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** L'agent envoie l'inventaire de sa machine : à l'enrôlement, puis chaque jour. */
export async function POST(request: Request) {
  const device = await authenticateAgent(request);
  if (!device) return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });

  const parsed = inventorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: 'Inventaire invalide' }, { status: 400 });
  }
  const { packages, upgradable, ...fields } = parsed.data;
  const data = {
    ...fields,
    reportedAt: new Date(),
    packages: JSON.stringify(packages),
    upgradable: JSON.stringify(upgradable),
  };
  await prisma.machineInventory.upsert({
    where: { deviceId: device.deviceId },
    create: { deviceId: device.deviceId, ...data },
    update: data,
  });
  return NextResponse.json({ ok: true });
}
