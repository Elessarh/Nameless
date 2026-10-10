# Fonds inspirés de SAO Minecraft — 11 octobre 2026

La référence demandée est [la page française de SAO Minecraft](https://saominecraft.com/fr). Son accueil utilise un décor peint dans une direction anime ; d’autres sections montrent des rendus du jeu Minecraft. La nouvelle série reprend cette combinaison : environnements peints en 2D et illustrations natives pour les créatures, objets et cartes.

## Sources finales

Les quatre images ont été générées avec le **tool image_gen intégré**, puis sauvegardées dans le projet. Ce sont des illustrations générées par IA, inspectées pour obtenir une finition plus proche d’un décor d’animation ; elles ne sont pas présentées comme des œuvres dessinées à la main.

| Décor | PNG source | Intégration |
| --- | --- | --- |
| Aincrad | [aincrad-source.png](../../assets/art-v4/aincrad-source.png) | Accueil, exploration, carte d’entrée du wiki |
| Forêt | [forest-source.png](../../assets/art-v4/forest-source.png) | Bestiaire, ambiance de forêt |
| Atelier | [workshop-source.png](../../assets/art-v4/workshop-source.png) | Objets, ambiance d’atelier |
| Salle de guilde | [guild-source.png](../../assets/art-v4/guild-source.png) | Guilde et encart de l’accueil |

Les sources font 1672 × 941 pixels. Seize variantes WebP sont produites sans agrandissement. L’accueil dispose d’un recadrage mobile centré sur Aincrad ; les bandeaux utilisent leurs variantes adaptées à la largeur. Le panorama le plus grand pèse 231 856 octets, sa version mobile 72 382 octets.

## Direction et provenance

Le panorama conserve la silhouette d’Aincrad : plateaux superposés, pointe inférieure, bras latéraux et ville fortifiée au sol. Les autres décors utilisent des masses de feuillage lisibles, des contours discrets, des ombres larges, des couleurs mates et une architecture construite : portail de pierre, poutres soutenues, fenêtres, mobilier, enclume et foyer identifiables. Les images évitent les logos, inscriptions et personnages ajoutés.

Les images de référence du site sont conservées dans `references/official-hero.webp` et `references/official-story.webp`, avec leurs URL et rôles dans [prompts.json](prompts.json). Elles ont servi de références de style et de sujet pour la génération ; elles ne sont pas publiées directement comme fonds du projet. Les prompts complets des quatre générations sont dans ce même fichier.

La série `art-v4` remplace `art-v3` dans toutes les références actives. Les anciennes sources restent disponibles pour l’historique. Le manifeste [asset-manifest.json](../../assets/art-v4/asset-manifest.json) conserve les empreintes SHA256, dimensions, cadrages et provenance des sorties.

Pour reproduire les dérivés à partir des sources sauvegardées :

```powershell
py tools/optimize-reviewed-art.py --series art-v4
```

## Vérification

Deux inspections visuelles ont contrôlé les formes, perspectives, silhouettes, absence d’inscriptions et cadrages. Le contraste des surfaces sous les bandeaux est conservé pour que le décor ne concurrence pas les fiches. La qualité artistique reste un jugement visuel ; les tests ne prétendent pas mesurer un rendu « humanmade ».

Les contrôles suivants passent après intégration : politique d’art et empreintes, accueil, 108 régressions des catalogues, intégrité des 104 PNG d’objets et build des routes. Le test d’art contrôle les références `art-v4` optimisées et interdit le chargement des anciennes familles, dont `art-v3`.

[browser/verification.json](browser/verification.json) documente **12 vues finales** dans le navigateur Codex : accueil en 1920 × 1080 et 360 × 844 ; Bestiaire, Objets, guilde publique, wiki et carte en 1280 × 720 et 360 × 844. Aucun débordement horizontal, image visible manquante ni erreur JavaScript n’a été observé. Les aperçus sont sauvegardés dans `browser/`.

Les cartes affichent toujours leurs atlas Minecraft natifs, les catalogues leurs créatures et objets natifs. La vérification de guilde concerne le bandeau et l’accès public sans session membre.
