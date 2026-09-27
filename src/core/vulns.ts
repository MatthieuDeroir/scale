import { cvss3BaseScore } from './cvss';
import { prisma } from './db';

/**
 * Traqueur de failles : croise l'inventaire d'une machine avec la base
 * publique OSV (qui agrège les bases de sécurité Debian et Ubuntu). Pour
 * chaque paquet source, on compare la version installée à celle qu'apt
 * propose : les failles qui disparaissent sont corrigées par la mise à jour,
 * les autres n'ont pas encore de correctif.
 *
 * Seuls des noms et versions de paquets publics partent vers OSV, jamais
 * d'information sur la machine ou le client.
 */

const OSV = () => (process.env.OSV_API_URL || 'https://api.osv.dev').replace(/\/$/, '');
const BATCH = 1000;
const PARALLEL = 10;

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'unassigned' | 'unimportant';

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  unassigned: 1,
  unimportant: 0,
};

/** Avis de sécurité (regroupent des CVE déjà comptées une à une) : exclus du décompte. */
const ADVISORY = /^(DSA|DLA|DTSA|USN|RHSA)-/;
export function isAdvisory(id: string): boolean {
  return ADVISORY.test(id);
}

/**
 * Gravité d'une faille pour une distribution :
 * 1. « sans importance » selon Debian l'emporte (la faille ne touche pas sa version) ;
 * 2. sinon le score CVSS de la CVE d'origine ;
 * 3. sinon l'urgence de la distribution, si elle en a donné une.
 */
export function severityOf(distroUrgency: string | undefined | null, cvssScore: number | null | undefined): Severity {
  const urgency = (distroUrgency ?? '').toLowerCase();
  if (urgency === 'unimportant' || urgency === 'end-of-life' || urgency === 'negligible') return 'unimportant';
  if (typeof cvssScore === 'number') {
    if (cvssScore >= 9) return 'critical';
    if (cvssScore >= 7) return 'high';
    if (cvssScore >= 4) return 'medium';
    if (cvssScore > 0) return 'low';
    return 'unimportant';
  }
  if (urgency.startsWith('high') || urgency === 'critical') return 'high';
  if (urgency.startsWith('medium')) return 'medium';
  if (urgency.startsWith('low')) return 'low';
  return 'unassigned';
}

/** Base OSV correspondant à l'OS déclaré par l'agent, ou `null` si non suivi. */
export function ecosystemFor(osId?: string | null, versionId?: string | null): string | null {
  const id = (osId ?? '').toLowerCase();
  const version = (versionId ?? '').trim();
  if (!version) return null;
  // Raspberry Pi OS suit les paquets Debian de même numéro.
  if (id === 'debian' || id === 'raspbian') return `Debian:${version.split('.')[0]}`;
  if (id === 'ubuntu') {
    const [year, month] = version.split('.').map(Number);
    return year % 2 === 0 && month === 4 ? `Ubuntu:${version}:LTS` : `Ubuntu:${version}`;
  }
  return null;
}

/** Version source d'une version binaire : sans le suffixe de recompilation « +bN ». */
export function sourceVersionOf(binaryVersion: string): string {
  return binaryVersion.replace(/\+b\d+$/, '');
}

export interface SourcePackage {
  source: string;
  binaries: string[];
  /** Binaires qui ont une mise à jour : ce qu'on demandera à l'agent. */
  upgradable: string[];
  installed: string;
  candidate: string | null;
}

type InventoryPackages = {
  packages: Array<{ name: string; version: string; source?: string; sourceVersion?: string }>;
  upgradable: Array<{ name: string; current: string; candidate: string }>;
};

/** Regroupe les paquets binaires par paquet source (libc6, libc-bin → glibc). */
export function groupBySource({ packages, upgradable }: InventoryPackages): SourcePackage[] {
  const candidates = new Map(upgradable.map((item) => [item.name, item.candidate]));
  const bySource = new Map<string, SourcePackage>();
  for (const pkg of packages) {
    const source = pkg.source || pkg.name;
    const installed = pkg.sourceVersion || sourceVersionOf(pkg.version);
    const entry = bySource.get(source) ?? { source, binaries: [], upgradable: [], installed, candidate: null };
    entry.binaries.push(pkg.name);
    const candidate = candidates.get(pkg.name);
    if (candidate) {
      entry.upgradable.push(pkg.name);
      entry.candidate = sourceVersionOf(candidate);
    }
    bySource.set(source, entry);
  }
  return [...bySource.values()];
}

