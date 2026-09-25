import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from '../AppShell';

vi.mock('next/navigation', () => ({ usePathname: () => '/flottes/clienta' }));

const sections = [
  {
    links: [
      { href: '/', label: 'Flottes', icon: <span /> },
      { href: '/machines', label: 'Machines', icon: <span /> },
    ],
  },
  { title: 'Administration', links: [{ href: '/comptes', label: 'Comptes', icon: <span /> }] },
];

function afficher() {
  return render(
    <AppShell product="Stramscale" sections={sections} toggleLabels={{ collapse: 'Réduire', expand: 'Déplier' }}>
      <p>contenu</p>
    </AppShell>
  );
}

describe('AppShell', () => {
  it('porte l’identité produit, les sections et le contenu', () => {
    afficher();
    // La sidebar existe en deux variantes (bureau/mobile), basculées en CSS :
    // jsdom rend les deux sans appliquer les media queries, d'où `getAllBy*`.
    expect(screen.getAllByText('Stramscale').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Administration').length).toBeGreaterThan(0);
    expect(screen.getByText('contenu')).toBeInTheDocument();
    expect(screen.getAllByRole('radiogroup', { name: 'Thème' }).length).toBeGreaterThan(0);
  });

  it('marque « Flottes » active sur une page de flotte, pas les autres', () => {
    afficher();
    const fleets = screen.getAllByRole('link', { name: /Flottes/ });
    expect(fleets.some((link) => link.getAttribute('aria-current') === 'page')).toBe(true);
    const machines = screen.getAllByRole('link', { name: /Machines/ });
    expect(machines.every((link) => !link.hasAttribute('aria-current'))).toBe(true);
  });

  it('se replie sur demande et garde les liens (icône + infobulle)', () => {
    afficher();
    fireEvent.click(screen.getAllByRole('button', { name: 'Réduire' })[0]);
    expect(screen.getAllByRole('button', { name: 'Déplier' }).length).toBeGreaterThan(0);
    expect(screen.getAllByTitle('Machines').length).toBeGreaterThan(0);
  });
});
