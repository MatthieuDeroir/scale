'use client';

import { createContext, useContext, type ReactNode } from 'react';

export interface Permissions {
  /** Émettre et révoquer des clés, agir sur les machines et les flottes. */
  operate: boolean;
  /** Comptes et journal. */
  admin: boolean;
}

// Par défaut tout est permis : le serveur reste le seul juge, ceci ne fait que
// masquer ce qu'il refuserait (et garde les composants testables isolément).
const PermissionsContext = createContext<Permissions>({ operate: true, admin: true });

export function PermissionsProvider({ value, children }: { value: Permissions; children: ReactNode }) {
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions(): Permissions {
  return useContext(PermissionsContext);
}
