import { NextResponse } from 'next/server';

const now = new Date().toISOString();
const earlier = new Date(Date.now() - 22 * 60_000).toISOString();

// Données de vitrine : structure du banc local, sans clé ni donnée client.
const nodes = [
  { id: 'demo-windows-video', name: 'slvideo-system-3', givenName: 'SL VIDEO SYSTEM 3', ipAddresses: ['100.64.0.11'], online: true, lastSeen: now, tags: ['tag:flotte-test-windows', 'tag:serveur'], agent: true, product: { id: 9, name: 'SL VIDEO SYSTEM 3', reference: 'Banc Windows', master: true, slaves: false, masterNodeId: null }, inventory: { os: 'Windows 11 Pro', upgradableCount: 1, reportedAt: now }, vulns: { total: 1, fixable: 1, fixableBySeverity: { medium: 1 }, worstFixable: 'medium' } },
  { id: 'demo-hypervision-client', name: 'hypervision-client', givenName: 'POSTE HYPERVISION CLIENT', ipAddresses: ['100.64.0.12'], online: true, lastSeen: now, tags: ['tag:flotte-test-windows', 'tag:hypervision'], agent: true, product: null, inventory: { os: 'Windows 11 Pro', upgradableCount: 0, reportedAt: now }, vulns: { total: 0, fixable: 0, fixableBySeverity: {}, worstFixable: null } },
  { id: 'demo-slmedia-01', name: 'slmedia-01', givenName: 'SL MEDIA 01', ipAddresses: ['100.64.0.21'], online: true, lastSeen: now, tags: ['tag:flotte-sl-media', 'tag:serveur'], agent: true, product: { id: 6, name: 'SL MEDIA', reference: 'Pilote', master: true, slaves: true, masterNodeId: null }, inventory: { os: 'Debian 12', upgradableCount: 0, reportedAt: now }, vulns: { total: 0, fixable: 0, fixableBySeverity: {}, worstFixable: null } },
  { id: 'demo-slmedia-replica', name: 'slmedia-replica-01', givenName: 'SL MEDIA REPLICA 01', ipAddresses: ['100.64.0.22'], online: true, lastSeen: now, tags: ['tag:flotte-sl-media'], agent: true, product: { id: 6, name: 'SL MEDIA', reference: 'Pilote', master: false, slaves: true, masterNodeId: 'demo-slmedia-01' }, inventory: { os: 'Debian 12', upgradableCount: 2, reportedAt: now }, vulns: { total: 2, fixable: 2, fixableBySeverity: { low: 1, medium: 1 }, worstFixable: 'medium' } },
  { id: 'demo-support-jgirard', name: 'support-jgirard', givenName: 'SUPPORT JGIRARD', ipAddresses: ['100.64.0.5'], online: true, lastSeen: now, tags: ['tag:support-jgirard'], agent: true, product: null, inventory: { os: 'Windows 11 Pro', upgradableCount: 0, reportedAt: now }, vulns: { total: 0, fixable: 0, fixableBySeverity: {}, worstFixable: null } },
  { id: 'demo-sltempo-01', name: 'sltempo-01', givenName: 'SL TEMPO 01', ipAddresses: ['100.64.0.31'], online: false, lastSeen: earlier, tags: ['tag:flotte-piscine'], agent: false, product: { id: 7, name: 'SL TEMPO', reference: 'Banc de test', master: true, slaves: false, masterNodeId: null }, inventory: null, vulns: null },
];
const fleets = [
  { tag: 'tag:flotte-test-windows', label: 'Banc Windows', deletable: true },
  { tag: 'tag:flotte-sl-media', label: 'Pilote SL MEDIA', deletable: true },
  { tag: 'tag:flotte-piscine', label: 'Banc piscine', deletable: true },
];
const policy = { fleets, rules: [], ssh: [], warnings: [], raw: '{}', updatedAt: now };
const profiles = [
  { tag: 'tag:flotte-test-windows', displayName: 'Banc Windows', sector: 'Validation', contact: 'Équipe Stramatel', phone: null, email: null, site: 'Laboratoire', reference: 'DEMO-WIN', notes: 'SL VIDEO SYSTEM 3, poste hypervision client et support produit.', updatedAt: now },
  { tag: 'tag:flotte-sl-media', displayName: 'Pilote SL MEDIA', sector: 'Validation', contact: 'Équipe Stramatel', phone: null, email: null, site: 'Laboratoire', reference: 'DEMO-MEDIA', notes: 'Serveur SL MEDIA et réplica pour la recette.', updatedAt: now },
  { tag: 'tag:flotte-piscine', displayName: 'Banc piscine', sector: 'Validation', contact: 'Équipe Stramatel', phone: null, email: null, site: 'Laboratoire', reference: 'DEMO-PISCINE', notes: 'Exemple de composition multi-produits.', updatedAt: now },
];
const products = [
  { id: 6, name: 'SL MEDIA', category: 'gamme', master: true, slaves: true, machines: 2, supportTags: ['tag:support-jgirard'] },
  { id: 7, name: 'SL TEMPO', category: 'gamme', master: true, slaves: false, machines: 1, supportTags: ['tag:support-jgirard'] },
  { id: 8, name: 'SL VIDEO SCOREBOARD', category: 'gamme', master: false, slaves: false, machines: 0, supportTags: ['tag:support-jgirard'] },
  { id: 9, name: 'SL VIDEO SYSTEM 3', category: 'gamme', master: true, slaves: false, machines: 1, supportTags: ['tag:support-jgirard'] },
];
const slots = [
  { id: 32, fleetTag: 'tag:flotte-test-windows', kind: 'equipment', productId: 9, label: 'SL VIDEO SYSTEM 3', reference: null, position: 1, nodeId: 'demo-windows-video', keyId: 'demo-key-1', keyIssuedAt: now, parentSlotId: null },
  { id: 33, fleetTag: 'tag:flotte-test-windows', kind: 'hypervision', productId: null, label: 'Poste hypervision client', reference: null, position: 2, nodeId: 'demo-hypervision-client', keyId: 'demo-key-2', keyIssuedAt: now, parentSlotId: null },
  { id: 18, fleetTag: 'tag:flotte-sl-media', kind: 'equipment', productId: 6, label: 'SL MEDIA', reference: null, position: 1, nodeId: 'demo-slmedia-01', keyId: null, keyIssuedAt: null, parentSlotId: null },
  { id: 19, fleetTag: 'tag:flotte-sl-media', kind: 'equipment', productId: 6, label: 'SL MEDIA REPLICA 1', reference: null, position: 2, nodeId: 'demo-slmedia-replica', keyId: null, keyIssuedAt: null, parentSlotId: 18 },
  { id: 13, fleetTag: 'tag:flotte-piscine', kind: 'equipment', productId: 7, label: 'SL TEMPO', reference: null, position: 1, nodeId: 'demo-sltempo-01', keyId: null, keyIssuedAt: null, parentSlotId: null },
  { id: 14, fleetTag: 'tag:flotte-piscine', kind: 'equipment', productId: 6, label: 'SL MEDIA', reference: null, position: 2, nodeId: null, keyId: null, keyIssuedAt: null, parentSlotId: null },
  { id: 15, fleetTag: 'tag:flotte-piscine', kind: 'hypervision', productId: null, label: "Poste d'hypervision", reference: null, position: 3, nodeId: null, keyId: null, keyIssuedAt: null, parentSlotId: null },
];
const security = { openBySeverity: { low: 1, medium: 2 }, fixableBySeverity: { low: 1, medium: 2 }, investigating: 0, excluded: 0, topPackages: [{ package: 'openssl', machines: 1, fixes: 2, worst: 'medium' }], perNode: { 'demo-windows-video': { fixableBySeverity: { medium: 1 }, worstFixable: 'medium', fixable: 1 }, 'demo-slmedia-replica': { fixableBySeverity: { low: 1, medium: 1 }, worstFixable: 'medium', fixable: 2 } } };

