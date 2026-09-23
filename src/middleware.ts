import { NextResponse, type NextRequest } from 'next/server';
import { hasCapability } from '@/.generated/capabilities';
import { readSession, sessionCookie } from '@/features/auth';

/**
 * Refus par défaut. Toute route non explicitement publique exige une session.
 *
 * L'inverse — monter des routes avant le contrôle d'accès — est l'erreur qui a
 * ouvert l'API du G552 : six routes montées avant le middleware, dont la
 * création de compte avec le rôle choisi par l'appelant.
 */
const PUBLIC_PATHS = ['/api/health', '/login', '/api/auth/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  // Sans la fonctionnalité auth, il n'y a pas de session à vérifier : le
  // produit est alors supposé isolé, et c'est une décision à documenter dans
  // son analyse de risques (profil P3 de la baseline).
  if (!hasCapability('auth')) return NextResponse.next();

  const session = await readSession(request.cookies.get(sessionCookie.name)?.value);
  if (session) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ message: 'Non authentifié' }, { status: 401 });
  }

  const target = request.nextUrl.clone();
  target.pathname = '/login';
  return NextResponse.redirect(target);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
