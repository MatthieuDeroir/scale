/** Nom d'hôte acceptable par Tailscale : minuscules, chiffres, tirets, 63 caractères. Module pur. */
export function toHostname(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63);
}

/**
 * Nom réseau d'un emplacement : flotte + libellé (« piscine-sl-media »). Les
 * noms MagicDNS sont uniques dans tout le VPN, et chaque flotte a son SL MEDIA.
 */
export function slotHostname(fleetTag: string, label: string): string {
  const fleet = fleetTag.replace(/^tag:(flotte-)?/, '');
  return toHostname(`${fleet} ${label}`);
}
