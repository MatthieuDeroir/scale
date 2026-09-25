import { describe, expect, it } from 'vitest';
import type { FleetNode } from '@/features/fleets';
import { nodeMatches, summarizeFleets, unassignedNodes } from '../lib/summarize';

function node(id: string, tags: string[], online = true): FleetNode {
  return { id, name: `n${id}`, givenName: `machine-${id}`, ipAddresses: [`100.64.0.${id}`], online, lastSeen: null, tags };
}

const policy = [
  { tag: 'tag:flotte-zeta', label: 'zeta' },
  { tag: 'tag:interne', label: 'Interne' },
  { tag: 'tag:flotte-alpha', label: 'alpha' },
];

describe('summarizeFleets', () => {
  const nodes = [
    node('1', ['tag:flotte-alpha']),
    node('2', ['tag:flotte-alpha', 'tag:hypervision'], false),
    node('3', ['tag:a-assigner']),
    node('4', ['tag:flotte-orphelin']),
  ];
  const fleets = summarizeFleets(policy, nodes);

  it("place l'interne en tête puis trie par nom", () => {
    expect(fleets.map((fleet) => fleet.slug)).toEqual(['interne', 'alpha', 'orphelin', 'zeta']);
  });

  it('compte machines, en ligne et postes d’hypervision', () => {
    const alpha = fleets.find((fleet) => fleet.slug === 'alpha')!;
    expect([alpha.nodes.length, alpha.online, alpha.hypervision]).toEqual([2, 1, 1]);
  });

  it('garde une flotte vide (juste créée) et signale un tag hors politique', () => {
    expect(fleets.find((fleet) => fleet.slug === 'zeta')!.nodes).toHaveLength(0);
    expect(fleets.find((fleet) => fleet.slug === 'orphelin')!.inPolicy).toBe(false);
  });

  it("n'affiche jamais les machines à assigner dans une flotte", () => {
    expect(fleets.flatMap((fleet) => fleet.nodes).map((item) => item.id)).not.toContain('3');
    expect(unassignedNodes(nodes).map((item) => item.id)).toEqual(['3']);
  });
});

describe('nodeMatches', () => {
  it('cherche sur le nom sans accents ni casse, et sur l’IP', () => {
    const target = { ...node('7', []), givenName: 'Écran-Quai' };
    expect(nodeMatches(target, 'ecran')).toBe(true);
    expect(nodeMatches(target, '100.64.0.7')).toBe(true);
    expect(nodeMatches(target, 'gare')).toBe(false);
  });
});
