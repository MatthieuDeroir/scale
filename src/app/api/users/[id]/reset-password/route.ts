import { logActivity, prisma } from '@/core';
import { generatePassword, hashPassword } from '@/features/auth';
import { requireSession } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession('ADMIN');
  if (!session.ok) {
    return NextResponse.json(
      { message: session.status === 401 ? 'Non authentifié' : 'Droits insuffisants' },
      { status: session.status }
    );
  }

  const { id } = await params;
  const password = generatePassword();
  const user = await prisma.user.update({
    where: { id: Number.parseInt(id, 10) },
    data: {
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      failedAttempts: 0,
      lockedUntil: null,
    },
  });

  // Jamais le mot de passe lui-même dans le journal (LOG-03) — juste qui a été touché.
  await logActivity({
    actor: session.session.username,
    action: 'users-reset-password',
    target: user.username,
  });

  return NextResponse.json({ password });
}
