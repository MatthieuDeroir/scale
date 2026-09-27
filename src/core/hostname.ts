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
