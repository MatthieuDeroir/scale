import { PrismaClient } from '@prisma/client';
import { createSession, hashPassword, sessionCookie } from '@/features/auth';

export const prisma = new PrismaClient();

/** Remet la base à zéro entre deux tests. Chaque test part d'un état connu. */
export async function resetDatabase() {
  await prisma.user.deleteMany();
  await prisma.setting.deleteMany();
}

export async function createUser({
  username = 'operateur',
  password = 'motdepasse-de-test',
  role = 'OPERATOR',
  mustChangePassword = false,
}: Partial<{
  username: string;
  password: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  mustChangePassword: boolean;
}> = {}) {
  const user = await prisma.user.create({
    data: { username, passwordHash: await hashPassword(password), role, mustChangePassword },
  });
  return { user, password };
}

/** Construit une requête JSON, comme Next la passera au gestionnaire de route. */
export function jsonRequest(url: string, body: unknown, init: RequestInit = {}) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...init,
  });
}

export async function cookieFor(user: { id: number; username: string; role: string }) {
  const token = await createSession({
    userId: user.id,
    username: user.username,
    role: user.role,
  });
  return `${sessionCookie.name}=${token}`;
}
