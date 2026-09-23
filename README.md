# Stramatel Starter 2026

Socle de démarrage du bureau d'études. Il matérialise les conventions éprouvées sur
**SL MEDIA** (2 963 commits) et ce qu'un produit Stramatel exige en plus d'une application
web : un port série ouvert en permanence, un affichage plein écran sur la machine, et une
mise à jour qui doit passer sans réseau.

> Générer un projet avec le skill **`bootstrap-projet-stramatel`** plutôt qu'en copiant le
> dossier : il pose les questions de cadrage et n'active que les axes nécessaires.

## Le principe : tout est disponible, rien n'est imposé

Le socle porte **le catalogue de tout ce que le bureau d'études sait faire**. Un projet
n'embarque que ce qu'il utilise.

```ts
// capabilities.config.ts
export const activeCapabilities = [
  'health',
  'auth',
  // 'screens',   // décommenter pour activer
  // 'slideshow',
] as const;
```

`pnpm build:registry` en dérive le registre, **le schéma Prisma composé**, les messages fusionnés
et les services serveur actifs. Commenter une ligne retire la fonctionnalité du bundle, de la
navigation, des tables **et** du serveur — pas seulement de l'écran.

Deux garde-fous, vérifiés **au build** : une fonctionnalité activée mais absente échoue ; une
dépendance déclarée dans `requires` mais non activée échoue. L'erreur tombe à la compilation,
pas chez le client.

Le catalogue complet, avec la source à porter pour chaque entrée :
**`docs/CATALOGUE.md`**.

## Les quatre axes

```
server/                      couche matérielle, processus long   ← racine
  index.mjs                    Next + Socket.io + cycle de vie
  services/                    lecteurs partagés, ordonnanceurs
  module-services.mjs          registre des services de data-module

src/
  app/                       routes Next.js, fines
  core/                      auth, db, validation, limitation de débit
  features/<kebab-case>/     tranche applicative        ← toujours actif
  data-modules/<type>/       contenus enfichables       ← si le produit affiche du contenu
    lib/                       décodeurs PURS
    services/<id>.service.mjs  service serveur du module ← quatrième axe
  shared/                    api, ui, hooks, realtime
```

Voir `docs/adr/0001-quatre-axes.md`. **La convention est vérifiée, pas suggérée** :
`project-structure/*.json` + `eslint-plugin-project-structure`, dans le stage `quality`.

Deux règles sont refusées par le lint, pas seulement écrites :

- une feature ne peut importer ni `server/**` ni `serialport` ;
- un décodeur ne peut importer ni `node:fs`, ni Prisma, ni une feature.

## La couche de communication

Trois transports, un seul invariant : **un port, une socket.** Le transport possède le port et
redistribue aux abonnés ; aucun module n'ouvre le sien.

```
server/transport/
  frame-codec.mjs   découpage, validation, journalisation, recul — PUR, 14 tests
  serial.mjs        flux d'octets : réassemblage, dispatch par type de trame
  udp.mjs           datagrammes : dispatch par octet de tête, émission incluse
  realtime.mjs      Socket.io AUTHENTIFIÉ
```

| | |
|---|---|
| Le terminateur est **vérifié** | une trame tronquée resynchronise, elle n'est pas livrée |
| Écoute et émission sur **la même socket** | `sendUdp` / `sendSerial` n'ouvrent pas de second port |
| Le protocole n'est **jamais supposé** | `subscribeSerial` et `subscribeUdp` refusent de démarrer sans `protocol` déclaré par le module |
| La poignée de main WebSocket **vérifie la session** | sans `auth`, la socket accepte tout **et le démarrage l'écrit dans le journal** |

> ⚠️ **Une socket n'hérite pas du middleware HTTP.** Une application dont toutes les routes
> sont protégées peut avoir un WebSocket ouvert — c'est le constat B3 de l'audit SL MEDIA,
> toujours ouvert là-bas. Voir `docs/adr/0006-couche-de-communication.md`.

## La règle qui rend un produit matériel testable

**Un port, une socket, redistribution par type de trame** — et le décodage n'y touche jamais.

```
port série  →  server/services/serial-listener.service.mjs   resynchronise, découpe, distribue
                     ↓ (abonnement par type)
            src/data-modules/example-serial/services/…service.mjs   entrées/sorties, Socket.io
                     ↓ (fonction pure)
            src/data-modules/example-serial/lib/frame-parser.ts     Buffer → objet
```

C'est ce qui permet à `pnpm test:frames` de tourner en CI **sans pupitre, sans radio et sans
panneau**. Le module `example-serial` est là comme exemple complet du découpage, pas pour être
utilisé tel quel.

### Retirer l'exemple

```bash
rm -rf src/data-modules/example-serial
# si le produit ne parle à aucun matériel :
rm server/services/serial-listener.service.mjs
pnpm remove serialport
pnpm build:registry
```

