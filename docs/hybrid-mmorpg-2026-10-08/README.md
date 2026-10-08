# Nameless — livraison Hybrid MMORPG

8 octobre 2026. Refonte développée et vérifiée dans le projet local à partir du commit `a396645`. Le site statique, son routeur, Leaflet, Supabase, les URLs et les données fiables sont conservés. Aucun déploiement ni changement de base distante n'a été effectué.

## Phase 0 — audit et référence

L'audit [PHASE-0.md](PHASE-0.md) décrit l'architecture, les anciens styles, les contenus obsolètes, les assets et les mesures initiales. Les captures de départ sont dans `baseline/`.

La planche fournie a guidé la composition, la hiérarchie et les surfaces. Ses noms de lieux, paliers, statistiques et événements fictifs n'ont pas été importés. Le paysage existant d'Aincrad reste nocturne, contrairement à la scène diurne de la référence. Cette différence est volontaire et documentée : aucune capture de maquette ni nouvelle illustration de remplissage ne remplace les composants du site.

## Phase 1 — fondations et navigation

`css/tokens.css` centralise couleurs, espacements, typographies, rayons, bordures, contrastes, hauteurs, priorités d'affichage et durées. Les alias historiques permettent aux modules existants d'utiliser la même palette. Les couches répétées de `css/style.css` et les anciens styles de page ont été consolidés.

Le thème utilise bleu nuit, bleu pétrole, ardoise et ivoire, avec l'or ancien pour les sélections et actions. Cinzel et Inter restent locaux. Les surfaces sont opaques, les contours fins et les rayons de 2 à 4 px. Les halos, pilules et animations décoratives permanentes ont été retirés. Les transitions de contrôle restent courtes et respectent la réduction du mouvement.

Les 13 documents d'entrée partagent le même header : logo au corbeau, wordmark, Explorer, Carte, Bestiaire, Objets et Guilde. La recherche affiche son raccourci sur ordinateur et une icône sur mobile. La navigation reste visible pendant le défilement ; les versions invité et membre tiennent à 360/390 px. La déconnexion mobile utilise un SVG avec libellé accessible, sans modifier son traitement d'authentification.

La palette conserve Ctrl+K, navigation clavier, Échap, retour du focus, favoris, catégories, compteurs réels et liens carte. Les miniatures proviennent uniquement des sources connues. Les résultats historiques sont identifiés.

## Phase 2 — accueil

L'accueil présente le paysage d'Aincrad à droite, le titre et les actions à gauche. Le grand logo et le carrousel automatique ont été remplacés par une signature discrète et quatre accès illustrés visibles : carte, bestiaire, objets et guilde.

La sélection « À explorer » utilise les fiches existantes d'Illfang, Gorbel, Gelée de Slime et Potion de Mana. Elle ne prétend pas représenter une activité récente. La section guilde explique les fonctions disponibles et conserve les liens Discord et membre.

Les illustrations existantes ont reçu des variantes adaptées dans `assets/home/`. Les six sources restent intactes ; les fichiers effectivement servis passent de 527 Kio à environ 124 Kio au maximum. Le manifeste SHA-256 et le script reproductible sont `home-art-manifest.json` et `tools/optimize-home-art.py`. Le hero et les PNG d'items ne sont pas régénérés.

## Phase 3 — carte

La carte conserve les images du jeu et leur calibration. Une barre propose uniquement les paliers 01, 02 et 03, avec flèches et commandes clavier ; le sélecteur demeure sur mobile. Les filtres prennent place dans un rail gauche de 174 px sur ordinateur et dans un tiroir non modal sur mobile. Le panneau droit occupe 29 % au maximum, plafonné à 380 px. La bottom sheet, le pan, le zoom, le recentrage, le partage et le plein écran restent opérationnels.

Les relations disposent de miniatures locales quand elles existent et de liens compacts. Les lieux sans illustration n'en reçoivent pas une inventée. Le parcours carte → lieu → créature → drop → item et son retour sont conservés. Aucun spawn ni relevé de coordonnées n'est ajouté. Les créatures sans position propre ciblent uniquement une zone connue, avec cette limite affichée.

Les images et données restent chargées par palier et mises en cache. Le détail remplace l'aperçu après chargement. Les réponses tardives et erreurs ne remplacent pas le palier courant. Les points masqués ne réapparaissent pas sous forme de marqueurs statiques. La palette native ne laisse pas Échap fermer un panneau de carte situé dessous. Les hooks de retrait de Leaflet sont conservés et testés avec la véritable bibliothèque.

## Phase 4 — codex, objets et fiches

Le bestiaire et l'inventaire utilisent des filtres latéraux de 232 px, repliables sur mobile. Recherche et réinitialisation restent accessibles quand les filtres sont fermés. Les paliers, catégories, types et zones proposés proviennent des données ; le bestiaire ne propose pas de paliers fictifs.

Les tris sont réels : noms dans les deux sens, catégories, raretés pour les objets. Recherche et tri fonctionnent en FR/EN selon les noms affichés, avec maintien des valeurs et IDs d'origine. Le changement de langue ne ferme pas la fiche ni ne modifie son URL.

Les fiches réutilisent les modales accessibles existantes, avec portrait, informations fiables, descriptions, drops et sources. Focus, clavier, liens directs, pagination et nettoyage SPA sont conservés. Les 18 fiches de boss générées utilisent ces mêmes composants. Les 104 PNG restent identiques et les petits sprites sont présentés à 1× ou 2×.

## Fiabilité des contenus

