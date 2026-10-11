# Rework 2.0 — phases A et B

[Comparaison avant / après](comparaison.html) : desktop 1920 × 1080 et mobile 390 px. Les captures originales sont dans `browser/`.

## Phase A

- `js/world-atmosphere.js` monte une couche PageAtmosphere directement sous le body, indépendante des largeurs de contenu. Image adaptée au mobile, lumière, texture légère et voile de contraste restent sous les contrôles, sans interception. La même couche est réutilisée en SPA ; l’accueil garde son panorama existant sans doublon.
- `world-experience.css`, `page-hero.css` et les tokens séparent fond de page et surfaces de lecture. Les anciens bandeaux décoratifs des catalogues et de la guilde sont retirés au profit du décor global.
- Le logo corbeau est conservé conformément à la confirmation utilisateur. Les modèles, sprites, atlas, données et 48 éléments par défaut restent préservés.

## Phase B

- Codex : accueil large, bibliothèque pleine page, quatre accès réels, huit guides secondaires, sidebar organisée et recherche principale. Le classement privilégie les titres, en français et anglais. Les articles restent limités à 1240 px avec leurs ancres et sommaires lorsque pertinents.
- Carte : styles dupliqués retirés, cadre allégé, commandes et filtres repliables regroupés, fiche adaptée à son contenu, zoom et fiche mobiles. Terrain, calibrage, contours publiés et permissions de l’éditeur conservés.
- Un seul nouveau décor nécessaire : [archives-source.png](../../assets/art-v6/archives-source.png), généré avec image_gen intégré puis inspecté deux fois. [Prompt](prompts.json), [empreintes et variantes](../../assets/art-v6/asset-manifest.json). Reproduction : `py tools/optimize-reviewed-art.py --series art-v6`.

## Vérification et suite

Build, 65 contrôles Codex, 144 contrôles catalogues, 33 contrôles régions, cycle Leaflet, transitions/routes, menu partagé, traductions et intégrité des illustrations passent. Tests ciblés uniquement ; aucun travail de backend ou de sécurité générale.

Le navigateur confirme les fonds hors conteneur sous le header, leur absence d’interception, l’absence de débordement et d’erreur JavaScript, recherche anglaise « class » → Class system, fermeture du menu avec Échap et retour du focus, sélection de région avec terrain réel et commandes visibles, relations contextuelles et filtres repliables. Les états privés de guilde/profil n’ont pas été testés avec un compte connecté.

Les phases C, D et E restent à réaliser après validation visuelle des phases A et B. Les grilles détaillées, états vides de guilde, fiche de personnage et polish du mouvement ne sont pas annoncés terminés. Pas de déploiement en production.
