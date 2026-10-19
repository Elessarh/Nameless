# Retouches visuelles et mouvements — 17 octobre 2026

La passe conserve les environnements approuvés, les aperçus natifs et les données du site.

- Accueil : relief et lumière des portails affinés, retour des flèches et des objets au survol, cadrage de la carte de lieu conservé pendant le focus et le survol.
- Bestiaire et objets : fonds des aperçus, bordures, filtres cochés, sélection et focus harmonisés ; rail de détails et panneau mobile gardent leurs animations propres.
- Navigation : état ouvert des commandes plus visible, retours au survol réservés aux pointeurs précis, focus et couleurs forcées conservés.
- Apparitions progressives sur l’accueil, le codex et les résultats des catalogues : 320 ms sur ordinateur, 240 ms sur petit écran, décalage total plafonné à 140/70 ms. La translation indépendante préserve le survol CSS.
- Le contenu reste visible sans JavaScript, sans API d’animation ou si une animation échoue. Focus, activation, changement de page, masquage de l’onglet et préférence de réduction du mouvement annulent les effets en cours. La carte interactive, les formulaires et les écrans privés ne reçoivent pas ces apparitions.
- Les couches floutées du décor restent fixes sur mobile ; les anciennes animations d’entrée de l’accueil sont remplacées par un seul cycle partagé.
- Les versions des ressources visuelles sont renouvelées sur les treize pages d’entrée et dans le registre de navigation.

## Validation

`npm test -- --skip-browser` : réussi, dont 70 vérifications du cycle d’animation (remplacement de 48 cartes, navigation, callbacks tardifs, focus, nettoyage, API absente et réduction du mouvement). La vérification de disposition navigateur est remplacée par le contrôle manuel CUA du navigateur intégré.

Après les dernières corrections CSS : tests `test-world-motion.mjs` et `test-hybrid-home.mjs` réussis ; compilation reconstruite pour les vérifications visuelles finales. Aucun envoi ou changement de données à distance.

Contrôle CUA à 1280 px et 390 px : aucun débordement horizontal, 48 cartes dans chaque catalogue, recherche Héraut (8 résultats et 8 aperçus chargés), effacement du filtre (retour à 48), sélection et fermeture par Échap avec retour du focus. Styles calculés confirmés : `catalogue-panel-enter` sur ordinateur, `catalogue-sheet-enter` sur mobile et `animation-name: none` sur les trois couches du décor mobile. Le menu d’ambiance met les trois couches en pause et permet leur reprise. Navigation accueil → bestiaire → objets → codex → accueil contrôlée.

Le navigateur intégré émet encore son avertissement natif d’annulation de View Transition sur certains chargements complets ; la navigation de secours fonctionne. Il ne s’agit pas d’une exception du module d’animation.

Captures : [bestiaire ordinateur](bestiary-desktop.png), [bestiaire mobile](bestiary-mobile.png), [objets ordinateur](items-desktop.png), [objets mobile](items-mobile.png), [accueil mobile](home-mobile.png).

## Suite : codex, atlas et quartier général

Retouches limitées à `wiki-codex.css`, `reference-map.css` et `guild-reference.css`, avec renouvellement des versions sur les pages directes, le registre SPA et l’atelier cartographique.

- Codex : sommaire et chapitre actif plus lisibles, angles des portails affinés, tables et encadrés harmonisés, liens de lecture mieux identifiables. L’accueil du codex conserve seulement les apparitions de ses éléments ; son conteneur ne reçoit plus une seconde animation.
- Atlas : matières et focus des commandes, filtres, légende et détails harmonisés. La région sélectionnée a une bordure et un fond distincts ; une priorité CSS ancienne qui masquait ce fond est corrigée. Aucune modification de géométrie ou de transformation Leaflet.
- Quartier général : relief des panneaux, séparation des titres, onglets et calendrier affinés. Les états sans événement sont présentés comme du contenu réel, sans cadre de chargement en pointillés. Transition courte des onglets, interrompue par la préférence de réduction du mouvement ; pas d’animation des mises à jour de membres.

Tests ciblés réussis : codex (65 contrôles), langues des 55 liens de guides, guilde (69 contrôles DOM), contexte et accès du QG, calendrier et expéditions avec base isolée, vue de carte, viewport Leaflet, cycle Leaflet, régions (33 régressions), mouvements partagés (70 contrôles). Compilation réussie : 13 routes, 14 pages de boss, 1 530 entrées de recherche.

CUA à 1280 et 390 px : recherche « donjon » → guide « Donjons et Boss Palier » → retour au sommaire ; pas de débordement. Navigation des onglets de guilde par flèches, Début et Fin ; l’onglet actif reste visible sur mobile. Carte : sélection Archipel d’Ika, fond/bordure/texte calculés conformes, palier 1 → 2 → 1, recentrage, fiche mobile, agrandissement et fermeture. Le palier mobile mesure 310 × 310 px dans un canevas de 356 × 395 px. Aucune écriture distante lors des parcours.

Captures : [codex ordinateur](codex-desktop.png), [codex mobile](codex-mobile.png), [guide mobile](codex-article-mobile.png), [guilde ordinateur](guild-desktop.png), [guilde mobile](guild-mobile.png), [atlas ordinateur](atlas-desktop.png), [atlas mobile](atlas-mobile.png).
