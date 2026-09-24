import { describe, expect, it } from 'vitest';
import {
  addFleetToPolicy,
  fleetTagFromName,
  parsePolicyFleets,
  removeFleetFromPolicy,
} from '../acl-policy';

const BASE_POLICY = `{
  "tagOwners": {
    "tag:interne": ["stramatel@"],
    "tag:flotte-clienta": ["stramatel@"],
  },
  "acls": [
    {"action": "accept", "src": ["tag:interne"], "dst": ["*:*"]},
    {"action": "accept", "src": ["tag:flotte-clienta"], "dst": ["tag:flotte-clienta:*"]},
  ],
}`;

describe('fleetTagFromName', () => {
  it('normalise en minuscules sans espace', () => {
    expect(fleetTagFromName('Nouveau Client')).toBe('tag:flotte-nouveau-client');
  });

  it('retire les diacritiques et les caractères non alphanumériques', () => {
    expect(fleetTagFromName("Société l'Équipe !")).toBe('tag:flotte-societe-lequipe-');
  });
});

describe('parsePolicyFleets', () => {
  it('extrait interne et les flottes client, jamais un tag hors motif', () => {
    const policy = `{"tagOwners":{"tag:interne":["a"],"tag:flotte-clienta":["a"],"tag:autre-chose":["a"]},"acls":[]}`;
    expect(parsePolicyFleets(policy)).toEqual([
      { tag: 'tag:interne', label: 'Interne', deletable: false },
      { tag: 'tag:flotte-clienta', label: 'clienta', deletable: true },
    ]);
  });
});

describe('addFleetToPolicy', () => {
  it('ajoute tagOwners et une règle ACL cloisonnée', () => {
    const result = JSON.parse(addFleetToPolicy(BASE_POLICY, 'tag:flotte-clientb'));
    expect(result.tagOwners['tag:flotte-clientb']).toEqual(['stramatel@']);
    expect(result.acls).toContainEqual({
      action: 'accept',
      src: ['tag:flotte-clientb'],
      dst: ['tag:flotte-clientb:*'],
    });
    // Rien d'existant n'est perdu.
    expect(result.tagOwners['tag:interne']).toEqual(['stramatel@']);
    expect(result.acls).toHaveLength(3);
  });

  it('refuse une flotte déjà existante plutôt que de la dupliquer', () => {
    expect(() => addFleetToPolicy(BASE_POLICY, 'tag:flotte-clienta')).toThrow();
  });
});

describe('removeFleetFromPolicy', () => {
  it('retire la flotte et sa règle ACL', () => {
    const result = JSON.parse(removeFleetFromPolicy(BASE_POLICY, 'tag:flotte-clienta'));
    expect(result.tagOwners['tag:flotte-clienta']).toBeUndefined();
    expect(result.acls).toHaveLength(1);
    expect(result.acls[0].src).toEqual(['tag:interne']);
  });

  it("refuse de supprimer l'interne — c'est la règle d'accès total", () => {
    expect(() => removeFleetFromPolicy(BASE_POLICY, 'tag:interne')).toThrow();
  });
});
