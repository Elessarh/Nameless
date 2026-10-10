# Direction artistique — 11 octobre 2026

Cette série `art-v3` est conservée pour l’historique. Les fonds actifs et la nouvelle direction anime sont décrits dans [la passe inspirée de SAO Minecraft](../sao-reference-art-2026-10-11/README.md).

La demande porte sur des images générées par IA dont la finition évoque une illustration maîtrisée. La suppression complète des décors IA lors de la passe précédente interprétait trop largement cette demande. Cette série réintroduit quatre environnements générés avec le **tool image_gen intégré**, puis inspectés avant intégration. Leur provenance reste IA ; ils ne sont pas présentés comme des œuvres réalisées à la main.

## Série retenue

| Décor | Source sauvegardée | Usage |
| --- | --- | --- |
| Aincrad | `assets/art-v3/aincrad-source.png` | Panorama d’accueil et ambiance d’exploration |
| Forêt | `assets/art-v3/forest-source.png` | Bandeau du Bestiaire et ambiance de forêt |
| Atelier | `assets/art-v3/workshop-source.png` | Bandeau des Objets et ambiance d’atelier |
| Salle de guilde | `assets/art-v3/guild-source.png` | Guilde et encart de l’accueil |

Les quatre sources mesurent 1672 × 941 pixels. Les variantes WebP sont produites sans agrandissement ; le mobile d’accueil dispose d’un recadrage du château. Les PNG sources ne sont pas chargés par les pages. La plus grande version du panorama pèse environ 199 ko, sa version mobile environ 76 ko.

## Critères de sélection

L’architecture privilégie une masse de château identifiable, une passerelle raccordée, des cours de pierre régulières et des poutres soutenues. La forêt conserve un portail, un chemin et un ruisseau lisibles. Dans l’atelier, le coffre, l’enclume et le foyer restent reconnaissables. La guilde utilise des volumes plus sobres et des bannières sans inscriptions. La palette commune associe pierre bleu-gris, bois mat, verts sourds et lumière ambre localisée.

Deux inspections visuelles ont retenu les quatre images : cohérence des formes et perspectives, absence de géométrie visiblement fondue, inscriptions et logos, lisibilité des sujets et pertinence des cadrages. Cette revue est un jugement artistique ; les contrôles techniques ne prétendent pas mesurer une qualité « humanmade ».

Les illustrations habillent les environnements, pas les fiches de jeu. Les atlas calibrés, modèles de créatures, PNG d’objets et leurs dimensions restent intacts. Les cartes d’inventaire gardent des fonds sobres, sans répétition d’illustration.

## Reproduction et provenance

- Les prompts complets, contraintes et rôles des références sont conservés dans `prompts.json`.
- `assets/art-v3/asset-manifest.json` contient les empreintes des sources et des exports, dimensions, cadrages et provenance.
- `py tools/optimize-reviewed-art.py` recrée les dérivés à partir des sources sauvegardées.
- `tools/test-native-art.mjs` contrôle les empreintes, proportions, références optimisées et conservation des sources natives. Les anciennes familles de décors écartées restent exclues des pages.

La documentation `docs/phase3-native-2026-10-10` décrit la passe précédente ; son choix de supprimer tous les décors IA est remplacé par cette sélection. Les fonctions de phase 3, les filtres, les fiches et la politique d’exclusion des quêtes archivées sont conservés.

## Validation de l’intégration

La suite `npm test` et le build passent. Après ajustement du contraste, les contrôles d’intégrité de l’art et les 108 régressions des catalogues passent également. Les captures finales et `browser/verification.json` couvrent **18 vues** : accueil, Bestiaire, Objets, guilde publique, wiki et carte, chacune en 360, 768 et 1920 pixels. Aucun débordement horizontal, image visible manquante, erreur JavaScript ni chargement des anciennes familles d’illustrations écartées n’a été constaté. La carte charge toujours ses atlas natifs.

La revue des captures a conduit à assombrir les surfaces des catalogues sous leur bandeau et le fond de guilde, pour préserver le contraste et éviter que le décor concurrence les données. Les captures de guilde vérifient le bandeau et l’accès public sans session membre ; elles ne prétendent pas tester une connexion réelle. Aucun changement n’a été déployé ni écrit dans Supabase pendant cette passe artistique.
