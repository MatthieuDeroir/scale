import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from './db';

/**
 * Agent installé sur chaque machine (image dorée). Il s'authentifie par un
 * jeton propre à la machine, remis une seule fois à l'enrôlement ; seule son
 * empreinte est stockée. L'agent tire ses ordres : aucune connexion entrante
 * sur la machine.
 */
export function generateAgentToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashAgentToken(token) };
}

export function hashAgentToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Machine correspondant au jeton `Authorization: Bearer …`, ou `null`. */
export async function authenticateAgent(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token.length < 32) return null;
  return prisma.provisioningDevice.findFirst({ where: { agentTokenHash: hashAgentToken(token) } });
}

/** Nom de paquet Debian : pas d'espace ni de caractère de shell, jamais. */
export const PACKAGE_NAME = /^[a-z0-9][a-z0-9+.-]{0,127}$/;

const text = (max: number) => z.string().trim().max(max).optional();

export const inventorySchema = z.object({
  hostname: text(128),
  osName: text(128),
  osVersion: text(128),
  kernel: text(128),
  arch: text(32),
  cpu: text(200),
  cores: z.number().int().min(0).max(1024).optional(),
  memoryMb: z.number().int().min(0).max(10_000_000).optional(),
  diskTotalGb: z.number().int().min(0).max(1_000_000).optional(),
  diskFreeGb: z.number().int().min(0).max(1_000_000).optional(),
  uptimeSeconds: z.number().int().min(0).optional(),
  packages: z
    .array(z.object({ name: z.string().regex(PACKAGE_NAME), version: z.string().max(128) }))
    .max(20_000)
    .default([]),
  upgradable: z
    .array(
      z.object({
        name: z.string().regex(PACKAGE_NAME),
        current: z.string().max(128),
        candidate: z.string().max(128),
      })
    )
    .max(20_000)
    .default([]),
});

export type Inventory = z.infer<typeof inventorySchema>;

export const JOB_KINDS = ['upgrade-package', 'upgrade-system'] as const;
export type JobKind = (typeof JOB_KINDS)[number];

/** Sortie des commandes : bornée, pour ne pas remplir la base avec un apt bavard. */
export const MAX_JOB_OUTPUT = 20_000;
