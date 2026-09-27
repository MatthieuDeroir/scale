import { prisma } from './db';
import { listNodes, type RawHeadscaleNode } from './headscale';
import { SEVERITY_RANK, severityOf, type PackageVulns, type Severity } from './vulns';

/**
 * Cybersécurité du parc : les failles de toutes les machines, regroupées par
 * CVE, avec les décisions de tri (VEX). Une même source pour l'onglet
 * Cybersécurité et le tableau de bord, pour que les chiffres concordent.
 */

export const VEX_STATUSES = ['not_affected', 'under_investigation', 'affected'] as const;
export type VexStatus = (typeof VEX_STATUSES)[number];

/** Justifications d'un « non concerné », reprises telles quelles de la norme VEX (CISA). */
export const VEX_JUSTIFICATIONS = [
  'component_not_present',
  'vulnerable_code_not_present',
  'vulnerable_code_not_in_execute_path',
  'vulnerable_code_cannot_be_controlled_by_adversary',
  'inline_mitigations_already_exist',
] as const;
export type VexJustification = (typeof VEX_JUSTIFICATIONS)[number];

/** État d'une faille sur le parc, après tri. */
export type VulnState = 'open' | 'investigating' | 'affected' | 'excluded';

const FLEET_TAG = /^tag:(interne|a-assigner|flotte-.+)$/;

export interface Assessment {
  id: number;
  productId: number | null;
  productName: string | null;
  status: VexStatus;
  justification: VexJustification | null;
  note: string | null;
  author: string;
  updatedAt: string;
}

export interface Occurrence {
  nodeId: string;
  machine: string;
  online: boolean;
  fleetTag: string | null;
  productId: number | null;
  productName: string | null;
  package: string;
  installed: string;
  candidate: string | null;
  /** La version proposée par la distribution corrige la faille. */
  fixable: boolean;
  /** Écartée par une décision « non concerné » (produit de la machine, ou tout le parc). */
  excluded: boolean;
  status: VexStatus | null;
}

export interface ParkVuln {
  key: string;
  cve: string | null;
  ids: string[];
  summary: string | null;
  severity: Severity;
  cvss: number | null;
  published: string | null;
  packages: string[];
  state: VulnState;
  /** Machines encore touchées (hors décision « non concerné »). */
  active: number;
  /** Dont celles qu'une mise à jour disponible corrige. */
  fixableOn: number;
  occurrences: Occurrence[];
  assessments: Assessment[];
}

/** Clé de tri d'une faille : sa CVE, pour décider une fois pour Debian et Ubuntu. */
export function vulnKeyOf(id: string, cve: string | null | undefined): string {
  return cve || id;
}

/** Décision qui s'applique à une machine : celle de son produit, sinon celle du parc. */
export function assessmentFor(assessments: Assessment[], productId: number | null): Assessment | undefined {
  return (
    (productId !== null ? assessments.find((item) => item.productId === productId) : undefined) ??
    assessments.find((item) => item.productId === null)
  );
}

export function stateOf(occurrences: Occurrence[]): VulnState {
  const live = occurrences.filter((item) => !item.excluded);
  if (live.length === 0) return 'excluded';
  if (live.some((item) => item.status === 'under_investigation')) return 'investigating';
  if (live.every((item) => item.status === 'affected')) return 'affected';
  return 'open';
}

/**
 * Rapport des failles du parc. `nodes` évite un second appel à Headscale
 * quand l'appelant les a déjà.
 */
