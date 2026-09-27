import { agentScript } from '@/core';

export const dynamic = 'force-dynamic';

/** Le script de l'agent, tel qu'il est dans le dépôt (public : aucun secret dedans). */
export function GET() {
  return new Response(agentScript(), { headers: { 'Content-Type': 'text/x-shellscript; charset=utf-8' } });
}
