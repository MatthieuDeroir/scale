import { addSlaves, createSlots, logActivity, resolveSlots } from '@/core';
import { guardApi } from '@/features/auth/lib/require-session';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const FLEET = /^tag:(interne|flotte-[a-z0-9-]+)$/;

/** Plan de la flotte : emplacements prévus et machine qui pourvoit chacun. */
export async function GET(_request: Request, { params }: { params: Promise<{ tag: string }> }) {
  const { denied } = await guardApi();
  if (denied) return denied;
  const tag = decodeURIComponent((await params).tag);
  if (!FLEET.test(tag)) return NextResponse.json({ message: 'Flotte invalide' }, { status: 400 });
  return NextResponse.json(await resolveSlots(tag));
}

interface Body {
  kind?: string;
  productId?: number | null;
  count?: number;
  label?: string;
  reference?: string;
  /** SLAVE par serveur, pour un produit qui en accepte. */
  slaves?: number;
  /** Ajout de SLAVE à un serveur déjà prévu. */
  parentSlotId?: number;
}

/**
 * Ajoute des emplacements : `count` emplacements identiques numérotés (avec
 * leurs SLAVE pour un SL MEDIA), ou `count` SLAVE sous `parentSlotId`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ tag: string }> }) {
  const { session, denied } = await guardApi('OPERATOR');
  if (denied) return denied;
  const tag = decodeURIComponent((await params).tag);
  if (!FLEET.test(tag)) return NextResponse.json({ message: 'Flotte invalide' }, { status: 400 });
  const body = (await request.json().catch(() => null)) as Body | null;
  const count = Number(body?.count ?? 1) || 1;

  try {
    let created: number;
    if (body?.parentSlotId) {
      created = await addSlaves(Number(body.parentSlotId), count);
    } else {
      const kind = body?.kind === 'hypervision' ? 'hypervision' : 'equipment';
      const label = body?.label?.trim().slice(0, 60);
      if (!label) return NextResponse.json({ message: 'Libellé requis' }, { status: 400 });
      created = await createSlots(tag, {
        kind,
        productId: kind === 'equipment' ? Number(body?.productId) || null : null,
        count,
        label,
        reference: body?.reference?.trim().slice(0, 60) || null,
        slaves: Number(body?.slaves ?? 0) || 0,
      });
    }
    await logActivity({ actor: session!.username, action: 'plan-add', target: `${tag} : ${created} emplacement(s)` });
    return NextResponse.json(await resolveSlots(tag));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Ajout refusé' }, { status: 400 });
  }
}
