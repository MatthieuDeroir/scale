import { parkVulns, summarizePark } from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Résumé pour le tableau de bord : mêmes chiffres que l'onglet Cybersécurité. */
export async function GET() {
  const { denied } = await guardApi();
  if (denied) return denied;
  return NextResponse.json(summarizePark(await parkVulns()));
}
