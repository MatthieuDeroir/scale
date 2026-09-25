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
  /** Clé qui a enregistré la machine. */
  keyId?: string | null;
  /** Renseigné si la machine s'est auto-enrôlée en déclarant ces informations. */
  enrollment?: { deviceId: string; serial: string | null; model: string | null; enrolledAt: string } | null;
}

export async function fetchNodes(): Promise<FleetNode[]> {
  const response = await fetch('/api/fleets/nodes');
  if (!response.ok) throw new Error(`Parc indisponible (${response.status})`);
  return response.json();
}
