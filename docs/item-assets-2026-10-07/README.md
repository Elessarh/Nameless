# Items Nameless : intégration du 7 octobre 2026

Les 104 images du catalogue utilisent maintenant les fichiers de l'archive fournie. Les noms, IDs, catégories, raretés, références et chemins physiques existants sont conservés. Les associations du bestiaire et des fiches boss continuent à utiliser les mêmes fichiers. Aucun accès ni changement de base de données n'a été nécessaire.

## Résultat

| Mesure | Nombre |
|---|---:|
| Images réellement remplacées | 104 |
| Fichiers du dossier principal copiés sans modification | 82 |
| Source de référence existante copiée sans modification | 1 |
| Images conservées telles quelles parmi les sources choisies | 83 |
| Images retouchées localement | 21 |
| Pixels modifiés localement | 1 740, uniquement alpha 255 → 0 |
| Images recréées ou générées par IA | 0 |
| Images anciennes identiques au résultat | 0 |

Les compteurs « remplacées » et « conservées telles quelles » décrivent deux choses différentes : les 104 anciens fichiers ont changé ; 83 nouveaux fichiers ont été copiés sans modifier leurs octets. Les 21 autres ont seulement reçu un nettoyage de transparence. Le rapport de première passe contenu dans l'archive a servi de donnée de référence, pas d'instruction à exécuter.

Dossier principal : `item_use_cleaned/`. Exception : le lingot cramoisi de 1080×1080 était disproportionné ; la version 79×79 déjà présente dans `late_cleaned/` a été choisie. Elle n'a été ni recréée ni redimensionnée. Les huit autres variantes tardives comparées changeaient aussi les couleurs du sprite ; elles n'ont pas été substituées aux sources principales.

## Nettoyages ciblés

Douze fichiers avaient un trait gris de cadre isolé, au bord du canvas. Cinq autres demandaient une sélection manuelle : trait blanc ou gris relié au sprite, ou fond gris extérieur bloqué par ce trait. Quatre ouvertures d'objets conservaient le gris du fond ; leur transparence a été rétablie à partir des ouvertures confirmées dans les anciennes sources. Aucun masque global sur les gris n'a été utilisé.

Pour chaque retouche, les dimensions et les valeurs RGB de **tous** les pixels sont identiques à la source de l'archive. Seules les coordonnées alpha explicitement examinées ont changé. Les coordonnées et signatures sont enregistrées dans [le manifeste final](integration-manifest.json).

| Item retouché | Pixels de transparence corrigés |
|---|---:|
| Anneau de Pacte | 47 |
| Collier de Aragorn | 72 |
| Bâton du Sorcier du Shaman | 48 |
| Clé de la Forêt | 81 |
| Clé des Déchus | 99 |
| Clé de Xal'Zirith | 28 |
| Parchemin de Réallocation | 94 |
| Potion de Mana Supérieur | 48 |
| Potion de Vie I | 47 |
| Brindille Enchantées | 46 |
| Bûche de Chêne | 48 |
| Carapace de Requin | 176 |
| Coeur de Flammes | 42 |
| Cristal Corrompu | 45 |
| Fourrure de Loup | 165 |
| Lingot d'Âme de Métal | 48 |
| Minerai de Cuivre | 46 |
| Mycélium Magique | 48 |
| Peau de Sanglier | 420 |
| Pousse de Sylve | 47 |
| Canne à Pêche | 45 |

## Comparaison visuelle

Les 104 images ont été examinées en planches, sur fond Nameless et damier. Les planches finales montrent les anciens fichiers sauvegardés à gauche et les nouveaux à droite. Les aperçus utilisent uniquement nearest-neighbor ; les PNG utilisés par le site gardent leurs dimensions.

- [Avant/après 01](comparison-01.png) · [Fond damier 01](comparison-01-checker.png)
- [Avant/après 02](comparison-02.png) · [Fond damier 02](comparison-02-checker.png)
- [Avant/après 03](comparison-03.png) · [Fond damier 03](comparison-03-checker.png)
- [Avant/après 04](comparison-04.png) · [Fond damier 04](comparison-04-checker.png)
- [Avant/après 05](comparison-05.png) · [Fond damier 05](comparison-05-checker.png)
- [Avant/après 06](comparison-06.png) · [Fond damier 06](comparison-06-checker.png)
- [Avant/après 07](comparison-07.png) · [Fond damier 07](comparison-07-checker.png)

Les propositions de nettoyage sont aussi documentées dans `cleanup-candidates.json`, `manual-cleanup-candidates.json` et `hole-cleanup-candidates.json`, avec leurs planches. Les originaux de l'archive restent dans `source-archive/` ; les anciens fichiers du site sont sauvegardés dans `previous/`.

## Affichage frontend

