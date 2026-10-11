# Phase E — Motion et finitions

Version locale du 11 octobre 2026, à valider visuellement.

- Les panneaux et la recherche se ferment depuis leur position réelle, même lorsque l’ouverture est interrompue. Une réouverture rapide annule proprement la sortie. Les durées de survol, panneau et navigation utilisent les mêmes règles.
- Les fiches Bestiaire/Objets sur téléphone isolent le catalogue, le header et l’audio. Échap, fermeture, changement de langue, redimensionnement et navigation restaurent le focus et les états précédents. La recherche native reste utilisable au-dessus d’une fiche.
- Le menu et les filtres mobiles isolent aussi l’audio. Le tri conserve son nom accessible. Les contrôles désactivés n’ont plus d’effet de survol ou de pression.
- Les catégories Armes, Accessoires et Consommables sont maintenant traduites en anglais dans les filtres, les cartes et les fiches, avec retour correct au français.
- Les sous-titres des en-têtes Guilde/Profil s’alignent avec leurs titres. Le badge générique « Créature » est retiré des détails lorsqu’il répète la catégorie.
- La vignette d’atlas de l’accueil utilise le cadrage existant de 768 px : 141 166 octets au lieu de 624 658, soit 77 % de moins pour cette seule image. Le décor mobile sélectionne sa source avant le chargement du fallback desktop.

Composants concernés : shell et recherche globale, navigation mobile, PageAtmosphere, styles partagés, panneaux Bestiaire/Objets, filtres/tri, traductions, vignette d’accueil et défilement de réponse du chat en mouvement réduit. Le corbeau validé et les sprites Minecraft sont conservés.

## Captures

| Vue | Avant | Après |
|---|---|---|
| Profil public, 1920 × 1080 | [Avant](browser/before-profile-1920.png) | [Après](browser/after-profile-1920.png) |
| Fiche Objet, téléphone 390 px | [Avant](browser/before-items-sheet-390.png) | [Après](browser/after-items-deeplink-390.png) |

[Bestiaire desktop](browser/after-bestiary-1920.png), [fiche Bestiaire](browser/after-bestiary-detail-1920.png), [filtres mobiles](browser/after-bestiary-filters-390.png), [carte mobile](browser/after-map-390.png), [Codex](browser/after-wiki-1920.png), [recherche mobile](browser/after-search-390.png).

La différence principale des fiches mobiles est fonctionnelle : le fond reste visible mais ne reçoit plus le clavier, les clics ou le lecteur d’écran. Les captures statiques ne démontrent pas à elles seules la qualité des transitions.

## Contrôles

Tests ciblés : 89 contrôles Objets, 86 Bestiaire, 52 Catalogue et 144 Hybrid Catalogue passent. Les suites panneaux, fermeture interrompue/réouverture, recherche et router, navigation membre, transitions, PageAtmosphere, accueil, Codex, FR/EN et régressions Guilde/Profil passent aussi. Build local réussi.

Navigateur à 1920 × 1080 et 390 × 844 : recherche Ctrl+K et navigation clavier, Échap et retour au déclencheur, liens directs des fiches, filtres et menu mobile, recherche au-dessus d’une fiche, redimensionnement, carte et sélection/changement de palier, navigation Codex et FR/EN. Aucun débordement horizontal ni image visible manquante dans les vues finales contrôlées.

[Résultats navigateur](browser/verification.json), [mesures des ressources](browser/performance.json).

Le mouvement réduit est couvert par les tests et les règles CSS ; le réglage système n’a pas été simulé dans le navigateur. Les mesures de poids ne constituent pas un score Lighthouse. Les vues connectées Guilde/Profil restent couvertes par les contrôles isolés de la phase D.

Suite : validation visuelle du site local, puis préparation de la publication si elle est demandée. Aucun déploiement en production.
