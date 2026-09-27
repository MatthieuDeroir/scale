import { parkVulns } from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Une faille avec ses machines touchées (`?key=CVE-…`). */
export async function GET(request: Request) {
  const { denied } = await guardApi();
  if (denied) return denied;
  const key = new URL(request.url).searchParams.get('key');
  const vuln = key ? (await parkVulns()).find((item) => item.key === key) : undefined;
  if (!vuln) return NextResponse.json({ message: 'Faille introuvable sur le parc' }, { status: 404 });
  return NextResponse.json(vuln);
}
