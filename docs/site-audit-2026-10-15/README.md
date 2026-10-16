# Vérification du site — 15 octobre 2026

L’audit associe les contrôles automatisés du site, un parcours réel dans le navigateur et la vérification des ressources publiées. Les corrections sont locales ; aucune publication, migration distante, inscription, présence, modification de profil ou message de test n’a été envoyé en production.

## Corrections

- **Aperçus d’objets :** l’ordre des rotations GUI composées était incorrect. Les angles suivent désormais la composition Euler XYZ du mode d’affichage de Blockbench. Les rotations des éléments, pivots, cuboïdes et pixels sources restent inchangés. Les UV constantes utilisent leur ligne, colonne ou texel natif, avec transparence, échantillonnage NEAREST et bord CLAMP. Sources techniques : [Blockbench](https://raw.githubusercontent.com/JannisX11/blockbench/master/js/display_mode/display_mode.js), [THREE.Euler](https://threejs.org/docs/pages/Euler.html).
- **Accueil :** une vignette de bâton conservait un ancien nom de SVG après régénération. Le build relie désormais les vignettes à leurs identités vérifiées dans le catalogue courant.
- **Recherche :** les catégories d’objets utilisent le vocabulaire du catalogue, notamment « Armures » en français et « Armor » en anglais. La version de cache couvre les octets exacts de l’index produit, y compris sur les pages de boss.
- **Profil :** un changement de connexion purge immédiatement l’ancien profil. Une réponse tardive ou une recherche Minecraft commencée avec un autre compte ne peut pas réafficher ses données ni modifier le compte remplaçant. Une ancienne sauvegarde ne peut pas déverrouiller le bouton d’une nouvelle sauvegarde. La version du script est actualisée sur les routes directes et SPA.

## Images

Le catalogue conserve **1 344 aperçus pour 1 382 objets** : 934 sprites plats et 410 projections natives. **318 projections sont corrigées et 1 026 restent strictement identiques** à la passe précédant cet audit. Aucun aperçu disponible n’a été perdu. Les 1 344 fiches utilisent 1 185 SVG uniques après déduplication.

Les SVG ont été rasterisés : aucune image vide, erreur de rendu ou découpe par les limites du cadre. Les 287 SVG modifiés uniques ont fait l’objet d’un second contrôle. Les plafonds de 384 éléments, 6 000 fragments et 750 000 octets sont conservés. Les faits officiels et les modèles/textures sources n’ont pas été modifiés.

Les **38 états neutres** restent explicites : 17 associations ambiguës, 20 modèles publics absents et une planche de texture non prise en charge. Certains assets natifs peuvent aussi être visuellement inhabituels : les Jambières du Chasseur, par exemple, ne contiennent qu’une bande peinte dans leur texture publique. Aucun dessin de remplacement ou modèle supposé n’est ajouté.

Preuves : [comparaison GUI](gui-before-after.png), [hallebarde sur ordinateur](halberd-desktop.png), [hallebarde sur mobile](halberd-mobile.png), [carte mobile](map-mobile.png). Les [changements de projections](preview-reprojection.json), [contrôles de géométrie](projection-report.json), [contrôles raster](raster-report.json) et [parcours du navigateur](browser-checks.json) sont conservés séparément.

## Parcours vérifiés

| Section | Contrôle dans le navigateur |
| --- | --- |
| Accueil | Navigation, recherche globale et liens vers les fiches. |
| Recherche | Résultat d’objet, aperçu, résumé français, sélection au clavier et ouverture de la fiche sur la même route. |
| Wiki | Recherche « donjon », ouverture de l’article, passage FR → EN → FR. |
| Bestiaire | 60 créatures, 48 cartes par page, les quatre boss approuvés, fiche de Nazgul, onglet Drops et page complète. |
| Objets | Aperçu réorienté de la hallebarde sur ordinateur et mobile ; fiche des Jambières du Gardien ; pagination à 48 et fermeture au clavier. |
| Carte | Lien depuis un boss, paliers 01 → 02 → 03 → 01, sélection d’une région et de son contour, recentrage, plein écran et sortie ; cadrage et fiche mobile. |
| Atelier cartographique | Accès administrateur existant, carte et sommets visibles, onglets Zones, Repères et Atlas accessibles ; aucune publication. |
| Guilde | Cinq onglets, calendrier et états vides, ouverture/fermeture du formulaire d’expédition et du chat ; aucun envoi ni inscription. |
| Profil | Chargement du profil existant, avatar, cinq classes et détails du compte repliés ; aucune sauvegarde. |
| Administration | Accès réel et quatre sections ouvertes ; aucune donnée changée. |
| Autres pages | Connexion, liens Confidentialité/Conditions, page 404 et retour à l’accueil. |
| Mobile | Menu et fermeture au clavier, navigation, carte et sélection de région, recherche et fiche d’objet à 390 px ; aucun débordement horizontal constaté. |

Les liens internes, assets, catégories, archives masquées, cycles Leaflet/SPA, traduction, gestion d’erreurs et protections de rôles sont également couverts par la suite automatisée. Les tests d’écritures et de sécurité utilisent des bases isolées. Les lectures réelles avec le compte administrateur existant ont été exercées ; les mutations distantes sont exclues de cet audit.

## Validation finale

**Suite complète terminée avec succès :** `npm test -- --skip-browser`, code de sortie 0. Le build vérifie 48 documents HTML et 2 375 références locales. Le test de navigateur lancé en CLI est remplacé localement par les parcours CUA ci-dessus.

Les contrôles comprennent notamment 5 553 vérifications des faits officiels, 81 d’identité des modèles, 77 du moteur natif, 65 du contrat des aperçus, 65 du profil, 12 de liaison des vignettes d’accueil et 27 de sécurité en base isolée. La revue finale indépendante n’a pas relevé de défaut bloquant dans les correctifs.

L’[audit HTTP final](site-assets-audit.json) vérifie **1 410 références runtime uniques**, toutes HTTP 200, sans erreur de casse ni de type MIME. Les 1 344 aperçus, 60 portraits et 54 références de butins sont présents. La matrice des limites ci-dessous reste applicable.

## Capture utilisateur — clôture du 16 octobre

La capture montrant les pièces de l’Héraut, de la Faucheuse et du Gardien sans aperçu a été rapprochée de l’onglet d’origine. Cet onglet conservait encore le catalogue `54828853e6c1` chargé en mémoire ; le site local servait déjà la version `e0d10a07f7f3` corrigée.

L’onglet d’origine a été rechargé. Les neuf pièces vérifiées ont toutes une image native disponible et chargée, dont les Jambières du Gardien. Le catalogue conserve 48 éléments par page. Preuves : [grille des armures après actualisation](armor-grid-refreshed-2026-10-16.png), [fiche des Bottes de l’Héraut](herald-boots-refreshed-2026-10-16.png).

Le Diadème du Berserker reste neutre : sa référence publique n’établit toujours pas de modèle exact. Les quatre casques d’Améthyste de classe restent également à confirmer. Ces états sont distincts des aperçus récupérés et des erreurs de téléchargement.

## Limites

- Le retour complet d’une nouvelle authentification Microsoft n’a pas été rejoué avec le compte réel ; le provider et le déclenchement unique du flux sont vérifiés.
- Les sauvegardes de profil, publications, inscriptions et réceptions de messages entre deux comptes réels n’ont pas été provoquées. Leur comportement et leurs règles d’accès sont testés dans un environnement isolé.
- Les 38 aperçus neutres nécessitent des ressources actuelles du serveur ou une confirmation en jeu ; aucun visuel supposé n’est ajouté pour masquer ces absences.
- Le navigateur intégré a signalé l’abandon de certaines transitions natives lors des navigations ; les pages et le repli de navigation restent fonctionnels. Il ne s’agit pas d’un échec de chargement d’image ou d’une exception bloquant les parcours contrôlés.
- Les contrôles de projection ne constituent pas une validation dans Minecraft ou Blockbench. Les données d’objets restent l’instantané du wiki officiel du 14 octobre, sans recours aux anciennes versions du serveur local.
