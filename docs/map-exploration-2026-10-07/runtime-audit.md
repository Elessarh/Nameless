# Audit du runtime de la carte — 7 octobre 2026

Audit en lecture seule du code applicatif. Aucun comportement ni donnée n'a été modifié. Les rapprochements entre catalogues sont traités séparément.

## Contrats à conserver

- `window.NamelessMapPage = { init, destroy }` est le seul contrat volontaire du runtime avec le registre SPA (`js/page-registry.js:71`). Le registre charge Leaflet avant `map.js`, détruit la route précédente, puis initialise la nouvelle. Les pages autonomes démarrent via `mapAutoStart` à la fin du fichier ; ce démarrage est inhibé quand le routeur contrôle le cycle de vie (`js/map.js:2382`, `2863`).
- `/carte`, `/carte/` et l'ancien `/pages/map.html` sont reconnus par le registre ; le build crée aussi `/carte/index.html`. Conserver les liens `floor`, `x`, `y`, `q`. Le paramètre historique `y` représente **Z dans le jeu**, pas la hauteur Y. `js/quetes.js:136` et les liens du catalogue le produisent, comme l'index de recherche global.
- `x` et `y` doivent être présents ensemble, être des nombres décimaux finis avec signe négatif éventuel, et rester entre -1 000 000 et 1 000 000. Les coordonnées invalides et les paliers indisponibles donnent un statut accessible (`js/map.js:657`). Les paramètres restent dans l'URL après ciblage. `q` est limité à 200 caractères ; la recherche locale commence à deux caractères.
- Les coordonnées de jeu sont converties avec `[lat, lng] = [5121 - Z, X]` pour les paliers 1 et 2. La souris et les résultats de recherche appliquent l'inverse. Les valeurs négatives et les zéros sont valides.
- Le ciblage utilise un zoom 1 sur ordinateur et 0 jusqu'à 768 px, borné par les limites Leaflet, et respecte la préférence de mouvement réduit (`js/map.js:19`). Préserver le halo temporaire et l'ouverture de la popup d'un résultat.
- La préférence locale `ironOathMapState` conserve `lat`, `lng`, `zoom`, `floor`. Les erreurs de stockage sont tolérées. La restauration valide le palier et les bornes, conserve les zéros et borne le zoom. Les paramètres URL ont priorité sur cette préférence (`js/map.js:751`, `2344`).
- Conserver les six filtres, la recherche par nom/type et sa normalisation des accents, la recherche des PNJ du palier 2, les boutons de résultats accessibles, les flèches haut/bas et Échap. La recherche couvre le palier courant, indépendamment de l'état des filtres, et retourne au plus 15 résultats (`js/map.js:2510`, `2586`, `2687`).
- Conserver les raccourcis `+`, `=`, `-`, `_`, `0` seulement lorsque le focus appartient au conteneur carte ; `0` recadre sur les bornes du palier courant (`js/map.js:988`).

## Cycle de vie et images progressives

L'initialisation détruit une éventuelle instance précédente, crée un `AbortController`, vide les groupes et recrée tous les marqueurs. Les écouteurs de document/fenêtre/contrôles utilisent le signal. `scheduleMapTask` garde tous les délais dans un ensemble et vérifie que le contrôleur appartient encore à l'instance active. La destruction retire les images, détache les callbacks d'image, annule les délais, interrompt les écouteurs, retire Leaflet, remet l'état de palier à 1 et vide les groupes (`js/map.js:46`, `461`, `2362`).

Le palier 1 commence avec `carte-overview.webp` (1600 px) ou `carte-overview-mobile.webp` (1024 px), puis demande `carte.webp` quand `zoom > log2(largeur aperçu / 4951)`. L'image complète reste transparente jusqu'à son événement `load`, puis remplace l'aperçu. Son objet est réutilisé après retour au palier 1. En cas d'erreur, l'aperçu reste disponible et le détail n'est pas redemandé à chaque zoom. Un changement de palier autorise un nouvel essai. Le contrôleur, l'instance Leaflet et `mapOverlayGeneration` empêchent une ancienne réponse d'image de remplacer le palier actif (`js/map.js:94`, `106`, `122`).

Poids observés : aperçu mobile 530 752 octets, aperçu ordinateur 1 251 712, détail 8 383 564, palier 2 2 527 368, palier 3 963 572. Les paliers 2 et 3 chargent directement leur WebP. Les PNG existent comme sources ; le runtime utilise les WebP. Les icônes des six catégories sont dans `/assets/map_assets/markers/`, avec version `20261007a`, tailles et ancres propres à chaque type. Le HTML utilise Leaflet 1.9.4 local avec intégrité (`pages/map.html:213`).

## Calibration : faits et limites

