/** Contrat d'une fonctionnalité enfichable du socle. */
export interface FeatureConfig {
  id: string;
  name: string;
  /**
   * Fonctionnalités dont celle-ci dépend. Vérifié au build : une dépendance
   * manquante échoue à la compilation, pas à l'exécution chez le client.
   */
  requires: string[];
  /** Entrées de navigation, clés i18n. */
  nav?: { href: string; labelKey: string }[];
}
