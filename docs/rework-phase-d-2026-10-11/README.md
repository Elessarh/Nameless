# Phase D — Guilde et Profil

Version locale du 11 octobre 2026, prête pour validation visuelle.

- **Guilde** : expéditions et annonces indépendantes du calendrier, panneaux adaptés au contenu, états vides avec icônes et actions selon le rôle. Les accès à l’administration annoncent leur destination. Une panne du planning reste une erreur, avec réessai, même après changement de mois, langue ou filtre.
- **Profil** : avatar et identité du personnage prioritaires, résumé des classe/niveau enregistrés, édition et accès distincts. Compte Microsoft/Minecraft et UUID repliables ; liaison Minecraft accessible depuis l’identité. Les informations absentes sont indiquées comme telles. Les pseudos disposent de toute la largeur sur téléphone.
- Décor pleine page et corbeau validé conservés ; aucun logo supplémentaire dans les panneaux ni nouvel art.

Composants modifiés : structures HTML, styles Guilde/Profil, rendus des états vides et du calendrier, présentation du personnage, traductions et versions de ressources. Le serveur de test local couvre désormais les rôles, données absentes et panne du planning avec le même décor que le site.

## Avant / après

| Vue | Avant | Après |
|---|---|---|
| Guilde, panneaux vides, 1920 px | [Avant](browser/before-guild-empty-1920.png) | [Après](browser/after-guild-empty-1920.png) |
| Profil associé, 1920 px | [Avant](browser/before-profile-linked-1920.png) | [Après](browser/after-profile-linked-1920.png) |
| Guilde, téléphone | [Avant](browser/before-guild-empty-390.png) | [Après](browser/after-guild-empty-390.png) |
| Profil, téléphone | [Avant](browser/before-profile-linked-390.png) | [Après](browser/after-profile-linked-390.png) |
| Profil public | [Avant](browser/before-profile-public-1920.png) | [Après](browser/after-profile-public-1920.png) |

Les captures membres utilisent des **données fictives isolées et un avatar de test**, signalés dans le bandeau. L’avatar Minecraft de production reste inchangé. [Profil sans informations enregistrées](browser/after-profile-missing-390.png), [calendrier sélectionné sur tablette](browser/after-guild-day-768.png).

## Vérification et suite

47 contrôles Profil et 69 Guilde passent, ainsi que les tests existants membres/expéditions, FR/EN et PageAtmosphere. Build réussi. Navigateur : sauvegarde locale de test, niveau décimal refusé, brouillons conservés en FR/EN, compte repliable, liaison accessible, droits membre/admin, dialogue et Échap, panne persistante et calendrier sur tablette. Aucun débordement ni image visible manquante dans les vues contrôlées. [Mesures et résultats](browser/verification.json).

Suite : phase E, animations et finitions, mobile/accessibilité et performance. Aucun déploiement en production ni changement des données officielles.
