# Phase 0 — état de référence et plan

Audit du 8 octobre 2026, départ Git `a396645` (`Patch 0.1`), espace de travail propre au démarrage. Le cahier Hybrid MMORPG remplace les choix visuels précédents ; les données fiables et les fonctionnalités existantes restent la base.

## Architecture conservée

Site statique HTML/CSS/JavaScript, 13 documents d'entrée, 12 routes propres et 18 fiches de boss générées. Le routeur remplace le contenu principal, conserve la navigation et les feuilles de styles chargées. Cinzel et Inter sont disponibles localement. Leaflet 1.9.4 assure la carte ; Supabase assure Microsoft Auth, les profils, rôles et outils de guilde. Les clés privilégiées et opérations serveur restent hors du navigateur. Aucun changement de framework, d'authentification ou d'hébergement n'est nécessaire pour les phases 1 et 2.

Le build copie seulement les ressources publiques dans `_site`. Le serveur de prévisualisation sert ce dossier, pas les archives `data/` ou les documents `docs/`. Les contrôles existants couvrent les routes directes et SPA, la sécurité isolée, les relations de données, les images d'items et les interactions clavier.

## Écarts identifiés

- Deux couches de thème dans `css/style.css`, des sélecteurs répétés et des priorités élevées rendent certains styles inopérants. Les styles de page persistants peuvent contaminer le retour vers l'accueil si leurs sélecteurs sont trop généraux.
- L'accueil actuel met en avant une scène de combat, un grand emblème et un carrousel automatique. La référence privilégie le paysage, une composition ouverte et plusieurs accès visibles simultanément.
- Les fonds sont très proches du noir pur, les contrôles souvent en majuscules et certains anciens boutons utilisent des pilules, halos ou balayages décoratifs.
- La navigation mobile reçoit dynamiquement la recherche et le changement de langue ; sa grille ne réserve pas explicitement toutes les zones. Sa hauteur et le décalage du corps ne concordent pas à toutes les tailles.
- Les 60 créatures comportent des PV dans le JavaScript publié. Ces valeurs se retrouvent dans les cartes, modales, JSON de carte et métadonnées de boss. Elles doivent disparaître des projections publiques, avec conservation de l'historique privé.
- Les anciennes principales représentent 40 repères et 67 étapes HTML ; 30 PNJ ne reposent que sur ces parcours. Leur retrait public doit précéder la dérivation du graphe, pour éviter des références ou positions résiduelles. Les secondaires restent une documentation historique non vérifiée.

## Référence artistique et assets

La planche jointe fournit une direction de composition, de surfaces et de navigation. Ses noms de lieux, statistiques, annonces, personnages et paliers fictifs ne sont pas importés. Les composants seront de vrais éléments HTML interactifs.

La palette retenue est bleu nuit `#0B141B`, bleu pétrole `#111E27`, panneaux `#15232D`, surfaces `#1B303B`, bordures `#35454A`, or ancien `#BBA47A` et ivoire `#DDD7CB`. L'or marque l'action et la sélection ; les données et descriptions gardent une typographie lisible. Les bordures, espacements, hauteurs, durées et priorités d'affichage seront centralisés avec des alias pour les composants existants.

Le paysage `assets/brand/nameless-hero.webp` et sa variante mobile existent déjà : architecture d'Aincrad à droite, espace pour le texte à gauche. Leur ambiance est nocturne, contrairement au paysage diurne de la planche. Cette différence est explicite : la première livraison réutilise cette illustration cohérente et légère, plutôt que la capture de maquette ou une image de remplissage. Le nouveau logo au corbeau, les portraits du bestiaire, cartes et 104 sprites items sont conservés.

## Mesures initiales

Captures : `baseline/home-1920.jpg` et `baseline/home-390.jpg`. Le DOM du bestiaire a confirmé l'affichage des anciennes valeurs numériques.

Lighthouse mobile local, accueil : performance **90**, accessibilité **100**, bonnes pratiques **100**, SEO **100**, LCP **3,6 s**, blocage **0 ms**, décalage de mise en page **0**, transfert **667 Kio**. Rapport brut : `baseline/lighthouse-home.json`. Ces résultats constituent une mesure de prévisualisation sous simulation, pas une mesure du site de production.

## Ensembles d'implémentation

1. Fiabilité : archives privées, projection de contenu public sans statistiques de combat, principales retirées, secondaires signalées comme historiques, URL importantes conservées.
2. Phase 1 : tokens, navigation partagée, contrôles, panneaux, recherche, focus et mouvement réduit ; consolidation de la cascade.
3. Phase 2 : paysage d'accueil, accès illustrés, sélection de fiches existantes, recherche directe, parcours de guilde réels. Aucune fausse activité récente.
4. Validation : build et tests, captures 360/390/768/1920/2560, parcours accueil → carte → bestiaire → accueil pour vérifier la persistance des styles, FR/EN, palette clavier, menu et liens directs, mesures avant/après.
5. Suite progressive : déclinaison détaillée de la carte, du codex et du quartier général à partir de ces fondations, avec rapport indiquant les phases effectivement stabilisées. L'administration et les interactions Supabase nécessitent une recette réelle en complément des tests locaux.

Aucun déploiement en production n'est autorisé par ce cahier. Les migrations préparées restent locales et additives ; les données historiques ne sont pas supprimées définitivement.
