import {
  createPreAuthKey,
  ensureSystemTagsInPolicy,
  listPreAuthKeys,
  logActivity,
  mapNewPreAuthKey,
  mapPreAuthKey,
  SYSTEM_TAGS,
  type RawHeadscalePreAuthKey,
} from '@/core';
import { requireSession } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireSession();
  if (!session.ok) {
    return NextResponse.json({ message: 'Non authentifié' }, { status: session.status });
  }

  const response = await listPreAuthKeys();
  if (!response.ok) {
    return NextResponse.json({ message: 'Headscale indisponible' }, { status: 502 });
  }

  const { preAuthKeys } = (await response.json()) as { preAuthKeys: RawHeadscalePreAuthKey[] };
  return NextResponse.json(preAuthKeys.map(mapPreAuthKey));
}

interface CreateKeyBody {
  tags?: string[];
  reusable?: boolean;
  expiration?: string;
}

export async function POST(request: Request) {
  const session = await requireSession('OPERATOR');
  if (!session.ok) {
    return NextResponse.json(
      { message: session.status === 401 ? 'Non authentifié' : 'Droits insuffisants' },
      { status: session.status }
    );
  }

  const body = (await request.json().catch(() => null)) as CreateKeyBody | null;
  const tags = body?.tags?.filter((tag) => tag.startsWith('tag:')) ?? [];
  if (tags.length === 0) {
    return NextResponse.json({ message: 'Un tag valide est requis' }, { status: 400 });
  }

  const expiration = body?.expiration ? new Date(body.expiration) : null;
  if (!expiration || Number.isNaN(expiration.getTime()) || expiration <= new Date()) {
    return NextResponse.json({ message: 'Date d’expiration invalide' }, { status: 400 });
  }

  let response: Response;
  try {
    if (tags.some((tag) => (SYSTEM_TAGS as readonly string[]).includes(tag))) {
      await ensureSystemTagsInPolicy();
    }
    response = await createPreAuthKey({
      tags,
      reusable: body?.reusable ?? false,
      expiration: expiration.toISOString(),
    });
  } catch (error) {
    console.error('createPreAuthKey', error);
    return NextResponse.json({ message: 'Parc non configuré' }, { status: 500 });
  }
  if (!response.ok) {
    return NextResponse.json({ message: 'Émission refusée par Headscale' }, { status: 502 });
  }

  const { preAuthKey } = (await response.json()) as { preAuthKey: RawHeadscalePreAuthKey };
  await logActivity({
    actor: session.session.username,
    action: 'keys-create',
    target: tags.join(','),
  });
  return NextResponse.json({
    ...mapNewPreAuthKey(preAuthKey),
    // Adresse que la machine cliente doit joindre (≠ HEADSCALE_API_URL, vue
    // depuis ce serveur) — sert à afficher la commande d'installation.
    loginServer: process.env.HEADSCALE_PUBLIC_URL || process.env.HEADSCALE_API_URL,
  });
}
