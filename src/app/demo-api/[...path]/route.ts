import { NextResponse } from 'next/server';

const now = new Date().toISOString();
const fleetTag = (name: string) => `tag:flotte-${name}`;
const inventory = { os: 'Debian GNU/Linux 12 (bookworm)', upgradableCount: 0, reportedAt: now };
const noVulns = { total: 264, fixable: 0, fixableBySeverity: {}, worstFixable: null };

// Copie du parc local au 28 septembre 2026. Les clés et données techniques
// d'enrôlement ne font pas partie de la vitrine publique.
const nodeRows: Array<[string, string, string, string, string[], boolean]> = [
  ['25', 'stra-04nzts018369', 'piscine-sl-tempo', '100.64.0.11', [fleetTag('piscine'), 'tag:serveur'], true],
  ['26', 'stra-04nzts018369', 'piscine-sl-media', '100.64.0.12', [fleetTag('piscine'), 'tag:serveur'], true],
  ['27', 'stra-04nzts018369', 'piscine-sl-media-replica-1', '100.64.0.13', [fleetTag('piscine')], true],
  ['28', 'stra-04nzts018369', 'piscine-sl-media-replica-2', '100.64.0.14', [fleetTag('piscine')], true],
  ['29', 'stra-04nzts018369', 'cinema-sl-media', '100.64.0.15', [fleetTag('cinema'), 'tag:serveur'], true],
  ['30', 'stra-04nzts018369', 'cinema-sl-media-replica-1', '100.64.0.16', [fleetTag('cinema')], true],
  ['31', 'stra-04nzts018369', 'cinema-sl-media-replica-2', '100.64.0.17', [fleetTag('cinema')], true],
  ['32', 'piscine-poste-d-hypervision', 'piscine-poste-d-hypervision', '100.64.0.18', [fleetTag('piscine'), 'tag:hypervision'], false],
  ['33', 'cinema-poste-d-hypervision', 'cinema-poste-d-hypervision', '100.64.0.19', [fleetTag('cinema'), 'tag:hypervision'], false],
  ['34', 'stra-04nzts018369', 'bowling-sl-media', '100.64.0.20', [fleetTag('bowling'), 'tag:serveur'], true],
  ['35', 'stra-04nzts018369', 'bowling-sl-media-replica-1', '100.64.0.21', [fleetTag('bowling')], true],
  ['36', 'stra-04nzts018369', 'bowling-sl-media-replica-2', '100.64.0.22', [fleetTag('bowling')], true],
  ['37', 'bowling-poste-d-hypervision', 'bowling-poste-d-hypervision', '100.64.0.23', [fleetTag('bowling'), 'tag:hypervision'], false],
  ['38', 'test-windows-poste-hypervision-client', 'test-windows-poste-hypervision-client', '100.64.0.24', [fleetTag('test-windows'), 'tag:hypervision'], false],
  ['39', 'test-windows-support-jgirard', 'test-windows-sl-video-system-3', '100.64.0.25', [fleetTag('test-windows'), 'tag:serveur', 'tag:support-jgirard'], false],
];
const productByNode: Record<string, { id: number; name: string; master: boolean; slaves: boolean; masterNodeId: string | null }> = {
  '25': { id: 7, name: 'SL TEMPO', master: true, slaves: false, masterNodeId: null },
  '26': { id: 6, name: 'SL MEDIA', master: true, slaves: true, masterNodeId: null }, '27': { id: 6, name: 'SL MEDIA', master: false, slaves: true, masterNodeId: '26' }, '28': { id: 6, name: 'SL MEDIA', master: false, slaves: true, masterNodeId: '26' },
  '29': { id: 6, name: 'SL MEDIA', master: true, slaves: true, masterNodeId: null }, '30': { id: 6, name: 'SL MEDIA', master: false, slaves: true, masterNodeId: '29' }, '31': { id: 6, name: 'SL MEDIA', master: false, slaves: true, masterNodeId: '29' },
  '34': { id: 6, name: 'SL MEDIA', master: true, slaves: true, masterNodeId: null }, '35': { id: 6, name: 'SL MEDIA', master: false, slaves: true, masterNodeId: '34' }, '36': { id: 6, name: 'SL MEDIA', master: false, slaves: true, masterNodeId: '34' },
  '39': { id: 9, name: 'SL VIDEO SYSTEM 3', master: true, slaves: false, masterNodeId: null },
};
const nodes = nodeRows.map(([id, name, givenName, ip, tags, agent]) => ({ id, name, givenName, ipAddresses: [ip], online: true, lastSeen: now, tags, agent, product: productByNode[id] ? { ...productByNode[id], reference: null } : null, inventory: agent ? inventory : null, vulns: agent ? noVulns : null }));
const fleets = ['piscine', 'cinema', 'bowling', 'test-windows'].map((name) => ({ tag: fleetTag(name), label: name, deletable: true }));
const policy = { fleets, rules: [], ssh: [], warnings: [], raw: '{}', updatedAt: now };
const profiles = [{ tag: fleetTag('test-windows'), displayName: 'Test Windows', sector: null, contact: null, phone: null, email: null, site: null, reference: null, notes: 'Banc de test VPN : SL VIDEO SYSTEM 3 sous Windows 11, poste client hypervision, support jgirard. Préparé via Codex.', updatedAt: now }];
const products = [
  { id: 6, name: 'SL MEDIA', category: 'gamme', master: true, slaves: true, machines: 9, supportTags: [] },
  { id: 7, name: 'SL TEMPO', category: 'gamme', master: true, slaves: false, machines: 1, supportTags: [] },
  { id: 8, name: 'SL VIDEO SCOREBOARD', category: 'gamme', master: false, slaves: false, machines: 0, supportTags: [] },
  { id: 9, name: 'SL VIDEO SYSTEM 3', category: 'gamme', master: true, slaves: false, machines: 1, supportTags: [] },
];
const slots = [
  [13, 'piscine', 'equipment', 7, 'SL TEMPO', '25', null], [14, 'piscine', 'equipment', 6, 'SL MEDIA', '26', null], [15, 'piscine', 'equipment', 6, 'SL MEDIA REPLICA 1', '27', 14], [16, 'piscine', 'equipment', 6, 'SL MEDIA REPLICA 2', '28', 14], [24, 'piscine', 'hypervision', null, "Poste d'hypervision", '32', null],
  [18, 'cinema', 'equipment', 6, 'SL MEDIA', '29', null], [19, 'cinema', 'equipment', 6, 'SL MEDIA REPLICA 1', '30', 18], [20, 'cinema', 'equipment', 6, 'SL MEDIA REPLICA 2', '31', 18], [25, 'cinema', 'hypervision', null, "Poste d'hypervision", '33', null],
  [21, 'bowling', 'equipment', 6, 'SL MEDIA', '34', null], [22, 'bowling', 'equipment', 6, 'SL MEDIA REPLICA 1', '35', 21], [23, 'bowling', 'equipment', 6, 'SL MEDIA REPLICA 2', '36', 21], [26, 'bowling', 'hypervision', null, "Poste d'hypervision", '37', null],
  [27, 'bowling-atlantis', 'equipment', 6, 'SL MEDIA', null, null], [28, 'bowling-atlantis', 'equipment', 6, 'SL MEDIA REPLICA 1', null, 27], [29, 'bowling-atlantis', 'equipment', 6, 'SL MEDIA REPLICA 2', null, 27], [30, 'bowling-atlantis', 'hypervision', null, "Poste d'hypervision", null, null], [31, 'adidas-arena', 'equipment', 9, 'SL VIDEO SYSTEM 3', null, null],
  [32, 'test-windows', 'equipment', 9, 'SL VIDEO SYSTEM 3', '39', null], [33, 'test-windows', 'hypervision', null, 'Poste hypervision client', '38', null],
].map(([id, fleet, kind, productId, label, nodeId, parentSlotId]) => ({ id, fleetTag: fleetTag(String(fleet)), kind, productId, label, reference: null, nodeId, keyId: null, keyIssuedAt: null, parentSlotId }));
const templates = [
  { id: 2, name: 'Piscine', description: "SL TEMPO, SL MEDIA et 3 REPLICA, poste d'hypervision (SL TEMPO et SERVEUR SL MEDIA)", items: [{ kind: 'equipment', productId: 7, count: 1, label: 'SL TEMPO' }, { kind: 'equipment', productId: 6, count: 1, label: 'SL MEDIA', slaves: 3 }, { kind: 'hypervision', productId: null, count: 1, label: "Poste d'hypervision" }, { kind: 'support', productId: null, count: 1, label: 'glegoff', supportTag: 'tag:support-glegoff' }, { kind: 'support', productId: null, count: 1, label: 'mderoir', supportTag: 'tag:support-mderoir' }] },
  { id: 3, name: 'SL Média', description: "SL MEDIA et 2 REPLICA, poste d'hypervision (SERVEUR SL MEDIA)", items: [{ kind: 'equipment', productId: 6, count: 1, label: 'SL MEDIA', slaves: 2 }, { kind: 'hypervision', productId: null, count: 1, label: "Poste d'hypervision" }, { kind: 'support', productId: null, count: 1, label: 'glegoff', supportTag: 'tag:support-glegoff' }] },
];
const security = { openBySeverity: {}, fixableBySeverity: {}, investigating: 0, excluded: 0, topPackages: [], perNode: {} };

