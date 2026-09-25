import { describe, expect, it } from 'vitest';
import { fleetSlug, fleetTagOf, isHypervision, tagFromSlug, withFleet } from '../lib/tags';

describe('tags de flotte', () => {
  it('changer de flotte conserve le type de machine', () => {
    expect(withFleet(['tag:flotte-a', 'tag:hypervision'], 'tag:flotte-b')).toEqual([
      'tag:flotte-b',
      'tag:hypervision',
    ]);
  });

  it('sortir de « à assigner » remplace le tag, sans le cumuler', () => {
    expect(withFleet(['tag:a-assigner'], 'tag:interne')).toEqual(['tag:interne']);
  });

  it('trouve le tag de flotte parmi les tags de type', () => {
    expect(fleetTagOf(['tag:hypervision', 'tag:flotte-a'])).toBe('tag:flotte-a');
    expect(fleetTagOf(['tag:hypervision'])).toBeNull();
    expect(isHypervision(['tag:flotte-a', 'tag:hypervision'])).toBe(true);
  });

  it('slug et tag font l’aller-retour', () => {
    for (const tag of ['tag:interne', 'tag:flotte-keolis-lyon']) {
      expect(tagFromSlug(fleetSlug(tag))).toBe(tag);
    }
  });
});
