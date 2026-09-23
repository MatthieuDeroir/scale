# Catalogue des fonctionnalités

Le socle porte **tout ce que le bureau d'études sait déjà faire**. Un projet n'embarque que ce
qu'il utilise : commenter une ligne de `capabilities.config.ts` retire la fonctionnalité du
bundle, de la navigation, du schéma Prisma **et** des services serveur.

> **Rien ne s'invente ici.** Chaque ligne a une source : un produit en production où la
> fonctionnalité tourne déjà. Le portage consiste à la généraliser, pas à la réécrire.

> ⚠️ **Cette liste est à valider, pas à exécuter.** Elle recense ce qui existe dans la gamme.
> Décider ce qui entre au catalogue, et dans quel ordre, est un arbitrage à faire — pas une
> conséquence automatique du fait qu'une brique existe quelque part.

## Transports — `server/transport/<id>/`

Chaque transport est une fonctionnalité à part entière : le désactiver retire son code **et ses
dépendances**. `frame-codec.mjs` n'en est pas une : c'est le noyau pur partagé, sans dépendance
et sans entrée/sortie, toujours présent.

| Fonctionnalité | Ce qu'elle apporte | Dépendances retirées si désactivée | État |
|---|---|---|:-:|
| `transport-serial` | flux d'octets, réassemblage, resynchronisation, dispatch par type, écriture | `serialport` | ✅ |
| `transport-udp` | un port une socket : écoute **et** émission, dispatch par octet de tête | *aucune* (`node:dgram`) | ✅ |
| `transport-websocket` | Socket.io **authentifié**, état à la connexion, diffusion par rôle | `socket.io`, `socket.io-client` | ✅ |

Un data-module déclare le transport dont il dépend (`export const transport` dans son
`lib/protocol.mjs`). **Le build échoue** si ce transport n'est pas activé — vérifié :

```
[build:registry] le data-module « example-serial » requiert « transport-serial »,
                 non activé dans capabilities.config.ts
```

## Fonctionnalités applicatives — `src/features/<id>/`

Relevé le 2026-09-08 sur les surfaces d'API et les dossiers réels des quatre produits.
**Colonne « Garder ? » à remplir : tout ce qui existe n'a pas vocation à entrer au socle.**

### Socle commun — probablement tous les produits

| Fonctionnalité | Ce qu'elle apporte | Source | Garder ? | État |
|---|---|---|:-:|:-:|
| `health` | état de la source matérielle, sonde `/api/health` | socle | ✔ | ✅ |
| `auth` | session JWT signée, RBAC, verrouillage progressif, refus par défaut | SL MEDIA · ServeurTemps · G552 | ✔ | ✅ |
| `users` | comptes, profils de permission granulaires | SL MEDIA `permission-profiles` + `users` | | ⬜ |
| `settings` | réglages applicatifs, contribués par les fonctionnalités | SL MEDIA `settings`, ServeurTemps `modules/setting` (17 f.) | | ⬜ |
| `system` | redémarrage service et machine, état, journaux | SL MEDIA `system`, G552 `/admin` | | ⬜ |
| `update` | mise à jour en ligne et hors ligne depuis l'interface | SL MEDIA `update-docker.sh`, ServeurTemps `server/update`, SL FTP `updates` | | 🟨 |
| `reboot` | redémarrage quotidien planifié, fuseau explicite | socle `scheduled-reboot.service.mjs` | | 🟨 |

### Affichage et contenu — produits qui pilotent un écran

