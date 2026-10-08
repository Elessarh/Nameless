# Carte Nameless et nouveau logo — 8 octobre 2026

La carte conserve Leaflet 1.9.4, les dessins Nameless et les routes `/carte` et `/pages/map.html`. Elle permet désormais d'explorer les lieux, leurs créatures et leurs drops, puis de rejoindre les fiches items. Les fiches du bestiaire, des boss, des items et la recherche globale renvoient vers le panneau de carte correspondant.

## Architecture et navigation

`js/map.js` gère le montage et le nettoyage de la vue via `NamelessMapPage.init/destroy`. Le zoom, le déplacement, le recentrage et les commandes clavier utilisent Leaflet. Le plein écran englobe les outils et le panneau, avec une solution CSS si l'API native est indisponible. Le panneau occupe au maximum 30 % de la largeur sur ordinateur ; sur mobile, il devient un panneau inférieur non modal, repliable, qui laisse la carte manipulable.

Les icônes sont des SVG définis dans le code. Les points proches se regroupent à faible zoom, avec choix des entités et ouverture de leur étendue réelle. Ces regroupements n'ajoutent aucune coordonnée aux données. Les filtres n'affichent que les catégories disponibles. Les lieux sont visibles au départ ; les quêtes sont facultatives.

La recherche couvre les trois paliers disponibles. Une sélection charge le palier concerné, ouvre son panneau et cible une position connue. Les URL utilisent `floor` et `entity`, avec prise en charge des anciens `x`, `y` et `q`, ainsi que des entrées `location`, `boss`, `creature`, `guide` et `quest`. Partager conserve aussi le centre relatif et le zoom, y compris dans les marges autorisées. Les favoris globaux gardent leurs identifiants précédents.

## Sources et relations

L'audit préalable est conservé dans `../map-exploration-2026-10-07/runtime-audit.md`. Les huit tables de l'ancien script ont été extraites sans changement dans `data/map-source.json` ; `source-extraction.json` documente leurs comptes et le hash du script d'origine.

`tools/build-map-graph.mjs` compile cette source, le bestiaire, le catalogue items et les quêtes HTML. Le build génère `assets/map/catalog.json` et un fichier JSON par palier. Il n'existe aucune deuxième liste manuelle de butins par zone : les objets sont calculés à partir des créatures et de leurs drops.

Le graphe contient 33 lieux, 99 repères de quêtes archivés, 125 guides, 89 références PNJ, 60 créatures et 104 items. Les 132 points des sources cartographiques sont conservés. Les positions de guides restent distinctes des coordonnées archivées, avec leur provenance. Les 22 conflits sont documentés dans `graph-audit.json`, dont Varn, Mephisto, Ramoon, Malrik et Virel ; aucune correction silencieuse n'a été appliquée.

57 créatures sont reliées à une zone cartographiée. Leur position propre reste inconnue : le panneau l'indique et sélectionne seulement le repère de zone. Néphantes, Essaim d'Insectes et Farfadet restent sans correspondance cartographique fiable. Six variantes lexicales de lieux et Valhat/Valhatt sont explicitement documentées ; les rapprochements géographiques non prouvés sont refusés. Les drops sont reliés au catalogue, y compris les deux variantes glaciaires dont le nom diffère mais dont l'image et l'identité item concordent. Les preuves figurent dans l'audit.

Aucun spawn, lieu, téléporteur ou relevé de coordonnées n'a été inventé. Les coordonnées des paliers 1 et 2 conservent la formule Leaflet `[5121 − Z, X]` et les limites existantes. Le palier 3 utilise la taille réelle de son image, 1274 × 1513, sans coordonnées du jeu ni repères fictifs.

## Administration et migration

L'éditeur propose le choix d'une entité existante, le placement par clic, le déplacement du brouillon, le type, l'enregistrement, le masquage, la suppression de la carte et le rétablissement du point d'origine. Le brouillon reste en mémoire jusqu'à une action explicite. Les coordonnées `u/v` sont relatives à l'image : gauche vers droite et haut vers bas, entre 0 et 1.

Le module n'est chargé qu'après vérification de la session et du rôle administrateur. Les mutations revérifient l'utilisateur, le rôle et la stabilité de la session ; les RLS et triggers assurent aussi ces contrôles côté serveur. Le registre vérifie les références et paliers. Le budget est de 60 mutations par minute et 300 par heure ; l'audit est transactionnel. Masquer et supprimer créent des états persistants qui suppriment également le repère statique. Seul Rétablir retire l'override.

