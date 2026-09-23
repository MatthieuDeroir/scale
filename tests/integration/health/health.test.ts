import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('répond avec la forme attendue', async () => {
    const body = await (await GET()).json();

    expect(body.status).toBe('ok');
    expect(typeof body.uptimeSeconds).toBe('number');
    expect(body.source).toEqual({
      fresh: expect.any(Boolean),
      lastFrameAt: null,
      frameCount: expect.any(Number),
    });
  });

  it('signale une source muette plutôt que de se taire', async () => {
    // Sans matériel, `fresh` doit valoir false — pas être absent. L'absence de
    // source doit être visible sur la sonde, sinon l'installateur ne la voit pas.
    const body = await (await GET()).json();
    expect(body.source.fresh).toBe(false);
  });
});
