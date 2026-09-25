'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchPolicy } from '@/features/acl';
import { fetchNodes } from '@/features/fleets';

/** Mêmes clés de cache que les features d'origine : une mutation là-bas rafraîchit ici. */
export function useNodes() {
  return useQuery({ queryKey: ['fleets', 'nodes'], queryFn: fetchNodes, refetchInterval: 15000 });
}

export function usePolicy() {
  return useQuery({ queryKey: ['acl', 'policy'], queryFn: fetchPolicy });
}
