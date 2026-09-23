'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '../lib';
import { useTheme, type Theme } from './theme';

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Clair', Icon: Sun },
  { value: 'dark', label: 'Sombre', Icon: Moon },
  { value: 'system', label: 'Système', Icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Thème"
      className="inline-flex rounded-md border border-sidebar-border bg-sidebar-accent p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => setTheme(value)}
          className={cn(
            'rounded-sm p-1.5 text-sidebar-muted transition-colors',
            'hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
            theme === value && 'bg-sidebar text-sidebar-accent-foreground'
          )}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
