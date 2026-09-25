export interface ActivityEvent {
  id: number;
  at: string;
  actor: string;
  action: string;
  target: string | null;
}

export interface ActivityPage {
  retentionDays: number;
  total: number;
  events: ActivityEvent[];
}

export async function fetchActivity(): Promise<ActivityPage> {
  const response = await fetch('/api/activity');
  if (!response.ok) throw new Error(`Journal indisponible (${response.status})`);
  return response.json();
}
