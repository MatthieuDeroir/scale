export interface FleetProfile {
  tag: string;
  displayName: string | null;
  sector: string | null;
  contact: string | null;
  phone: string | null;
  email: string | null;
  site: string | null;
  reference: string | null;
  notes: string | null;
  updatedAt: string;
}

export type FleetProfileInput = Partial<Omit<FleetProfile, 'tag' | 'updatedAt'>>;

export async function fetchProfiles(): Promise<FleetProfile[]> {
  const response = await fetch('/api/fleets/profiles');
  if (!response.ok) throw new Error(`Fiches indisponibles (${response.status})`);
  return response.json();
}

export async function saveProfile(tag: string, input: FleetProfileInput): Promise<FleetProfile> {
  const response = await fetch(`/api/fleets/profiles/${encodeURIComponent(tag)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? `Enregistrement refusé (${response.status})`);
  }
  return response.json();
}
