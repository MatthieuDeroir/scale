# CLAUDE.md — stramscale-ui

**Métier(s) engagé(s)** : 1 (architecture) · 2 (réalisation) · 3 (intégration/exploitation)
**Statut** : scaffold initial (2026-09-23) — aucune fonctionnalité métier encore développée

## À quoi sert ce dépôt

Interface d'administration du fork Headscale de Stramatel (`../stramscale/`) : gestion des
flottes clients (groupes logiques de machines par client, par tag), émission et révocation de
clés d'accès scopées à une flotte, état du parc. Voir `../CAHIER_DES_CHARGES.md` pour le
périmètre fonctionnel complet et le chiffrage.

Bootstrap depuis `mes_projets/interne/socle/starter_2026/` (skill `bootstrap-projet-stramatel`).
**Ceci n'est pas un produit embarqué** : c'est une application web hébergée (VPS Lan2Net),
consultée par des humains avec accès Internet — contrairement au reste de la gamme, la
contrainte "pas de police téléchargée" du starter ne s'applique pas ici par nature, mais elle
est conservée par défaut (pile système) faute de raison de diverger pour l'instant.

## Axes activés

Seul **`auth`** est actif (`capabilities.config.ts`) — comptes, session JWT, RBAC. Tout le
reste du catalogue socle est désactivé : pas de transport (websocket/série/UDP), pas de
data-modules (pas de contenu enfichable type horloge/météo), pas d'axe matériel `server/`
hormis son noyau de configuration partagé.

**`users` n'est pas encore porté au socle** (`docs/CATALOGUE.md` : état ⬜) — la gestion des
flottes/tags/clés sera une **feature propre à ce projet**, à écrire dans `src/features/fleets/`
(ou nom équivalent), pas une capacité socle à activer.

Le module d'exemple `data-modules/example-serial` et ses tests associés (transport série) ont
été retirés — illustratifs uniquement, sans rapport avec ce projet.

## Comment on lance, teste

```bash
pnpm install && pnpm secret:generate && pnpm db:push && pnpm db:seed && pnpm dev
pnpm test            # suites Vitest restantes après retrait de l'axe matériel
pnpm verify           # lint + typecheck + tests, avant tout envoi
```

**111/111 tests passent.** Un défaut latent du socle a été trouvé et corrigé : `@prisma/client`
recharge `.env` à l'import (dotenv vendored) et repeuple tout `process.env`, ce qui réinjectait
silencieusement `JWT_SECRET` dans `server/__tests__/config.test.mjs` après sa suppression en
mémoire par le test. Corrigé en mockant `@prisma/client` dans ce test (il ne teste que la
validation d'env, pas Prisma). Corrigé à la source dans
`mes_projets/interne/socle/starter_2026/server/__tests__/config.test.mjs` — tout futur projet
bootstrappé en hérite.

## Prochaine étape

Voir `../CAHIER_DES_CHARGES.md` §6 (phasage) et §8 (points à préciser) avant de commencer le
développement des fonctionnalités : spike NAT traversal sur le vrai parc 4G, modèle ACL par
tag de flotte, puis les premiers écrans d'admin.

## Charte graphique

Jetons repris tels quels de SL FTP (slate/navy shadcn, accent rouge `--brand`,
`docs/adr/0004-charte-graphique.md`) — cohérent avec le reste de la gamme et avec les
présentations (`mes_projets/divers/presentations/CLAUDE.md`).

## Qui d'autre y touche

Personne pour l'instant.
