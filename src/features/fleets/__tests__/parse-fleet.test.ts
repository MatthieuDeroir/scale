import { describe, expect, it } from 'vitest';
import { parseFleetLabel } from '../lib/parse-fleet';

describe('parseFleetLabel', () => {
  it("reconnaît l'interne, quels que soient les autres tags", () => {
    expect(parseFleetLabel(['tag:interne'])).toBe('Interne');
  });

  it('extrait le nom de client depuis tag:flotte-<client>', () => {
    expect(parseFleetLabel(['tag:flotte-clienta'])).toBe('clienta');
  });

  it("retombe sur « Sans flotte » quand aucun tag ne matche", () => {
    expect(parseFleetLabel([])).toBe('Sans flotte');
    expect(parseFleetLabel(['tag:autre-chose'])).toBe('Sans flotte');
  });
});
