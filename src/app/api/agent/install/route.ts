import { installerScript, publicStramscaleUrl } from '@/core';

export const dynamic = 'force-dynamic';

/** Installateur de l'agent (public : clé et jeton sont passés en arguments). */
export function GET(request: Request) {
  return new Response(installerScript(publicStramscaleUrl(request)), {
    headers: { 'Content-Type': 'text/x-shellscript; charset=utf-8' },
  });
}
