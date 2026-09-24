import { expirePreAuthKey, logActivity } from '@/core';
import { requireSession } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession('OPERATOR');
  if (!session.ok) {
    return NextResponse.json(
      { message: session.status === 401 ? 'Non authentifié' : 'Droits insuffisants' },
      { status: session.status }
    );
  }

  const { id } = await params;
  const response = await expirePreAuthKey(id);
  if (!response.ok) {
    return NextResponse.json({ message: 'Révocation refusée par Headscale' }, { status: 502 });
  }

  await logActivity({ actor: session.session.username, action: 'keys-revoke', target: id });
  return NextResponse.json({ ok: true });
}
