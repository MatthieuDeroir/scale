import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../AppShell';

const links = [
  { href: '/', label: 'Vue d’ensemble', icon: <span />, active: true },
  { href: '/keys', label: 'Clés d’accès', icon: <span />, active: false },
];

describe('AppShell', () => {
  it('porte l’identité produit, le titre d’écran et la navigation', () => {
    render(
      <AppShell product="Stramscale" title="Vue d’ensemble" links={links}>
        <p>contenu</p>
      </AppShell>
    );
    // La sidebar existe en deux variantes (bureau/mobile), basculées en CSS :
    // jsdom rend les deux sans appliquer les media queries, d'où `getAllBy*`.
    expect(screen.getAllByText('Stramscale').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Vue d’ensemble' })).toBeInTheDocument();
    expect(screen.getByText('contenu')).toBeInTheDocument();
    expect(screen.getAllByAltText('Stramatel').length).toBeGreaterThan(0);
  });

  it('expose le sélecteur de thème dans la barre', () => {
    render(
      <AppShell product="Stramscale" title="X" links={links}>
        c
      </AppShell>
    );
    expect(screen.getAllByRole('radiogroup', { name: 'Thème' }).length).toBeGreaterThan(0);
  });

  it('signale la page active aux lecteurs d’écran, jamais les autres', () => {
    render(
      <AppShell product="Stramscale" title="X" links={links}>
        c
      </AppShell>
    );
    const activeLinks = screen.getAllByRole('link', { name: /Vue d’ensemble/ });
    expect(activeLinks.some((link) => link.getAttribute('aria-current') === 'page')).toBe(true);

    const otherLinks = screen.getAllByRole('link', { name: /Clés d’accès/ });
    expect(otherLinks.every((link) => !link.hasAttribute('aria-current'))).toBe(true);
  });
});