| Palier | Bornes Leaflet de l'image | Conversion utilisée | Statut |
| --- | --- | --- | --- |
| 1 | `[[85,85],[5036,5036]]` | `5121 - Z`, `X` | Le code documente quatre références cardinales. Aperçu et détail ont exactement les mêmes bornes. |
| 2 | `[[3842,-1059],[6180,1059]]` | `5121 - Z`, `X` | Le commentaire explique une correction de marge sud de l'image. Les limites annoncées du terrain sont X/Z ±1059. |
| 3 | `[[0,0],[2000,2000]]` | `5121 - Z`, `X` malgré la configuration | Le commentaire dit « À configurer plus tard ». Image affichée, aucun marqueur, calibration non confirmée. |

Pour le palier 2, les limites Z ±1059 correspondraient à lat 4062..6180 sans marge. La borne réelle 3842 ajoute **220 unités au sud** ; ce n'est pas un changement de formule de coordonnées. Garder cette valeur jusqu'à l'obtention de points de référence vérifiables ; la symétriser arbitrairement déplacerait visuellement les marqueurs existants.

`floorConfig.coordOffset` n'est utilisé nulle part. Le paramètre `floor` du convertisseur local est ignoré (`js/map.js:1922`). Pour le palier 3, son offset configuré à zéro ne s'applique donc pas : une cible Z=0 donne lat=5121, hors de ses bornes. L'affichage souris utilise aussi 5121 et attribue les zones du palier 1 à tout palier autre que 2 (`js/map.js:881`). Aucun offset fiable du palier 3 ne peut être déduit de ce code.

Les noms de secteurs affichés sous la souris sont des rectangles calculés, avec des libellés génériques (`Terres du Nord`, quadrants, etc.), pas des limites de zones validées par des données de jeu. Les zones de monstres sont des points représentatifs, sans polygones de spawn. Les coordonnées des tableaux sont des littéraux existants sans provenance explicite ; le code seul ne permet pas de les qualifier de vérifiées ou d'inventées. Ne pas fabriquer de marqueurs pour les paliers 2/3 ni de positions manquantes.

## Frontières entre données et runtime

- À la portée du script classique : instance carte, overlays et cache, contrôleur/délais, palier courant, groupes Leaflet des paliers 1/2, `questDataFloor2`, configuration/images, liste de recherche et fonctions de filtres/recherche. Les `let`/`const` sont des bindings lexicaux globaux, pas des propriétés `window`, mais les déclarations de fonctions restent globales. L'évaluation dépend déjà de `L` car les groupes sont créés immédiatement.
- Dans la fermeture d'`initMapView` : `questData` du palier 1, `villesData`, `donjonsData`, `marchandsData`, `monstresData`, icônes, convertisseur, créateurs de marqueurs, changement de palier, application des paramètres URL et persistance. Les fonctions de filtres/recherche externes lisent l'état global ; cette frontière est la cause principale de la longueur et du couplage du fichier.
- Inventaire des littéraux : 69 entrées de quêtes P1 (67 coordonnées), 30 quêtes P2 (26 coordonnées), 6 villes, 5 donjons, 10 marchands (9 coordonnées), 12 zones de monstres. Les IDs sont uniques dans chaque tableau. Tous les champs d'origine doivent être conservés : ID, nom, coordonnées, type/étape, PNJ lorsqu'il existe, description.
- Les marqueurs de quêtes sont regroupés par coordonnées exactes. Leur icône et leur groupe de filtre suivent le type de la **première** quête du groupe ; leurs entrées restent distinctes pour la recherche et la popup. Les quêtes P1 n'ont actuellement aucun champ `npc`; le runtime ne peut donc pas en dériver une liste fiable de PNJ P1.
- `tools/build-search-index.mjs:68` extrait les six tableaux par leur nom dans le texte de `map.js`, sans lancer Leaflet. Renommer/déplacer ces littéraux casse ce contrat. Son extracteur ne vérifie pas séparément l'existence du nom avant de chercher le premier `[`, donc une extraction incorrecte peut apparaître après une restructuration. L'index global et les favoris de lieux/marchands utilisent des IDs issus du nom de tableau et de son index ; changer l'ordre modifie leur identité.
- Les popups interpolent les données des littéraux dans des chaînes HTML. Ce modèle est sûr tant que ces données restent des sources maîtrisées ; une future alimentation éditable doit passer par du texte DOM ou un échappement. Les résultats de recherche utilisent déjà `textContent` pour les noms.

## Mode administrateur réel

Le HTML contient un bouton `#place-mode-btn` dans un parent `.admin-only` caché avec `display:none` (`pages/map.html:189`). `auth-supabase.js` expose `isAdmin`, mais aucun code du site ne révèle ce parent ni ne branche le bouton sur les droits de l'utilisateur. Le seul handler affiche `alert('Fonctionnalité admin à venir...')` (`js/map.js:2487`). Il n'y a ni placement, ni déplacement, ni édition, ni enregistrement de données de carte. Les classes CSS d'édition et les tableaux `questesMarkers`/`questesSecondairesMarkers` sont des restes sans utilisation fonctionnelle. Ce bouton est une promesse de fonctionnalité, pas un outil admin à préserver comme existant.

