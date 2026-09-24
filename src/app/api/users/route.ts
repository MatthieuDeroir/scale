import { logActivity, prisma } from '@/core';
import { generatePassword, hashPassword, ROLES, type Role } from '@/features/auth';
import { requireSession } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function serialize(user: {
  id: number;
  username: string;
  role: string;
  disabled: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    disabled: user.disabled,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function GET() {
  const session = await requireSession('ADMIN');
  if (!session.ok) {
    return NextResponse.json(
      { message: session.status === 401 ? 'Non authentifié' : 'Droits insuffisants' },
      { status: session.status }
    );
  }

  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  return NextResponse.json(users.map(serialize));
}

interface CreateUserBody {
  username?: string;
  role?: string;
}

export async function POST(request: Request) {
  const session = await requireSession('ADMIN');
  if (!session.ok) {
    return NextResponse.json(
      { message: session.status === 401 ? 'Non authentifié' : 'Droits insuffisants' },
      { status: session.status }
    );
  }

  const body = (await request.json().catch(() => null)) as CreateUserBody | null;
  const username = body?.username?.trim();
  const role = body?.role;
  if (!username) {
    return NextResponse.json({ message: "Identifiant requis" }, { status: 400 });
  }
  if (!role || !(ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ message: 'Rôle invalide' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ message: 'Identifiant déjà utilisé' }, { status: 409 });
  }

  const password = generatePassword();
  const user = await prisma.user.create({
    data: {
      username,
      role: role as Role,
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
    },
  });

  await logActivity({
    actor: session.session.username,
    action: 'users-create',
    target: `${username} (${role})`,
  });

  return NextResponse.json({ ...serialize(user), password });
}
