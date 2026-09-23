/**
 * Fonctionnalités activées pour ce build.
 *
 * Le socle porte le catalogue de TOUT ce que le bureau d'études sait faire ;
 * un projet n'embarque que ce qu'il utilise. Commenter une ligne retire la
 * fonctionnalité du bundle, de la navigation, du schéma Prisma et des services
 * serveur — pas seulement de l'écran.
 *
 * Après modification : `pnpm build:registry`.
 *
 * Catalogue et état de portage : docs/CATALOGUE.md
 */
export const activeCapabilities = [
  // Ni écran ni matériel embarqué : ce projet est une UI d'administration web
  // devant l'API REST d'un Headscale forké. Aucun transport, pas de source
  // matérielle à surveiller.
  // 'transport-websocket', // Socket.io authentifié          → socket.io
  // 'transport-serial', //    lecture/écriture port série    → serialport
  // 'transport-udp',   //    écoute et émission UDP        → aucune dépendance

  // 'health', // état de la source matérielle — sans objet ici

  'auth', // comptes, session JWT, RBAC, verrouillage progressif

  // 'users' n'est pas encore porté au socle (docs/CATALOGUE.md : état ⬜) — la
  // gestion des flottes/tags/clés sera une feature propre à ce projet
  // (src/features/fleets/), pas une capacité socle activée ici.

  // 'screens',     // écrans, zones, luminosité, allumage
  // 'media',       // bibliothèque d'images et de vidéos
  // 'slideshow',   // diaporamas et diffusion
  // 'schedule',    // programmation horaire et récurrences
  // 'standby',     // veille, logo, redémarrage quotidien
  // 'update',      // mise à jour en ligne et hors ligne depuis l'interface
  // 'licence',     // activation et protection commerciale
] as const;

export type CapabilityId = (typeof activeCapabilities)[number];
