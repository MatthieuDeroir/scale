export interface FleetNode {
  id: string;
  name: string;
  givenName: string;
  ipAddresses: string[];
  online: boolean;
  lastSeen: string | null;
  tags: string[];
}

export async function fetchNodes(): Promise<FleetNode[]> {
  const response = await fetch('/api/fleets/nodes');
  if (!response.ok) throw new Error(`Parc indisponible (${response.status})`);
  return response.json();
}
