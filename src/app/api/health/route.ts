import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Sonde de santé. Sert au conteneur, à Playwright, et à l'installateur qui
 * veut savoir en une requête si l'équipement reçoit vraiment des trames.
 */
export async function GET() {
  const { runtime, isSourceFresh } = await import('../../../../server/state/global-state.mjs');

  return NextResponse.json({
    status: 'ok',
    uptimeSeconds: Math.round((Date.now() - runtime.startedAt.getTime()) / 1000),
    source: {
      fresh: isSourceFresh(),
      lastFrameAt: runtime.lastFrameAt?.toISOString() ?? null,
      frameCount: runtime.frameCount,
    },
  });
}
