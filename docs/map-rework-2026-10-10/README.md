# Refonte de la carte et de son atelier — 10 octobre 2026

La carte publique et `/admin-carte` utilisent les trois atlas Minecraft originaux, avec leurs dimensions et leurs calibrations. Aucune illustration n’a été générée. Les douze contours du premier palier restent indicatifs.

La carte publique présente un atlas plein cadre, des filtres escamotables et une fiche contextuelle. L’atelier distingue les outils de modification, le brouillon privé et la publication. Les commandes avancées sont repliées. Les points des zones et des repères se règlent aussi au clavier.

Le cadrage attend un conteneur visible et conserve la caméra lors des changements de taille. La reprise des brouillons, les restaurations, les révisions concurrentes, les erreurs de relecture et les changements de compte sont vérifiés séparément.

Les captures `before-admin-*` et `after-admin-*` utilisent les mêmes résolutions. Les captures publiques finales couvrent 360, 390, 768, 1280, 1920 et 2560 px. Les captures et vidéos de l’atelier portent un bandeau QA : elles utilisent une session et une base isolées, sans écriture dans Supabase réel.

Rapports de validation : `after-checks-verification.json`, `public-design-checks.json`. Les vidéos finales sont `public-map-motion.webm` et `admin-map-editor-motion.webm`. Les dossiers `video-*-work` proviennent d’enregistrements interrompus antérieurs ; ils ne font pas partie des livrables validés.

La suite complète `npm test` passe. Le rapport principal contient 49 contrôles navigateur réussis, sans erreur JavaScript. Après le dernier ajustement des boutons mobiles, les 3 contrôles publics mobiles et les 4 contrôles complémentaires de l’atelier passent aussi (`after-mobile-verification.json`, `after-supplementary-verification.json`). Les captures finales ont été reprises après les animations, puis inspectées sur ordinateur et mobile.

Les deux vidéos sont en VP8, 1920 × 1080, à 25 images par seconde : 11,12 secondes pour la carte publique et 8,92 secondes pour l’atelier. Une image a été décodée et inspectée à 8 secondes et 6 secondes respectivement. Le fichier `media-verification.json` précise ces vérifications.
