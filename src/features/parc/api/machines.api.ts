import type { FleetNode } from '@/features/fleets';

export interface MachineInventory {
  reportedAt: string;
  hostname: string | null;
  osName: string | null;
  osVersion: string | null;
  kernel: string | null;
  arch: string | null;
  cpu: string | null;
  cores: number | null;
  memoryMb: number | null;
  diskTotalGb: number | null;
  diskFreeGb: number | null;
  uptimeSeconds: number | null;
  packages: Array<{ name: string; version: string }>;
  upgradable: Array<{ name: string; current: string; candidate: string }>;
}

export interface AgentJob {
  id: number;
  kind: 'upgrade-package' | 'upgrade-system';
  package: string | null;
  status: 'pending' | 'running' | 'done' | 'failed';
  createdBy: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  output: string | null;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'unassigned' | 'unimportant';

export interface VulnPackage {
  source: string;
  binaries: string[];
  upgradable: string[];
  installed: string;
  candidate: string | null;
  fixed: string[];
  remaining: string[];
}

export interface VulnSummary {
  total: number;
  fixable: number;
  fixableBySeverity: Partial<Record<Severity, number>>;
  remainingBySeverity: Partial<Record<Severity, number>>;
  packages: number;
  worstFixable: Severity | null;
}

export interface MachineVulns {
  scannedAt: string;
  ecosystem: string | null;
  error: string | null;
  summary: VulnSummary | null;
  packages: VulnPackage[];
  details: Record<string, { summary: string | null; aliases: string[]; severity: Severity; cve: string | null; cvss: number | null; published: string | null }>;
}

export interface MachineDetail extends Omit<FleetNode, 'inventory' | 'vulns'> {
  agent: boolean;
  vulns: MachineVulns | null;
  inventory: MachineInventory | null;
  jobs: AgentJob[];
}

export async function fetchMachine(id: string): Promise<MachineDetail> {
  const response = await fetch(`/api/machines/${encodeURIComponent(id)}`);
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? `Machine indisponible (${response.status})`);
  }
  return response.json();
}

export async function requestUpdate(
  id: string,
  input: { kind: 'upgrade-package'; package: string } | { kind: 'upgrade-package'; packages: string[] } | { kind: 'upgrade-system' }
): Promise<{ id: number }> {
  const response = await fetch(`/api/machines/${encodeURIComponent(id)}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? `Demande refusée (${response.status})`);
  }
  return response.json();
}

/** Commande d'installation de l'agent pour un équipement déjà raccordé (nouveau jeton). */
export async function installAgent(id: string): Promise<{ token: string; installUrl: string }> {
  const response = await fetch(`/api/machines/${encodeURIComponent(id)}/agent`, { method: 'POST' });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? `Refusé (${response.status})`);
  }
  return response.json();
}

export async function rescanMachine(id: string): Promise<void> {
  const response = await fetch(`/api/machines/${encodeURIComponent(id)}/scan`, { method: 'POST' });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? `Analyse refusée (${response.status})`);
  }
}

export interface RecentJob extends Omit<AgentJob, 'startedAt' | 'output'> {
  deviceId: string;
}

export async function fetchRecentJobs(): Promise<RecentJob[]> {
  const response = await fetch('/api/jobs');
  if (!response.ok) throw new Error(`Mises à jour indisponibles (${response.status})`);
  return response.json();
}
