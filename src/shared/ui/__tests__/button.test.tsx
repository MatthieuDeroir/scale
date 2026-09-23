import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '../button';

describe('Button', () => {
  it('rend un bouton par défaut', () => {
    render(<Button>Enregistrer</Button>);
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument();
  });

  it('expose la variante de marque pour l’action principale', () => {
    render(<Button variant="brand">Se connecter</Button>);
    expect(screen.getByRole('button').className).toMatch(/bg-brand/);
  });

  it('reste désactivable', () => {
    render(<Button disabled>Connexion…</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('délègue le rendu avec asChild', () => {
    render(
      <Button asChild>
        <a href="/login">Connexion</a>
      </Button>
    );
    expect(screen.getByRole('link', { name: 'Connexion' })).toBeInTheDocument();
  });
});
