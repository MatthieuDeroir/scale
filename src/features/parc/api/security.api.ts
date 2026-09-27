import type { Severity } from './machines.api';

export type VexStatus = 'not_affected' | 'under_investigation' | 'affected';
export type VexJustification =
  | 'component_not_present'
  | 'vulnerable_code_not_present'
  | 'vulnerable_code_not_in_execute_path'
  | 'vulnerable_code_cannot_be_controlled_by_adversary'
  | 'inline_mitigations_already_exist';
export type VulnState = 'open' | 'investigating' | 'affected' | 'excluded';

export const VEX_JUSTIFICATIONS: VexJustification[] = [
  'component_not_present',
  'vulnerable_code_not_present',
  'vulnerable_code_not_in_execute_path',
  'vulnerable_code_cannot_be_controlled_by_adversary',
  'inline_mitigations_already_exist',
];

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
  fixable: boolean;
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
  active: number;
  fixableOn: number;
  occurrences: Occurrence[];
  assessments: Assessment[];
}

/** Faille de la liste : sans le détail par machine, avec les produits touchés. */
export type ParkVulnItem = Omit<ParkVuln, 'occurrences'> & { productIds: number[] };

export interface SecuritySummary {
  openBySeverity: Partial<Record<Severity, number>>;
  fixableBySeverity: Partial<Record<Severity, number>>;
  investigating: number;
  excluded: number;
  topPackages: Array<{ package: string; machines: number; fixes: number; worst: Severity }>;
  perNode: Record<string, { fixableBySeverity: Partial<Record<Severity, number>>; worstFixable: Severity | null; fixable: number }>;
}

export interface FleetPlanProgress {
  fleetTag: string;
  total: number;
  filled: number;
  keyIssued: number;
}

async function call<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const response = await fetch(url, {
    ...init,
    ...(init?.json !== undefined
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(init.json) }
      : {}),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? `Refusé (${response.status})`);
  }
  return response.json();
}

export const fetchSecurity = () => call<{ vulns: ParkVulnItem[]; summary: SecuritySummary }>('/api/security');
export const fetchVulnDetail = (key: string) => call<ParkVuln>(`/api/security/detail?key=${encodeURIComponent(key)}`);
export const fetchSecuritySummary = () => call<SecuritySummary>('/api/security/summary');
export const fetchPlansProgress = () => call<FleetPlanProgress[]>('/api/plan');
export const saveAssessment = (input: {
  vulnKey: string;
  productId: number | null;
  status: VexStatus;
  justification: VexJustification | null;
  note: string;
}) => call<{ id: number }>('/api/security/assessments', { method: 'POST', json: input });
export const deleteAssessment = (id: number) => call<{ ok: true }>(`/api/security/assessments/${id}`, { method: 'DELETE' });

/** Liens de référence d'une faille : trackers Debian et NVD pour une CVE, OSV sinon. */
export function vulnLinks(vuln: Pick<ParkVuln, 'cve' | 'ids'>): Array<{ label: string; href: string }> {
  if (vuln.cve) {
    return [
      { label: 'Debian', href: `https://security-tracker.debian.org/tracker/${vuln.cve}` },
      { label: 'NVD', href: `https://nvd.nist.gov/vuln/detail/${vuln.cve}` },
      { label: 'OSV', href: `https://osv.dev/vulnerability/${vuln.ids[0]}` },
    ];
  }
  return vuln.ids.map((id) => ({ label: id, href: `https://osv.dev/vulnerability/${id}` }));
}
