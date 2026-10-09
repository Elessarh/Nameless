# Nameless — audit de départ, 9 octobre 2026

L’accueil est le premier écran corrigé. Les autres interfaces ont été inspectées pour établir les écarts ; leur composition n’a pas été étendue dans cette passe. Le repository était propre au départ, sur `43f7ff3` (« Refonte »). Les travaux antérieurs sont conservés.

## Références et preuves

La [planche fournie à sept interfaces](reference-seven.png) fixe la composition recherchée. L’[accueil de départ livré le 8 octobre](screenshots/home-baseline-1920.jpg) et l’[accueil public observé](screenshots/public-home-1920.jpg) montrent la version Minecraft à corriger : ville aérienne centrale, quatre accès de traitements différents, découvertes en bandeaux et guilde en colonne. La première capture est une preuve antérieure conservée ; les vues publiques et les autres pages ci-dessous ont été prises pour cet audit.

Les anciennes preuves « bestiary-1920 » et « guild-qa-390 » ne démontraient pas leur format annoncé. Elles ont été remplacées par des vues réellement observées. Le [manifeste des captures](../screenshot-manifest.json) contient leurs dimensions, poids et SHA. Les différences entre viewport demandé et pixels exportés sont décrites dans le [protocole](../CAPTURE_PROTOCOL.md).

## Architecture réelle

| Domaine | État constaté |
|---|---|
| Frontend | HTML/CSS/JavaScript, documents autonomes et routeur SPA progressif. Aucun framework à migrer. 12 routes dans le registre, 13 documents source avec le fallback, 18 fiches boss générées. |
| Build | Node 24 ; `tools/build-site.mjs` produit uniquement l’artefact autorisé `_site`. 42 documents HTML avec routes et compatibilité historique. Le serveur local sert cet artefact. |
| CSS et composants | Tokens centralisés, styles communs puis modules par page ; header/mobile, boutons et cadres SVG/CSS, recherche native `dialog`, modales, filtres, onglets, Leaflet. Le routeur garde les CSS chargés : les nouvelles règles d’accueil sont limitées à `.home-page`. |
| Animations | Mouvement léger du décor, survols, ouvertures de panneaux ; pause et réduction des mouvements déjà présentes. Pas de vidéo ni nouvelle bibliothèque. |
| Authentification | Microsoft/Azure via Supabase Auth ; profils et rôles existants. Session et caches privés conservés. Pas de connexion réelle effectuée pour cet audit. |
| Backend et sécurité | Supabase JS 2.117.2 local, PostgreSQL/RLS, Storage et Realtime. Actions admin protégées par Edge/JWT/rôle et validations serveur. SQL 004/005/006 préparés et testés en base isolée ; leur état distant n’est pas certifié ici. |
| Administration | Comptes, rôles, profils, annonces et outils de carte existants. Aucun nouveau droit ni changement de base de production. |
| Minecraft | Résolution publique pseudo/UUID via PlayerDB/mc-heads. Elle ne prouve pas la propriété du compte. Parcours officiel `link-minecraft` dormant ; validation manuelle refusée côté serveur. Son README a été clarifié. |
| Discord | Invitation existante ; aucune synchronisation, API ou bot constaté. Aucun message envoyé. |
| Recherche | Index généré de **326** entrées publiques ; recherche FR/EN, catégories, clavier, favoris locaux, liens profonds et carte. L’ancien chiffre README 403 a été corrigé. Aucune donnée privée indexée. |
| Carte | Leaflet 1.9.4 local ; trois paliers documentés, filtres, marqueurs, sélection, recherche et relations. Graphe de 373 entités, registre de 269 IDs et 92 repères publics par défaut. Positions absentes signalées, sans coordonnées inventées. |
| Bestiaire / objets | 60 créatures, 104 items et 18 boss. Modèles et PNG réels conservés. Sources d’obtention et zones reliées par le graphe existant. |
| Donjons | Entités et relations cartographiques ; pas de module autonome `/donjons`. Les liens wiki existants ne prouvent pas un nouveau catalogue de donjons. |
| Guilde | Planning, objectifs, présences, annonces, chat, messages privés et médias existants. Vue visiteur protégée ; fixture membre locale séparée avec bandeau QA et données fictives en mémoire. |
| Quêtes / valeurs historiques | Les anciennes quêtes principales et statistiques de combat ont déjà été retirées de la projection publique. Sept sources originales archivées et exclues du build. Les quêtes secondaires restent historiques, non vérifiées et `noindex`. |

