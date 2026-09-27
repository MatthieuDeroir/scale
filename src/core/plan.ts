import { prisma } from './db';
import { getNode, listNodes, renameNode, setNodeTags, type RawHeadscaleNode } from './headscale';
import { slotHostname } from './hostname';
import { SERVER_TAG } from './acl-policy';
import { ensureSystemTagsInPolicy } from './system-tags';

/**
 * Plan d'une flotte : les emplacements prévus (« ici un SL TEMPO, là un
 * SL MEDIA et ses 4 REPLICA, un poste d'hypervision »), pourvus par une clé
 * émise pour eux ou par une machine en attente qu'on y affecte.
 *
 * Un produit maître (SL TEMPO, SL MEDIA) donne des machines maîtresses (tag
 * SERVEUR). S'il accepte des REPLICA (SL MEDIA), l'emplacement sans parent est le
 * maître, ceux qui y sont rattachés sont ses REPLICA.
 */

const MASTER_TAG = SERVER_TAG;
const HYPERVISION_TAG = 'tag:hypervision';
const FLEET_TAG = /^tag:(interne|a-assigner|flotte-.+)$/;
export const MAX_SLOTS = 50;

/** Proposés au premier lancement ; le catalogue se modifie ensuite depuis l'interface. */
const DEFAULT_PRODUCTS = [
  { name: 'SL MEDIA', category: 'gamme', master: true, slaves: true },
  { name: 'SL TEMPO', category: 'gamme', master: true, slaves: false },
  { name: 'SL VIDEO SCOREBOARD', category: 'gamme', master: false, slaves: false },
];
/** Flux connus : les REPLICA joignent leur serveur, SL TEMPO joint le serveur SL MEDIA. Ports à préciser. */
const DEFAULT_LINKS = [
  ['SL MEDIA', 'SL MEDIA'],
  ['SL TEMPO', 'SL MEDIA'],
];

export async function ensureDefaultProducts(): Promise<void> {
  if ((await prisma.product.count()) > 0) return;
  await prisma.product.createMany({ data: DEFAULT_PRODUCTS });
  const ids = new Map((await prisma.product.findMany()).map((product) => [product.name, product.id]));
  await prisma.productLink.createMany({
    data: DEFAULT_LINKS.map(([from, to]) => ({ fromId: ids.get(from)!, toId: ids.get(to)! })),
  });
}

/** Tags d'une machine pour une flotte et un rôle : flotte, puis SERVEUR si serveur. */
export function tagsFor(
  current: string[],
  fleetTag: string,
  { hypervision, master }: { hypervision: boolean; master: boolean }
): string[] {
  const rest = current.filter((tag) => !FLEET_TAG.test(tag) && tag !== MASTER_TAG && tag !== HYPERVISION_TAG);
  return [fleetTag, ...(hypervision ? [HYPERVISION_TAG] : []), ...(master ? [MASTER_TAG] : []), ...rest];
}

/** Libellés numérotés pour plusieurs emplacements identiques : « SL MEDIA 1 », « … 2 ». */
export function numberedLabels(label: string, count: number, taken: string[]): string[] {
  if (count <= 1 && !taken.includes(label)) return [label];
  const out: string[] = [];
  for (let index = 1; out.length < count; index++) {
    const candidate = `${label} ${index}`;
    if (!taken.includes(candidate)) out.push(candidate);
  }
  return out;
}

export async function setMachineProduct(
  nodeId: string,
  productId: number | null,
  reference: string | null,
  masterNodeId: string | null = null
) {
  if (productId === null) {
    await prisma.machineProduct.deleteMany({ where: { nodeId } });
    return;
  }
  await prisma.machineProduct.upsert({
    where: { nodeId },
    create: { nodeId, productId, reference, masterNodeId },
    update: { productId, reference, masterNodeId },
  });
}

async function takenLabels(fleetTag: string) {
  const existing = await prisma.fleetSlot.findMany({ where: { fleetTag }, select: { label: true, position: true } });
  return {
    taken: existing.map((slot) => slot.label),
    position: existing.reduce((max, slot) => Math.max(max, slot.position), 0),
  };
}

export interface NewSlots {
  kind: 'equipment' | 'hypervision';
  productId: number | null;
  count: number;
  label: string;
  reference?: string | null;
  /** REPLICA par serveur, pour un produit qui en accepte. */
  slaves?: number;
}

/**
 * Crée `count` emplacements numérotés ; pour un produit à REPLICA, chaque
 * serveur reçoit ses `slaves` REPLICA (« SL MEDIA 1 REPLICA 1 »…), placés juste
 * après lui dans le plan.
 */
