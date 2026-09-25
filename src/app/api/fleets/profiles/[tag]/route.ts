import { logActivity, prisma } from '@/core';
import { requireSession } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FIELDS = ['displayName', 'sector', 'contact', 'phone', 'email', 'site', 'reference', 'notes'] as const;
const LIMITS: Record<(typeof FIELDS)[number], number> = {
  displayName: 80,
  sector: 60,
  contact: 120,
  phone: 40,
  email: 120,
  site: 200,
  reference: 60,
  notes: 2000,
};

export async function PUT(request: Request, { params }: { params: Promise<{ tag: string }> }) {
  const session = await requireSession('OPERATOR');
  if (!session.ok) {
    return NextResponse.json(
      { message: session.status === 401 ? 'Non authentifié' : 'Droits insuffisants' },
      { status: session.status }
    );
  }

  const tag = decodeURIComponent((await params).tag);
  if (!/^tag:(interne|flotte-[a-z0-9-]+)$/.test(tag)) {
    return NextResponse.json({ message: 'Flotte invalide' }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: 'Requête invalide' }, { status: 400 });

  const data: Record<string, string | null> = {};
  for (const field of FIELDS) {
    const value = body[field];
    if (value === undefined) continue;
    if (value !== null && typeof value !== 'string') {
      return NextResponse.json({ message: `Champ ${field} invalide` }, { status: 400 });
    }
    const trimmed = value?.trim() ?? '';
    if (trimmed.length > LIMITS[field]) {
      return NextResponse.json({ message: `Champ ${field} trop long` }, { status: 400 });
    }
    data[field] = trimmed || null;
  }

  const profile = await prisma.fleetProfile.upsert({
    where: { tag },
    create: { tag, ...data },
    update: data,
  });
  await logActivity({ actor: session.session.username, action: 'fleets-profile-update', target: tag });
  return NextResponse.json({ ...profile, updatedAt: profile.updatedAt.toISOString() });
}
