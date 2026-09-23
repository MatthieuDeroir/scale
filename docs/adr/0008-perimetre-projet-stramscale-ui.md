# ADR 0008 — Un seul axe socle actif, la gestion de flotte est une feature propre

**Statut** : accepté · **Date** : 2026-09-23

## Contexte

Ce projet est l'UI d'administration d'un fork Headscale (`../stramscale/`, dépôt Go séparé),
pas un produit embarqué. Bootstrap depuis `starter_2026`, dont le catalogue de capacités
(`capabilities.config.ts`, `docs/CATALOGUE.md`) est pensé pour les afficheurs de la gamme
(SL MEDIA, ServeurTemps, G552) : transports série/UDP/websocket, écrans, médias, diaporamas.
Aucun de ces axes n'a de sens pour une application web hébergée consultée par des humains.

## Décision

Seule la capacité **`auth`** reste active. Sont explicitement retirés :

- `transport-serial`, `transport-udp`, `transport-websocket` — aucun matériel à piloter.
- `health` — pas de source matérielle dont surveiller l'état.
- Le module d'exemple `src/data-modules/example-serial/` et ses tests associés
  (`server/__tests__/module-services.test.mjs`,
  `tests/integration/transport/serial.test.ts`) — supprimés, pas seulement désactivés,
  puisqu'ils illustrent un axe entièrement hors sujet ici.
- `SERIAL_PATH`/`SERIAL_BAUD_RATE` retirés de `.env`/`.env.example`.

**`users` n'est volontairement pas activé** — cette capacité n'est pas encore portée au socle
(`docs/CATALOGUE.md` : état ⬜, pas ✅). La gestion des flottes clients, des tags et des clés
d'accès sera développée comme une **feature propre à ce projet**
(`src/features/fleets/` ou nom équivalent, à trancher au moment du développement), pas comme
une capacité socle activée par erreur sur une brique qui n'existe pas encore.

## Conséquences

- Le lint et le typecheck passent avec ce périmètre réduit ; `pnpm build:registry` ne
  référence plus aucun transport ni data-module.
- `docs/adr/0001` à `0007` (hérités du starter) restent en place tels quels : ils documentent
  l'architecture du socle, pas les décisions propres à ce projet. Cet ADR est la première
  décision qui appartient à `stramscale-ui` lui-même.
- Un défaut latent du socle a été révélé en testant avec un vrai `.env`
  (`server/__tests__/config.test.mjs`, test « refuse de démarrer sans secret » — le Prisma
  Client recharge `.env` à l'import et réinjecte le secret supprimé en mémoire par le test) et
  **corrigé à la source** dans `mes_projets/interne/socle/starter_2026/` en mockant
  `@prisma/client` dans ce test (validation de variables d'environnement, pas de Prisma). Le
  même correctif est repris ici pour rester synchronisé avec le socle.