export interface PackageVulns extends SourcePackage {
  /** Failles corrigées par la version proposée. */
  fixed: string[];
  /** Failles encore présentes après mise à jour (ou sans mise à jour). */
  remaining: string[];
}

export interface ScanSummary {
  total: number;
  fixable: number;
  /** Nombre de failles par urgence, hors « sans importance ». */
  fixableBySeverity: Partial<Record<Severity, number>>;
  remainingBySeverity: Partial<Record<Severity, number>>;
  packages: number;
  /** Pire urgence corrigeable, pour trier les machines. */
  worstFixable: Severity | null;
}

export function summarize(results: PackageVulns[], severity: (id: string) => Severity): ScanSummary {
  const fixed = new Set(results.flatMap((item) => item.fixed));
  const remaining = new Set(results.flatMap((item) => item.remaining).filter((id) => !fixed.has(id)));
  const count = (ids: Set<string>) => {
    const out: Partial<Record<Severity, number>> = {};
    for (const id of ids) out[severity(id)] = (out[severity(id)] ?? 0) + 1;
    return out;
  };
  const fixableBySeverity = count(fixed);
  const worst = (Object.keys(fixableBySeverity) as Severity[]).sort((a, b) => SEVERITY_RANK[b] - SEVERITY_RANK[a])[0];
  return {
    total: fixed.size + remaining.size,
    fixable: fixed.size,
    fixableBySeverity,
    remainingBySeverity: count(remaining),
    packages: results.length,
    worstFixable: worst ?? null,
  };
}

