import { describe, expect, it } from 'vitest';
import { hashAgentToken, inventorySchema, PACKAGE_NAME } from '../agent';

describe('agent', () => {
  it("n'accepte que des noms de paquets Debian, jamais du shell", () => {
    for (const ok of ['vim', 'libc6', 'g++', 'python3.11', 'linux-image-6.1.0-18-amd64']) {
      expect(PACKAGE_NAME.test(ok)).toBe(true);
    }
    for (const bad of ['vim; rm -rf /', '$(reboot)', 'Vim', '-y', 'a b', '']) {
      expect(PACKAGE_NAME.test(bad)).toBe(false);
    }
  });

  it("refuse un inventaire qui glisse une commande dans un nom de paquet", () => {
    const result = inventorySchema.safeParse({ packages: [{ name: 'vim && reboot', version: '1' }] });
    expect(result.success).toBe(false);
  });

  it('accepte un inventaire normal et complète les listes absentes', () => {
    const result = inventorySchema.parse({ osName: 'Debian GNU/Linux', cores: 4 });
    expect(result.packages).toEqual([]);
    expect(result.upgradable).toEqual([]);
  });

  it("ne stocke qu'une empreinte stable du jeton", () => {
    expect(hashAgentToken('abc')).toBe(hashAgentToken('abc'));
    expect(hashAgentToken('abc')).not.toContain('abc');
    expect(hashAgentToken('abc')).toHaveLength(64);
  });
});
