import { describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({ prisma: {} }));

const { assessmentFor, stateOf, summarizePark, vulnKeyOf } = await import('../security');

const occurrence = (over: Record<string, unknown> = {}) => ({
  nodeId: '1',
  machine: 'm',
  online: true,
  fleetTag: 'tag:flotte-b',
  productId: 1,
  productName: 'SL MEDIA',
  package: 'curl',
  installed: '1',
  candidate: '2',
  fixable: true,
  excluded: false,
  status: null,
  ...over,
});

describe('cybersécurité du parc', () => {
  it('trie par CVE : une décision vaut pour Debian et Ubuntu', () => {
    expect(vulnKeyOf('DEBIAN-CVE-2024-1', 'CVE-2024-1')).toBe('CVE-2024-1');
    expect(vulnKeyOf('GHSA-xxxx', null)).toBe('GHSA-xxxx');
  });

  it('la décision du produit l’emporte sur celle du parc', () => {
    const park = { id: 1, productId: null, status: 'affected' } as never;
    const media = { id: 2, productId: 1, status: 'not_affected' } as never;
    expect(assessmentFor([park, media], 1)).toBe(media);
    expect(assessmentFor([park, media], 2)).toBe(park);
    expect(assessmentFor([media], null)).toBeUndefined();
  });

  it('une faille n’est écartée que si toutes ses machines le sont', () => {
    expect(stateOf([occurrence({ excluded: true }), occurrence({ nodeId: '2' })] as never)).toBe('open');
    expect(stateOf([occurrence({ excluded: true, status: 'not_affected' })] as never)).toBe('excluded');
    expect(stateOf([occurrence({ status: 'under_investigation' })] as never)).toBe('investigating');
  });

  it('les failles écartées sortent des décomptes et des machines prioritaires', () => {
    const vuln = (key: string, severity: string, occurrences: unknown[], state = 'open') => ({
      key, cve: key, ids: [key], summary: null, severity, cvss: null, published: null, packages: ['curl'],
      state, active: 1, fixableOn: 1, occurrences, assessments: [],
    });
    const summary = summarizePark([
      vuln('CVE-1', 'critical', [occurrence()]),
      vuln('CVE-2', 'critical', [occurrence({ excluded: true, status: 'not_affected' })], 'excluded'),
      vuln('CVE-3', 'high', [occurrence(), occurrence({ nodeId: '2' })]),
    ] as never);
    expect(summary.openBySeverity).toEqual({ critical: 1, high: 1 });
    expect(summary.excluded).toBe(1);
    expect(summary.perNode['1']).toMatchObject({ fixable: 2, worstFixable: 'critical' });
    expect(summary.topPackages[0]).toEqual({ package: 'curl', machines: 2, fixes: 2, worst: 'critical' });
  });
});
