import { describe, expect, it } from 'vitest';
import { covers } from '../lib/roles';

describe('covers', () => {
  it('un rôle couvre les rôles inférieurs', () => {
    expect(covers('ADMIN', 'OPERATOR')).toBe(true);
    expect(covers('OPERATOR', 'VIEWER')).toBe(true);
  });

  it('un rôle ne couvre pas les rôles supérieurs', () => {
    expect(covers('VIEWER', 'OPERATOR')).toBe(false);
    expect(covers('OPERATOR', 'ADMIN')).toBe(false);
  });

  it('un rôle se couvre lui-même', () => {
    expect(covers('OPERATOR', 'OPERATOR')).toBe(true);
  });
});
