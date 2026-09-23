# Sécurité et conformité CRA — ce dépôt

Doctrine complète : `.claude/context/securite.md` du dossier de travail.
Ce fichier décrit ce qui est **déjà câblé ici**, et ce qui reste à faire par projet.

## Déjà câblé

| Élément | Où |
|---|---|
| Secrets — `gitleaks` sur tout l'historique, **bloquant** | job `gitleaks` |
| SAST — `Semgrep` (auto + typescript + nodejs) | job `semgrep` |
| Dépendances — `Trivy` CVE, config, licences ; **bloquant en CRITICAL** | job `trivy` |
| **SBOM CycloneDX JSON**, conservé sans expiration | job `sbom` |
| Hook anti-secrets avant commit | `.pre-commit-config.yaml` |
| Secrets exclus du dépôt | `.gitignore` |
| Vérification de durcissement machine | `security/hardening-check.sh` |

Le stage `package` **dépend** de `gitleaks`, `trivy` et `sbom` : on ne publie pas une image
dont la sécurité n'a pas été vérifiée.

## À compléter à chaque nouveau projet

### 1. Classification CRA

Renseigner ci-dessous, **avant mise sur le marché**, et faire valider par **Gatien** si le
produit est connecté à un usage sensible (signalisation, systèmes tiers) :

```
Classification CRA pressentie : [ ] par défaut  [ ] important classe I  [ ] important classe II  [ ] critique
Justification :
Validée par :                        le :
```

### 2. Canal de signalement

Faire figurer l'adresse **security@** (une fois validée par la DSI) dans :

- le `README.md` de ce dépôt ;
- **toute documentation client livrée**.

Le point de contact pour la remontée de comportement suspect doit être **distinct du support
commercial**.

### 3. Security by design

- [ ] Aucun credential en dur — variables d'environnement ou vault, dès l'init.
- [ ] Lockfile commité, **pas de versions flottantes** en production.
- [ ] Contrôle d'accès **côté serveur** (RBAC), jamais uniquement côté client.
- [ ] JWT signés (`jose`), bcrypt pour les mots de passe.
- [ ] `rate-limiter-flexible` sur l'authentification et les routes d'écriture.
- [ ] Validation Zod à toutes les frontières réseau.
- [ ] Revue IDOR sur les routes portant un identifiant.

### 4. Ce que ce chantier n'est pas

Il ne s'applique **pas rétroactivement** aux anciens produits. Sur le parc existant, seule la
**capacité à réagir à un signal** (client, chercheur externe, monitoring) est requise — pas un
scan ni une remise à niveau du legacy.

> Ne pas laisser un agent élargir ce chantier au legacy : c'est un arbitrage explicite.

## Pourquoi le SBOM n'expire jamais

L'objectif est de répondre en quelques minutes à « sommes-nous concernés par cette CVE, sur
quels produits, quelle version ? ». C'est la condition pour tenir le **délai de notification
de 24 h** de l'article 14 du CRA. Un SBOM purgé au bout de 30 jours ne sert à rien.
