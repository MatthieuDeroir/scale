import { prisma } from './db';

/**
 * Journal d'activité (F6, baseline CRA `LOG-01`). Appelé depuis les routes
 * mutantes de plusieurs features (auth, keys, fleets, acl, provisioning,
 * users) — c'est pourquoi il vit dans `core`, pas dans une feature en
 * particulier (le schéma Prisma, lui, est porté par `features/activity`,
 * comme `User` est porté par `auth` tout en étant lu partout via `@/core`).
 *
 * `target` ne doit jamais contenir de secret (`LOG-03`) — un tag, un
 * identifiant, jamais une clé ou un mot de passe en clair. Les appelants
 * sont responsables de ce filtrage : cette fonction ne le devine pas.
 */
const DEFAULT_RETENTION_DAYS = 365;

/** LOG-02 : durée de conservation du journal, réglable par `ACTIVITY_RETENTION_DAYS`. */
export function activityRetentionDays(): number {
  const days = Number(process.env.ACTIVITY_RETENTION_DAYS);
  return Number.isInteger(days) && days > 0 ? days : DEFAULT_RETENTION_DAYS;
}

export async function logActivity(entry: {
  actor: string;
  action: string;
  target?: string;
}): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: { actor: entry.actor, action: entry.action, target: entry.target ?? null },
    });
    // Purge au fil de l'eau (index sur `at`) : pas de tâche planifiée à exploiter.
    const cutoff = new Date(Date.now() - activityRetentionDays() * 24 * 60 * 60 * 1000);
    await prisma.activityLog.deleteMany({ where: { at: { lt: cutoff } } });
  } catch (error) {
    // Le journal ne doit jamais faire échouer l'action qu'il journalise.
    console.error('logActivity', error);
  }
}