function planFor(tag: string) { return slots.filter((slot) => slot.fleetTag === tag).map((slot) => { const product = products.find((item) => item.id === slot.productId); const machine = nodes.find((item) => item.id === slot.nodeId); return { id: slot.id, kind: slot.kind, label: slot.label, reference: slot.reference, parentSlotId: slot.parentSlotId, product: product ? { id: product.id, name: product.name, master: product.master, slaves: product.slaves } : null, keyIssuedAt: slot.keyIssuedAt, machine: machine ? { id: machine.id, name: machine.givenName, online: machine.online, ip: machine.ipAddresses[0] ?? null } : null }; }); }
function data(path: string) {
  if (path === 'fleets/nodes') return nodes;
  if (path === 'acl/policy') return policy;
  if (path === 'fleets/profiles') return profiles;
  if (path.startsWith('fleets/profiles/')) return profiles.find((item) => item.tag === decodeURIComponent(path.slice(16))) ?? null;
  if (path === 'plan') return fleets.map((fleet) => { const items = slots.filter((item) => item.fleetTag === fleet.tag); return { fleetTag: fleet.tag, total: items.length, filled: items.filter((item) => item.nodeId).length, keyIssued: 0 }; });
  if (path.startsWith('plan/')) return planFor(decodeURIComponent(path.slice(5)));
  if (path === 'products') return products;
  if (path === 'products/links') return [{ id: 1, fromId: 6, toId: 6, ports: '*', note: null }, { id: 2, fromId: 7, toId: 6, ports: '*', note: null }];
  if (path === 'templates') return templates;
  if (path === 'support') return [
    { tag: 'tag:support-glegoff', name: 'glegoff', targets: [fleetTag('cinema'), fleetTag('bowling')], manualTargets: [fleetTag('cinema'), fleetTag('bowling')], automaticTargets: [], machines: [] },
    { tag: 'tag:support-jgirard', name: 'Matthieu Deroir', targets: [fleetTag('test-windows')], manualTargets: [fleetTag('test-windows')], automaticTargets: [], machines: [{ id: '39', name: 'test-windows-sl-video-system-3', online: true, ip: '100.64.0.25', lastSeen: now }] },
    { tag: 'tag:support-mderoir', name: 'mderoir', targets: [fleetTag('piscine')], manualTargets: [fleetTag('piscine')], automaticTargets: [], machines: [] },
    { tag: 'tag:support-pforget', name: 'pforget', targets: [], manualTargets: [], automaticTargets: [], machines: [] },
  ];
  if (path === 'security/summary') return security;
  if (path === 'security') return { vulns: [], summary: security };
  if (path === 'jobs' || path === 'keys') return [];
  if (path === 'activity') return { events: [], total: 0, retentionDays: 365 };
  if (path === 'users') return [{ id: 1, username: 'demo', role: 'ADMIN', disabled: false, mustChangePassword: false, createdAt: now }];
  if (path === 'updates') return { machines: [], skipped: [], totalFixes: 0 };
  if (path === 'health') return { status: 'ok', source: 'demo', uptimeSeconds: 3600 };
  if (path.startsWith('machines/')) { const node = nodes.find((item) => item.id === path.split('/')[1]) ?? nodes[0]; return { ...node, jobs: [], inventory: node.inventory ? { reportedAt: now, hostname: node.name, osName: node.inventory.os, osVersion: null, kernel: null, arch: 'x86_64', cpu: null, cores: null, memoryMb: null, diskTotalGb: null, diskFreeGb: null, uptimeSeconds: null, packages: [], upgradable: [] } : null, vulns: null }; }
  return [];
}
async function respond(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params; const pathname = path.join('/'); if (request.method === 'GET') return NextResponse.json(data(pathname));
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  if (pathname === 'updates') return NextResponse.json(body.dryRun ? { machines: [], skipped: [], totalFixes: 0 } : { machines: 0, jobs: 0, skipped: 0 });
  if (pathname === 'keys' || pathname.endsWith('/key')) return NextResponse.json({ id: 'demo-key', reusable: false, used: false, expiration: new Date(Date.now() + 86_400_000).toISOString(), createdAt: now, tags: [], key: 'demo-key-not-valid', loginServer: 'https://demo.stramscale.invalid' });
  if (pathname.endsWith('/agent')) return NextResponse.json({ token: 'demo-agent-token', installUrl: 'https://demo.stramscale.invalid/install' });
  if (pathname.endsWith('/jobs') || pathname === 'security/assessments') return NextResponse.json({ id: 1 });
  return NextResponse.json({ ok: true, id: 'demo-action' });
}
export const GET = respond; export const POST = respond; export const PUT = respond; export const PATCH = respond; export const DELETE = respond;
