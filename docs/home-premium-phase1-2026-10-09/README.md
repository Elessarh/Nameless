# Nameless — accueil, phase 1

Panorama voxel sur toute la largeur, lumière et brume indépendantes, parallaxe, bannières, quatre cartes illustrées, découvertes authentiques et panneau de guilde. Les ressources, liens et données du catalogue sont conservés.

Validation : `npm run build`, `npm test`, puis `node tools/verify-home-phase1.mjs` avec le serveur lancé par `npm start`. Le script utilise Playwright et Chromium déjà installés ; il n’installe rien. Les résultats sont dans `browser-verification.json`.

Captures : `home-desktop.png` (1920 × 1080), `home-mobile.png` (390 × 844), et leurs variantes `-full.png`. Démonstration réelle : `home-motion-demo.webm`.

Pour reproduire les mouvements : recharger l’accueil, déplacer le pointeur sur le panorama, survoler les cartes, ouvrir la recherche avec Ctrl+K, saisir un nom puis fermer avec Échap, et utiliser « Pause du décor ». Les préférences de mouvements réduits désactivent les animations continues.

Les prochaines sessions restent dédiées aux composants partagés (phase 2), fiches latérales et tooltips (phase 3), transitions de carte (phase 4), calendrier et expéditions persistantes (phase 5).
