import { NextResponse } from 'next/server';
import { logActivity, prisma } from '@/core';
import { createSession, loginSchema, sessionCookie, verifyLogin } from '@/features/auth';

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: 'Requête invalide' }, { status: 400 });
  }

  const result = await verifyLogin(prisma, parsed.data.username, parsed.data.password);

  if (!result.ok) {
    // Même réponse pour « inconnu », « mot de passe faux » et « verrouillé ».
    // Le détail n'aide que l'attaquant — mais le journal interne, lui, garde
    // l'identifiant tenté (LOG-01 : connexions, échecs).
    await logActivity({
      actor: parsed.data.username,
      action: 'auth-login-failed',
    });
    return NextResponse.json({ message: 'Connexion refusée' }, { status: 401 });
  }

  const token = await createSession({
    userId: result.user.id,
    username: result.user.username,
    role: result.user.role,
  });

  await logActivity({ actor: result.user.username, action: 'auth-login-success' });

  const response = NextResponse.json({ mustChangePassword: result.user.mustChangePassword });
  response.cookies.set(sessionCookie.name, token, sessionCookie.options);
  return response;
}
