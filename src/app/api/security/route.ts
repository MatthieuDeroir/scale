import { parkVulns, summarizePark } from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Failles du parc regroupées par CVE, avec les décisions de tri (onglet
 * Cybersécurité). Liste allégée : le détail par machine se charge à
 * l'ouverture d'une faille (`/api/security/detail`), sinon la réponse grossit
 * avec le nombre de machines.
 */
export async function GET() {
  const { denied } = await guardApi();
  if (denied) return denied;
  const vulns = await parkVulns();
  return NextResponse.json({
    vulns: vulns.map(({ occurrences, ...vuln }) => ({
      ...vuln,
      productIds: [...new Set(occurrences.flatMap((item) => (item.productId ? [item.productId] : [])))],
    })),
    summary: summarizePark(vulns),
  });
}
