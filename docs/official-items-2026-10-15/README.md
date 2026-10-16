# Aperçus des objets — récupération du 15 octobre 2026

Ce document décrit la passe de récupération de 29 aperçus. Une [vérification ultérieure du site](../site-audit-2026-10-15/README.md) a corrigé la pose GUI de 318 projections, en conservant les 1 344 aperçus disponibles. Les comparaisons et empreintes ci-dessous décrivent la passe de récupération avant cette correction de projection.

Le catalogue des 1 382 objets du [wiki officiel SAO Minecraft](https://saominecraft.com/fr/wiki), importé le 14 octobre, dispose désormais de **1 344 aperçus** : **934 textures plates natives** et **410 vues natives en volume**. Cette passe récupère **29 aperçus supplémentaires**. Les **1 315 aperçus auparavant disponibles conservent exactement leur chemin et leur SHA-256** ; aucun n’est perdu ou remplacé.

Il reste **38 fiches avec un aperçu neutre** : 17 associations non résolues, 20 modèles absents des ressources publiques et un cas de texture non pris en charge. Les données de jeu et les noms publiés ne sont pas modifiés par cette récupération. Les noms ressemblants, notamment les potions de la catégorie stamina, sont conservés tels que publiés.

Les chiffres et les listes ci-dessous sont calculés depuis le manifeste de cette passe comparé au relevé initial. [availability.json](availability.json) conserve le détail lisible par machine, les empreintes des entrées, les raisons et le résultat de cette comparaison. L’état décrit correspond au manifeste SHA-256 `b6247c6c6e919c6b097b8010de3a52a66c9b65aac3ea5f1bea5a844926ee24f0` ; l’index public des modèles reste `c61bd4072223d3e4c75e3bc9cb80d454299d41ffed522db2a05c48506a10374a`.

## Ce qui a permis les récupérations

Les chemins différents d’un même modèle ou sprite sont désormais comparés sur leur contenu natif plutôt que traités automatiquement comme deux apparences distinctes. Un modèle au CMD exact et une image qualifiée qui aboutissent aux mêmes pixels fournissent une corroboration vérifiable. Les alias globaux génériques ne remplacent pas cette preuve.

Certaines identités ambiguës ont fait l’objet d’une revue visuelle explicite, avec empreintes figées du modèle et de toutes ses textures. Pour les trois arbalètes, le namespace, le type de l’objet, les textures officielles et la silhouette projetée permettent de retenir une identité qualifiée malgré leur CMD public non exact. La preuve Halloween compare les octets RGBA de la première trame du PNG publié à ceux de la texture native correspondante. [crossbow-evidence.json](crossbow-evidence.json) rassemble les URLs primaires et les empreintes, sans importer un atlas UV comme vignette.

Le moteur prend également en charge des UV qui dépassent les bords de l’atlas en conservant l’échantillonnage de bord du viewer officiel, et un axe GUI nul lorsque la silhouette plane reste visible. Il conserve les cuboïdes, pivots, rotations, coordonnées UV et pixels d’origine. Aucun visuel IA, aucune géométrie inventée et aucun fichier des anciennes versions du serveur local n’alimentent ces aperçus. Ces contrôles de projection ne constituent pas un test dans Minecraft ou Blockbench.

## Les 29 aperçus récupérés

| Objet publié | Identité source | Aperçu retenu | Raison |
| --- | --- | --- | --- |
| Bottes de l’Héraut | `armor:fallen_herald_boots` | Texture plate native | Le modèle au CMD exact et la référence d’image qualifiée sont équivalents sur les pixels natifs, malgré leurs chemins différents. |
| Tunique de l’Héraut | `armor:fallen_herald_chestplate` | Texture plate native | Le modèle au CMD exact et la référence d’image qualifiée sont équivalents sur les pixels natifs, malgré leurs chemins différents. |
| Jambières de l’Héraut | `armor:fallen_herald_leggins` | Texture plate native | Le modèle au CMD exact et la référence d’image qualifiée sont équivalents sur les pixels natifs, malgré leurs chemins différents. |
| Bottes de la Faucheuse | `armor:fallen_reaper_boots` | Texture plate native | Le modèle au CMD exact et la référence d’image qualifiée sont équivalents sur les pixels natifs, malgré leurs chemins différents. |
| Plastron de la Faucheuse | `armor:fallen_reaper_chestplate` | Texture plate native | Le modèle au CMD exact et la référence d’image qualifiée sont équivalents sur les pixels natifs, malgré leurs chemins différents. |
| Jambières de la Faucheuse | `armor:fallen_reaper_leggins` | Texture plate native | Le modèle au CMD exact et la référence d’image qualifiée sont équivalents sur les pixels natifs, malgré leurs chemins différents. |
| Bottes du Gardien | `armor:fallen_warden_boots` | Texture plate native | Le modèle au CMD exact et la référence d’image qualifiée sont équivalents sur les pixels natifs, malgré leurs chemins différents. |
| Plastron du Gardien | `armor:fallen_warden_chestplate` | Texture plate native | Le modèle au CMD exact et la référence d’image qualifiée sont équivalents sur les pixels natifs, malgré leurs chemins différents. |
| Jambières du Gardien | `armor:fallen_warden_leggins` | Texture plate native | Le modèle au CMD exact et la référence d’image qualifiée sont équivalents sur les pixels natifs, malgré leurs chemins différents. |
| Arbalète d'Amour | `crossbow:ARBALETE_AMOUR_P3` | Vue native en volume | Modèle qualifié du même pack corroboré par les textures sources et approuvé en revue CUA malgré le CMD non exact. |
| Arbalète Hurlante | `crossbow:ARBALETE_HALLOWEEN_P3` | Vue native en volume | Modèle qualifié du même pack corroboré par les textures sources et approuvé en revue CUA malgré le CMD non exact. |
| Arbalète Hivernale | `crossbow:ARBALETE_NOEL_P3` | Vue native en volume | Modèle qualifié du même pack corroboré par les textures sources et approuvé en revue CUA malgré le CMD non exact. |
| Dague de l'Héraut | `dagger:DAGUE_HEROIQUE` | Vue native en volume | Identité native approuvée en revue CUA ; modèle et textures retenus sont verrouillés par leurs empreintes SHA-256. |
| Dague Basique | `dagger:DAGUE_INTERMEDIAIRE` | Vue native en volume | Identité native approuvée en revue CUA ; modèle et textures retenus sont verrouillés par leurs empreintes SHA-256. |
| Raie | `fishing_job:RAIE` | Texture plate native | Le matériau/CMD exact et la clé qualifiée du PNG désignent le même modèle ; l’alias global contradictoire est écarté. |
| Sardine | `fishing_job:SARDINE` | Texture plate native | Le matériau/CMD exact et la clé qualifiée du PNG désignent le même modèle ; l’alias global contradictoire est écarté. |
| Catalyseur Damnée | `halloween:AILE_HALLOWEEN` | Vue native en volume | Le moteur conserve désormais l’axe Z nul du GUI d’origine et rend sa silhouette plane, sans gonfler le modèle. |
| Fragment d'Orichalque | `material:FRAGMENT_ORICHALQUE` | Texture plate native | Identité native approuvée en revue CUA ; modèle et textures retenus sont verrouillés par leurs empreintes SHA-256. |
| Lingot de Métal Enchanté | `material:ingot_metal_enchanted` | Texture plate native | Le modèle au CMD exact et la référence d’image qualifiée sont équivalents sur les pixels natifs, malgré leurs chemins différents. |
| Âme du Reaper | `material:reaper_soul` | Texture plate native | Le modèle au CMD exact et la référence d’image qualifiée sont équivalents sur les pixels natifs, malgré leurs chemins différents. |
| Pièce de Métal Enchanté | `material:scrap_metal_enchanted` | Texture plate native | Le modèle au CMD exact et la référence d’image qualifiée sont équivalents sur les pixels natifs, malgré leurs chemins différents. |
| Pièce d’Âme de Métal | `material:scrap_soulmetal` | Texture plate native | Le modèle au CMD exact et la référence d’image qualifiée sont équivalents sur les pixels natifs, malgré leurs chemins différents. |
| Rondache en Bois Piqué | `shield:BOUCLIER_POINTUE_BOIS` | Vue native en volume | Identité native approuvée en revue CUA ; modèle et textures retenus sont verrouillés par leurs empreintes SHA-256. |
| Rondache du Magicien | `shield:BOUCLIER_TOLBANA_SEMITANK` | Vue native en volume | Identité native approuvée en revue CUA ; modèle et textures retenus sont verrouillés par leurs empreintes SHA-256. |
| Orbe d'Avarice | `staff_mage:BATON1_EARTHLEVELING_P1` | Vue native en volume | Le moteur prend désormais en charge les UV natives hors atlas avec le même échantillonnage de bord que le viewer officiel, sans modifier les coordonnées ou pixels. |
| Orbe d'Avarice | `staff_mage:BATON1_EARTHLEVELING_P2` | Vue native en volume | Le moteur prend désormais en charge les UV natives hors atlas avec le même échantillonnage de bord que le viewer officiel, sans modifier les coordonnées ou pixels. |
| Orbe d'Avarice | `staff_mage:BATON1_EARTHLEVELING_P3` | Vue native en volume | Le moteur prend désormais en charge les UV natives hors atlas avec le même échantillonnage de bord que le viewer officiel, sans modifier les coordonnées ou pixels. |
| Bâton Magique d'Amour | `staff_shaman:SCEPTRE_SAINT_VALENTIN` | Vue native en volume | Le moteur prend désormais en charge les UV natives hors atlas avec le même échantillonnage de bord que le viewer officiel, sans modifier les coordonnées ou pixels. |
| Sceptre d'Amour | `staff_shaman:SCEPTRE_SAINT_VALENTIN_P3` | Vue native en volume | Le moteur prend désormais en charge les UV natives hors atlas avec le même échantillonnage de bord que le viewer officiel, sans modifier les coordonnées ou pixels. |

## Pourquoi 38 aperçus restent neutres

- **19 objets de matériaux vanilla avec CMD 0** : le wiki ne publie ni PNG ni modèle associé. Leur matériau seul ne démontre pas les textures, teintes ou profils de crâne du pack actuel. Des sprites vanilla génériques ne sont donc pas présentés comme leur apparence SAO vérifiée.
- **Serpe Noël** : aucun modèle `netherite_hoe/10000` n’est publié. L’atlas Noël partagé et le modèle `scythe` de Faux Noël ne prouvent pas que cette serpe possède la même géométrie.
- **5 correspondances par seuil seulement** : Diadème du Berserker, Kit de réparation complet, Arbalète basique, Arbalète d’entraînement et Arbalète des Bois Ancien. Aucun seuil exact ou autre élément indépendant ne résout leur identité. Le modèle nommé Bois Ancien existe, mais son seuil 12691 contredit le CMD 10004 publié pour l’objet.
- **12 autres associations contradictoires** : quatre casques d’améthyste de classe, Mythril, Malachite, Onyx et cinq potions de stamina. Les références publiques ne permettent pas de choisir une apparence sans supposition.
- **Bâton à Lanterne Lunaire** : une planche native verticale mesure 32×1760, sans métadonnées de trame exploitables dans les ressources publiques. L’aperçu expérimental affichait des lignes parasites et a été rejeté pendant la revue CUA. La sélection d’une trame, la cadence ou une répétition UV ne sont pas inventées pour masquer ce cas.

| Objet publié | Identité source | Motif du manifeste | Explication |
| --- | --- | --- | --- |
| Casque d'Améthyste Chasseuse | `armor:CASQUE_AMETHYSTE_ARCHER` | `conflicting-model-without-independent-corroboration` | L’alias de casque de classe contredit le modèle générique golden_helmet/CMD 10000 ; aucun PNG ou preuve indépendante ne permet de choisir. |
| Casque d'Améthyste Faucheuse | `armor:CASQUE_AMETHYSTE_ASSASSIN` | `conflicting-model-without-independent-corroboration` | L’alias de casque de classe contredit le modèle générique golden_helmet/CMD 10000 ; aucun PNG ou preuve indépendante ne permet de choisir. |
| Casque d'Améthyste Magique | `armor:CASQUE_AMETHYSTE_MAGE` | `conflicting-model-without-independent-corroboration` | L’alias de casque de classe contredit le modèle générique golden_helmet/CMD 10000 ; aucun PNG ou preuve indépendante ne permet de choisir. |
| Casque d'Améthyste Sauvage | `armor:CASQUE_AMETHYSTE_SHAMAN` | `conflicting-model-without-independent-corroboration` | L’alias de casque de classe contredit le modèle générique golden_helmet/CMD 10000 ; aucun PNG ou preuve indépendante ne permet de choisir. |
| Diademe du Berserker | `armor:DIADEM_WARRIOR_P3` | `nonexact-cmd-range` | CMD 10100 absent des seuils exacts ; le repli vers le casque d’améthyste 10000 ne démontre pas l’identité du diadème. |
| Bottes de l’écume | `armor:foam_boots` | `no-public-model` | Aucun modèle/PNG public associé ; le matériau et CMD 0 ne prouvent pas l’apparence du pack SAO actuel. |
| Kit de Réparation Complet | `consumable:KIT_REPARATION_COMPLET` | `nonexact-cmd-range` | CMD 12417 absent des seuils exacts ; le repli vers iconpalier3 (12416) est incorrect et aucun PNG ne rattache un autre kit à cet objet. |
| Arbalète Basique | `crossbow:ARBALETE_BASIQUE` | `nonexact-cmd-range` | CMD 10004 absent des seuils exacts ; aucun modèle d’arbalète basique ni PNG ou clé qualifiée ne corrobore une identité précise. |
| Arbalète des Bois Ancien | `crossbow:ARBALETE_BOIS_ANCIEN` | `nonexact-cmd-range` | Un modèle nommé arbalete_boisancien existe au seuil 12691, mais le wiki indique 10004 sans PNG ni clé qualifiée corroborante. |
| Arbalète d'Entraînement | `crossbow:ARBALETE_ENTRAINEMENT` | `nonexact-cmd-range` | CMD 10004 absent des seuils exacts ; les modèles arc_entrainement sont des arcs et ne prouvent pas l’identité de cette arbalète. |
| Serpe Noël | `dagger:SERPE_NOEL_P3` | `no-public-model` | Aucun modèle netherite_hoe/10000 publié ; le modèle Noël scythe correspond déjà à Faux Noël et le seul atlas partagé ne prouve pas une serpe identique. |
| Flarevae | `farmer_job:FLAREVAE` | `no-public-model` | Aucun modèle/PNG public associé ; le matériau et CMD 0 ne prouvent pas l’apparence du pack SAO actuel. |
| Fleur d’Allium | `farmer_job:FLEUR_ALLIUM` | `no-public-model` | Aucun modèle/PNG public associé ; le matériau et CMD 0 ne prouvent pas l’apparence du pack SAO actuel. |
| Blé | `farmer_job:WHEAT_BASE` | `no-public-model` | Aucun modèle/PNG public associé ; le matériau et CMD 0 ne prouvent pas l’apparence du pack SAO actuel. |
| Bâton à Lanterne Lunaire | `lunar:BATON_LANTERNE_LUNAR` | `unsupported-native-texture` | Texture d’animation 32×1760 sans métadonnées de trame exploitables ; l’aperçu expérimental a été rejeté en revue CUA. Aucune trame, cadence ou répétition UV n’est supposée. |
| Carapace d’Abeille | `material:bee_shell` | `no-public-model` | Aucun modèle/PNG public associé ; le matériau et CMD 0 ne prouvent pas l’apparence du pack SAO actuel. |
| Pinceau Magique | `material:BRUSH` | `no-public-model` | Aucun modèle/PNG public associé ; le matériau et CMD 0 ne prouvent pas l’apparence du pack SAO actuel. |
| Carnet Froissé | `material:crumpled_book` | `no-public-model` | Aucun modèle/PNG public associé ; le matériau et CMD 0 ne prouvent pas l’apparence du pack SAO actuel. |
| Bouquet de Tulipes | `material:fleur_allium` | `no-public-model` | Aucun modèle/PNG public associé ; le matériau et CMD 0 ne prouvent pas l’apparence du pack SAO actuel. |
| Pantalon | `material:LEGGINGS_KICK` | `no-public-model` | Aucun modèle/PNG public associé ; le matériau et CMD 0 ne prouvent pas l’apparence du pack SAO actuel. |
| Mythril | `material:Mythril` | `conflicting-model-without-independent-corroboration` | Les références publiques désignent des modèles différents ; aucune égalité native ou preuve indépendante ne permet de choisir l’apparence exacte. |
| Pantalon perdu de Caulette | `material:PANTALON_PERDU` | `no-public-model` | Aucun modèle/PNG public associé ; le matériau et CMD 0 ne prouvent pas l’apparence du pack SAO actuel. |
| Poudre Explosif | `material:PoudreACanon` | `no-public-model` | Aucun modèle/PNG public associé ; le matériau et CMD 0 ne prouvent pas l’apparence du pack SAO actuel. |
| Relique du Maitre Épéiste | `material:relic_swordmaster` | `no-public-model` | Aucun modèle/PNG public associé ; le matériau et CMD 0 ne prouvent pas l’apparence du pack SAO actuel. |
| Sable | `material:Sable` | `no-public-model` | Aucun modèle/PNG public associé ; le matériau et CMD 0 ne prouvent pas l’apparence du pack SAO actuel. |
| Os de Squelette | `material:skeleton_bone` | `no-public-model` | Aucun modèle/PNG public associé ; le matériau et CMD 0 ne prouvent pas l’apparence du pack SAO actuel. |
| Os de Squelette Supérieur | `material:skeleton_bone_superior` | `no-public-model` | Aucun modèle/PNG public associé ; le matériau et CMD 0 ne prouvent pas l’apparence du pack SAO actuel. |
| Fil d’Araignée | `material:STRING_SPIDER` | `no-public-model` | Aucun modèle/PNG public associé ; le matériau et CMD 0 ne prouvent pas l’apparence du pack SAO actuel. |
| TNT Artisanale | `material:yasneko_LugTNT` | `no-public-model` | Aucun modèle/PNG public associé ; le matériau et CMD 0 ne prouvent pas l’apparence du pack SAO actuel. |
| Minerai de Cuivre | `miner_job:COPPER_ORE` | `no-public-model` | Aucun modèle/PNG public associé ; le matériau et CMD 0 ne prouvent pas l’apparence du pack SAO actuel. |
| Malachite | `miner_job:MALACHITE` | `conflicting-model-without-independent-corroboration` | Les références publiques désignent des modèles différents ; aucune égalité native ou preuve indépendante ne permet de choisir l’apparence exacte. |
| Onyx | `miner_job:ONYX` | `conflicting-model-without-independent-corroboration` | Les références publiques désignent des modèles différents ; aucune égalité native ou preuve indépendante ne permet de choisir l’apparence exacte. |
| Potion de Vie I | `potion_stamina:POTION1` | `conflicting-model-without-independent-corroboration` | Le modèle global nommé potion1…5 contredit le modèle exact glass_bottle/CMD 29 ; le PNG publié est absent (404), sans corroboration indépendante. |
| Potion de Vie II | `potion_stamina:POTION2` | `conflicting-model-without-independent-corroboration` | Le modèle global nommé potion1…5 contredit le modèle exact glass_bottle/CMD 29 ; le PNG publié est absent (404), sans corroboration indépendante. |
| Potion de Mana III | `potion_stamina:POTION3` | `conflicting-model-without-independent-corroboration` | Le modèle global nommé potion1…5 contredit le modèle exact glass_bottle/CMD 29 ; le PNG publié est absent (404), sans corroboration indépendante. |
| Potion de Vie IV | `potion_stamina:POTION4` | `conflicting-model-without-independent-corroboration` | Le modèle global nommé potion1…5 contredit le modèle exact glass_bottle/CMD 29 ; le PNG publié est absent (404), sans corroboration indépendante. |
| Potion de Vie V | `potion_stamina:POTION5` | `conflicting-model-without-independent-corroboration` | Le modèle global nommé potion1…5 contredit le modèle exact glass_bottle/CMD 29 ; le PNG publié est absent (404), sans corroboration indépendante. |
| Torche | `tool:TORCH` | `no-public-model` | Aucun modèle/PNG public associé ; le matériau et CMD 0 ne prouvent pas l’apparence du pack SAO actuel. |

## Preuves et validation

Preuves visuelles conservées : [identités natives revues](reviewed-identities.png), [Dague de l’Héraut](herald-dagger-reviewed.png), [trois arbalètes](crossbows-reviewed.png). Les listes de disponibilité incluent les sourceKeys et les raisons ; le manifeste actif conserve les sources et leurs empreintes détaillées.

La comparaison des manifestes est validée : 29 récupérations, 38 neutres et 1 315 aperçus précédents inchangés. Les candidats représentatifs ci-dessus ont été inspectés dans le navigateur via CUA ; le cas Lunaire a été exclu après cette revue.

**Validation terminée :** `npm run build` et `npm test -- --skip-browser` se terminent avec succès. La suite comprend les 59 contrôles du contrat d’aperçus, 81 contrôles d’identité, 48 contrôles du moteur natif, les 5 553 contrôles des faits officiels et les autres régressions du site. Le navigateur natif en CLI est remplacé localement par la recette CUA.

Dans le navigateur, la fiche des Jambières du Gardien affiche désormais son sprite natif. Le filtre Armures conserve 48 cartes par page ; seuls cinq aperçus restent neutres dans ses 48 premières entrées. La fiche de l’Arbalète Hivernale affiche le modèle retenu sur ordinateur et mobile. À 1 920 px et 390 px : aucun débordement horizontal ni image cassée constatés, pagination à 48, fermeture de la fiche au clavier et retrait du filtre fonctionnels. Preuves : [Gardien sur ordinateur](guardian-preview-desktop.png), [arbalète sur ordinateur](crossbow-catalogue-desktop.png), [arbalète sur mobile](crossbow-catalogue-mobile.png), [grille mobile](items-grid-mobile.png).

Ces validations préparent le site local. Elles ne publient pas le site et ne poussent aucun commit.
