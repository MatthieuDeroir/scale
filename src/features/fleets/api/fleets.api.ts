export interface FleetNode {
  id: string;
  name: string;
  givenName: string;
  ipAddresses: string[];
  online: boolean;
  lastSeen: string | null;
  tags: string[];
  /** Date d'enregistrement dans Headscale. */
  createdAt?: string | null;
  /** Nom dans le DNS du VPN (MagicDNS), si le domaine est configuré. */
  dnsName?: string | null;
  /** Clé qui a enregistré la machine. */
  keyId?: string | null;
  /** Renseigné si la machine s'est auto-enrôlée en déclarant ces informations. */
  enrollment?: { deviceId: string; serial: string | null; model: string | null; enrolledAt: string } | null;
  /** Agent Stramscale prévu pour la machine (jeton émis). */
  agent?: boolean;
  /** Produit de la gamme (ou sur mesure) et n° d'affaire. */
  product?: {
    id: number;
    name: string;
    reference: string | null;
    /** Produit à SLAVE (SL MEDIA) : la machine est serveur (tag MASTER) ou SLAVE. */
    slaves: boolean;
    /** SLAVE : nœud du serveur auquel elle est rattachée. */
    masterNodeId: string | null;
  } | null;
  /** Résumé de l'inventaire envoyé par l'agent (OS, mises à jour en attente). */
  inventory?: { os: string; upgradableCount: number; reportedAt: string } | null;
  /** Résumé de la dernière analyse des failles. */
  vulns?: {
    total: number;
    fixable: number;
    fixableBySeverity: Partial<Record<'critical' | 'high' | 'medium' | 'low' | 'unassigned' | 'unimportant', number>>;
    worstFixable: 'critical' | 'high' | 'medium' | 'low' | 'unassigned' | 'unimportant' | null;
  } | null;
}

export async function fetchNodes(): Promise<FleetNode[]> {
  const response = await fetch('/api/fleets/nodes');
  if (!response.ok) throw new Error(`Parc indisponible (${response.status})`);
  return response.json();
}