Les migrations **005 et son seed sont préparés, mais n'ont pas été exécutés en production**. Suivre `../supabase/MAP_MARKERS_005_DEPLOYMENT.md` après les prérequis 004. Le navigateur de contrôle a constaté que le RPC public 005 est absent : la carte utilise donc ses données archivées et l'éditeur reste indisponible. Une panne réelle, différente d'une migration absente, ne réaffiche pas des points potentiellement masqués ; les positions attendent une lecture valide ou utilisent le dernier instantané public obtenu.

## Images et performance

Les originaux restent inchangés. `tools/optimize-map-previews.py` produit des WebP dérivés avec Pillow, sans dessin ni génération d'image. `preview-manifest.json` consigne les dimensions, paramètres et hashes des sources et résultats.

| Palier | Original | Aperçu ordinateur | Aperçu mobile | Détail dérivé |
|---|---:|---:|---:|---:|
| 1 | 8 383 564 o | 624 658 o | 141 166 o | 7 727 910 o |
| 2 | 2 527 368 o | 548 218 o | 148 116 o | 1 471 228 o |
| 3 | 963 572 o | 628 652 o | 189 240 o | 662 582 o |

Seuls l'image et le fichier de données du palier choisi sont chargés. Le petit index de recherche commun est séparé des détails par palier. Les données sont mises en cache en mémoire ; les cartes détaillées sont chargées quand la résolution de l'aperçu ne suffit plus. L'aperçu reste visible pendant ce chargement et en cas d'échec. Les réponses tardives ne remplacent pas le palier courant. L'image démarre en parallèle de la lecture des overrides, sans afficher de points avant leur vérification.

Lighthouse mobile sur le build local optimisé : performance **82**, accessibilité **100**, bonnes pratiques **96**, SEO **100**. LCP **4,8 s**, blocage **0 ms**, déplacement de mise en page **0,009**. Avant l'optimisation des aperçus : LCP **6,8 s**, déplacement **0,074**. Ces mesures utilisent la simulation de connexion lente de Lighthouse, pas une mesure de production. Le score de bonnes pratiques relève le RPC absent ; la migration doit être activée pour vérifier le service réel.

## Nouveau logo

La dernière image fournie, `Image ChatGPT 8 oct. 2026, 03_40_16.png`, est intégrée à la navigation des 13 documents d'entrée, à l'accueil, à la connexion, aux favicons, aux aperçus sociaux et aux images de remplacement. Le PNG RGBA 1254 × 1254 est conservé à l'identique dans `assets/brand/nameless-logo.png`, SHA-256 `8afaaa6a804362e36a7a5a20ebbb6bb3a81307c71e6f8515a4cf9b575202cb9b`.

Les variantes WebP transparentes 128/256/512/768 px pèsent environ 10/28/84/166 Ko. Les dimensions sont réservées et les versions de cache actualisées. Le dessin n'a été ni réinterprété ni régénéré. Les portraits des boss, les images du jeu et les 104 sprites items restent leurs propres illustrations.

## Vérifications et limites

`npm test` passe : syntaxe, audits FR/EN, intégrité des 104 sprites, graphe (**2678 vérifications**), liens (**45**), administration isolée (**20**), sécurité isolée (**26**), recherche/navigation et build (**42 documents, 2222 références locales**). `tools/test-map-leaflet.mjs` utilise le véritable Leaflet fourni pour tester zoom, sélection, déplacements, changements répétés de palier et destruction. Il couvre le défaut de nettoyage des écouteurs qui échappait au double Leaflet.

Le navigateur a vérifié les formats ordinateur et mobile, la recherche de boss et de PNJ, les filtres, le zoom, le déplacement avec panneau ouvert, le plein écran, les trois paliers, les visites directes et le cycle carte → boss → drop → item → carte. Les captures sont dans `screenshots/`. Le logo a été vérifié sur l'accueil, la connexion et la carte. Le zoom par pincement sur un appareil tactile physique reste à vérifier : l'outil utilisé valide le viewport mobile et les interactions souris/clavier, pas ce geste matériel.

Les RLS et écritures admin ont été testés dans PGlite avec des comptes fictifs, sans écriture sur Supabase réel. Il reste à appliquer la migration et le seed en recette, puis à vérifier les sessions, la concurrence et le geste tactile sur les environnements réels avant mise en service de l'éditeur. Le build local est prêt ; aucun déploiement distant n'a été effectué par cette tâche.