export async function createSlots(fleetTag: string, input: NewSlots): Promise<number> {
  const product = input.productId ? await prisma.product.findUnique({ where: { id: input.productId } }) : null;
  if (input.kind === 'equipment' && !product) throw new Error('Choisissez un produit');
  const count = Math.min(Math.max(input.count, 1), MAX_SLOTS);
  const slaves = product?.slaves ? Math.min(Math.max(input.slaves ?? 0, 0), MAX_SLOTS) : 0;
  let { taken, position } = await takenLabels(fleetTag);
  let created = 0;

  for (const label of numberedLabels(input.label, count, taken)) {
    taken = [...taken, label];
    const server = await prisma.fleetSlot.create({
      data: {
        fleetTag,
        kind: input.kind,
        productId: product?.id ?? null,
        label,
        reference: input.reference || null,
        position: ++position,
      },
    });
    created++;
    if (slaves > 0) {
      const labels = numberedLabels(`${label} REPLICA`, slaves, taken);
      taken = [...taken, ...labels];
      await prisma.fleetSlot.createMany({
        data: labels.map((slaveLabel) => ({
          fleetTag,
          kind: 'equipment',
          productId: product!.id,
          label: slaveLabel,
          reference: input.reference || null,
          position: ++position,
          parentSlotId: server.id,
        })),
      });
      created += labels.length;
    }
  }
  return created;
}

/** Ajoute des REPLICA à un serveur déjà prévu. */
export async function addSlaves(parentSlotId: number, count: number): Promise<number> {
  const parent = await prisma.fleetSlot.findUnique({ where: { id: parentSlotId }, include: { product: true } });
  if (!parent || parent.parentSlotId || !parent.product?.slaves) throw new Error("Cet emplacement n'accepte pas de REPLICA");
  const { taken, position } = await takenLabels(parent.fleetTag);
  const labels = numberedLabels(`${parent.label} REPLICA`, Math.min(Math.max(count, 1), MAX_SLOTS), taken);
  // Placés après les REPLICA existants du serveur : on décale la suite du plan.
  const last = await prisma.fleetSlot.findFirst({
    where: { OR: [{ id: parent.id }, { parentSlotId: parent.id }] },
    orderBy: { position: 'desc' },
  });
  const after = last?.position ?? position;
  await prisma.fleetSlot.updateMany({
    where: { fleetTag: parent.fleetTag, position: { gt: after } },
    data: { position: { increment: labels.length } },
  });
  await prisma.fleetSlot.createMany({
    data: labels.map((label, index) => ({
      fleetTag: parent.fleetTag,
      kind: 'equipment',
      productId: parent.productId,
      label,
      reference: parent.reference,
      position: after + index + 1,
      parentSlotId: parent.id,
    })),
  });
  return labels.length;
}

/** Rôle SERVEUR d'un emplacement : produit maître, hors REPLICA. */
export function isServerSlot(slot: { parentSlotId: number | null; product: { master: boolean } | null }): boolean {
  return Boolean(slot.product?.master) && slot.parentSlotId === null;
}

/**
 * Rattache les emplacements à leur machine : celle qui s'est raccordée avec
 * la clé émise pour l'emplacement. Un emplacement dont la machine a été
 * supprimée ou a changé de flotte redevient à pourvoir. Les REPLICA suivent
 * leur serveur dès qu'il est raccordé.
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
    const node = slot.nodeId ? byId.get(slot.nodeId) : undefined;
    if (slot.nodeId && (!node || !node.tags.includes(fleetTag))) {
      await prisma.fleetSlot.update({ where: { id: slot.id }, data: { nodeId: null, keyId: null, keyIssuedAt: null } });
      Object.assign(slot, { nodeId: null, keyId: null, keyIssuedAt: null });
    } else if (!slot.nodeId && slot.keyId && byKey.has(slot.keyId)) {
      slot.nodeId = byKey.get(slot.keyId)!.id;
      await prisma.fleetSlot.update({ where: { id: slot.id }, data: { nodeId: slot.nodeId } });
    }
  }

  // Produit et serveur de rattachement des machines raccordées.
  const nodeOfSlot = new Map(slots.map((slot) => [slot.id, slot.nodeId]));
  const current = new Map(
    (
      await prisma.machineProduct.findMany({
        where: { nodeId: { in: slots.flatMap((slot) => (slot.nodeId ? [slot.nodeId] : [])) } },
      })
    ).map((item) => [item.nodeId, item])
  );
  for (const slot of slots) {
    if (!slot.nodeId || !slot.productId) continue;
    const masterNodeId = slot.parentSlotId ? (nodeOfSlot.get(slot.parentSlotId) ?? null) : null;
    const known = current.get(slot.nodeId);
    if (!known || known.productId !== slot.productId || known.masterNodeId !== masterNodeId) {
      await setMachineProduct(slot.nodeId, slot.productId, known?.reference ?? slot.reference, masterNodeId);
    }
  }

  return slots.map((slot) => {
    const node = slot.nodeId ? byId.get(slot.nodeId) : undefined;
    return {
      id: slot.id,
      kind: slot.kind as 'equipment' | 'hypervision',
      label: slot.label,
      reference: slot.reference,
      parentSlotId: slot.parentSlotId,
      product: slot.product
        ? { id: slot.product.id, name: slot.product.name, master: slot.product.master, slaves: slot.product.slaves }
        : null,
      keyIssuedAt: slot.keyIssuedAt?.toISOString() ?? null,
      machine: node
        ? { id: node.id, name: node.givenName || node.name, online: node.online, ip: node.ipAddresses[0] ?? null }
        : null,
    };
  });
}

/**
 * Affecte une machine en attente (« À assigner ») à un emplacement : flotte,
 * rôle SERVEUR pour un serveur, nom de l'emplacement, produit.
 */
