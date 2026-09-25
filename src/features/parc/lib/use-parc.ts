'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchPolicy } from '@/features/acl';
import { fetchNodes } from '@/features/fleets';
import { fetchProfiles } from '../api';

/** Mêmes clés de cache que les features d'origine : une mutation là-bas rafraîchit ici. */
export function useNodes() {
  return useQuery({ queryKey: ['fleets', 'nodes'], queryFn: fetchNodes, refetchInterval: 15000 });
}

export function usePolicy() {
  return useQuery({ queryKey: ['acl', 'policy'], queryFn: fetchPolicy });
}

export function useProfiles() {
  return useQuery({ queryKey: ['fleets', 'profiles'], queryFn: fetchProfiles });
}

/** Flottes de la politique, avec le nom lisible de leur fiche : options de sélection. */
export function useFleetOptions(): Array<{ tag: string; label: string }> {
  const policy = usePolicy().data;
  const profiles = useProfiles().data;
  return useMemo(() => {
    const names = new Map((profiles ?? []).map((profile) => [profile.tag, profile.displayName]));
    return (policy?.fleets ?? [])
      .map((fleet) => ({ tag: fleet.tag, label: names.get(fleet.tag) || fleet.label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [policy, profiles]);
}
