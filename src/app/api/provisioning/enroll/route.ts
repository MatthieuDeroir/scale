import { timingSafeEqual } from 'node:crypto';
import {
  createPreAuthKey,
  ensureSystemTagsInPolicy,
  logActivity,
  mapNewPreAuthKey,
} from '@/core';
import { prisma } from '@/core';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const KEY_LIFETIME_MS = 60 * 60 * 1000; // 1h : consommée immédiatement au premier boot.

/**
 * Endpoint public — une machine qui vient de démarrer n'a pas de session
 * Stramatel. Le seul verrou est un secret de fabrication partagé, embarqué
 * dans l'image dorée (même valeur sur tous les clones, prouve seulement
 * « cet appareil vient d'une image Stramatel », pas une identité
 * individuelle — voir CAHIER_DES_CHARGES.md §2 F1).
 */
function authorized(request: Request): boolean {
  const secret = process.env.PROVISIONING_SECRET;
  if (!secret) return false;

  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';

  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    deviceId?: string;
    serial?: string;
    model?: string;
    hostname?: string;
  } | null;
  const deviceId = body?.deviceId?.trim();
  // Champs libres déclarés par la machine : bornés, jamais interprétés.
  const clean = (value?: string) => value?.trim().slice(0, 128) || null;
  if (!deviceId) {
    return NextResponse.json({ message: 'deviceId requis' }, { status: 400 });
  }

  const existing = await prisma.provisioningDevice.findUnique({ where: { deviceId } });
  if (existing) {
    return NextResponse.json({ message: 'Machine déjà enrôlée' }, { status: 409 });
  }

  let response: Response;
  try {
    await ensureSystemTagsInPolicy();
    // `tag:a-assigner` et pas `tag:interne` : une machine qui vient de
    // démarrer n'a encore aucune raison de voir le parc. Avec `tag:interne`,
    // un secret de fabrication fuité donnait un accès total à toutes les
    // flottes. Ici, aucune règle ACL sortante tant qu'un opérateur ne l'a pas
    // rangée dans une flotte (écran « À assigner »).
    response = await createPreAuthKey({
      tags: ['tag:a-assigner'],
      reusable: false,
      expiration: new Date(Date.now() + KEY_LIFETIME_MS).toISOString(),
    });
  } catch (error) {
    console.error('provisioning/enroll: createPreAuthKey', error);
    return NextResponse.json({ message: 'Parc non configuré' }, { status: 500 });
  }
  if (!response.ok) {
    return NextResponse.json({ message: 'Émission refusée par Headscale' }, { status: 502 });
  }

  const { preAuthKey } = (await response.json()) as { preAuthKey: Parameters<typeof mapNewPreAuthKey>[0] };
  const serial = clean(body?.serial);
  await prisma.provisioningDevice.create({
    data: {
      deviceId,
      keyId: preAuthKey.id,
      serial,
      model: clean(body?.model),
      hostname: clean(body?.hostname),
    },
  });
  await logActivity({
    actor: 'provisioning',
    action: 'provisioning-enroll',
    target: serial ? `${deviceId} (n° ${serial})` : deviceId,
  });

  return NextResponse.json({
    authKey: mapNewPreAuthKey(preAuthKey).key,
    loginServer: process.env.HEADSCALE_PUBLIC_URL || process.env.HEADSCALE_API_URL,
  });
}
