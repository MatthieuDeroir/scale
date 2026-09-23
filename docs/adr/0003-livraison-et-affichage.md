# ADR 0003 — Le kiosque est un navigateur, pas une seconde application

**Statut** : accepté · **Date** : 2026-09-08

## Contexte

Le G552 a trois têtes : un backend Express, une interface React, et un afficheur Electron. La
refonte a pour premier objectif de simplifier cette architecture — non par élégance, mais
parce que trois têtes, ce sont trois builds, trois déploiements et trois façons de tomber en
panne pendant un match.

SL MEDIA, plus récent et plus gros, n'a pas de tête Electron. Son afficheur est un navigateur
en mode kiosque pointant sur la même application, lancé par `kiosk.sh` et
`kiosk-autostart.sh`.

## Décision

**Une application, deux vues, un déploiement.** La vue d'affichage est une route de la même
application Next.js ; la machine cible ouvre un navigateur en kiosque dessus.

```
serveur Node maison ──┬── interface d'exploitation   (navigateur de l'opérateur, Wi-Fi)
                      └── /display                   (navigateur kiosque, écran local)
```

Conséquences concrètes :

- une seule chaîne de build, un seul artefact, une seule mise à jour ;
- l'afficheur bénéficie du temps réel Socket.io sans pont supplémentaire ;
- plus de runtime Electron à maintenir ni de surface d'attaque associée.

`kiosk.sh` attend `/api/health` avant de lancer le navigateur : sans cette attente, l'opérateur
voit une page d'erreur s'afficher sur le panneau au démarrage.

## Livraison

| Mode | Commande | Quand |
|---|---|---|
| En ligne | `pnpm release` | machine raccordée, registre GitLab joignable |
| **Hors ligne** | `pnpm release:offline` | **mode nominal** — gymnase, usine, site sans réseau |

L'archive hors ligne embarque l'image, la composition, les scripts d'installation et de mise à
jour, le SBOM, et un fichier d'empreintes. `update-docker.sh` **sauvegarde la base avant toute
opération**, vérifie les empreintes, applique, contrôle la santé, et revient en arrière si la
santé n'est pas confirmée en 60 secondes.

> L'empreinte prouve l'intégrité, pas l'origine. La **signature** de l'archive reste à
> implémenter par projet — contrôles `INT-01` et `UPD-02` de la baseline. Le script porte
> l'emplacement exact où l'ajouter.

## Ce que le conteneur ne fait pas

Il n'est **ni `privileged`, ni en `pid: host`, ni en root**. L'accès au port série passe par
`devices:` et le groupe `dialout`. C'est la contre-mesure directe du constat qui, ailleurs dans
la gamme, transforme une faille applicative en compromission de la machine hôte.