Le socle **ne suppose aucun protocole** : `subscribeSerial` refuse de démarrer sans un
`protocol { startByte, frameSize, endByte? }` déclaré par le module, et sans `SERIAL_BAUD_RATE`.
Un défaut RSCOM ici imposerait `0xF8` / 54 octets à tout projet Stramatel.

## Pile

Next.js App Router · React 19 · TypeScript · Tailwind 4 · **shadcn/Radix + lucide** · Zustand ·
TanStack Query · react-hook-form + Zod · next-intl · sonner · Prisma/SQLite · serveur Node
maison + Socket.io · `serialport` · **pnpm** · **Vitest** + Playwright · livraison **Docker**.

## Charte graphique — reprise, pas réinventée

Les jetons viennent **tels quels de SL FTP**, elle-même alignée sur ServeurTemps et SL MEDIA :
base slate/navy shadcn (`style: new-york`), **sidebar sombre dans les deux thèmes**, et
l'accent **rouge du logo STRAMATEL** (`--brand: 353 94% 45%`).

| | |
|---|---|
| Accent de marque | `bg-brand` — **une action principale par vue**, pas davantage |
| États | `Badge` en `ok` / `warning` / `critical`, distincts de l'accent |
| Thème | clair · sombre · système, sans clignotement au chargement |
| Police | pile système — aucune police à télécharger, un équipement hors ligne n'ira pas la chercher |
| Icônes | `lucide-react` |

`components.json` est configuré : `npx shadcn@latest add <composant>` dépose dans
`src/shared/ui/` et hérite des jetons. Voir `docs/adr/0004-charte-graphique.md`.

## Démarrage

```bash
pnpm install
cp .env.example .env
pnpm secret:generate                # coller la valeur dans JWT_SECRET
pnpm db:generate && pnpm db:push && pnpm db:seed
pnpm dev
```

`db:seed` **tire un mot de passe au sort** et l'affiche une seule fois. Aucun identifiant par
défaut n'est livré : c'est le constat qui revient dans chaque audit, il ne doit pas naître ici.

## Développement — TDD

Le test vient avant le code. Cinq suites, qui ne se recouvrent pas.

| Suite | Environnement | Couvre |
|---|---|---|
| `pnpm test:transport` | Node | codec de trames, ordonnanceurs, état, configuration |
| `pnpm test:frames` | Node | décodeurs des data-modules |
| `pnpm test:unit` | jsdom | composants, schémas, hooks |
| `pnpm test:integration` | Node | routes, middleware, transports, **vraie base SQLite jetable** |
| `pnpm test:e2e` | Playwright | parcours complet |

**Seuil de couverture bloquant** : `lines 88 · statements 85 · functions 82 · branches 80`.
Il se relève quand une fonctionnalité est portée, **jamais ne se baisse**.

**Une fonctionnalité n'est pas finie sans** : tests unitaires de sa logique pure, tests
d'intégration de ses routes et de son schéma sur la vraie base, **un cas de refus pour chaque
contrôle d'accès**, et la couverture au-dessus du plancher. Voir `docs/adr/0007-tdd.md`.

> L'intégration touche une **vraie base**. Simuler Prisma prouverait le code du test, pas le
> schéma — ni les contraintes, ni les index uniques. Le G552 n'a pas de contrainte d'unicité sur
> `username` : c'est de là que viennent ses comptes en double.

## Commandes

| Commande | Rôle |
|---|---|
| `pnpm dev` / `build` / `start` | développement, build, production |
| `pnpm lint` / `typecheck` | qualité, **dont la structure de dossiers** |
| `pnpm test` | les quatre suites Vitest |
| `pnpm test:coverage` | idem, avec le seuil bloquant |
| `pnpm test:transport` / `test:frames` / `test:unit` / `test:integration` | une suite à la fois |
| `pnpm test:e2e` | Playwright |
| `pnpm verify` | lint + typecheck + tests, avant tout envoi |
| `pnpm release` / `release:offline` | image poussée / archive autonome |
| `pnpm update` | mise à jour d'une machine en service |
| `pnpm secret:generate` | secret JWT |

## Sur la machine cible

```bash
sudo bash scripts/install.sh            # utilisateur de service, dialout, .env, systemd
sudo bash scripts/kiosk-autostart.sh    # lightdm + openbox + navigateur en kiosque
```

L'afficheur est **un navigateur en mode kiosque sur une route de la même application**, pas une
seconde application. Une chaîne de build, un artefact, un déploiement — voir
`docs/adr/0003-livraison-et-affichage.md`.

Le service ne tourne **pas en root** et le conteneur n'est **ni `privileged` ni en `pid: host`** :
l'accès au port série passe par `devices:` et le groupe `dialout`.

## Mise à jour hors ligne

Mode nominal pour un équipement en gymnase ou en usine.

```bash
pnpm release:offline                    # archive + SHA256SUMS + SBOM
sudo bash scripts/update-docker.sh --file stramatel-…-offline.tar.gz
```

