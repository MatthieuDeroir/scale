import { describe, expect, it } from 'vitest';
import { toCsv } from '../../lib/csv';

describe('toCsv', () => {
  it('sépare par « ; » et commence par un BOM pour Excel', () => {
    expect(toCsv([['a', 'b'], [1, null]])).toBe('﻿a;b\r\n1;');
  });

  it('protège les séparateurs et les guillemets', () => {
    expect(toCsv([['un;deux', 'dit "oui"']])).toBe('﻿"un;deux";"dit ""oui"""');
  });

  it("neutralise les formules : un nom de machine n'est jamais exécuté", () => {
    expect(toCsv([['=HYPERLINK("x")', '+1', '-2', '@a']])).toBe(
      '﻿"\'=HYPERLINK(""x"")";\'+1;\'-2;\'@a'
    );
  });
});