Le catalogue conserve ses données et ses URLs d'items. Les images sont centrées avec un ratio conservé ; leur affichage est à 1× ou 2× entier, selon la place disponible, sans interpolation du sprite. Le mode `image-rendering: pixelated` est limité aux petites images, pas aux images de secours. Le zoom au survol et l'ombre de l'image ont été retirés. Le redimensionnement recalcule la taille ; les écouteurs sont démontés avec la page.

Le panneau de recherche mobile ne réserve plus une hauteur vide de 240 px entre la recherche et les filtres. Les images, le module items et son CSS ont une version de cache spécifique. La version du registre a été synchronisée dans les pages qui le chargent. Les chemins de fichiers, slugs, noms et références stockables restent inchangés ; seul le paramètre de cache des requêtes frontend change.

## Vérifications

- `tools/audit-item-assets.mjs` valide les 104 PNG : signature, CRC des chunks, décompression et filtres, pixels RGBA, dimensions, transparence, poids, SHA et références exactes du catalogue. Aucun fond entièrement opaque, aucun fichier invalide, aucune référence manquante.
- Limites des fichiers finaux : dimensions maximales 80×80 ; poids de chaque fichier inférieur à 64 Kio. Le total des images référencées passe de 1 340 970 à 196 563 octets (environ 85 % de moins).
- Les 104 réponses du serveur local ont été vérifiées : HTTP 200, MIME PNG et hash correspondant au manifeste (`http-verification.json`).
- Tests de rejet : 17 cas, dont manifeste incohérent, ID manquant/dupliqué, chemin sortant du dossier, CRC ou flux PNG corrompu.
- Suite `npm test` : audit d'images, 78 contrôles catalogue, 186 contrôles boss, vérification du build, traductions et 26 contrôles sécurité isolés.
- Parcours navigateur : recherche « anneau », rareté, catégorie + rareté combinées, pagination, changement du nombre par page, fiche détaillée et fermeture clavier. Mobile et desktop : sept largeurs (360, 390, 768, 820, 1440, 1920, 2560 px), ratios et facteurs entiers contrôlés, sans image de secours ni débordement détecté. Les captures `catalogue-desktop.jpg`, `catalogue-mobile.jpg` et `catalogue-mobile-detail.jpg` conservent le rendu vérifié.

Le contrôle a porté sur l'équivalent local du catalogue. Les fichiers sont prêts dans le projet ; aucune publication du domaine distant n'a été exécutée.

## Points à confirmer humainement si le pack original est disponible

Aucun problème bloquant n'a été détecté après nettoyage. Deux sources sont cadrées au pixel près et touchent un coin : **Carapace de Requin** et **Éclat de Bois Magique**. Cette proximité ne prouve pas une coupure ; aucune extrémité n'a été inventée ni aucun canvas forcé.

Neuf images fournies conservent des pixels semi-transparents et parfois un rendu plus doux. La semi-transparence n'est pas automatiquement un halo : un seuil global aurait supprimé des détails. Sans source raw plus fidèle prouvée, ces images restent inchangées. À comparer au pack du serveur si une validation artistique stricte est souhaitée :

- Potion de Mana (`assets/items/Consommables/PotiondeMana.png`)
- Bûche de Bouleau (`assets/items/Ressources/BuchedeBouleau.png`)
- Coeur Putrifié (`assets/items/Ressources/CoeurPutrifié.png`)
- Lingot de Fer (`assets/items/Ressources/LingotdeFer.png`)
- Minerai Cramoisi (`assets/items/Ressources/Mineraicramoisi.png`)
- Os de Squelette (`assets/items/Ressources/OsdeSquelette.png`)
- Os de Squelette Renforcé (`assets/items/Ressources/OsdeSqueletteRenforcé.png`)
- Poussière d'Os (`assets/items/Ressources/PoussièredOs.png`)
- Venin d'Araignée (`assets/items/Ressources/VenindAraignée.png`)

Deux cosmétiques supplémentaires (chapeaux de sorcière et du corbeau) ne figurent pas dans les données du catalogue et n'ont pas été ajoutés. Les dossiers Event et autres références restent dans la zone QA. `default.png`, non référencé par le catalogue, reste conservé.

## Retour arrière et entretien

Ne pas relancer une restauration globale du projet. Pour annuler seulement les images, recopier les fichiers correspondants de `previous/` vers `assets/items/`, puis reconstruire. Les originaux existent aussi dans Git au commit `13f5b3a`. Si un rollback est décidé, mettre à jour ou retirer le manifeste/audit de cette importation dans le même changement, car ils contrôlent intentionnellement les nouvelles images exactes.

Pour reproduire l'intégration déjà examinée : `python tools/integrate-item-assets.py --apply` (Pillow nécessaire). Le script contrôle sources, coordonnées alpha, couleurs, dimensions, containment des chemins et sauvegardes avant copie. Pour régénérer les planches : `python tools/build-item-qa.py`. Le build et les audits CI restent en Node, sans dépendance Python requise.