## Défauts concrets observés

1. **Résultats périmés après changement manuel de palier.** `changeFloor` reconstruit `currentSearchableItems`, mais ne ferme/recalcule pas les boutons déjà affichés (`js/map.js:599`). Reproduction : rechercher Hanaka en P1, sélectionner P2 ; le résultat Hanaka reste affiché et son clic centre à `[1698,1531]` sur l'image P2. `displaySearchResults` ne vérifie pas le palier du résultat.
2. **Ancienne cible retardée après navigation.** Le délai de ciblage est protégé contre la destruction SPA, mais pas contre une autre requête de la même carte (`js/map.js:700`). Reproduction : `/carte?floor=2&x=-40&y=-888`, puis immédiatement `/carte?floor=3` ; au bout de 300 ms, le sélecteur affiche 3 et une vue `[6009,-40]` s'applique. Les recadrages à 100 ms capturent aussi les anciennes bornes sans vérifier une génération de navigation (`js/map.js:605`).
3. **Ciblage potentiellement appliqué deux fois au montage SPA.** `initMapView` applique directement les paramètres et le routeur émet ensuite `nameless:routechange` lors de l'activation. Deux halos/délais peuvent être créés pour la même URL. Les tests actuels appellent l'init puis simulent uniquement des changements ultérieurs, sans ce double montage.
4. **URL et vue manuelle peuvent diverger.** Changer le sélecteur ne modifie pas `floor`/`x`/`y` de l'URL existante ; recharger/partager peut donc réouvrir l'ancienne cible.
5. **Nettoyage de recherche incomplet.** La destruction vide les groupes, mais pas `currentSearchableItems`, qui garde temporairement des références de marqueurs. Les handlers de boutons générés n'utilisent pas le signal ; le remplacement du DOM par la SPA les élimine normalement.
6. **Déchets fonctionnels.** `updateZoomDisplay` est vide. L'accélération calculée par le listener `wheel` n'est jamais utilisée. Les coordonnées/secteurs affichés à forte précision ne constituent pas une preuve de précision de calibration.

## Refactor minimal recommandé

1. Envelopper le runtime dans une fermeture stricte, garder uniquement `window.NamelessMapPage`, créer les groupes lors de l'init et rassembler l'état par instance. Garder les contrats route/autostart et tous les assets existants.
2. Centraliser `gameToLeaflet` et `leafletToGame`, avec l'offset **confirmé** 5121 pour P1/P2. Séparer le statut de calibration du palier 3 ; ne pas lui attribuer un offset supposé en supprimant le commentaire provisoire.
3. Ajouter une génération de navigation distincte de celle des images, annuler les anciennes cibles/recadrages/halos au changement de palier, et fermer ou recalculer les résultats affichés. Garder la génération d'overlay et le contrôle d'instance pour le chargement progressif.
4. Extraire sans transformation les littéraux via l'AST TypeScript déjà disponible, puis produire un JSON dérivé avec source, version, comptes et champs d'origine. Comparer IDs/coordonnées/contenu avant/après. Ne pas dédupliquer des étapes ni corriger des positions lors de cette extraction. Si le JSON devient la source runtime, mettre à jour simultanément `build-search-index.mjs` pour lire la même source et préserver les identités d'index/favoris.
5. Éviter un `fetch` non protégé au milieu du cycle synchrone actuel : le registre n'attend pas le retour d'`init`. Si le chargement JSON est asynchrone, l'init doit prendre sa propre génération et ignorer les réponses après destroy ; sinon charger une couche de données générée avant le runtime par le registre.
6. Conserver les popups et leurs champs, puis réduire leurs répétitions dans un renderer DOM commun. Retirer le mode édition fictif ou le présenter comme indisponible selon la direction produit ; ne pas ajouter un CRUD au titre d'un nettoyage.

## Vérification effectuée

`node tools/test-catalogs.mjs` : **78 vérifications réussies**. La suite couvre coordonnées invalides, coordonnées négatives P2 et URL conservée, stockage interdit, restauration avec zéros, absence de recherche P1 en P3, mouvement réduit, aperçus desktop/mobile, seuils de détail, réutilisation du détail, erreur d'image et callbacks après changement de palier/destruction. Elle utilise un double Leaflet : elle ne valide ni le placement visuel sur les images, ni la calibration P2/P3, ni l'ouverture réelle des popups (`bindPopup`/`popup` sont des stubs), ni l'absence de duplication d'écouteurs dans un navigateur.

Deux scénarios supplémentaires, exécutés en mémoire avec le même double Leaflet, ont confirmé les défauts 1 et 2. Aucun fichier de test ni fichier applicatif n'a été modifié.
