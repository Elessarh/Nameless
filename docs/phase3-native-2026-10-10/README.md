# Nameless — visuels natifs et phase 3

Travail commencé le 10 octobre et vérifié le 11 octobre 2026. Prévisualisation locale : http://127.0.0.1:4173/.

## Résultat

- La carte et la recherche excluent les 176 identités historiques : 59 quêtes secondaires, 58 anciens guides et 59 PNJ associés. Les anciens caches, positions partagées, favoris, relations et liens de sélection sont filtrés à l’exécution. Le catalogue public contient 33 lieux actuels, 60 créatures et 104 objets.
- Les décors générés `reference-v2` et `aincrad-minecraft`, ainsi que les décors de guilde sans provenance confirmée, ne sont plus référencés par les pages ou styles actifs. Les fichiers originaux sont conservés.
- L’accueil utilise la capture Minecraft `city.png` et ses variantes existantes, identifiées par le manifeste `../sao-minecraft-home-2026-10-08/asset-manifest.json`. Les cartes originales et les rendus de créatures et d’objets restent intacts. Aucun nouvel art généré n’a été ajouté.
- Bestiaire et Objets proposent des filtres multiples, des compteurs contextuels, des filtres actifs supprimables, une recherche, un tri et les vues grille/liste. Les choix d’un groupe sont réunis ; les groupes se combinent.
- Les fiches apparaissent à la sélection : panneau latéral sur grand écran, fiche modale sur écran compact. Les sources et butins connus relient réellement objets, créatures et carte. Les informations absentes du catalogue restent signalées comme absentes.
- Les filtres mobiles sont de vrais tiroirs opaques, accessibles au-dessus de la navigation. L’arrière-plan devient inactif et retrouve son état à la fermeture. Les infobulles, le partage et son champ de copie de secours fonctionnent au clavier ; Échap et la restauration du focus sont vérifiés.

## Vérification

`npm test` passe : syntaxe, catalogue, traduction, sécurité, géométrie/Leaflet, accès administrateur, archives et audits des ressources originales. Les tests PostgreSQL utilisent exclusivement PGlite local.

`node tools/verify-phase3-native.mjs` vérifie les quatre pages Accueil, Bestiaire, Objets et Carte à 360, 390, 768, 1280, 1920 et 2560 px, puis les interactions avec les composants réels. Les captures attendent le chargement des images visibles.

Voir `after-verification.json`, `after-checks-verification.json` et les captures `after-*.png`. Les captures `before-*.png` documentent l’état initial de cette intervention. `after-clip-verification.json` identifie une démonstration vidéo des interactions réelles, en 1280 × 720.

Exécution finale : **44 contrôles navigateur réussis**, 24 dispositions, 37 captures, aucune erreur JavaScript ou ressource locale manquante, aucune requête vers les décors retirés. La vidéo contrôlée dure 7,96 secondes.

## Limites et publication

Les contours déjà proposés sur la carte restent indicatifs tant qu’un administrateur ne les valide pas. Aucun taux, statistique de combat ou descriptif manquant n’a été inventé.

Un stress de navigations documentaires très rapprochées a également été examiné : Chromium peut signaler une transition native annulée (`AbortError: Transition was skipped`, sans pile JavaScript), sans perte de navigation, de fiche ou de cadrage. Une garde JavaScript testée en mémoire ne corrigeait pas ce signal ; elle n’a pas été ajoutée au produit. Les parcours SPA sont vérifiés depuis l’accueil avec conservation effective du document et du header, tandis que les accès directs sont contrôlés séparément. Les transitions restent une amélioration annulable, conformément au [modèle de la spécification W3C](https://www.w3.org/TR/css-view-transitions-1/#viewtransition).

Cette intervention modifie le workspace et sa prévisualisation ; aucun déploiement ni changement de la base Supabase distante n’a été effectué. La migration 008 déjà appliquée est inchangée. Les seeds actuels 005/006 sont régénérés ; leur application additive et la conservation des archives privées ont été testées localement. La suppression visuelle des archives est également imposée par le client, indépendamment de l’ancien état du serveur.

## Reproduire

```powershell
npm test
npm start
# Dans un second terminal, une fois les tests terminés :
node tools/verify-phase3-native.mjs
node tools/verify-phase3-native.mjs --clip-only
```

Les tests complets reconstruisent `_site` : terminer cette reconstruction avant les essais navigateur.