| Fonctionnalité | Ce qu'elle apporte | Source | Garder ? | État |
|---|---|---|:-:|:-:|
| `screens` | écrans, zones (`zoneX`/`zoneY`), luminosité, allumage, état en ligne | SL MEDIA `screens` + `screen.service.mjs` | | ⬜ |
| `media` | bibliothèque images et vidéos, dossiers, quotas | SL MEDIA `media` `folders` `uploads` | | ⬜ |
| `serve-upload` | service de fichiers durci (traversée, types, en-têtes) | SL MEDIA `serve-upload` | | ⬜ |
| `slideshow` | diaporamas, diffusion, diaporamas d'alerte | SL MEDIA `slideshows` `slides` + `diapo.service.mjs` | | ⬜ |
| `editor` | composition sur canevas Konva, formes, gabarits | SL MEDIA `editor-v2` `shape-templates` `fonts` | | ⬜ |
| `preview` | rendu d'aperçu côté serveur | SL MEDIA `preview.service.mjs` | | ⬜ |
| `standby` | veille, logo, extinction programmée | SL MEDIA `standby-scheduler.service.mjs`, G552 `/veilles` | | ⬜ |
| `dashboard` | tableau de bord à widgets contribués par les modules | SL MEDIA `dashboard` | | ⬜ |
| `rescue` | application de secours si le build principal échoue | SL MEDIA `build-rescue.mjs` | | ⬜ |

### Temps et programmation

| Fonctionnalité | Ce qu'elle apporte | Source | Garder ? | État |
|---|---|---|:-:|:-:|
| `schedule` | programmation horaire, récurrences, exceptions | SL MEDIA `schedules`, ServeurTemps `modules/schedule` (22 f.) + `recurrence` | | ⬜ |
| `masks` | masques de plages horaires | ServeurTemps `modules/masks` (7 f.) | | ⬜ |
| `alert-mode` | mode alerte global | ServeurTemps `alert-mode` | | ⬜ |
| `clocks` | parc d'horloges, configuration diffusion / multicast / web | ServeurTemps `clocks` + `server/clock` | | ⬜ |
| `time-frames` | composeurs de trames `0xCB` `0xCF` `0xCC` `0xCA`, composeur intelligent | ServeurTemps `server/time` (19 f.) | | ⬜ |
| `gps-ntp` | GPS NMEA, pont Chrony SHM, service NTP | ServeurTemps `server/{gps,time}` | | ⬜ |

### Matériel

| Fonctionnalité | Ce qu'elle apporte | Source | Garder ? | État |
|---|---|---|:-:|:-:|
| `gpio` | entrées/sorties, contacts secs, étiquettes, journaux, simulation, test | ServeurTemps `gpio` (6 routes) + `server/gpio` | | ⬜ |
| `audio` | sonneries, fichiers, périphériques, lecture, séquences | ServeurTemps `audio` (6 routes) + `modules/bells` | | ⬜ |
| `temperature` | sondes et seuils | ServeurTemps `server/temperature` + SL MEDIA data-module | | ⬜ |
| `network` | configuration réseau depuis l'interface, DHCP | ServeurTemps `server/network` | | ⬜ |

### Fichiers et intégrations

| Fonctionnalité | Ce qu'elle apporte | Source | Garder ? | État |
|---|---|---|:-:|:-:|
| `files` | navigation, téléversement, téléchargement, recherche | SL FTP `browse` `upload` `download` `search` | | ⬜ |
| `gitlab` | intégration forge : releases, jetons, publication | SL FTP `gitlab` | | ⬜ |
| `proxy` | passerelle web pour contenu externe en iframe | SL MEDIA `proxy` | | ⬜ |
| `notify` | notifications, courriel | SL MEDIA `notify.service.mjs`, ServeurTemps `server/email` | | ⬜ |
| `licence` | activation, protection commerciale | SL MEDIA `license.service.mjs` | | ⬜ |
| `machine-config` | configuration propre à l'équipement livré | SL MEDIA `machine-config` | | ⬜ |

### Spécifique produit — à ne PAS mettre au socle

Listé pour mémoire, parce que la tentation existera : ces briques appartiennent à leur produit.

| Brique | Produit | Pourquoi elle reste chez lui |
|---|---|---|
| `scoreboard` (13 mises en page sportives) | G552 · SL MEDIA | règles métier par sport, pas une brique générique |
| `macros` / `buttons` | G552 | sémantique liée au pupitre |
| `optisea` · `cinema` · `weather` · `rss` · `youtube` · `web` · `ephemeris` · `broadcast-stats` | SL MEDIA | **data-modules**, autre axe et autre contrat |

