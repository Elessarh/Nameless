# Phase C — Bestiaire et Objets

Version locale du 11 octobre 2026, à valider visuellement avant la phase D.

## Changements visibles

- Un seul décor existant pour toute la page ; retrait des anciennes scènes de héros et des textures répétées des cartes.
- Six colonnes à 1920 px, cinq à 1280 px, trois sur tablette, deux à 390 px et une à 320 px. La sélection réserve la place de la fiche sur ordinateur ; la vue liste garde une seule colonne.
- Sprites d’objets agrandis à des facteurs entiers, généralement 2× dans les cartes et jusqu’à 3× dans la fiche. Les 104 PNG natifs restent inchangés.
- Rareté sous le sprite, noms plus lisibles, catégories et zones utiles visibles dans le Bestiaire.
- Fiches contextuelles, portraits des sources y compris les boss, liens vers les zones réelles du même palier et objets des mêmes sources.
- 48 éléments dès l’ouverture ; filtres, tri, pagination et données existantes conservés.

Composants modifiés : styles partagés des catalogues, cartes et fiches Bestiaire/Objets, sources et tooltips, versions des ressources dans les deux pages et le registre de navigation.

## Captures avant/après

| Page | Avant, 1920 × 1080 | Après, 1920 × 1080 | Avant, 390 px | Après, 390 px |
|---|---|---|---|---|
| Bestiaire | [Avant](browser/before-bestiary-1920.png) | [Après](browser/after-bestiary-1920.png) | [Avant](browser/before-bestiary-390.png) | [Après](browser/after-bestiary-390.png) |
| Objets | [Avant](browser/before-items-1920.png) | [Après](browser/after-items-1920.png) | [Avant](browser/before-items-390.png) | [Après](browser/after-items-390.png) |

Fiches : [Loup Blanc, ordinateur](browser/after-bestiary-detail-1920.png), [Gorbel, téléphone](browser/after-bestiary-detail-390.png), [Gelée de Slime et ses sources](browser/after-items-detail-1920.png), [objet, téléphone](browser/after-items-detail-390.png). [Vue liste avec fiche à 1280 px](browser/after-items-list-1280.png).

Les captures montrent des cartes plus larges et moins chargées que les versions précédentes, avec le décor continu derrière les surfaces. Les zones et sources affichées proviennent du catalogue réel ; les compositions des maquettes ne servent pas à inventer du contenu.

## Vérification

Navigateur : grilles aux largeurs 1920, 1280, 768, 390 et 320 px ; fiches latérales et mobiles ; filtres cumulés Accessoires + Armes ; infobulle au clavier ; fermeture avec Échap et restauration du focus ; FR/EN ; liens réels Loup Blanc → Vallée des Loups et Gelée de Slime → Marécage putride ; vue liste avec sélection. Aucun débordement horizontal ni image visible manquante dans les vues contrôlées. Mesures dans [verification.json](browser/verification.json).

Tests ciblés réussis : 144 contrôles hybrides, 61 Bestiaire, 71 Objets, 52 DOM et 72 layout natif. FR/EN, 204 contrôles des boss, politique des illustrations et intégrité des 104 sprites passent également. Build local réussi. Fermeture pendant un changement de langue et portrait des boss couverts par tests dédiés.

## Suite

Phase D : hiérarchie de la guilde, états vides et fiche personnage, avec le corbeau validé. Phase E : transitions, états interactifs et dernier contrôle mobile/accessibilité/performance. Les descriptions et sources non renseignées restent explicitement absentes. La validation visuelle de cette phase est attendue ; aucun déploiement en production.
