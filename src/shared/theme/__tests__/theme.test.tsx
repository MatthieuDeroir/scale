import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeToggle } from '../ThemeToggle';
import { themeInitScript } from '../theme';

describe('themeInitScript', () => {
  it('lit le choix stocké et applique la classe avant le rendu', () => {
    // Sans ce script, une interface en thème sombre s'affiche blanche pendant
    // une frame — visible, et sur un panneau, inacceptable.
    expect(themeInitScript).toContain("localStorage.getItem('theme')");
    expect(themeInitScript).toContain('classList.toggle');
    expect(themeInitScript).toContain('prefers-color-scheme');
  });

  it('ne casse pas si le stockage est refusé', () => {
    expect(themeInitScript).toContain('try');
    expect(themeInitScript).toContain('catch');
  });
});

describe('ThemeToggle', () => {
  it('propose les trois états', () => {
    render(<ThemeToggle />);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByLabelText('Clair')).toBeInTheDocument();
    expect(screen.getByLabelText('Sombre')).toBeInTheDocument();
    expect(screen.getByLabelText('Système')).toBeInTheDocument();
  });

  it('mémorise le choix et l’applique au document', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByLabelText('Sombre'));

    expect(localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('marque l’état courant pour les lecteurs d’écran', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByLabelText('Clair'));
    expect(screen.getByLabelText('Clair')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Sombre')).toHaveAttribute('aria-checked', 'false');
  });
});