async function osvFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${OSV()}${path}`, { ...init, signal: AbortSignal.timeout(30_000), cache: 'no-store' });
}

async function queryBatch(queries: Array<{ name: string; ecosystem: string; version: string }>): Promise<string[][]> {
  const out: string[][] = [];
  for (let start = 0; start < queries.length; start += BATCH) {
    const chunk = queries.slice(start, start + BATCH);
    const response = await osvFetch('/v1/querybatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: chunk.map((query) => ({
          package: { name: query.name, ecosystem: query.ecosystem },
          version: query.version,
        })),
      }),
    });
    if (!response.ok) throw new Error(`OSV a répondu ${response.status}`);
    const { results } = (await response.json()) as { results: Array<{ vulns?: Array<{ id: string }> }> };
    out.push(...results.map((result) => (result.vulns ?? []).map((vuln) => vuln.id)));
  }
  return out;
}

interface OsvRecord {
  id: string;
  summary?: string;
  details?: string;
  aliases?: string[];
  upstream?: string[];
  published?: string;
  severity?: Array<{ type: string; score: string }>;
  affected?: Array<{ package?: { ecosystem?: string }; ecosystem_specific?: { urgency?: string } }>;
}

async function fetchRecords(ids: string[]): Promise<OsvRecord[]> {
  const out: OsvRecord[] = [];
  for (let start = 0; start < ids.length; start += PARALLEL) {
    const records = await Promise.all(
      ids.slice(start, start + PARALLEL).map(async (id) => {
        const response = await osvFetch(`/v1/vulns/${encodeURIComponent(id)}`);
        return response.ok ? ((await response.json()) as OsvRecord) : null;
      })
    );
    out.push(...records.filter((record): record is OsvRecord => record !== null));
  }
  return out;
}

/**
 * Complète le cache des fiches (seulement celles jamais vues), puis le score
 * CVSS de leur CVE d'origine : les fiches Debian n'en portent pas.
 */
async function cacheVulns(ids: string[]): Promise<void> {
  const known = new Set(
    (await prisma.osvVuln.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((row) => row.id)
  );
  for (const record of await fetchRecords(ids.filter((id) => !known.has(id)))) {
    const urgency: Record<string, string> = {};
    const fallback = record.severity?.find((item) => item.type.toLowerCase().includes('ubuntu'))?.score;
    for (const affected of record.affected ?? []) {
      const ecosystem = affected.package?.ecosystem;
      if (ecosystem) urgency[ecosystem] = affected.ecosystem_specific?.urgency ?? fallback ?? '';
    }
    const cve =
      [record.id, ...(record.upstream ?? []), ...(record.aliases ?? [])].find((item) => /^CVE-\d{4}-\d+$/.test(item)) ??
      null;
    const data = {
      summary: (record.summary || record.details || '').slice(0, 400),
      aliases: JSON.stringify(record.aliases ?? []),
      urgency: JSON.stringify(urgency),
      published: record.published ? new Date(record.published) : null,
      cve,
      fetchedAt: new Date(),
    };
    await prisma.osvVuln.upsert({ where: { id: record.id }, create: { id: record.id, ...data }, update: data });
  }

  const missingScore = await prisma.osvVuln.findMany({
    where: { id: { in: ids }, cve: { not: null }, cvssVector: null },
    select: { id: true, cve: true },
  });
  const cves = [...new Set(missingScore.map((row) => row.cve!))];
  const vectors = new Map<string, string>();
  for (const record of await fetchRecords(cves)) {
    const vector = record.severity?.find((item) => item.type === 'CVSS_V3')?.score;
    if (vector) vectors.set(record.id, vector);
  }
  for (const row of missingScore) {
    const vector = vectors.get(row.cve!);
    // Vecteur vide enregistré : ne pas redemander une CVE qui n'a pas de CVSS 3.
    await prisma.osvVuln.update({
      where: { id: row.id },
      data: { cvssVector: vector ?? '', cvssScore: vector ? cvss3BaseScore(vector) : null },
    });
  }
}

/** Gravité de chaque faille pour la distribution de la machine, depuis le cache. */
export async function severityResolver(ids: string[], ecosystem: string): Promise<(id: string) => Severity> {
  const rows = await prisma.osvVuln.findMany({
    where: { id: { in: ids } },
    select: { id: true, urgency: true, cvssScore: true },
  });
  const map = new Map(
    rows.map((row) => [
      row.id,
      severityOf((JSON.parse(row.urgency) as Record<string, string>)[ecosystem], row.cvssScore),
    ])
  );
  return (id) => map.get(id) ?? 'unassigned';
}

/**
 * Analyse une machine et enregistre le résultat. N'échoue jamais bruyamment :
 * une erreur (OSV injoignable…) est enregistrée et affichée, l'inventaire
 * reste valable.
 */
export async function scanDevice(deviceId: string): Promise<void> {
  const inventory = await prisma.machineInventory.findUnique({ where: { deviceId } });
  if (!inventory) return;
  const ecosystem = ecosystemFor(inventory.osId, inventory.osVersionId);
  const save = (data: { ecosystem: string | null; results?: string; error?: string | null }) =>
    prisma.vulnScan.upsert({
      where: { deviceId },
      create: { deviceId, scannedAt: new Date(), results: data.results ?? '{}', ecosystem: data.ecosystem, error: data.error ?? null },
      update: { scannedAt: new Date(), results: data.results ?? '{}', ecosystem: data.ecosystem, error: data.error ?? null },
    });

  if (!ecosystem) {
    await save({ ecosystem: null, error: 'OS non suivi par la base de failles (Debian, Ubuntu, Raspberry Pi OS).' });
    return;
  }

  try {
    const sources = groupBySource({
      packages: JSON.parse(inventory.packages),
      upgradable: JSON.parse(inventory.upgradable),
    });
    const installedIds = await queryBatch(
      sources.map((item) => ({ name: item.source, ecosystem, version: item.installed }))
    );
    const withCandidate = sources.map((item, index) => ({ item, index })).filter(({ item }) => item.candidate);
    const candidateIds = await queryBatch(
      withCandidate.map(({ item }) => ({ name: item.source, ecosystem, version: item.candidate! }))
    );
    const afterUpgrade = new Map(withCandidate.map(({ index }, position) => [index, new Set(candidateIds[position])]));

    const results: PackageVulns[] = sources
      .map((item, index) => {
        const current = installedIds[index];
        const after = afterUpgrade.get(index);
        const cves = current.filter((id) => !isAdvisory(id));
        return {
          ...item,
          fixed: after ? cves.filter((id) => !after.has(id)) : [],
          remaining: after ? cves.filter((id) => after.has(id)) : cves,
        };
      })
      .filter((item) => item.fixed.length + item.remaining.length > 0);

    const ids = [...new Set(results.flatMap((item) => [...item.fixed, ...item.remaining]))];
    await cacheVulns(ids);
    const severity = await severityResolver(ids, ecosystem);
    await save({ ecosystem, results: JSON.stringify({ summary: summarize(results, severity), packages: results }) });
  } catch (error) {
    console.error('scanDevice', error);
    // Dernière ligne seulement : c'est elle qui dit ce qui ne va pas (OSV injoignable…).
    const message = (error instanceof Error ? error.message : String(error)).trim().split('\n').pop();
    await save({ ecosystem, error: `Analyse impossible : ${message}` });
  }
}
