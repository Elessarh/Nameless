# Nameless — direction Hybrid SAO Minecraft

Cette bible applique la consigne définitive du 9 octobre. L’accueil est corrigé en premier ; les autres écrans font l’objet d’un audit, puis d’une passe distincte après livraison de cette phase.

## Palette et surfaces

Les références indicatives sont bleu nuit #0B141B, secondaire #111E27, panneau #15232D, élevé #1B303B, bordure #35454A, or #BBA47A / #D3BE91, ivoire #DDD7CB et texte secondaire #94A3AB. La planche montre des zones planes encore plus sombres : navigation proche de #01070B, fond #000B12, panneaux #010E16–#030E16. Les tokens actuels #030B12 / #07131B / #0A1923 / #112632 sont conservés comme adaptation perceptuelle de ces surfaces, avec les contrastes AA déjà vérifiés. Un décor lumineux est localisé dans le hero ; les composants utilisent des fonds opaques bleu-noir. Les bordures servent à identifier les éléments interactifs, sans empiler des cadres de section.

## Typographie

Georgia pour le grand titre et les noms de cartes en casse courante ; Cinzel local pour les titres de sections et petits libellés de navigation ; Inter local pour les descriptions et commandes. Hiérarchie mesurée : titre environ 40–48 px desktop et 32–35 px mobile, section 20–23 px, fiche 14–16 px, métadonnées 12–13 px. Les noms ne deviennent pas de longues phrases en capitales.

## Illustrations : priorité et origine

1. Le logo fourni, les modèles du catalogue et les PNG de l’archive Items sont prioritaires et restent intacts.
2. La carte existante conserve ses ressources, relations et coordonnées ; un recadrage de navigation ne crée pas de nouvelles données.
3. Les scènes voxel historiques peuvent évoquer la guilde sans prétendre montrer un lieu ou des personnes officiels.
4. Une seule illustration complémentaire de hero est justifiée par l’inventaire : la ville existante est une vue aérienne centrée, et aucun asset ne fournit le point focal architectural droit de la maquette.

Cette illustration sera une **interprétation d’ambiance**, sans attribution à un lieu réel du serveur. Elle doit avoir une géométrie Minecraft évidente : blocs cubiques, contours en escalier, pierre et bois à textures pixelisées, feuilles et terrains voxel. Les paliers de la masse flottante d’Aincrad sont lisibles. La lumière peut être cinématique, mais ne transforme pas les constructions en architecture réaliste ou peinte.

Le sujet principal est à droite, le premier plan calme à gauche accueille de vrais composants HTML. Perspective à hauteur d’exploration, plans distincts, soleil naturel ivoire, ombres bleu nuit. Garder le sommet et la base dans une zone sûre pour le cadrage du hero. Aucun texte, bouton, interface, personnage officiel, monstre, équipement ou marqueur inventé dans cette image.

## Composition de l’accueil

Header compact 64 / 60 px. Hero desktop environ 420–460 px, texte gauche 440–500 px, décor à droite. Quatre accès homogènes sous le hero, avec zones d’image et de texte de même hauteur. Une galerie de cinq fiches en une rangée desktop et deux colonnes mobile, réservée aux véritables fiches. Le bloc de guilde devient secondaire sous cette galerie. Aucun qualificatif de récence sans historique réel.

## Composants et mouvement

Le kit SVG/CSS existant fournit traits fins, angles courts, séparateurs, boutons et focus. Cibles au moins 44 px, surface stable au survol, pictogrammes au trait 1,5 px. La petite texture Minecraft reste native, à 1× ou 2× entier, avec pixels nets ; les modèles sont adaptés à leur silhouette.

Apparition courte, bordure et éclairage de survol discrets, légère mise en valeur d’image. Le mouvement du hero est secondaire, accessible à la pause et supprimé avec `prefers-reduced-motion`. Les modules métier, auth, routeur et données ne sont pas réécrits pour cette composition.

## Accepté / rejeté

Accepté : rendus voxel reconnaissables, vrai modèle Illfang/Gorbel, PNG d’items préservés, carte réelle, UI lisible et dense, création Minecraft explicitement décorative si nécessaire.

Rejeté : peinture fantasy lisse, pierre réaliste sans blocs, château gothique générique, armure ou créature réinventée, géométrie impossible, surdétail aléatoire, halo fluorescent, données fictives de la planche et grands espaces vides servant à agrandir des sprites.

## Contrôle

Inventaire A/B/C et planche d’assets avant création. Inspection du résultat de génération puis de l’intégration. Captures dont les dimensions et la largeur DOM sont vérifiées : 360, 390, 768, 1280, 1920 et 2560 px. Comparaison des proportions et de la densité ; pas de validation fondée sur le build ou les couleurs seules.
