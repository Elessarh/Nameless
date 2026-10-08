# Collection de navigation Nameless — contrôle artistique

Quatre illustrations originales ont été produites avec le générateur intégré `image_gen`, une génération par asset. La [bible artistique](ART_BIBLE.md) a été lue avant leur production. Les [prompts exacts et les références](navigation-prompts.json) ainsi que les [dimensions, poids et SHA-256](navigation-art-manifest.json) sont conservés.

Les originaux PNG sont préservés dans `sources/`. Les WebP ont uniquement été réduits avec Lanczos puis compressés à qualité 76 ; aucune retouche sémantique, recoloration, génération supplémentaire ou modification des sprites de jeu n'a été effectuée. La qualité de compression initiale de 82 a été abaissée après l'audit Lighthouse afin de réduire le transfert sans changer la composition.

| Scène | Source PNG | Contrôle du sujet et du décor |
| --- | --- | --- |
| Carte | `sources/map-v2-source.png` | Un chemin, un pont de pierre et une citadelle forment un trajet visuel lisible. Le décor montre la profondeur et une lumière de jour cohérente. Aucun tracé, symbole ni position prétendant représenter le serveur. |
| Bestiaire | `sources/bestiary-v2-source.png` | Le Petit Slime est fondé sur le vrai rendu `assets/mobs/Petit Slime.png` : cube vert, dessus plat, côtés carrés, deux yeux carrés sombres. Pas de bouche, membres, couronne, armure ou anatomie inventée. Le décor de mousse et d'eau reste une illustration, sans localisation de jeu affirmée. |
| Objets | `sources/items-v2-source.png` | Une épée droite dont lame, garde et poignée sont alignées ; un bouclier kite à contour plausible. Le bois, la pierre et les petites touches de laiton s'accordent à la collection. Ces équipements restent un décor générique, sans remplacement d'item réel. |
| Guilde | `sources/guild-v2-source.png` | Une grande table de conseil, des chaises de chêne, de la pierre et de la lumière de jour. Aucune présence ni événement inventé ; documents non lisibles et aucune fausse carte. |

Chaque original 1672 × 941 a été inspecté en grand format avec `view_image`. Après optimisation à qualité 76, les quatre WebP de 256 × 144 et les quatre de 512 × 288 ont été inspectés de nouveau : silhouettes, yeux du Slime, lame droite, pont et mobilier restent lisibles. Une confrontation avec `sources/aincrad-panorama-v2.png` a confirmé la même famille de matériaux, la température du soleil ivoire, les ombres bleu nuit, la pierre gris bleu et la végétation naturelle.

Les quatre sujets ont des silhouettes distinctes à 256 px. La scène Carte conserve sa flèche haute près du bord supérieur : conserver le ratio 16:9 plutôt qu'ajouter une forte coupe verticale. Les points focaux utilisables pour les cadrages sont inscrits dans le manifest. L'intégration et les captures dans le navigateur sont contrôlées par la tâche principale.

| Variantes | Dimensions | Poids des quatre scènes |
| --- | --- | ---: |
| `assets/illustrations/{map,bestiary,items,guild}-v2-256.webp` | 256 × 144 | 36 666 octets |
| `assets/illustrations/{map,bestiary,items,guild}-v2-512.webp` | 512 × 288 | 126 330 octets |
| `assets/illustrations/{map,bestiary,items,guild}-v2-768.webp` | 768 × 432 | 253 846 octets |

La plus grande variante pèse 77 044 octets. Les douze variantes représentent 416 842 octets, soit 110 488 octets de moins que la compression initiale (−21 %). Les quatre variantes 512 économisent 32 794 octets et les quatre variantes 256 économisent 9 232 octets. Les quatre originaux représentent toujours 11 093 051 octets et demeurent dans la documentation, hors du répertoire de ressources publiques. Le script reproductible est `tools/optimize-navigation-art-v2.py`. Sa nouvelle exécution a duré environ une seconde et vérifie que les SHA-256 des sources restent identiques.

Les anciennes illustrations de navigation et tous les fichiers de jeu restent disponibles. Aucune modification de CSS, HTML, route, catalogue, carte ou backend n'a été effectuée par cette tâche.
