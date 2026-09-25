import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnassignedInbox } from '../components/UnassignedInbox';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import acl from '../../acl/messages/fr.json';
import fleets from '../../fleets/messages/fr.json';
import keys from '../../keys/messages/fr.json';
import parc from '../messages/fr.json';

const messages = { ...acl, ...fleets, ...keys, ...parc };

function renderWithProviders(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body };
}

// Radix Select, une fois ouvert, bloque jsdom une trentaine de secondes :
// remplacé ici par un <select> natif, c'est la logique d'assignation qu'on teste.
vi.mock('@/shared/ui/select', async () => {
  const { createContext, useContext } = await import('react');
  const Ctx = createContext<{ value: string; onValueChange: (v: string) => void }>({
    value: '',
    onValueChange: () => {},
  });
  type P = { children?: React.ReactNode; value?: string; onValueChange?: (v: string) => void };
  let label = '';
  return {
    Select: ({ children, value = '', onValueChange = () => {} }: P) => (
      <Ctx.Provider value={{ value, onValueChange }}>{children}</Ctx.Provider>
    ),
    SelectTrigger: (props: { 'aria-label'?: string }) => {
      label = props['aria-label'] ?? '';
      return null;
    },
    SelectValue: () => null,
    SelectGroup: ({ children }: P) => <>{children}</>,
    SelectContent: ({ children }: P) => {
      const ctx = useContext(Ctx);
      return (
        <select aria-label={label} value={ctx.value} onChange={(e) => ctx.onValueChange(e.target.value)}>
          <option value="" />
          {children}
        </select>
      );
    },
    SelectItem: ({ children, value }: P) => <option value={value}>{children}</option>,
  };
});

const nodes = [
  { id: '5', name: 'nuc-5', givenName: 'nuc-5', ipAddresses: ['100.64.0.5'], online: true, lastSeen: null, tags: ['tag:a-assigner'] },
  { id: '6', name: 'nuc-6', givenName: 'nuc-6', ipAddresses: ['100.64.0.6'], online: true, lastSeen: null, tags: ['tag:a-assigner'] },
  { id: '7', name: 'rpi-7', givenName: 'rpi-7', ipAddresses: ['100.64.0.7'], online: true, lastSeen: null, tags: ['tag:interne'] },
];
const policy = { fleets: [{ tag: 'tag:flotte-keolis', label: 'keolis', deletable: true }], raw: '{}', updatedAt: 'x' };

describe('UnassignedInbox', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/acl/policy')) return jsonResponse(policy);
      if (init?.method === 'POST') return jsonResponse({});
      return jsonResponse(nodes);
    }));
  });

  it("ne liste que les machines en attente, sans l'interne", async () => {
    renderWithProviders(<UnassignedInbox />);
    expect(await screen.findByText('nuc-5')).toBeInTheDocument();
    expect(screen.getByText('nuc-6')).toBeInTheDocument();
    expect(screen.queryByText('rpi-7')).not.toBeInTheDocument();
  });

  it("n'assigne rien sans flotte de destination", async () => {
    renderWithProviders(<UnassignedInbox />);
    fireEvent.click(await screen.findByLabelText('Tout sélectionner'));
    expect(screen.getByRole('button', { name: 'Assigner (2)' })).toBeDisabled();
  });

  it('assigne la sélection en remplaçant le tag a-assigner', async () => {
    renderWithProviders(<UnassignedInbox />);
    fireEvent.click(await screen.findByLabelText('Sélectionner nuc-5'));

    fireEvent.change(screen.getByLabelText('Flotte de destination'), {
      target: { value: 'tag:flotte-keolis' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Assigner (1)' }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/fleets/nodes/5/tags',
        expect.objectContaining({ body: JSON.stringify({ tags: ['tag:flotte-keolis'] }) })
      )
    );
    expect(fetch).not.toHaveBeenCalledWith('/api/fleets/nodes/6/tags', expect.anything());
  });
});