`update-docker.sh` **sauvegarde la base avant toute opération**, vérifie les empreintes,
applique, contrôle `/api/health`, et **revient en arrière** si la santé n'est pas confirmée.

> L'empreinte prouve l'intégrité, pas l'origine. La **signature** reste à implémenter par
> projet — `INT-01` et `UPD-02` de la baseline. Le script porte l'emplacement exact.

## Pipeline — 7 stages

```
install → quality → security → test → build → package → deploy
```

`security` est obligatoire : `gitleaks` (bloquant), Semgrep, Trivy (bloquant en CRITICAL),
**SBOM CycloneDX** conservé sans expiration. `package` en dépend, et dépend aussi de
`test:frames` — on ne publie pas une image dont les décodeurs n'ont pas été vérifiés.

## Sécurité et conformité CRA

À faire **avant toute mise sur le marché** : renseigner la classification CRA et le canal de
signalement dans `security/README.md`, puis monter le dossier produit à partir de
`mes_projets/interne/mise_en_conformite_cra/dossier_type/`.

```bash
pipx install pre-commit && pre-commit install
bash security/hardening-check.sh
```

Ce que le socle apporte déjà, et qu'il ne faut pas défaire :

| Contrôle | Où |
|---|---|
| `JWT_SECRET` validé au démarrage, refus de démarrer sinon | `server/config.mjs` |
| Aucun identifiant par défaut, mot de passe initial tiré au sort | `prisma/seed.ts` |
| Routes refusées par défaut, liste blanche explicite | `src/middleware.ts` |
| Conteneur non privilégié, sans capacités, en lecture seule | `docker-compose.yml` |
| Sauvegarde de la base avant mise à jour, retour arrière | `scripts/update-docker.sh` |
| Terminateur de trame vérifié, resynchronisation | `serial-listener.service.mjs` |

## État de vérification — 2026-09-08

Tout ce qui suit a été exécuté sur ce dépôt, pas seulement écrit.

| Vérification | Résultat |
|---|---|
| `pnpm install` | 50 paquets, sans erreur |
| `pnpm lint` (dont structure de dossiers) | vert |
| `pnpm typecheck` | vert |
| `pnpm i18n:check` | 18 clés alignées sur 2 langues, messages fusionnés depuis les fonctionnalités |
| `pnpm test` | **139 tests** en 25 fichiers, aucun n'exige de matériel |
| `pnpm test:coverage` | **lignes 91,6 % · instructions 88,7 % · fonctions 88,8 % · branches 82,2 %** — au-dessus du plancher |
| Le plancher échoue vraiment | seuil porté à 99 % : `ERROR: Coverage for lines (91.56%) does not meet global threshold (99%)` |
| Défauts trouvés PAR les tests | résolveur Zod 4 incompatible (validation du formulaire inopérante) · `sendUdp` limité à son propre port |
| `pnpm db:push && pnpm db:seed` | base créée, mot de passe tiré au sort, seed idempotent |
| `pnpm dev` + `GET /api/health` | serveur démarré, sonde répond, `fresh:false` sans matériel |
| Rendu de la coquille | sidebar sombre, accent `bg-brand`, `lang="fr"`, script anti-clignotement et sélecteur de thème présents dans le HTML servi |
| `pnpm build:registry` | 2 fonctionnalités, 1 data-module, schéma Prisma composé, 2 langues fusionnées |
| Garde-fous d'activation | fonctionnalité absente → build refusé ; dépendance non activée → build refusé |
| Capacité `auth`, bout en bout | `/api/health` 200 · route protégée sans session 401 · page protégée → 307 vers `/login` · bon mot de passe 200 + cookie · page protégée avec session 200 |
| Pas d'oracle d'énumération | mauvais mot de passe et compte inexistant renvoient **le même 401** |
| Verrouillage progressif | 5 échecs → compte verrouillé ; le **bon** mot de passe est ensuite refusé |
| **WebSocket authentifié** | sans cookie **refusé** · cookie invalide **refusé** · session valide **connecté** |
| **UDP** | deux abonnés sur un même port, dispatch par octet de tête ; trames invalides et types inconnus non livrés ; émission sans second bind |
| Règles d'architecture | une feature important `server/**` et un décodeur important `shared/**` sont **refusés** ; les fichiers légitimes passent |

Non vérifié faute de cible : `pnpm build`, l'image Docker, `install.sh`, `kiosk.sh`,
`update-docker.sh` et les tests Playwright.

## Ce que ce starter ne fait pas

- Il ne migre aucun projet existant. `ServeurTemps` garde `src/modules/`, `G552` reste sur
  Express/React/Electron tant que sa refonte n'est pas engagée.
- Il ne s'applique pas rétroactivement au legacy pour la conformité CRA.
- Il ne signe pas les mises à jour : l'emplacement est marqué, la décision est projet.
