import { describe, expect, it } from 'vitest';
import { installCommand, toHostname } from '../lib/install-commands';

const base = { loginServer: 'https://vpn.stramatel.fr', key: 'hskey-auth-x' };

describe('toHostname', () => {
  it('produit un nom accepté par Tailscale', () => {
    expect(toHostname('Écran Quai n°2 (Gare Nord)')).toBe('ecran-quai-n-2-gare-nord');
    expect(toHostname('  --a--  ')).toBe('a');
    expect(toHostname('x'.repeat(80))).toHaveLength(63);
  });
});

describe('installCommand', () => {
  it('Windows : installe puis inscrit, sans interaction', () => {
    const command = installCommand('windows', { ...base, hostname: 'poste-1' });
    expect(command).toContain('winget install --id Tailscale.Tailscale');
    expect(command).toContain('--authkey=hskey-auth-x --hostname=poste-1 --unattended');
  });

  it('Linux : script officiel puis sudo tailscale up', () => {
    expect(installCommand('linux', base)).toBe(
      'curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up --login-server=https://vpn.stramatel.fr --authkey=hskey-auth-x'
    );
  });

  it('déjà installé : la seule inscription', () => {
    expect(installCommand('installed', base)).toBe(
      'tailscale up --login-server=https://vpn.stramatel.fr --authkey=hskey-auth-x'
    );
  });
});
