# Captures reproductibles de l’accueil

Le serveur local sert `_site`, jamais les fichiers de travail. Exécuter `npm run build`, puis `npm start` sur 4173. Après une modification et un nouveau build, recharger l’onglet. Pour le quartier général isolé : `node tools/serve-ui-fixtures.mjs` sur 4181, route `/qa/guild` ; son bandeau et ses données fictives doivent rester visibles.

Dans le navigateur Codex, ouvrir un onglet neuf sur la route à contrôler. Régler la capacité documentée `viewport` **après** la création de cet onglet. Relever `innerWidth`, `innerHeight`, la largeur du document et `scrollTop` avec une lecture du DOM. Vérifier le retour visuel, puis capturer avec `tab.screenshot({fullPage:false})` ; utiliser `fullPage:true` pour la page complète. Sauver les octets JPEG d’origine, sans agrandissement ou correction du cadrage.

| Viewport demandé | Usage |
|---|---|
| 360 × 800 | Mobile étroit |
| 390 × 844 | Mobile |
| 768 × 1024 | Tablette |
| 1280 × 900 | Petit desktop |
| 1920 × 1080 | Desktop |
| 2560 × 1440 | Grand desktop |

Charger les vignettes différées par un défilement réel, cliquer le titre puis revenir en haut avec Ctrl+Home. Vérifier `scrollTop=0` avant les captures de viewport. Mettre le décor en pause avec son bouton pour rendre les comparaisons stables. Les onglets de guilde peuvent intercepter Home : retirer leur focus avant le retour en haut.

**Limite constatée de l’outil :** le recadrage `clip` a produit des captures mobiles vides malgré un DOM correct ; il n’est pas retenu pour ces vues. Les captures de viewport fonctionnent, mais les pixels exportés peuvent différer des dimensions demandées : par exemple viewport 390 × 844, contenu 380 px avec gouttière, JPEG 380 × 822. Le manifeste indique les dimensions réelles de chaque fichier. Les noms `home-390` désignent le viewport testé, pas une promesse de dimensions exactes du JPEG. Aucune image n’est rééchantillonnée pour masquer cet écart.

Les six vues ont été ouvertes et inspectées. Les preuves DOM sont dans `phase-1/responsive-dom.json`, les interactions dans `phase-1/interaction-checks.json`. Les captures anciennes mal étiquetées ne servent pas de preuve de responsive. La planche comparative recadre uniquement le premier écran de la référence et réduit les autres images pour la lecture ; les originaux restent disponibles.

`python tools/build-definitive-proof.py` recompose les deux planches de revue, extrait les dimensions/SHA des JPEG et résume le Lighthouse sauvegardé. Ce script ne prend pas les captures à la place du navigateur.

Le script nécessite Pillow et les polices Arial de Windows. Ici, l’interpréteur disponible est celui des dépendances Codex : `C:/Users/julie/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe` ; le raccourci Windows `python` n’était pas installé.