export async function parkVulns(nodes?: RawHeadscaleNode[]): Promise<ParkVuln[]> {
  if (!nodes) {
    const response = await listNodes();
    nodes = response.ok ? ((await response.json()) as { nodes: RawHeadscaleNode[] }).nodes : [];
  }
  const byKey = new Map(nodes.filter((node) => node.preAuthKey).map((node) => [node.preAuthKey!.id, node]));
  const [scans, machineProducts, rawAssessments] = await Promise.all([
    prisma.vulnScan.findMany({ include: { device: { select: { keyId: true } } } }),
    prisma.machineProduct.findMany({ include: { product: { select: { name: true } } } }),
    prisma.vulnAssessment.findMany({ include: { product: { select: { name: true } } }, orderBy: { updatedAt: 'desc' } }),
  ]);
  const productOf = new Map(machineProducts.map((item) => [item.nodeId, item]));

  const parsed = scans.flatMap((scan) => {
    const node = scan.device.keyId ? byKey.get(scan.device.keyId) : undefined;
    if (!node || !scan.ecosystem) return [];
    const packages = (JSON.parse(scan.results || '{}') as { packages?: PackageVulns[] }).packages ?? [];
    return [{ node, ecosystem: scan.ecosystem, packages }];
  });
  const ids = [...new Set(parsed.flatMap((item) => item.packages.flatMap((pkg) => [...pkg.fixed, ...pkg.remaining])))];
  const records = new Map((await prisma.osvVuln.findMany({ where: { id: { in: ids } } })).map((row) => [row.id, row]));

  const assessmentsByKey = new Map<string, Assessment[]>();
  for (const row of rawAssessments) {
    const list = assessmentsByKey.get(row.vulnKey) ?? [];
    list.push({
      id: row.id,
      productId: row.productId,
      productName: row.product?.name ?? null,
      status: row.status as VexStatus,
      justification: (row.justification as VexJustification | null) ?? null,
      note: row.note,
      author: row.author,
      updatedAt: row.updatedAt.toISOString(),
    });
    assessmentsByKey.set(row.vulnKey, list);
  }

  const vulns = new Map<string, ParkVuln>();
  for (const { node, ecosystem, packages } of parsed) {
    const product = productOf.get(node.id);
    for (const pkg of packages) {
      const fixedSet = new Set(pkg.fixed);
      for (const id of [...pkg.fixed, ...pkg.remaining]) {
        const record = records.get(id);
        const key = vulnKeyOf(id, record?.cve);
        const severity = severityOf(
          record ? (JSON.parse(record.urgency) as Record<string, string>)[ecosystem] : null,
          record?.cvssScore
        );
        const assessments = assessmentsByKey.get(key) ?? [];
        const vuln =
          vulns.get(key) ??
          ({
            key,
            cve: record?.cve ?? (key.startsWith('CVE-') ? key : null),
            ids: [],
            summary: record?.summary ?? null,
            severity,
            cvss: record?.cvssScore ?? null,
            published: record?.published?.toISOString() ?? null,
            packages: [],
            state: 'open',
            active: 0,
            fixableOn: 0,
            occurrences: [],
            assessments,
          } satisfies ParkVuln);
        if (!vuln.ids.includes(id)) vuln.ids.push(id);
        if (!vuln.packages.includes(pkg.source)) vuln.packages.push(pkg.source);
        // Gravité la plus haute rencontrée (elle peut varier d'une distribution à l'autre).
        if (SEVERITY_RANK[severity] > SEVERITY_RANK[vuln.severity]) vuln.severity = severity;
        if (vuln.occurrences.some((item) => item.nodeId === node.id && item.package === pkg.source)) continue;
        const decision = assessmentFor(assessments, product?.productId ?? null);
        vuln.occurrences.push({
          nodeId: node.id,
          machine: node.givenName || node.name,
          online: node.online,
          fleetTag: node.tags.find((tag) => FLEET_TAG.test(tag)) ?? null,
          productId: product?.productId ?? null,
          productName: product?.product.name ?? null,
          package: pkg.source,
          installed: pkg.installed,
          candidate: pkg.candidate,
          fixable: fixedSet.has(id),
          excluded: decision?.status === 'not_affected',
          status: decision?.status ?? null,
        });
        vulns.set(key, vuln);
      }
    }
  }

  for (const vuln of vulns.values()) {
    const live = vuln.occurrences.filter((item) => !item.excluded);
    vuln.active = new Set(live.map((item) => item.nodeId)).size;
    vuln.fixableOn = new Set(live.filter((item) => item.fixable).map((item) => item.nodeId)).size;
    vuln.state = stateOf(vuln.occurrences);
  }
  return [...vulns.values()].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.active - a.active || a.key.localeCompare(b.key)
  );
}

export interface SecuritySummary {
  /** Failles distinctes encore à traiter (hors « non concerné » et « sans importance »), par gravité. */
  openBySeverity: Partial<Record<Severity, number>>;
  /** Dont corrigeables par une mise à jour disponible. */
  fixableBySeverity: Partial<Record<Severity, number>>;
  investigating: number;
  excluded: number;
  /** Paquets à mettre à jour en priorité : ceux qui corrigent le plus de failles graves. */
  topPackages: Array<{ package: string; machines: number; fixes: number; worst: Severity }>;
  /** Par machine : failles corrigeables encore à traiter, par gravité. */
  perNode: Record<string, { fixableBySeverity: Partial<Record<Severity, number>>; worstFixable: Severity | null; fixable: number }>;
}

export function summarizePark(vulns: ParkVuln[]): SecuritySummary {
  const summary: SecuritySummary = {
    openBySeverity: {},
    fixableBySeverity: {},
    investigating: 0,
    excluded: 0,
    topPackages: [],
    perNode: {},
  };
  const packages = new Map<string, { machines: Set<string>; fixes: Set<string>; worst: Severity }>();
  for (const vuln of vulns) {
    if (vuln.state === 'excluded') {
      summary.excluded++;
      continue;
    }
    if (vuln.state === 'investigating') summary.investigating++;
    if (vuln.severity === 'unimportant') continue;
    summary.openBySeverity[vuln.severity] = (summary.openBySeverity[vuln.severity] ?? 0) + 1;
    if (vuln.fixableOn > 0) summary.fixableBySeverity[vuln.severity] = (summary.fixableBySeverity[vuln.severity] ?? 0) + 1;
    for (const item of vuln.occurrences) {
      if (item.excluded || !item.fixable) continue;
      const node = (summary.perNode[item.nodeId] ??= { fixableBySeverity: {}, worstFixable: null, fixable: 0 });
      node.fixableBySeverity[vuln.severity] = (node.fixableBySeverity[vuln.severity] ?? 0) + 1;
      node.fixable++;
      if (!node.worstFixable || SEVERITY_RANK[vuln.severity] > SEVERITY_RANK[node.worstFixable]) node.worstFixable = vuln.severity;
      const pkg = packages.get(item.package) ?? { machines: new Set(), fixes: new Set(), worst: vuln.severity };
      pkg.machines.add(item.nodeId);
      pkg.fixes.add(vuln.key);
      if (SEVERITY_RANK[vuln.severity] > SEVERITY_RANK[pkg.worst]) pkg.worst = vuln.severity;
      packages.set(item.package, pkg);
    }
  }
  summary.topPackages = [...packages.entries()]
    .map(([name, item]) => ({ package: name, machines: item.machines.size, fixes: item.fixes.size, worst: item.worst }))
    .sort((a, b) => SEVERITY_RANK[b.worst] - SEVERITY_RANK[a.worst] || b.fixes - a.fixes || b.machines - a.machines)
    .slice(0, 8);
  return summary;
}
