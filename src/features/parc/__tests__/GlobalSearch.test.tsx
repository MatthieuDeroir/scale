import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '@/shared/ui/sidebar';
import fleets from '../../fleets/messages/fr.json';
import parc from '../messages/fr.json';
import { GlobalSearch } from '../components/GlobalSearch';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const nodes = [
  {
    id: '1',
    name: 'nuc-quai',
    givenName: 'nuc-quai',
    ipAddresses: ['100.64.0.9'],
    online: true,
    lastSeen: null,
    tags: ['tag:flotte-keolis'],
    enrollment: { deviceId: 'd', serial: 'SN-4471', model: 'NUC 13', enrolledAt: '2026-09-25' },
  },
];

describe('GlobalSearch', () => {
  beforeEach(() => {
    push.mockReset();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        json: async () =>
          url.includes('policy')
            ? { fleets: [{ tag: 'tag:flotte-keolis', label: 'keolis', deletable: true }], raw: '{}', updatedAt: 'x' }
            : url.includes('profiles')
              ? [{ tag: 'tag:flotte-keolis', displayName: 'Keolis Lyon' }]
              : nodes,
      }))
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <NextIntlClientProvider locale="fr" messages={{ ...fleets, ...parc }}>
        <QueryClientProvider client={client}>
          <Sidebar>
            <GlobalSearch />
          </Sidebar>
        </QueryClientProvider>
      </NextIntlClientProvider>
    );
  });

  it('s’ouvre au clavier et retrouve une machine par son n° de série', async () => {
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = await screen.findByRole('combobox');
    fireEvent.change(input, { target: { value: 'sn-4471' } });
    expect(await screen.findByText('nuc-quai')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(push).toHaveBeenCalledWith('/machines/1');
  });

  it('retrouve une flotte par son nom lisible', async () => {
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'keolis ly' } });
    expect(await screen.findByText('Keolis Lyon')).toBeInTheDocument();
  });
});
