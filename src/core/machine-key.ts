import { generateAgentToken } from './agent';
import { publicStramscaleUrl } from './agent-install';
import { SYSTEM_TAGS } from './acl-policy';
import { prisma } from './db';
import { createPreAuthKey, mapNewPreAuthKey, type RawHeadscalePreAuthKey } from './headscale';
import { ensureSystemTagsInPolicy } from './system-tags';

export class KeyIssueError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

/**
 * Émet une clé pour UNE machine. Pour un équipement Stramatel, crée aussi le
 * jeton de l'agent lié à cette clé (specs, failles, mises à jour) ; jamais
 * pour un poste d'hypervision client.
 */
export async function issueMachineKey({
  tags,
  expiration,
  request,
}: {
  tags: string[];
  expiration: Date;
  request: Request;
}) {
  if (tags.some((tag) => (SYSTEM_TAGS as readonly string[]).includes(tag))) {
    await ensureSystemTagsInPolicy();
  }
  const response = await createPreAuthKey({ tags, reusable: false, expiration: expiration.toISOString() });
  if (!response.ok) throw new KeyIssueError('Émission refusée par Headscale', 502);

  const { preAuthKey } = (await response.json()) as { preAuthKey: RawHeadscalePreAuthKey };
  const agent = tags.includes('tag:hypervision') ? null : generateAgentToken();
  if (agent) {
    await prisma.provisioningDevice.create({
      data: { deviceId: `key-${preAuthKey.id}`, keyId: preAuthKey.id, agentTokenHash: agent.hash },
    });
  }
  return {
    ...mapNewPreAuthKey(preAuthKey),
    // Adresse que la machine doit joindre (≠ HEADSCALE_API_URL, vue depuis ce serveur).
    loginServer: process.env.HEADSCALE_PUBLIC_URL || process.env.HEADSCALE_API_URL,
    agentToken: agent?.token ?? null,
    installUrl: agent ? `${publicStramscaleUrl(request)}/api/agent/install` : null,
  };
}