Les 60 valeurs HP ont été retirées du JavaScript public, du graphe, des fiches et des métadonnées. Les 40 repères et 67 guides principaux obsolètes sont exclus avant dérivation des PNJ et relations ; 30 PNJ exclusivement liés à ces parcours sortent de la projection publique.

Les 59 repères et 58 guides secondaires restent une documentation **historique non vérifiée**, signalée dans les pages, résultats et panneaux. `/quetes` et sa page historique restent accessibles, avec notice et `noindex`, hors sitemap. Un ancien lien principal affiche une notice d'archivage. Le filtre de catégorie devenu redondant a été retiré.

Sept archives complètes sont conservées hors de l'artefact public, avec hashes vérifiés avant chaque build. Le graphe public contient 373 entités, 269 identités de registre et 92 repères ; l'index global contient 326 entrées. Les relations sont calculées depuis les mêmes sources et non recopiées manuellement. Détails : `../hybrid-2026-10-08/CONTENT_POLICY.md`.

## Phase 5 — quartier général et comptes

Le quartier général place planning, objectifs et présences avant les annonces et ressources. Il réutilise le mur d'activité, le chat et les conversations privées existants. Aucun événement, participant, checklist ou groupe fictif n'a été ajouté au site.

Le profil distingue identité du compte et personnage, en conservant classe, niveau déclaré et liaison Minecraft. L'administration propose des tableaux défilants, commandes de tri au clavier et états `aria-sort`. Un défaut d'onglets qui laissait plusieurs panneaux actifs a été corrigé. Les compteurs attendent les résultats réels plutôt que d'afficher des valeurs inventées.

Les feuilles de guilde, chat, DM et activité sont limitées à leurs routes pour ne pas contaminer les catalogues après navigation. Les API, sessions, rôles, écritures et helpers de dates de Paris sont conservés.

## Phase 6 — harmonisation et qualité

Wiki, archives et connexion utilisent les mêmes surfaces et contrôles. La connexion conserve Microsoft et les IDs utilisés par le module d'authentification, avec des explications concrètes. Le lecteur audio reste disponible en pied de page au lieu de recouvrir les liens. Focus, hiérarchie des titres, contrastes, cibles et mouvement réduit ont été contrôlés.

Les captures de l'accueil couvrent 360, 390, 768, 1920×1080 et 2560×1440 ; aucune largeur de document ne dépasse son viewport. Les contrôles principaux mesurent au moins 44 px. Les mesures sont dans `phase-1-2/layout-checks.json`. Les captures finales de carte, codex, objets et comptes sont dans `final/screenshots/`.

### Performance mesurée localement

| Surface | Performance | Accessibilité | Bonnes pratiques | SEO | LCP | Blocage | Décalage |
|---|---:|---:|---:|---:|---:|---:|---:|
| Accueil initial | 90 | 100 | 100 | 100 | 3,6 s | 0 ms | 0 |
| Accueil refondu | 91 | 100 | 100 | 100 | 3,6 s | 0 ms | 0 |
| Carte finale | 85 | 100 | 96 | 100 | 4,4 s | 0 ms | 0,002 |

L'accueil passe de 667 Kio à 454 Kio transférés, avec davantage d'accès simultanément visibles. Ces mesures Lighthouse simulent une connexion mobile lente sur le build local ; elles ne garantissent pas les mêmes résultats en production. Le LCP demeure perfectible. La carte signale le RPC Supabase 005 actuellement absent, ce qui affecte les bonnes pratiques.

### Tests exécutés

`npm test` passe : syntaxe, audits de contenu et traductions, CRC des 104 sprites, build de 42 documents et 2134 références locales, interactions de catalogues, recherche et routeur, dates de Paris, nettoyage de sessions, sécurité isolée et administration. Vérifications marquantes : 2056 invariants de graphe, 635 contrôles de publication, 22 contrôles SQL + Leaflet sur la publication, 62 contrôles de catalogue Hybrid, 20 contrôles admin de carte et 26 contrôles de sécurité.

Le navigateur a testé recherche et clavier, FR/EN, menu mobile, tris, filtres, modales, sources d'items, panneaux de carte et le retour accueil → carte → bestiaire → accueil. Des relectures indépendantes n'ont relevé aucun blocage restant.

Les écrans membres ont été contrôlés avec le serveur **QA isolé** `tools/serve-ui-fixtures.mjs`, données explicitement fictives en mémoire et réseau externe bloqué. Ces fixtures sont hors `_site` et ne créent aucune donnée réelle. Elles valident les dispositions, champs et onglets ; elles ne remplacent pas une recette authentifiée sur Supabase. Les captures correspondantes portent `qa` dans leur nom et affichent leur bandeau de contexte.

## Mise en service restante

L'éditeur de marqueurs attend les migrations 005 puis 006 et leurs seeds. La 006 est additive et ne supprime aucune histoire. Elle publie une allowlist et retourne des tombstones minimaux pour les identités non publiées, même sans override, afin d'empêcher la réapparition de coordonnées statiques avant le seed. Aucun titre obsolète, auteur ou placement privé n'est retourné. Voir `../supabase/MAP_PUBLICATION_006_DEPLOYMENT.md`.

Avant une mise en service autorisée : recette des migrations, sessions réelles joueur/membre/admin, concurrence des écritures, parcours Microsoft/Minecraft et gestes tactiles sur appareil. Le pincement n'a pas été testé sur matériel physique. Les nouvelles expéditions avec participants et checklists restent à développer seulement si un besoin réel et des données adaptées sont confirmés ; aucun contrôle fictif n'anticipe ces fonctions.

Le build local est prêt à être examiné. La production n'a pas été déployée et les migrations n'ont pas été appliquées à distance.
