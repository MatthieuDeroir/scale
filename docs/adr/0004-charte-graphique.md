# ADR 0004 — La charte graphique n'est pas à réinventer

**Statut** : accepté · **Date** : 2026-09-08

## Contexte

Trois produits partagent déjà la même identité visuelle : **ServeurTemps**, **SL MEDIA** et
**SL FTP**. Ce n'est pas une coïncidence — le commentaire en tête de `globals.css` de SL FTP le
dit explicitement : *« charte graphique alignée sur ServeurTemps »*.

Un quatrième jeu de couleurs inventé pour le starter aurait produit exactement ce que le
bureau d'études n'a pas les moyens de maintenir : quatre produits qui se ressemblent presque.

## Décision

Le starter reprend **telles quelles** les valeurs de SL FTP — la plus récente des trois, et la
seule déjà écrite en Tailwind 4.

| Élément | Valeur | Pourquoi |
|---|---|---|
| Base | slate/navy shadcn, `style: new-york` | commune aux trois produits |
| **Accent de marque** | `--brand: 353 94% 45%` — le rouge du logo | identité, réservé à l'action principale |
| Sidebar | **sombre dans les deux thèmes** | c'est elle qui porte l'identité produit |
| Rayon | `--radius: 0.5rem` | idem |
| Police | pile système (`ui-sans-serif, system-ui, …`) | aucune police à télécharger : un équipement hors ligne ne va pas chercher Google Fonts |
| Icônes | `lucide-react` | idem que les trois |

### Ce que le starter ajoute, et pourquoi

**Un état lisible d'un coup d'œil.** `Badge` porte trois variantes sémantiques — `ok`,
`warning`, `critical` — distinctes de l'accent de marque. Sur un équipement en exploitation,
« est-ce que ça reçoit ? » doit se lire à la couleur avant de se lire au texte.

**Un bouton `brand`.** Le rouge STRAMATEL est un accent, pas une couleur d'interface : **une
action principale par vue, pas davantage.** Le reste utilise `default`, `secondary` ou `ghost`.

**Un thème sans clignotement.** Le script `themeInitScript` s'exécute avant le premier rendu.
Sans lui, une interface en thème sombre s'affiche blanche pendant une frame — visible partout,
et inacceptable sur un panneau.

**Une surface d'affichage distincte.** `body[data-surface='display']` supprime curseur,
sélection et ascenseur : le kiosque n'est pas un poste de travail.

## Conséquences

- `components.json` est configuré : `npx shadcn@latest add <composant>` dépose directement dans
  `src/shared/ui/` et hérite des jetons. Le starter n'embarque que les primitives réellement
  utilisées — inutile de copier toute la bibliothèque d'avance.
- Un projet qui a besoin d'une couleur produit l'ajoute **en jeton**, dans `globals.css`, pour
  les deux thèmes. Jamais une valeur littérale dans un composant : elle casserait un thème sur
  deux.

## Ce que cette décision ne fait pas

Elle ne dit rien de l'écran d'affichage lui-même — panneau LED, résolutions, lisibilité à
distance. C'est un sujet produit, traité par affaire, pas une charte d'interface.
