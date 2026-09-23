import { describe, expect, it } from 'vitest';
import { loginSchema } from '../lib/schema';

describe('loginSchema', () => {
  it('accepte un couple valide', () => {
    expect(loginSchema.safeParse({ username: 'op', password: 'x' }).success).toBe(true);
  });

  it('refuse les champs vides', () => {
    expect(loginSchema.safeParse({ username: '', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ username: 'op', password: '' }).success).toBe(false);
  });

  it('refuse des champs absents ou d’un autre type', () => {
    expect(loginSchema.safeParse({}).success).toBe(false);
    expect(loginSchema.safeParse({ username: 42, password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse(null).success).toBe(false);
  });

  it('borne la longueur — une entrée non bornée est une entrée non validée', () => {
    expect(loginSchema.safeParse({ username: 'a'.repeat(65), password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ username: 'op', password: 'x'.repeat(257) }).success).toBe(false);
  });
});
