import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from '../badge';

describe('Badge', () => {
  it('rend son contenu', () => {
    render(<Badge>trames reçues</Badge>);
    expect(screen.getByText('trames reçues')).toBeInTheDocument();
  });

  it('distingue les états de fonctionnement par la couleur', () => {
    // L'état doit se lire à la couleur avant de se lire au texte : sur un
    // équipement en exploitation, c'est ce qu'on regarde en premier.
    const { rerender } = render(<Badge variant="ok">ok</Badge>);
    expect(screen.getByText('ok').className).toMatch(/emerald/);

    rerender(<Badge variant="warning">alerte</Badge>);
    expect(screen.getByText('alerte').className).toMatch(/amber/);

    rerender(<Badge variant="critical">panne</Badge>);
    expect(screen.getByText('panne').className).toMatch(/destructive/);
  });

  it('n’utilise pas l’accent de marque pour un état', () => {
    // Le rouge STRAMATEL est une identité, pas une sémantique d'alerte.
    render(<Badge variant="critical">panne</Badge>);
    expect(screen.getByText('panne').className).not.toMatch(/\bbg-brand\b/);
  });
});