Légende : ✅ portée et vérifiée · 🟨 présente côté serveur, pas encore packagée en fonctionnalité
activable · ⬜ **listée, aucun code écrit**.

**Décompte au 2026-09-08 : 5 portées, 2 à moitié, 28 listées.** Une ligne ⬜ est un relevé de
ce qui existe ailleurs, avec son emplacement — pas une promesse de portage.

> Les trois **transports** ne sont pas des fonctionnalités activables : ils sont dans
> `server/transport/` et ne coûtent rien tant qu'aucun module ne s'y abonne. Un produit sans
> matériel supprime `serial.mjs` et la dépendance `serialport` ; `udp.mjs` et `realtime.mjs`
> n'ont aucune dépendance au-delà de Socket.io. Voir `docs/adr/0006-couche-de-communication.md`.

## Data-modules — l'autre axe

Les **contenus enfichables** suivent le même principe mais un contrat distinct
(`src/data-modules/`) : ils fournissent des valeurs à afficher, pas des écrans d'exploitation.

Existants chez SL MEDIA, à porter au besoin : `clock` · `datetime` · `weather` · `rss` ·
`cinema` · `temperature` · `ephemeris` · `web` · `youtube` · `optisea` · `broadcast-stats` ·
`security`.

Le socle n'en fournit qu'un, **`example-serial`**, et c'est un exemple à supprimer — voir
« Retirer l'exemple » dans le README.

## Ajouter une fonctionnalité

```
src/features/<id>/
  feature.config.ts        id, nom, requires[], entrées de navigation
  prisma/schema.prisma     fragment de schéma, concaténé au socle       (optionnel)
  messages/{fr,en}.json    messages, fusionnés au build                 (optionnel)
  services/<id>.service.mjs  service serveur                            (optionnel)
  api/ components/ hooks/ lib/ store/ types/ __tests__/   comme toute feature
```

Puis décommenter la ligne dans `capabilities.config.ts` et lancer `pnpm build:registry`.

### Une fonctionnalité n'est PAS portée tant qu'elle n'a pas

- [ ] ses tests **unitaires**, écrits avant le code (`src/features/<id>/__tests__/`) ;
- [ ] ses tests d'**intégration** sur la vraie base (`tests/integration/<id>/`) ;
- [ ] **un cas de refus par contrôle d'accès** qu'elle introduit — un test qui prouve qu'une
      route fonctionne ne prouve pas qu'elle refuse ;
- [ ] un fragment Prisma si elle a des tables, et un test qui vérifie ses **contraintes** ;
- [ ] ses messages `fr` **et** `en` — `pnpm i18n:check` échoue sinon ;
- [ ] la couverture globale au-dessus du plancher, **sans avoir baissé le plancher**.

Tant qu'une case manque, l'entrée reste ⬜ dans le tableau. Voir `docs/adr/0007-tdd.md`.

**Deux garde-fous, vérifiés au build** — testés contre de vraies erreurs le 2026-09-08 :

- une fonctionnalité activée mais absente de `src/features/` **échoue le build** ;
- une dépendance déclarée dans `requires` mais non activée **échoue le build**.

Dans les deux cas l'erreur tombe à la compilation, pas à l'exécution chez le client.

## Règles de portage

1. **Porter, pas réécrire.** La version de référence est celle du produit le plus récent qui
   l'exécute. Pour la charte, c'est SL FTP ; pour les modules et le déploiement, SL MEDIA ;
   pour la couche matérielle, ServeurTemps.
2. **Une fonctionnalité qui n'a pas de fragment Prisma, de messages ni de service n'est qu'une
   feature ordinaire.** Ne pas la faire entrer au catalogue pour le principe.
3. **Le contrat de service serveur est celui de SL MEDIA** : `initialize(io, prisma)` ·
   `stop()` · `getConnectionData()` · `handleDataChange(data)`.
4. **Aucune fonctionnalité ne suppose le protocole d'une autre.** Le socle ne connaît ni RSCOM
   ni les trames UDP : c'est le data-module qui déclare son `protocol`.
