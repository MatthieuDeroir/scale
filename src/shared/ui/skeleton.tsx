import type { ComponentProps } from 'react';
import { cn } from '../lib';

/** Un rectangle qui pulse doucement — remplace le texte « Chargement… », qui
 * ne donne aucune idée de la forme du contenu à venir. */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}
