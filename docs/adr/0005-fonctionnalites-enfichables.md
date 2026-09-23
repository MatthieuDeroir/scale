# ADR 0005 — Tout le catalogue, rien d'imposé

**Statut** : accepté · **Date** : 2026-09-08

## Contexte

Chaque produit du bureau d'études réimplémente les mêmes choses : comptes, écrans, médias,
programmation horaire, veille, mise à jour, redémarrage planifié. Elles existent déjà, en
production, dans SL MEDIA, ServeurTemps et SL FTP — mais chacune enfermée dans son dépôt.

Deux mauvaises réponses se présentaient :

- **Un socle minimal** — chaque projet repart de zéro sur les mêmes sujets, et chacun
  réintroduit ses propres défauts. C'est la situation actuelle.
- **Un socle qui embarque tout** — un afficheur de gymnase traîne le moteur de composition, la
  gestion documentaire et la couche GPIO qu'il n'utilisera jamais. Surface d'attaque, taille de
  bundle et dépendances à surveiller, pour rien.

## Décision

**Le socle porte le catalogue complet ; le projet en active une part.**

Le mécanisme n'est pas inventé : c'est celui que SL MEDIA applique déjà à ses data-modules
(`modules.config.ts` + `build-modules.ts`, qui compose jusqu'au schéma Prisma), généralisé aux
fonctionnalités.

```
capabilities.config.ts        la liste, commentable ligne à ligne
        ↓ pnpm build:registry
src/.generated/capabilities.ts   registre et garde `hasCapability()`
prisma/schema.prisma             socle + fragment de chaque fonctionnalité active
messages/.generated/*.json       messages du socle + ceux des fonctionnalités
server/.generated/*.mjs          data-modules ayant un service serveur
```

Une fonctionnalité est un dossier `src/features/<id>/` qui peut apporter, en plus d'une feature
ordinaire : un `feature.config.ts`, un fragment Prisma, ses messages et un service serveur.

### Ce qui rend la décision tenable

**Les erreurs tombent au build, pas chez le client.** Deux garde-fous vérifiés à chaque
`build:registry` : une fonctionnalité activée mais absente échoue ; une dépendance déclarée
dans `requires` mais non activée échoue.

**Le socle ne suppose rien du produit.** Corollaire appliqué immédiatement : `subscribeSerial`
refuse de démarrer sans un `protocol` déclaré par le module, et sans `SERIAL_BAUD_RATE`. Un
défaut RSCOM dans le socle imposerait `0xF8` / 54 octets à tout projet Stramatel — y compris à
ceux qui ne parlent pas au pupitre.

**Le catalogue nomme sa source.** `docs/CATALOGUE.md` indique, pour chaque entrée, le produit
en production d'où elle doit être portée. Porter, pas réécrire.

## Conséquences

- Le schéma Prisma devient **généré** : on édite `prisma/base-template.prisma` ou le fragment
  d'une fonctionnalité, jamais `prisma/schema.prisma`.
- Les messages d'une fonctionnalité vivent avec elle. `pnpm i18n:check` porte sur le résultat
  fusionné : une clé absente d'une langue échoue.
- Une fonctionnalité désactivée n'est pas seulement masquée : ses tables ne sont pas créées,
  son service ne démarre pas, ses messages ne sont pas chargés.
- `middleware.ts` interroge `hasCapability('auth')`. **Un produit sans authentification est une
  décision à documenter dans son analyse de risques**, pas un oubli — profil P3 de la baseline.

## Ce que cette décision ne fait pas

Elle ne porte pas les fonctionnalités. Le catalogue en compte 22 ; deux sont portées. Le reste
est un travail identifié, avec sa source — pas une promesse.
