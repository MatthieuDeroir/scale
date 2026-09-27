import { isSupportTag, issueMachineKey, KeyIssueError, logActivity } from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Clé pour raccorder le PC du poste support (sans agent : ce n'est pas un équipement). */
export async function POST(request: Request, { params }: { params: Promise<{ tag: string }> }) {
  const { session, denied } = await guardApi('OPERATOR');
  if (denied) return denied;
  const tag = decodeURIComponent((await params).tag);
  if (!isSupportTag(tag)) return NextResponse.json({ message: 'Poste support inconnu' }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { expiration?: string } | null;
  const expiration = body?.expiration ? new Date(body.expiration) : null;
  if (!expiration || Number.isNaN(expiration.getTime()) || expiration <= new Date()) {
    return NextResponse.json({ message: 'Date d’expiration invalide' }, { status: 400 });
  }
  try {
    const issued = await issueMachineKey({ tags: [tag], expiration, request });
    await logActivity({ actor: session!.username, action: 'keys-create', target: tag });
    return NextResponse.json(issued);
  } catch (error) {
    if (error instanceof KeyIssueError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: 'Émission impossible (poste déclaré dans la politique ?)' }, { status: 500 });
  }
}
