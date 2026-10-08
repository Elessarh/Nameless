# Fiabilité du contenu public

Le retrait des valeurs de combat et des anciennes quêtes principales est appliqué aux données publiées, avant l’indexation et les relations cartographiques. Il ne repose pas sur du CSS.

Les sept sources originales sont conservées sous `data/archive/hybrid-2026-10-08`, avec longueur et SHA-256 dans un manifeste. Le build vérifie leurs empreintes et n’inclut ni `data`, ni `docs` dans `_site`. Le JSON brut `data/map-source.json` reste identique à son archive.

Les 60 créatures conservent leur ID, leur nom, leur illustration, leur catégorie, leur palier, leur zone, leur description et leurs drops. Les 60 anciennes valeurs HP restent privées. Elles ne figurent plus dans le littéral JavaScript public, ses cartes, ses fiches, les données cartographiques ou les métadonnées des 18 pages de boss. La projection centralisée autorise uniquement les champs de créature explicitement retenus et refuse tout champ de combat dans le graphe ou l’index générés.

Les 40 points principaux bruts et les 67 anciens guides principaux sont exclus avant la dérivation des PNJ. Les 30 PNJ exclusivement issus de ces parcours n’entrent plus dans le graphe. Les quatre conflits de coordonnées Mephisto/Ramoon/Malrik/Virel restent donc privés ; le conflit secondaire Varn reste documenté avec ses deux sources.

Les 59 points secondaires bruts et 58 guides HTML secondaires restent conservés avec leurs IDs et coordonnées. Ils portent `historical-unverified`. La page `/quetes` et son alias `/pages/quetes.html` présentent une notice d’archive, sont `noindex`, et sont absents du sitemap. Les anciens liens `?quest=p1-principale-…` et `?quest=p2-principale-…` ciblent une explication accessible, sans ancien parcours publié. Le contenu secondaire ne prétend pas être à jour.

Le graphe public contient désormais 373 entités, 269 clés de registre et 92 repères par défaut. La recherche compte 326 entrées et conserve les IDs de favoris encore pertinents. Les vignettes de créatures et d’items utilisent exclusivement leurs assets locaux existants.

La migration additive 006 prépare un filtre de publication pour le registre et la RPC Supabase 005. Les placements historiques et leur contenu restent privés. La RPC transmet seulement une clé de masquage minimale pour chaque identité non publiée, avec ID et coordonnées nuls. Ce tombstone empêche le retour des coordonnées d’un ancien catalogue statique, même avant l’application du seed ou pour une identité sans override. L’accès privé administrateur et les tombstones des entités publiées sont préservés. Un seed généré publie uniquement l’allowlist du catalogue actuel. Aucune migration distante n’a été appliquée.

Tests ciblés exécutés : graphe (2056 invariants), catalogues DOM (52 contrôles), pages de boss (204 contrôles), liens carte (45 contrôles), recherche et routeur, i18n DOM et audits, artifact de publication (42 documents, 2117 références locales), politique publique (635 contrôles incluant une vraie exécution SQL 006 dans PGlite). Une suppression initiale de `_site` a reçu `ENOTEMPTY` sous Windows ; le build retente désormais trois fois la suppression du seul chemin validé. Le contrôle de l’artifact est ensuite passé.

Régression de publication 006 corrigée : une RPC vide après la migration seule aurait réactivé les coordonnées du catalogue statique. Le nouveau test `test-map-publication.mjs` exécute la migration dans PGlite et fournit sa vraie projection au runtime Leaflet livré. Ses 22 contrôles vérifient le masquage avant le seed, les identités sans override, la sélection sans recentrage, les placements visibles publiés et un retrait ultérieur de publication. Ce test ne construit ni ne lit `_site` et n’appelle aucun service distant.
