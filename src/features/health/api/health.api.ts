export interface HealthPayload {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  source: { fresh: boolean; lastFrameAt: string | null; frameCount: number };
}

export async function fetchHealth(): Promise<HealthPayload> {
  const response = await fetch('/api/health');
  if (!response.ok) throw new Error(`Santé indisponible (${response.status})`);
  return response.json();
}