export async function assignNodeToSlot(slotId: number, nodeId: string) {
  const slot = await prisma.fleetSlot.findUnique({ where: { id: slotId }, include: { product: true, parent: true } });
  if (!slot) throw new Error('Emplacement introuvable');
  if (slot.nodeId) throw new Error('Emplacement déjà pourvu');
  if (slot.kind === 'hypervision') throw new Error("Un poste d'hypervision se raccorde par sa propre clé");

  const response = await getNode(nodeId);
  if (!response.ok) throw new Error('Machine introuvable');
  const { node } = (await response.json()) as { node: RawHeadscaleNode };
  const fleet = node.tags.find((tag) => FLEET_TAG.test(tag));
  if (fleet && fleet !== 'tag:a-assigner') throw new Error("Cette machine n'est pas en attente d'affectation");

  const master = isServerSlot(slot);
  if (master) await ensureSystemTagsInPolicy();
  const tagged = await setNodeTags(nodeId, tagsFor(node.tags, slot.fleetTag, { hypervision: false, master }));
  if (!tagged.ok) throw new Error('Changement de flotte refusé par Headscale');
  const renamed = await renameNode(nodeId, slotHostname(slot.fleetTag, slot.label));
  if (!renamed.ok) throw new Error('Renommage refusé par Headscale (nom déjà pris ?)');

  await prisma.fleetSlot.update({ where: { id: slotId }, data: { nodeId } });
  if (slot.productId) await setMachineProduct(nodeId, slot.productId, slot.reference, slot.parent?.nodeId ?? null);
  // Les REPLICA déjà raccordés de ce serveur s'y rattachent.
  if (master) {
    const slaves = await prisma.fleetSlot.findMany({ where: { parentSlotId: slot.id, nodeId: { not: null } } });
    await prisma.machineProduct.updateMany({
      where: { nodeId: { in: slaves.map((item) => item.nodeId!) } },
      data: { masterNodeId: nodeId },
    });
  }
  return { label: slot.label, fleetTag: slot.fleetTag, previous: node.givenName || node.name };
}

export interface TemplateItem {
  kind: 'equipment' | 'hypervision';
  productId: number | null;
  count: number;
  label: string;
  /** REPLICA par serveur (produit à REPLICA). */
  slaves?: number;
}

/**
 * Plan d'une flotte → éléments de modèle : serveurs regroupés avec leur
 * nombre de REPLICA, emplacements identiques regroupés, numéros retirés.
 */
export function planToTemplateItems(
  slots: Array<{ id: number; kind: string; productId: number | null; label: string; parentSlotId: number | null }>
): TemplateItem[] {
  const slaveCount = new Map<number, number>();
  for (const slot of slots) {
    if (slot.parentSlotId) slaveCount.set(slot.parentSlotId, (slaveCount.get(slot.parentSlotId) ?? 0) + 1);
  }
  const groups = new Map<string, TemplateItem>();
  for (const slot of slots) {
    if (slot.parentSlotId) continue;
    const label = slot.label.replace(/\s+\d+$/, '');
    const slaves = slaveCount.get(slot.id) ?? 0;
    const key = `${slot.kind}|${slot.productId ?? ''}|${label}|${slaves}`;
    const item = groups.get(key) ?? {
      kind: slot.kind as TemplateItem['kind'],
      productId: slot.productId,
      count: 0,
      label,
      ...(slaves > 0 ? { slaves } : {}),
    };
    item.count += 1;
    groups.set(key, item);
  }
  return [...groups.values()];
}
