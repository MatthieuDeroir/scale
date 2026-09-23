import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell, NavLink } from '../AppShell';

describe('AppShell', () => {
  it('porte l’identité produit et le nom du produit', () => {
    render(
      <AppShell product="Starter 2026">
        <p>contenu</p>
      </AppShell>
    );
    expect(screen.getByText('STRAMATEL')).toBeInTheDocument();
    expect(screen.getByText('Starter 2026')).toBeInTheDocument();
    expect(screen.getByText('contenu')).toBeInTheDocument();
  });

  it('expose le sélecteur de thème dans la barre', () => {
    render(<AppShell product="X">c</AppShell>);
    expect(screen.getByRole('radiogroup', { name: 'Thème' })).toBeInTheDocument();
  });
});

describe('NavLink', () => {
  it('signale la page courante aux lecteurs d’écran', () => {
    render(
      <NavLink href="/" active>
        Vue d’ensemble
      </NavLink>
    );
    expect(screen.getByRole('link')).toHaveAttribute('aria-current', 'page');
  });

  it('ne marque pas les autres liens', () => {
    render(<NavLink href="/x">Autre</NavLink>);
    expect(screen.getByRole('link')).not.toHaveAttribute('aria-current');
  });
});
