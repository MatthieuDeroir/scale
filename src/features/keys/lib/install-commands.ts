export type Platform = 'windows' | 'linux' | 'installed';

// Module pur (pas le barrel `@/core`, qui tire Prisma côté serveur).
export { toHostname } from '@/core/hostname';

/**
 * Commande à coller sur la machine à raccorder. Windows et Linux installent
 * Tailscale par la voie officielle avant de l'enregistrer ; « installed »
 * suppose le client déjà présent.
 */
export function installCommand(
  platform: Platform,
  { loginServer, key, hostname }: { loginServer: string; key: string; hostname?: string }
): string {
  const args = [`--login-server=${loginServer}`, `--authkey=${key}`];
  if (hostname) args.push(`--hostname=${hostname}`);
  const up = args.join(' ');

  if (platform === 'windows') {
    return [
      'winget install --id Tailscale.Tailscale -e --accept-source-agreements --accept-package-agreements',
      `& "$env:ProgramFiles\\Tailscale\\tailscale.exe" up ${up} --unattended`,
    ].join('\n');
  }
  if (platform === 'linux') {
    return `curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up ${up}`;
  }
  return `tailscale up ${up}`;
}

/**
 * Équipement Stramatel : une seule commande qui installe Tailscale, raccorde
 * la machine et installe l'agent (specs, paquets, mises à jour).
 */
export function agentInstallCommand({
  installUrl,
  token,
  loginServer,
  key,
  hostname,
}: {
  installUrl: string;
  token: string;
  loginServer?: string;
  key?: string;
  hostname?: string;
}): string {
  const args = [];
  if (key && loginServer) args.push(`--authkey=${key}`, `--login-server=${loginServer}`);
  if (hostname) args.push(`--hostname=${hostname}`);
  args.push(`--token=${token}`);
  return `curl -fsSL ${installUrl} | sudo sh -s -- ${args.join(' ')}`;
}
