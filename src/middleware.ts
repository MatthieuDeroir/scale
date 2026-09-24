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
// `/api/provisioning/enroll` est public par nature (F1) : une machine qui
// vient de démarrer n'a pas de session Stramatel. Elle s'authentifie par un
// secret de fabrication propre à la route (voir ce fichier), pas par cookie.
const PUBLIC_PATHS = ['/api/health', '/login', '/api/auth/login', '/api/provisioning/enroll'];

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

// `images/` (public/images) est un dossier d'actifs statiques, pas une route
// applicative — la logique d'optimisation de `next/image` y fait une requête
// interne sans cookie de session, qu'un middleware qui l'exigerait ferait
// systématiquement échouer (307 → « ceci n'est pas une image valide »).
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/).*)'],
};
