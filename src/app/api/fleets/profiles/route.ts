import { prisma } from '@/core';
import { requireSession } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireSession();
  if (!session.ok) {
    return NextResponse.json({ message: 'Non authentifié' }, { status: session.status });
  }
  const profiles = await prisma.fleetProfile.findMany();
  return NextResponse.json(profiles.map((profile) => ({ ...profile, updatedAt: profile.updatedAt.toISOString() })));
}
