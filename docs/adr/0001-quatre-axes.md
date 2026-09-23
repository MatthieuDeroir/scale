# ADR 0001 — Quatre axes, pas trois

**Statut** : accepté · **Date** : 2026-09-08 · **Remplace** : « découpage en trois axes »

## Contexte

La première version de cet ADR annonçait trois axes — `features/`, `data-modules/`,
`src/server/` — en présentant le dernier comme l'apport de ServeurTemps. Confrontée au code,
cette description était fausse sur deux points :

1. **`src/server/` n'aurait pas passé le lint du socle.** `folder-structure.json`, copié de
   SL MEDIA, ne déclarait ni `server` ni `core` sous `structureRoot: "src"`. Créer
   `src/server/serial/` aurait été rejeté par la règle que ce même socle impose.
2. **SL MEDIA ne fait pas ça.** Sa couche matérielle vit dans un `server/` **à la racine**,
   hors du périmètre du lint, et un quatrième mécanisme existait sans être documenté : les
   **services de data-module**, chargés dynamiquement par `server/module-services.mjs`.

## Décision

Quatre axes, nommés d'après ce qui est réellement en production.

```
server/                     couche matérielle et processus long   ← racine, hors structureRoot
  index.mjs                 Next + Socket.io + cycle de vie
  services/                 lecteurs partagés (série, UDP), ordonnanceurs
  module-services.mjs       registre des services de data-module

src/
  app/                      routes Next.js, fines
  core/                     invariants techniques : auth, db, validation, limitation de débit
  features/<kebab-case>/    tranche applicative      ← toujours actif
  data-modules/<type>/      contenus enfichables     ← si le produit affiche du contenu
    lib/                      décodeurs PURS, testables sans matériel
    services/<id>.service.mjs  service serveur du module  ← le quatrième axe
  shared/                   api, ui, hooks, realtime
```

### Pourquoi `server/` à la racine

Le lecteur série est un processus long qui possède un descripteur de fichier. Ce n'est pas du
code applicatif : ce n'est ni rendu, ni importé par une page, ni bundlé. Le placer sous `src/`
oblige à l'exclure du lint, du typage strict et du bundler — trois exceptions pour un seul
dossier. À la racine, il n'y a aucune exception à écrire.

### Pourquoi les services de data-module

Un module de contenu peut avoir besoin du matériel : le module `optisea` de SL MEDIA lit un
radar en UDP. Le faire remonter dans `server/` mélangerait le générique et le métier. Le
contrat retenu est celui déjà en production :

```
initialize(io, prisma)  démarrage
stop()                  arrêt propre           (optionnel)
getConnectionData()     état à la connexion    (optionnel)
handleDataChange(data)  réaction aux changements (optionnel)
```

`getConnectionData()` n'est pas un confort : sans lui, un afficheur qui redémarre reste noir
jusqu'au prochain événement.

### La règle qui rend l'ensemble testable

**Un port, une socket, redistribution par type de trame.** Le service partagé possède le port ;
les modules s'y abonnent. C'est la leçon écrite en commentaire de
`udp-listener.service.mjs` de SL MEDIA : si chaque module ouvre le port, le dernier ouvert
reçoit tout et les autres sont sourds.

Et surtout : **le décodage ne touche jamais au matériel.** Les décodeurs sont dans
`data-modules/*/lib/`, prennent un `Buffer` et rendent un objet. C'est ce qui permet à
`pnpm test:frames` de tourner en CI sans pupitre, sans radio et sans panneau.

Les deux règles sont vérifiées par `independent-modules.json`, pas seulement écrites ici.

## Conséquences

- Une feature ne peut pas importer `server/**` ni `serialport` : le lint le refuse.
- Un décodeur ne peut pas importer `node:fs`, Prisma ou une feature : le lint le refuse.
- Un projet sans matériel n'active ni `server/services/` ni les services de module. Les axes
  sont optionnels ; leur emplacement ne l'est pas.

## Ce que cette décision ne fait pas

Elle ne migre aucun projet existant. `ServeurTemps` garde `src/modules/`, `G552` reste sur
Express/React/Electron tant que sa refonte n'est pas engagée.
