import { prisma } from './db';
import { getNode, listNodes, renameNode, setNodeTags, type RawHeadscaleNode } from './headscale';
import { toHostname } from './hostname';
import { ensureSystemTagsInPolicy } from './system-tags';

/**
 * Plan d'une flotte : les emplacements prévus (« ici un serveur temps, là des
 * SL MEDIA SLAVE, un poste d'hypervision »), pourvus par une clé émise pour
 * eux ou par une machine en attente qu'on y affecte.
 */

const MASTER_TAG = 'tag:master';
const HYPERVISION_TAG = 'tag:hypervision';
const FLEET_TAG = /^tag:(interne|a-assigner|flotte-.+)$/;

/** Noms proposés au premier lancement ; le catalogue se modifie ensuite depuis l'interface. */
const DEFAULT_PRODUCTS = [
  { name: 'SL MEDIA MASTER', category: 'gamme', role: 'master' },
  { name: 'SL MEDIA SLAVE', category: 'gamme', role: 'slave' },
  { name: 'SL TEMPO', category: 'gamme', role: null },
  { name: 'SL VIDEO SCOREBOARD', category: 'gamme', role: null },
  { name: 'Sur mesure', category: 'sur-mesure', role: null },
];

export async function ensureDefaultProducts(): Promise<void> {
  if ((await prisma.product.count()) > 0) return;
  await prisma.product.createMany({ data: DEFAULT_PRODUCTS });
}

/** Tags d'une machine pour une flotte et un produit : flotte, puis MASTER si le produit l'est. */
export function tagsFor(
  current: string[],
  fleetTag: string,
  { hypervision, master }: { hypervision: boolean; master: boolean }
): string[] {
  const rest = current.filter((tag) => !FLEET_TAG.test(tag) && tag !== MASTER_TAG && tag !== HYPERVISION_TAG);
  return [fleetTag, ...(hypervision ? [HYPERVISION_TAG] : []), ...(master ? [MASTER_TAG] : []), ...rest];
}

/** Libellés numérotés pour plusieurs emplacements identiques : « SL MEDIA SLAVE 1 », « … 2 ». */
export function numberedLabels(label: string, count: number, taken: string[]): string[] {
  if (count <= 1 && !taken.includes(label)) return [label];
  const out: string[] = [];
  for (let index = 1; out.length < count; index++) {
    const candidate = `${label} ${index}`;
    if (!taken.includes(candidate)) out.push(candidate);
  }
  return out;
}

export async function setMachineProduct(nodeId: string, productId: number | null, reference: string | null) {
  if (productId === null) {
    await prisma.machineProduct.deleteMany({ where: { nodeId } });
    return;
  }
  await prisma.machineProduct.upsert({
    where: { nodeId },
    create: { nodeId, productId, reference },
    update: { productId, reference },
  });
}

/**
 * Rattache les emplacements à leur machine : celle qui s'est raccordée avec
 * la clé émise pour l'emplacement. Un emplacement dont la machine a été
 * supprimée redevient à pourvoir.
 */
export async function resolveSlots(fleetTag: string, nodes?: RawHeadscaleNode[]) {
  const slots = await prisma.fleetSlot.findMany({
    where: { fleetTag },
    include: { product: true },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
  });
  if (!nodes) {
    const response = await listNodes();
    nodes = response.ok ? ((await response.json()) as { nodes: RawHeadscaleNode[] }).nodes : [];
  }
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const byKey = new Map(nodes.filter((node) => node.preAuthKey).map((node) => [node.preAuthKey!.id, node]));

  for (const slot of slots) {
    if (slot.nodeId && !byId.has(slot.nodeId)) {
      await prisma.fleetSlot.update({ where: { id: slot.id }, data: { nodeId: null, keyId: null, keyIssuedAt: null } });
      Object.assign(slot, { nodeId: null, keyId: null, keyIssuedAt: null });
    } else if (!slot.nodeId && slot.keyId && byKey.has(slot.keyId)) {
      const node = byKey.get(slot.keyId)!;
      await prisma.fleetSlot.update({ where: { id: slot.id }, data: { nodeId: node.id } });
      if (slot.productId) await setMachineProduct(node.id, slot.productId, slot.reference);
      slot.nodeId = node.id;
    }
  }
  return slots.map((slot) => {
    const node = slot.nodeId ? byId.get(slot.nodeId) : undefined;
    return {
      id: slot.id,
      kind: slot.kind as 'equipment' | 'hypervision',
      label: slot.label,
      reference: slot.reference,
      product: slot.product ? { id: slot.product.id, name: slot.product.name, role: slot.product.role } : null,
      keyIssuedAt: slot.keyIssuedAt?.toISOString() ?? null,
      machine: node
        ? { id: node.id, name: node.givenName || node.name, online: node.online, ip: node.ipAddresses[0] ?? null }
        : null,
    };
  });
}

/**
 * Affecte une machine en attente (« À assigner ») à un emplacement : flotte,
 * rôle MASTER selon le produit, nom de l'emplacement, produit.
 */
export async function assignNodeToSlot(slotId: number, nodeId: string) {
  const slot = await prisma.fleetSlot.findUnique({ where: { id: slotId }, include: { product: true } });
  if (!slot) throw new Error('Emplacement introuvable');
  if (slot.nodeId) throw new Error('Emplacement déjà pourvu');
  if (slot.kind === 'hypervision') throw new Error("Un poste d'hypervision se raccorde par sa propre clé");

  const response = await getNode(nodeId);
  if (!response.ok) throw new Error('Machine introuvable');
  const { node } = (await response.json()) as { node: RawHeadscaleNode };
  const fleet = node.tags.find((tag) => FLEET_TAG.test(tag));
  if (fleet && fleet !== 'tag:a-assigner') throw new Error("Cette machine n'est pas en attente d'affectation");

  const master = slot.product?.role === 'master';
  if (master) await ensureSystemTagsInPolicy();
  const tagged = await setNodeTags(nodeId, tagsFor(node.tags, slot.fleetTag, { hypervision: false, master }));
  if (!tagged.ok) throw new Error('Changement de flotte refusé par Headscale');
  const name = toHostname(slot.label);
  if (name) await renameNode(nodeId, name);

  await prisma.fleetSlot.update({ where: { id: slotId }, data: { nodeId } });
  if (slot.productId) await setMachineProduct(nodeId, slot.productId, slot.reference);
  return { label: slot.label, fleetTag: slot.fleetTag, previous: node.givenName || node.name };
}

export interface TemplateItem {
  kind: 'equipment' | 'hypervision';
  productId: number | null;
  count: number;
  label: string;
}

/** Plan d'une flotte → éléments de modèle : emplacements identiques regroupés, numéros retirés. */
export function planToTemplateItems(
  slots: Array<{ kind: string; productId: number | null; label: string }>
): TemplateItem[] {
  const groups = new Map<string, TemplateItem>();
  for (const slot of slots) {
    const label = slot.label.replace(/\s+\d+$/, '');
    const key = `${slot.kind}|${slot.productId ?? ''}|${label}`;
    const item = groups.get(key) ?? { kind: slot.kind as TemplateItem['kind'], productId: slot.productId, count: 0, label };
    item.count += 1;
    groups.set(key, item);
  }
  return [...groups.values()];
}
