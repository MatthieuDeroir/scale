import { mapNode, listNodes, type RawHeadscaleNode } from '@/core';
import { requireSession } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Proxy server-side vers l'API REST de Headscale : la clé d'API
 * (`HEADSCALE_API_KEY`) ne doit jamais atteindre le navigateur, donc jamais
 * d'appel direct depuis le composant client (F4 — le seul accès à l'UI est
 * Stramatel, authentifié par session).
 */
export async function GET() {
  const session = await requireSession();
  if (!session.ok) {
    return NextResponse.json({ message: 'Non authentifié' }, { status: session.status });
  }

  let response: Response;
  try {
    response = await listNodes();
  } catch {
    return NextResponse.json({ message: 'Parc non configuré' }, { status: 500 });
  }
  if (!response.ok) {
    return NextResponse.json({ message: 'Headscale indisponible' }, { status: 502 });
  }

  const { nodes } = (await response.json()) as { nodes: RawHeadscaleNode[] };
  return NextResponse.json(nodes.map(mapNode));
}
