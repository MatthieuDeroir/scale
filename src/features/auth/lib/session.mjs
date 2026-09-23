/**
 * Session par jeton signé. En `.mjs` : la couche serveur et le middleware
 * doivent pouvoir l'importer sans passer par TypeScript.
 *
 * Choix assumés :
 * - `jose` avec vérification de signature — jamais `decode()` seul, qui lit
 *   un jeton sans le valider ;
 * - durée courte et révocation possible par changement de secret ;
 * - cookie `httpOnly`, `sameSite=lax`, `secure` hors développement.
 */
import { SignJWT, jwtVerify } from 'jose';

const ALG = 'HS256';
const COOKIE = 'stramatel_session';
const MAX_AGE_SECONDS = 60 * 60 * 8;

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error('JWT_SECRET absent');
  return new TextEncoder().encode(value);
}

export async function createSession({ userId, username, role }) {
  return new SignJWT({ username, role })
    .setProtectedHeader({ alg: ALG })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

/** @returns {Promise<{userId:number, username:string, role:string}|null>} */
export async function readSession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] });
    return { userId: Number(payload.sub), username: payload.username, role: payload.role };
  } catch {
    // Jeton absent, expiré ou signature invalide : pas de session. Pas de détail
    // renvoyé à l'appelant — il n'a pas à savoir laquelle des trois.
    return null;
  }
}

export const sessionCookie = {
  name: COOKIE,
  options: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  },
};