Les passes précédentes avaient déjà intégré le logo, nettoyé le catalogue d’items, créé les relations carte/codex, protégé les écritures et remplacé les peintures fantasy de l’accueil par une ville Minecraft. Cette passe traite les proportions et le point focal qui restaient insuffisants.

## Matrice des sept écrans

**C** Critique · **I** Important · **A** Amélioration · **S** Déjà satisfaisant. Ces statuts décrivent l’écart visuel au départ, pas une certification de tous les parcours métier.

| Écran | Composition | Palette | Typographie | Illustrations | Composants | Densité | Espacements | Fonctions | Responsive |
|---|---|---|---|---|---|---|---|---|---|
| Accueil | C | S | A | I | A | I | I | S, retesté en phase 1 | I, corrigé en phase 1 |
| Carte | I | S | I | S | I | I | I | S, base testée | A/I, vue mobile reprise |
| Recherche | I | S | A | S | A | I | I | S, clavier et liens testés | I, préambule haut |
| Bestiaire | I | S | A | S | I | I | I | S, base testée | Recette de sa phase à compléter |
| Fiche d’objet | I | S | A | S | A | I | I | S, ouverture testée | Recette de sa phase à compléter |
| Quartier général | I | S | I | S | I | I | I | Fixture / visiteur vérifiés | I, nom tronqué dans le header |
| Carte mobile | I | S | A | S | I | I | I | Contrôles existants, tests DOM | I, densité et hiérarchie |

Les surfaces actuelles sont proches des zones très sombres de la planche. Les références hexadécimales indicatives sont plus claires ; la [bible artistique](../ART_BIBLE.md) explique la conservation perceptuelle des tokens bleu-noir, ivoire et or. La correction prioritaire porte sur la structure, pas sur une nouvelle palette globale.

| Écran / preuve fraîche | Écart concret et correction à prévoir |
|---|---|
| [Accueil de départ](screenshots/home-baseline-1920.jpg) | La ville aérienne ne donne ni silhouette monumentale à droite ni profondeur comparable. Hero à recomposer ; quatre bandes d’images homogènes ; galerie verticale compacte ; guilde en bloc horizontal secondaire. **Traité en phase 1.** |
| [Carte desktop](screenshots/map-1920.jpg) | Organisation gauche/carte/droite pertinente, mais titre et barre de commandes hauts, panneau droit large et opaque. Priorité à la surface utile et aux raccourcis de palier, sans nouveau fond ni données. |
| [Recherche desktop](screenshots/search-1920.jpg) / [mobile](screenshots/search-390.jpg) | Le titre, l’aide et les favoris repoussent les résultats. Réduire ce préambule et améliorer les groupes ; conserver le clavier, le focus et les vraies entrées. |
| [Bestiaire](screenshots/bestiary-1920.jpg) | Vrais modèles et filtres satisfaisants, mais grand préambule et cartes espacées : moins d’informations utiles que la référence. Densifier la galerie sans agrandir arbitrairement les modèles. |
| [Items](screenshots/items-1920.jpg) / [fiche Potion](screenshots/item-detail-1920.jpg) | La fiche utilise un sprite net de 92 px dans une grande zone média ; beaucoup d’espace vide. Réorganiser informations et sources connues. Ne pas remplacer le PNG par une illustration inventée. |
| [Guilde desktop QA](screenshots/guild-qa-1920.jpg) / [mobile QA](screenshots/guild-qa-390.jpg) | Grand en-tête et planning haut, annonces/ressources peu compactes ; nom membre tronqué dans le header mobile. Fixture explicitement fictive ; aucun événement de test n’a été publié. |
| [Carte mobile](screenshots/map-390.jpg) | Carte et sélection sont accessibles, mais commandes occupent beaucoup de hauteur. Le cercle gris appartient à l’asset cartographique existant, ce n’est pas un terrain généré. Revoir les commandes et le panneau bas dans sa phase. |

## Inventaire et fidélité

[Inventaire détaillé A/B/C](asset-inventory.json) · [planche des sources avant](asset-control-before.jpg) · [planche des assets retenus après](../phase-1/asset-control-after.jpg).

