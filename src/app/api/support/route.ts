import {
  addSupportPost,
  getPolicy,
  listNodes,
  logActivity,
  parseSupportPosts,
  SUPPORT_PREFIX,
  toHostname,
  updatePolicy,
  type RawHeadscaleNode,
} from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Postes support, leur périmètre et les machines qui portent leur tag. */
export async function GET() {
  // Lecture ouverte à tous les rôles : qui assure le support d'une flotte n'est pas un secret.
  const { denied } = await guardApi();
  if (denied) return denied;
  const [policyResponse, nodesResponse] = await Promise.all([getPolicy(), listNodes()]);
  if (!policyResponse.ok || !nodesResponse.ok) return NextResponse.json({ message: 'Headscale indisponible' }, { status: 502 });
  const { policy } = (await policyResponse.json()) as { policy: string };
  const { nodes } = (await nodesResponse.json()) as { nodes: RawHeadscaleNode[] };
  return NextResponse.json(
    parseSupportPosts(policy).map((post) => ({
      ...post,
      name: post.tag.slice(SUPPORT_PREFIX.length),
      machines: nodes
        .filter((node) => node.tags.includes(post.tag))
        .map((node) => ({
          id: node.id,
          name: node.givenName || node.name,
          online: node.online,
          ip: node.ipAddresses[0] ?? null,
          lastSeen: node.lastSeen ?? null,
        })),
    }))
  );
}

/** Déclare un poste support, sans accès : on choisit ensuite ses flottes. */
export async function POST(request: Request) {
  const { session, denied } = await guardApi('OPERATOR');
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { name?: string } | null;
  const slug = toHostname(body?.name ?? '').slice(0, 40);
  if (!slug) return NextResponse.json({ message: 'Nom requis' }, { status: 400 });
  const tag = `${SUPPORT_PREFIX}${slug}`;
  const result = await updatePolicy((raw) => addSupportPost(raw, tag));
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: result.status });
  await logActivity({ actor: session!.username, action: 'support-create', target: tag });
  return NextResponse.json({ tag, name: slug });
}
