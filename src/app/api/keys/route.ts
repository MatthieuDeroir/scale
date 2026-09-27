import {
  issueMachineKey,
  KeyIssueError,
  listNodes,
  listPreAuthKeys,
  logActivity,
  mapPreAuthKey,
  type RawHeadscaleNode,
  type RawHeadscalePreAuthKey,
} from '@/core';
import { requireSession } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireSession();
  if (!session.ok) {
    return NextResponse.json({ message: 'Non authentifié' }, { status: session.status });
  }

  const response = await listPreAuthKeys();
  if (!response.ok) {
    return NextResponse.json({ message: 'Headscale indisponible' }, { status: 502 });
  }

  const { preAuthKeys } = (await response.json()) as { preAuthKeys: RawHeadscalePreAuthKey[] };
  // Machine enregistrée avec chaque clé : « utilisée par … », sans deviner.
  const nodesResponse = await listNodes();
  const nodes = nodesResponse.ok
    ? ((await nodesResponse.json()) as { nodes: RawHeadscaleNode[] }).nodes
    : [];
  const byKey = new Map(nodes.filter((node) => node.preAuthKey).map((node) => [node.preAuthKey!.id, node]));
  return NextResponse.json(
    preAuthKeys.map((key) => {
      const node = byKey.get(key.id);
      return {
        ...mapPreAuthKey(key),
        usedBy: node ? { id: node.id, name: node.givenName || node.name, at: node.createdAt ?? null } : null,
      };
    })
  );
}

interface CreateKeyBody {
  tags?: string[];
  expiration?: string;
}

export async function POST(request: Request) {
  const session = await requireSession('OPERATOR');
  if (!session.ok) {
    return NextResponse.json(
      { message: session.status === 401 ? 'Non authentifié' : 'Droits insuffisants' },
      { status: session.status }
    );
  }

  const body = (await request.json().catch(() => null)) as CreateKeyBody | null;
  const tags = body?.tags?.filter((tag) => tag.startsWith('tag:')) ?? [];
  if (tags.length === 0) {
    return NextResponse.json({ message: 'Un tag valide est requis' }, { status: 400 });
  }

  const expiration = body?.expiration ? new Date(body.expiration) : null;
  if (!expiration || Number.isNaN(expiration.getTime()) || expiration <= new Date()) {
    return NextResponse.json({ message: 'Date d’expiration invalide' }, { status: 400 });
  }

  let issued;
  try {
    issued = await issueMachineKey({ tags, expiration, request });
  } catch (error) {
    if (error instanceof KeyIssueError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error('issueMachineKey', error);
    return NextResponse.json({ message: 'Parc non configuré' }, { status: 500 });
  }

  await logActivity({
    actor: session.session.username,
    action: 'keys-create',
    target: tags.join(','),
  });
  return NextResponse.json(issued);
}