function planFor(fleetTag: string) {
  return slots.filter((slot) => slot.fleetTag === fleetTag).map((slot) => {
    const product = products.find((item) => item.id === slot.productId);
    const machine = nodes.find((item) => item.id === slot.nodeId);
    return {
      id: slot.id,
      kind: slot.kind,
      label: slot.label,
      reference: slot.reference,
      parentSlotId: slot.parentSlotId,
      product: product ? { id: product.id, name: product.name, master: product.master, slaves: product.slaves } : null,
      keyIssuedAt: slot.keyIssuedAt,
      machine: machine ? { id: machine.id, name: machine.givenName, online: machine.online, ip: machine.ipAddresses[0] ?? null } : null,
    };
  });
}

function data(path: string) {
  if (path === 'fleets/nodes') return nodes;
  if (path === 'acl/policy') return policy;
  if (path === 'fleets/profiles') return profiles;
  if (path.startsWith('fleets/profiles/')) return profiles.find((profile) => profile.tag === decodeURIComponent(path.slice('fleets/profiles/'.length))) ?? null;
  if (path === 'security/summary') return security;
  if (path === 'security') return { vulns: [], summary: security };
  if (path === 'plan') return fleets.map((fleet) => { const items = slots.filter((slot) => slot.fleetTag === fleet.tag); return { fleetTag: fleet.tag, total: items.length, filled: items.filter((slot) => slot.nodeId).length, keyIssued: items.filter((slot) => slot.keyId).length }; });
  if (path.startsWith('plan/')) return planFor(decodeURIComponent(path.slice('plan/'.length)));
  if (path === 'jobs') return [];
  if (path === 'keys') return [];
  if (path === 'products') return products;
  if (path === 'products/links') return [{ id: 1, fromId: 7, toId: 6, ports: '443, 41641', note: 'Flux de démonstration' }];
  if (path === 'support') return [{ tag: 'tag:support-jgirard', name: 'Jessy Girard', targets: fleets.map((fleet) => fleet.tag), manualTargets: [], automaticTargets: fleets.map((fleet) => fleet.tag), machines: [{ id: 'demo-support-jgirard', name: 'SUPPORT JGIRARD', online: true, ip: '100.64.0.5', lastSeen: now }] }];
  if (path === 'templates') return [{ id: 3, name: 'SL MEDIA', description: "Serveur SL MEDIA, réplica et poste d'hypervision", items: [{ kind: 'equipment', productId: 6, count: 1, label: 'SL MEDIA', slaves: 1 }, { kind: 'hypervision', productId: null, count: 1, label: "Poste d'hypervision" }], createdAt: now, updatedAt: now }];
  if (path === 'activity') return { events: [{ id: 1, at: now, actor: 'demo', action: 'consultation', target: 'Banc Windows' }], total: 1, retentionDays: 365 };
  if (path === 'users') return [{ id: 1, username: 'demo', role: 'ADMIN', disabled: false, mustChangePassword: false, createdAt: now }];
  if (path === 'updates') return { machines: [], skipped: [], totalFixes: 0 };
  if (path === 'health') return { status: 'ok', source: 'demo', uptimeSeconds: 3600 };
  if (path.startsWith('machines/')) {
    const node = nodes.find((item) => item.id === path.split('/')[1]) ?? nodes[0];
    return { ...node, jobs: [], inventory: node.inventory ? { reportedAt: now, hostname: node.name, osName: node.inventory.os, osVersion: null, kernel: null, arch: 'x86_64', cpu: null, cores: null, memoryMb: null, diskTotalGb: null, diskFreeGb: null, uptimeSeconds: null, packages: [], upgradable: [] } : null, vulns: [] };
  }
  return [];
}

