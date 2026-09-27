import { describe, expect, it } from 'vitest';
import {
  addAccessRule,
  addFleetToPolicy,
  ensureSystemTags,
  normalizePorts,
  parsePolicyRules,
  removeAccessRule,
  fleetTagFromName,
  parsePolicyFleets,
  removeFleetFromPolicy,
  addSupportPost,
  parseSupportPosts,
  removeInternalFleet,
  removeSupportPost,
  setSupportAccess,
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

describe('ensureSystemTags', () => {
  it('déclare a-assigner et hypervision sans leur donner de règle ACL', () => {
    const result = JSON.parse(ensureSystemTags(BASE_POLICY)!);
    expect(result.tagOwners['tag:a-assigner']).toEqual(['stramatel@']);
    expect(result.tagOwners['tag:hypervision']).toEqual(['stramatel@']);
    // Aucune règle ne les prend en source : une machine « à assigner » n'a aucun accès sortant.
    const sources = result.acls.flatMap((rule: { src: string[] }) => rule.src);
    expect(sources).not.toContain('tag:a-assigner');
    expect(sources).not.toContain('tag:hypervision');
  });

  it("ne réécrit rien quand tout est déjà là", () => {
    const once = ensureSystemTags(BASE_POLICY)!;
    expect(ensureSystemTags(once)).toBeNull();
  });

  it("n'expose jamais les tags système comme des flottes", () => {
    const fleets = parsePolicyFleets(ensureSystemTags(BASE_POLICY)!).map((fleet) => fleet.tag);
    expect(fleets).toEqual(['tag:interne', 'tag:flotte-clienta']);
  });
});

describe('règles guidées', () => {
  // Parc sans l'ancienne flotte Interne : le support passe par des postes support.
  const withB = addFleetToPolicy(removeInternalFleet(BASE_POLICY), 'tag:flotte-clientb');

  it('classe support, cloisonnement et accès ajouté', () => {
    let raw = addAccessRule(withB, { from: 'tag:flotte-clienta', to: 'tag:flotte-clientb', ports: '22, 443' });
    raw = setSupportAccess(addSupportPost(raw, 'tag:support-guillaume'), 'tag:support-guillaume', ['tag:flotte-clienta']);
    const kinds = parsePolicyRules(raw).rules.map((rule) => rule.kind);
    expect(kinds).toEqual(['isolation', 'isolation', 'custom', 'support']);
    const custom = parsePolicyRules(raw).rules[2];
    expect([custom.from, custom.to, custom.ports]).toEqual(['tag:flotte-clienta', 'tag:flotte-clientb', '22,443']);
  });

  it("refuse un accès vers soi, depuis l'interne, vers une flotte inconnue ou en double", () => {
    expect(() => addAccessRule(withB, { from: 'tag:flotte-clienta', to: 'tag:flotte-clienta', ports: '*' })).toThrow();
    expect(() => addAccessRule(withB, { from: 'tag:interne', to: 'tag:flotte-clienta', ports: '*' })).toThrow();
    expect(() => addAccessRule(withB, { from: 'tag:flotte-clienta', to: 'tag:flotte-zzz', ports: '*' })).toThrow();
    const once = addAccessRule(withB, { from: 'tag:flotte-clienta', to: 'tag:flotte-clientb', ports: '*' });
    expect(() => addAccessRule(once, { from: 'tag:flotte-clienta', to: 'tag:flotte-clientb', ports: '' })).toThrow();
  });

  it('ne retire que les accès ajoutés, jamais le cloisonnement de base', () => {
    const raw = addAccessRule(withB, { from: 'tag:flotte-clienta', to: 'tag:flotte-clientb', ports: '*' });
    const { rules } = parsePolicyRules(raw);
    const custom = rules.find((rule) => rule.kind === 'custom')!;
    expect(parsePolicyRules(removeAccessRule(raw, custom.id)).rules.some((rule) => rule.kind === 'custom')).toBe(false);
    const isolation = rules.find((rule) => rule.kind === 'isolation')!;
    expect(() => removeAccessRule(raw, isolation.id)).toThrow();
  });

  it('supprimer une flotte retire aussi les accès qui la visent', () => {
    const raw = addAccessRule(withB, { from: 'tag:flotte-clienta', to: 'tag:flotte-clientb', ports: '*' });
    const after = JSON.parse(removeFleetFromPolicy(raw, 'tag:flotte-clientb'));
    const targets = after.acls.flatMap((rule: { dst: string[] }) => rule.dst);
    expect(targets.some((entry: string) => entry.startsWith('tag:flotte-clientb'))).toBe(false);
  });

  it('signale une flotte sans règle de cloisonnement', () => {
    const policy = JSON.parse(withB);
    policy.acls = policy.acls.filter((rule: { src: string[] }) => rule.src[0] !== 'tag:flotte-clientb');
    expect(parsePolicyRules(JSON.stringify(policy)).warnings).toEqual([
      { code: 'no-isolation', tag: 'tag:flotte-clientb' },
    ]);
  });

  it('valide les ports', () => {
    expect(normalizePorts(' 22, 443 ,5900-5910')).toBe('22,443,5900-5910');
    expect(normalizePorts('')).toBe('*');
    expect(() => normalizePorts('22;rm')).toThrow();
    expect(() => normalizePorts('70000')).toThrow();
    expect(() => normalizePorts('10-2')).toThrow();
  });
});

describe('postes support', () => {
  const base = addFleetToPolicy(addFleetToPolicy(removeInternalFleet(BASE_POLICY), 'tag:flotte-piscine'), 'tag:flotte-cinema');
  const guillaume = 'tag:support-guillaume';

  it('un poste déclaré ne joint rien tant que son périmètre est vide', () => {
    const raw = addSupportPost(base, guillaume);
    expect(parseSupportPosts(raw)).toEqual([{ tag: guillaume, targets: [] }]);
    expect(JSON.parse(raw).acls.some((rule: { src: string[] }) => rule.src.includes(guillaume))).toBe(false);
  });

  it('une seule règle par poste : les flottes choisies, toutes leurs machines', () => {
    let raw = setSupportAccess(addSupportPost(base, guillaume), guillaume, ['tag:flotte-piscine', 'tag:a-assigner']);
    raw = setSupportAccess(raw, guillaume, ['tag:flotte-piscine', 'tag:flotte-cinema']);
    const rules = JSON.parse(raw).acls.filter((rule: { src: string[] }) => rule.src.includes(guillaume));
    expect(rules).toEqual([{ action: 'accept', src: [guillaume], dst: ['tag:flotte-piscine:*', 'tag:flotte-cinema:*'] }]);
    expect(parseSupportPosts(raw)[0].targets).toEqual(['tag:flotte-piscine', 'tag:flotte-cinema']);
  });

  it('« tout le parc » est explicite, un périmètre vide retire la règle', () => {
    const raw = setSupportAccess(addSupportPost(base, guillaume), guillaume, ['*']);
    expect(parseSupportPosts(raw)[0].targets).toEqual(['*']);
    expect(parseSupportPosts(setSupportAccess(raw, guillaume, []))[0].targets).toEqual([]);
  });

  it('refuse une flotte inconnue, un poste inconnu ou un nom invalide', () => {
    const raw = addSupportPost(base, guillaume);
    expect(() => setSupportAccess(raw, guillaume, ['tag:flotte-zzz'])).toThrow();
    expect(() => setSupportAccess(raw, 'tag:support-inconnu', ['*'])).toThrow();
    expect(() => addSupportPost(raw, guillaume)).toThrow();
    expect(() => addSupportPost(raw, 'tag:support-Pas Bon')).toThrow();
  });

  it('supprimer une flotte la retire du périmètre ; supprimer le poste retire sa règle', () => {
    const raw = setSupportAccess(addSupportPost(base, guillaume), guillaume, ['tag:flotte-piscine', 'tag:flotte-cinema']);
    expect(parseSupportPosts(removeFleetFromPolicy(raw, 'tag:flotte-cinema'))[0].targets).toEqual(['tag:flotte-piscine']);
    const gone = JSON.parse(removeSupportPost(raw, guillaume));
    expect(gone.tagOwners[guillaume]).toBeUndefined();
    expect(gone.acls.some((rule: { src: string[] }) => rule.src.includes(guillaume))).toBe(false);
  });

  it("retire l'ancienne flotte Interne et son accès total", () => {
    const after = JSON.parse(removeInternalFleet(BASE_POLICY));
    expect(after.tagOwners['tag:interne']).toBeUndefined();
    expect(after.acls.some((rule: { src: string[]; dst: string[] }) => rule.src.includes('tag:interne') || rule.dst.includes('*:*'))).toBe(false);
  });
});
