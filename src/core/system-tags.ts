import { ensureSystemTags } from './acl-policy';
import { checkPolicy, getPolicy, setPolicy } from './headscale';

/**
 * Garantit que la politique Headscale déclare les tags système
 * (`tag:a-assigner`, `tag:hypervision`) avant d'émettre une clé qui les
 * porte — sans ça, la clé s'émet mais la machine est refusée à
 * l'enregistrement, en silence côté interface. Même garde-fou que
 * l'éditeur ACL : validation avant écriture.
 */
export async function ensureSystemTagsInPolicy(): Promise<void> {
  const current = await getPolicy();
  if (!current.ok) throw new Error('Politique Headscale illisible');
  const { policy } = (await current.json()) as { policy: string };

  const updated = ensureSystemTags(policy);
  if (!updated) return;

  const checked = await checkPolicy(updated);
  if (!checked.ok) throw new Error('Politique invalide après ajout des tags système');
  const applied = await setPolicy(updated);
  if (!applied.ok) throw new Error('Politique refusée par Headscale');
}
