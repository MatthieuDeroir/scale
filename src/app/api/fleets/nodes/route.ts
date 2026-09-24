import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { readSession, sessionCookie } from '@/features/auth';

export const dynamic = 'force-dynamic';

interface HeadscaleNode {
  id: string;
  name: string;
  givenName: string;
  ipAddresses: string[];
  online: boolean;
  lastSeen: string | null;
  tags?: string[];
  validTags?: string[];
  forcedTags?: string[];
}

/**
 * Proxy server-side vers l'API REST de Headscale : la clé d'API
 * (`HEADSCALE_API_KEY`) ne doit jamais atteindre le navigateur, donc jamais
 * d'appel direct depuis le composant client (F4 — le seul accès à l'UI est
 * Stramatel, authentifié par session).
 */
export async function GET() {
  const token = (await cookies()).get(sessionCookie.name)?.value;
  const session = await readSession(token);
  if (!session) {
    return NextResponse.json({ message: 'Non authentifié' }, { status: 401 });
  }

  const baseUrl = process.env.HEADSCALE_API_URL;
  const apiKey = process.env.HEADSCALE_API_KEY;
  if (!baseUrl || !apiKey) {
    console.error('FATAL: HEADSCALE_API_URL ou HEADSCALE_API_KEY absent.');
    return NextResponse.json({ message: 'Parc non configuré' }, { status: 500 });
  }

  const response = await fetch(`${baseUrl}/api/v1/node`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  });
  if (!response.ok) {
    return NextResponse.json({ message: 'Headscale indisponible' }, { status: 502 });
  }

  const { nodes } = (await response.json()) as { nodes: HeadscaleNode[] };
  return NextResponse.json(
    nodes.map((node) => ({
      id: node.id,
      name: node.name,
      givenName: node.givenName,
      ipAddresses: node.ipAddresses,
      online: node.online,
      lastSeen: node.lastSeen,
      tags: node.tags ?? node.validTags ?? node.forcedTags ?? [],
    }))
  );
}