async function respond(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const pathname = path.join('/');
  if (request.method === 'GET') return NextResponse.json(data(pathname));

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  if (pathname === 'updates') {
    const selected = nodes.filter((node) => !body.fleetTag || node.tags.includes(body.fleetTag as string));
    if (body.dryRun) return NextResponse.json({ machines: selected.filter((node) => node.agent).map((node) => ({ nodeId: node.id, name: node.givenName, online: node.online, packages: [], upgradableCount: node.inventory?.upgradableCount ?? 0, fixes: node.vulns?.fixable ?? 0 })), skipped: [], totalFixes: selected.reduce((count, node) => count + (node.vulns?.fixable ?? 0), 0) });
    return NextResponse.json({ machines: selected.length, jobs: selected.filter((node) => node.agent).length, skipped: 0 });
  }
  if (pathname === 'keys' || pathname.endsWith('/key')) return NextResponse.json({ id: 'demo-key', reusable: false, used: false, expiration: new Date(Date.now() + 86_400_000).toISOString(), createdAt: now, tags: [], key: 'demo-key-not-valid', loginServer: 'https://demo.stramscale.invalid', agentToken: 'demo-agent-token', installUrl: 'https://demo.stramscale.invalid/install' });
  if (pathname.endsWith('/agent')) return NextResponse.json({ token: 'demo-agent-token', installUrl: 'https://demo.stramscale.invalid/install' });
  if (pathname.endsWith('/jobs')) return NextResponse.json({ id: 1 });
  if (pathname === 'security/assessments') return NextResponse.json({ id: 1 });
  if (pathname === 'support') return NextResponse.json({ tag: 'tag:support-demo', name: String(body.name ?? 'Support démonstration') });
  if (pathname === 'products') return NextResponse.json({ id: 99, name: String(body.name ?? 'Produit démonstration'), category: 'gamme', master: false, slaves: false, machines: 0, supportTags: [] });
  if (pathname === 'products/links') return NextResponse.json({ id: 99, fromId: Number(body.fromId ?? 6), toId: Number(body.toId ?? 7), ports: String(body.ports ?? '*'), note: body.note ? String(body.note) : null });
  if (pathname === 'templates') return NextResponse.json({ id: 99, name: String(body.name ?? 'Modèle démonstration'), description: body.description ? String(body.description) : null, items: body.items ?? [] });
  return NextResponse.json({ ok: true, id: 'demo-action' });
}

export const GET = respond;
export const POST = respond;
export const PUT = respond;
export const PATCH = respond;
export const DELETE = respond;
