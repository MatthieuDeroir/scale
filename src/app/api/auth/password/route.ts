import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { logActivity, prisma } from '@/core';
import { changePasswordSchema, hashPassword } from '@/features/auth';
import { currentUser } from '@/features/auth/lib/require-session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ message: 'Non authentifié' }, { status: 401 });

  const parsed = changePasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? 'Requête invalide' }, { status: 400 });
  }
  if (parsed.data.next.toLowerCase().includes(user.username.toLowerCase())) {
    return NextResponse.json({ message: "Le mot de passe ne doit pas contenir l'identifiant" }, { status: 400 });
  }

  const record = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!record || !(await bcrypt.compare(parsed.data.current, record.passwordHash))) {
    await logActivity({ actor: user.username, action: 'auth-password-change-failed' });
    return NextResponse.json({ message: 'Mot de passe actuel incorrect' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.userId },
    data: { passwordHash: await hashPassword(parsed.data.next), mustChangePassword: false },
  });
  await logActivity({ actor: user.username, action: 'auth-password-change' });
  return NextResponse.json({ ok: true });
}
