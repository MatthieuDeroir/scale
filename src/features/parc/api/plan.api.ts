import type { NewAccessKey } from '@/features/keys';

export interface Product {
  id: number;
  name: string;
  category: 'gamme' | 'sur-mesure';
  role: 'master' | 'slave' | null;
  machines: number;
}

export type SlotKind = 'equipment' | 'hypervision';

export interface PlanSlot {
  id: number;
  kind: SlotKind;
  label: string;
  reference: string | null;
  product: { id: number; name: string; role: string | null } | null;
  keyIssuedAt: string | null;
  machine: { id: string; name: string; online: boolean; ip: string | null } | null;
}

export interface TemplateItem {
  kind: SlotKind;
  productId: number | null;
  count: number;
  label: string;
}

export interface FleetTemplate {
  id: number;
  name: string;
  description: string | null;
  items: TemplateItem[];
}

async function call<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const response = await fetch(url, {
    ...init,
    ...(init?.json !== undefined
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(init.json) }
      : {}),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? `Refusé (${response.status})`);
  }
  return response.json();
}

const planUrl = (tag: string) => `/api/plan/${encodeURIComponent(tag)}`;

export const fetchProducts = () => call<Product[]>('/api/products');
export const createProduct = (input: { name: string; category: string; role: string | null }) =>
  call<Product>('/api/products', { method: 'POST', json: input });
export const updateProduct = (id: number, input: Partial<{ name: string; category: string; role: string | null }>) =>
  call<Product>(`/api/products/${id}`, { method: 'PATCH', json: input });
export const deleteProduct = (id: number) => call<{ ok: true }>(`/api/products/${id}`, { method: 'DELETE' });

export const setMachineProduct = (id: string, input: { productId: number | null; reference: string }) =>
  call<{ ok: true }>(`/api/machines/${encodeURIComponent(id)}/product`, { method: 'PUT', json: input });

export const fetchPlan = (tag: string) => call<PlanSlot[]>(planUrl(tag));
export const addSlots = (
  tag: string,
  input: { kind: SlotKind; productId: number | null; count: number; label: string; reference: string }
) => call<PlanSlot[]>(planUrl(tag), { method: 'POST', json: input });
export const applyTemplate = (tag: string, templateId: number) =>
  call<PlanSlot[]>(`${planUrl(tag)}/template`, { method: 'POST', json: { templateId } });
export const deleteSlot = (id: number) => call<{ ok: true }>(`/api/plan/slots/${id}`, { method: 'DELETE' });
export const issueSlotKey = (id: number, expiration: string) =>
  call<NewAccessKey & { hostname: string }>(`/api/plan/slots/${id}/key`, { method: 'POST', json: { expiration } });
export const assignToSlot = (id: number, nodeId: string) =>
  call<{ ok: true }>(`/api/plan/slots/${id}/assign`, { method: 'POST', json: { nodeId } });

export const fetchTemplates = () => call<FleetTemplate[]>('/api/templates');
export const createTemplate = (
  input: { name: string; description?: string } & ({ items: TemplateItem[] } | { fromFleet: string })
) => call<FleetTemplate>('/api/templates', { method: 'POST', json: input });
export const deleteTemplate = (id: number) => call<{ ok: true }>(`/api/templates/${id}`, { method: 'DELETE' });
