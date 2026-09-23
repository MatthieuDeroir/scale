'use client';

import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark' | 'system';

/**
 * Script anti-clignotement, rendu côté serveur en tête de <body>.
 * Sans lui, une page en thème sombre s'affiche blanche pendant une frame —
 * visible, et sur un panneau d'affichage, inacceptable.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(cb: () => void) {
  listeners.add(cb);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', emit);
  return () => {
    listeners.delete(cb);
    media.removeEventListener('change', emit);
  };
}

function readStored(): Theme {
  if (typeof window === 'undefined') return 'system';
  const value = localStorage.getItem('theme');
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

function apply(theme: Theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readStored, () => 'system' as Theme);

  return {
    theme,
    setTheme(next: Theme) {
      localStorage.setItem('theme', next);
      apply(next);
      emit();
    },
  };
}
