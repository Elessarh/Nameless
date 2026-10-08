# Nameless — bible artistique de l’accueil

> Direction historique remplacée par la priorité aux assets SAO/Minecraft. Voir `docs/sao-minecraft-home-2026-10-08/REPORT.md` pour la passe active.

## Intention et références

L’accueil ouvre sur Aincrad, puis conduit vers quatre destinations utiles et des fiches réelles. La composition de la planche des sept interfaces reste la référence : paysage dominant, texte à gauche, cartes illustrées sous le paysage, découvertes compactes. Les nouvelles références du 8 octobre précisent l’architecture flottante, la lumière de jour et les matériaux des cadres. Les arabesques du cadre fourni inspirent un détail de coin discret, pas un encadrement multiple de chaque section.

## Palette et éclairage

L’interface conserve exactement les tokens bleu nuit #0B141B, ardoise #111E27 / #15232D, pétrole #477C80, or ancien #BBA47A, ivoire #DDD7CB / #F1EBDD. Les illustrations utilisent des pierres gris bleu, une végétation naturelle, une lumière de jour ivoire et de petits accents d’or. Une source de lumière cohérente éclaire les volumes. La luminosité appartient au décor ; un voile local sert uniquement à lire le texte.

## Images et matériaux

Illustration fantasy peinte avec volumes lisibles, perspective construite et détails choisis. Ni photo hyperréaliste ni dessin de jeu mobile. Pierre taillée patinée, métal ancien mat, bois sombre, papier ivoire. Aucun glow fluorescent, texture surdétaillée, typographie incorporée, fausse interface, faux logo ou personnage sans nécessité.

## Panorama

Une seule excellente illustration fixe, large, conçue pour le hero. Aincrad possède des paliers architecturaux empilés, une silhouette monumentale qui se resserre vers le sommet et des masses flottantes au-dessus des nuages. Le point focal occupe la moitié droite. Un premier plan sombre et calme à gauche accueille le vrai titre HTML ; des plans intermédiaires, des ponts et un ciel lumineux donnent la profondeur. Garder le monument complet et une réserve autour du sommet. Le cadrage mobile doit exposer le monument en haut puis laisser le texte sur le raccord sombre.

## Collection de navigation

Quatre illustrations horizontales, même famille peinte et même lumière, un point focal chacune. Carte : chemin et architecture d’exploration, jamais une fausse cartographie. Bestiaire : interprétation fidèle d’une créature identifiée par une référence du jeu. Objets : atelier et équipement général décoratif, sans prétendre remplacer une icône d’item réel. Guilde : salle de rassemblement d’aventuriers, sans faux membres ni événements.

## Composants

Géométrie vectorielle nette : traits fins, coins courts inspirés du métal ancien, un seul niveau de cadre par fiche. Icônes au trait de 1,5 px dans une grille 24 × 24, détails lisibles à 18–24 px. Les panneaux utiles, les boutons, la sélection et les séparateurs partagent les mêmes angles et épaisseurs. Les sections demeurent ouvertes. Pas de grands cadres raster ni d’arabesques répétées partout.

## Contenu fiable

Les illustrations de navigation sont des décors de catégorie. Les découvertes conservent les vrais rendus Illfang/Gorbel et les vrais PNG transparents des items, à taille native. Aucun chiffre de combat, lieu, position ou événement inventé. Les cartes et données des autres pages restent hors de cette passe d’accueil.

## Mouvement et performance

Apparition unique de 420 ms / déplacement de 8 px ; survol de carte de 220–360 ms avec zoom de 2,5 % et éclairage modéré. Pour le panorama, seulement un déplacement atmosphérique subtil si l’image finale s’y prête ; version fixe immédiate, mouvement désactivable et `prefers-reduced-motion` respecté. Pas de vidéo, particules globales, caméra excessive, dépendance lourde ni interception du scroll.

WebP responsifs, source conservée séparément, dimensions réservées, preload correspondant au cadrage du hero, illustrations secondaires lazy. Le résultat est inspecté dans le navigateur en 1920, 2560, 390 et 360 px, plus les largeurs intermédiaires. Les tests fonctionnels complètent la comparaison visuelle.
