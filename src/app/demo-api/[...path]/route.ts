import { NextResponse } from 'next/server';

const now = new Date().toISOString();
const nodes = [
  { id: 'demo-1', name: 'slmedia-rennes-01', givenName: 'SLMEDIA-RENNES-01', ipAddresses: ['100.64.0.11'], online: true, lastSeen: now, tags: ['tag:flotte-arena-rennes', 'tag:serveur'], agent: true, product: { id: 1, name: 'SL MEDIA', reference: 'Rennes', master: true, slaves: true, masterNodeId: null }, inventory: { os: 'Debian 12', upgradableCount: 0, reportedAt: now }, vulns: { total: 0, fixable: 0, fixableBySeverity: {}, worstFixable: null } },
  { id: 'demo-2', name: 'display-rennes-01', givenName: 'DISPLAY-RENNES-01', ipAddresses: ['100.64.0.12'], online: true, lastSeen: now, tags: ['tag:flotte-arena-rennes'], agent: true, product: { id: 2, name: 'SL VIDEO SYSTEM 3', reference: 'Rennes', master: false, slaves: false, masterNodeId: null }, inventory: { os: 'Windows 11', upgradableCount: 1, reportedAt: now }, vulns: { total: 1, fixable: 1, fixableBySeverity: { medium: 1 }, worstFixable: 'medium' } },
  { id: 'demo-3', name: 'hypervision-lyon', givenName: 'HYPERVISION-LYON', ipAddresses: ['100.64.0.21'], online: true, lastSeen: now, tags: ['tag:flotte-palais-lyon', 'tag:hypervision'], agent: false, product: null, inventory: null, vulns: null },
  { id: 'demo-4', name: 'display-lyon-02', givenName: 'DISPLAY-LYON-02', ipAddresses: ['100.64.0.22'], online: false, lastSeen: new Date(Date.now() - 43 * 60000).toISOString(), tags: ['tag:flotte-palais-lyon'], agent: true, product: { id: 2, name: 'SL VIDEO SYSTEM 3', reference: 'Lyon', master: false, slaves: false, masterNodeId: null }, inventory: { os: 'Windows 11', upgradableCount: 0, reportedAt: now }, vulns: { total: 0, fixable: 0, fixableBySeverity: {}, worstFixable: null } },
];
const policy = { fleets: [{ tag: 'tag:flotte-arena-rennes', label: 'Arena Rennes', deletable: true }, { tag: 'tag:flotte-palais-lyon', label: 'Palais des Sports Lyon', deletable: true }], rules: [], ssh: [], warnings: [], raw: '{}', updatedAt: now };
const profiles = [{ tag: 'tag:flotte-arena-rennes', displayName: 'Arena Rennes', sector: 'Sport', contact: 'Métropole de Rennes', phone: null, email: null, site: 'Rennes', reference: 'DEMO-001', notes: null, updatedAt: now }, { tag: 'tag:flotte-palais-lyon', displayName: 'Palais des Sports Lyon', sector: 'Sport', contact: 'Ville de Lyon', phone: null, email: null, site: 'Lyon', reference: 'DEMO-002', notes: null, updatedAt: now }];
const security = { openBySeverity: { medium: 1 }, fixableBySeverity: { medium: 1 }, investigating: 0, excluded: 0, topPackages: [{ package: 'windows-runtime', machines: 1, fixes: 1, worst: 'medium' }], perNode: { 'demo-2': { fixableBySeverity: { medium: 1 }, worstFixable: 'medium', fixable: 1 } } };

function data(path: string) {
  if (path === 'fleets/nodes') return nodes;
  if (path === 'acl/policy') return policy;
  if (path === 'fleets/profiles') return profiles;
  if (path === 'security/summary') return security;
  if (path === 'security') return { vulns: [], summary: security };
  if (path === 'plan') return [{ fleetTag: 'tag:flotte-arena-rennes', total: 4, filled: 4, keyIssued: 4 }, { fleetTag: 'tag:flotte-palais-lyon', total: 3, filled: 2, keyIssued: 3 }];
  if (path === 'jobs') return [];
  if (path === 'keys') return [];
  if (path === 'products') return [{ id: 1, name: 'SL MEDIA', category: 'gamme', master: true, slaves: true, machines: 1, supportTags: ['tag:support-jgirard'] }, { id: 2, name: 'SL VIDEO SYSTEM 3', category: 'gamme', master: false, slaves: false, machines: 2, supportTags: ['tag:support-jgirard'] }];
  if (path === 'support') return [{ tag: 'tag:support-jgirard', name: 'J. Girard', targets: ['tag:flotte-arena-rennes', 'tag:flotte-palais-lyon'] }];
  if (path.startsWith('machines/')) return { ...nodes.find((node) => node.id === path.split('/')[1]), jobs: [] };
  return [];
}

async function respond(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return NextResponse.json(request.method === 'GET' ? data(path.join('/')) : { ok: true, id: 'demo-action' });
}
export const GET = respond;
export const POST = respond;
export const PUT = respond;
export const PATCH = respond;
export const DELETE = respond;
