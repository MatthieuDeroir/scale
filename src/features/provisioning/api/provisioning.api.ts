export interface ProvisionedDevice {
  deviceId: string;
  enrolledAt: string;
}

export async function fetchDevices(): Promise<ProvisionedDevice[]> {
  const response = await fetch('/api/provisioning/devices');
  if (!response.ok) throw new Error(`Journal d'enrôlement indisponible (${response.status})`);
  return response.json();
}
