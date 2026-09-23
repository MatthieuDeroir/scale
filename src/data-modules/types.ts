/** Contrat commun des data-modules du socle. */
export interface FrameProtocol {
  /** Octet de synchronisation en tête de trame. */
  startByte: number;
  /** Terminateur, si le protocole en définit un. Vérifié à la lecture. */
  endByte?: number;
  /** Taille fixe de la trame, en octets. */
  frameSize: number;
}

export interface DataModuleManifest {
  id: string;
  name: string;
  /**
   * Protocole de trames, si le module lit une liaison série ou UDP.
   * Le socle n'en suppose aucun : c'est le module qui le déclare.
   */
  protocol?: FrameProtocol;
  /** Codes de type écoutés (octet 1 de la trame). */
  frameTypes?: number[];
  /**
   * Transport requis par ce module. Vérifié au build : un module qui lit le
   * port série alors que `transport-serial` est désactivé échoue à la
   * compilation, pas au démarrage chez le client.
   */
  transport?: string;
  /** Vrai si src/data-modules/<id>/services/<id>.service.mjs existe. */
  hasServerService?: boolean;
}
