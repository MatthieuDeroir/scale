# ADR 0002 — Vitest pour les tests, Docker pour la livraison

- **Statut** : accepté
- **Date** : 2026-09-07
- **Décideur** : Matthieu Deroir

## Contexte

Les deux produits de référence divergeaient sur deux axes structurants :

| | ServeurTemps (274 c.) | SL MEDIA (2 598 c.) |
|---|---|---|
| Tests | Jest + runners maison | **Vitest** + `@vitest/coverage-v8` |
| Livraison | tarball → Package Registry → webhook HMAC | **Docker** (`release-docker.sh`, mode `--offline`) |

## Décision

Le starter suit **SL MEDIA** : **Vitest** pour les tests unitaires et d'intégration,
**Playwright** pour l'e2e, **image Docker** publiée au GitLab Package Registry pour la
livraison, avec archive hors ligne pour les sites sans réseau sortant.

## Justification

Même raisonnement que l'ADR 0001 : SL MEDIA est le socle de référence, éprouvé sur dix fois
plus de commits, et aligner tests et livraison sur la même référence évite d'avoir à réapprendre
un outillage différent à chaque projet.

## Ce qui est conservé de ServeurTemps

Quand le produit parle au matériel (axe `server/` actif), les **runners maison** de
ServeurTemps n'ont pas d'équivalent générique et doivent être repris :

| Runner | Ce qu'il couvre |
|---|---|
| `tests/automated/test-frame-builders.mjs` | composition des trames binaires |
| `tests/automated/test-api-routes.mjs` | routes d'API, avec rapport |
| `scripts/test-hardware-*.mjs` | banc de test matériel réel |

De même, le modèle **tarball + webhook HMAC** reste une variante légitime pour les cibles où
Docker n'est pas souhaitable — le job `deploy:webhook` du pipeline en garde le mécanisme de
signature.

## Conséquences

- ⚠️ ServeurTemps reste sur Jest ; sa migration est un chantier distinct.
- ⚠️ Le pipeline de SL MEDIA était **désactivé** (`workflow: when: never`, faute de runner) et
  sa sécurité se limitait à `pnpm audit`. Le starter reprend sa structure mais **active** le
  pipeline et ajoute la vraie couche sécurité (voir `security/README.md`).