Conserver le logo RGBA fourni, Illfang, Gorbel et les PNG natifs. Améliorer les cadrages de la ville, de la carte et de la scène voxel de guilde ; aucune provenance officielle ne leur est inventée. Les anciennes peintures fantasy restent dans l’historique et ne reviennent pas sur l’accueil.

`C:/Users/julie/Downloads/Items_Cleaned_FirstPass.zip` est **présent** : 900 116 octets, 159 entrées, 888 151 octets décompressés. SHA256 `45773d7cde8ffbd36e3a60dcca793f3e2bc13b9346f35da4b781d3a9e5057041`, identique au manifeste d’intégration antérieur. Les 104 PNG actuels correspondent à leurs SHA finaux. Potion et gelée sont intactes ; le bâton avait déjà reçu un nettoyage de 48 pixels de cadre. Alpha et netteté ont été inspectés, sans nouveau nettoyage global.

Aucun asset existant ne réunissait Minecraft reconnaissable, hauteur d’Aincrad à droite et espace calme à gauche. Une unique illustration de hero est donc justifiée, avec une retouche de cadrage. Elle est étiquetée « Illustration d’ambiance ». Les monstres et items ne sont pas régénérés.

## État public et publication — priorité critique

Le navigateur normal rend l’accueil Minecraft du 8 octobre. Les URL publiques `/bestiaire/` et `/quetes/` récupèrent leur contenu après le fallback initial du routeur. L’échantillon du bestiaire observé ne montre pas de PV/dégâts ; les quêtes affichent l’avertissement historique et `noindex, follow`. En revanche, [la fiche publique `/boss/illfang/`](https://nameless-sao.fr/boss/illfang/) reste sur l’écran « page introuvable », contrairement à la fiche générée locale qui fonctionne, y compris après rafraîchissement.

Le lecteur web brut et un GET ordinaire ont reçu 403 sur les ressources contrôlées. Cela ne signifie pas que tous les visiteurs reçoivent 403. Aucun contournement n’a été essayé ; le HTML HTTP initial, ses en-têtes, les règles CDN/cache, le contenu effectif de robots/sitemap et les réglages privés Pages ne sont pas certifiés. Les métadonnées rapportées sont celles du DOM rendu. [Observations structurées](public-rendered-audit.json).

Pour `43f7ff3`, la [workflow « Deploy public site »](https://github.com/Elessarh/Nameless/actions/runs/37853597923) échoue à « Test application » ; build/upload/deploy sont sautés. La [workflow standard Pages](https://github.com/Elessarh/Nameless/actions/runs/37853597649) réussit. Les journaux détaillés et les réglages Pages n’étaient pas accessibles sans authentification : la cause exacte distante et le mode de publication ne sont donc pas affirmés.

**Blocage local reproductible identifié :** `* text=auto` a normalisé dans le commit les CRLF de trois archives, alors que leur manifeste exige les octets originaux. Les tailles deviennent 55 161 au lieu de 56 589, 91 274 au lieu de 92 642 et 114 785 au lieu de 116 400 octets. Une checkout Linux ne peut satisfaire ces SHA. C’est une cause probable de l’échec CI, mais le journal distant n’a pas été lu.

La correction locale ajoute `data/archive/** -text`, conserve les octets originaux et teste les sept SHA ainsi que le filtre Git avec `tools/test-archive-line-endings.mjs`. Le gros diff des trois archives représente leurs fins de ligne ; `git diff --ignore-space-at-eol --exit-code -- data/archive` ne relève aucun changement de texte. Le prochain commit autorisé devra inclure les attributs **et** les trois fichiers ; la correction n’est pas encore dans le commit distant. Une publication de `_site` et une vérification des réglages Pages seront ensuite nécessaires. Aucun push, changement d’hébergement ou lancement de workflow effectué.

## Suite après livraison de l’accueil

1. Recherche et composants communs : densité des résultats et cohérence des commandes.
2. Carte : réduire le chrome, revoir le panneau latéral/mobile, contrôler les relations réelles. L’investigation BlueMap autorisée appartient à cette phase ; aucune tuile, position de joueur ou ressource protégée n’a été copiée.
3. Bestiaire/items : galerie compacte et détails proportionnés aux ressources du serveur.
4. Guilde : planning, annonces et ressources plus denses, puis recette avec comptes réels et permissions.

La sécurité et les migrations ont été testées localement, sans écriture de production. La conformité visuelle et métier de ces futures phases ne se déduit pas des tests de l’accueil.
