# Carte et atelier — 19 octobre 2026

Cette passe poursuit la navigation et les retours d’état des cartes publique et administrative. Les images, contours, coordonnées et données partagées existants sont conservés.

## Navigation de la carte publique

- Une activation au clavier d’un résultat, d’une relation ou d’un bouton de région transfère le focus vers la fermeture visible de la fiche. La fermeture rend le focus à la carte.
- Les restaurations d’URL, changements de langue et relectures passives ne déplacent pas le focus vers une fiche. Une sélection différée ne reprend pas le focus si l’utilisateur l’a déplacé entre-temps.
- Les recherches avec et sans `q` synchronisent le champ, les résultats, la liste des régions et les polygones après Retour/Suivant. Le changement de palier nettoie aussi le filtre des régions.
- Un échec de chargement ne masque plus le résultat ayant lancé la sélection.

La recette Chromium a révélé qu’un jeton effacé dans un microtask de capture pouvait disparaître avant le gestionnaire cible d’un événement natif. Le bouton du rail transmet désormais directement sa source d’activation au pont de la carte ; la validation du focus reste dans la carte. Le parcours réel Tab → Entrée est vérifié en plus du test DOM.

## Atelier

- Le statut dépend d’un état explicite : brouillon privé, brouillon conservé, publication ou rechargement en cours, version publiée. Le texte « Aucune modification publiée » d’un enregistrement local ne peut plus être confondu avec un succès de publication.
- Une sélection vide efface le repère de travail, son historique et le mode de placement. Les actions devenues inutilisables sont désactivées.
- Le placement possède un état pressé visible et peut être désactivé par le même bouton ou avec Échap. Échap respecte les champs éditables, dialogues et événements déjà traités ; il n’altère pas les coordonnées.
- Les trois panneaux sont reliés à leurs onglets par leurs noms accessibles. Les boutons désactivés ne prennent plus l’apparence d’un survol actif. Les couleurs forcées et la réduction des mouvements sont respectées.
- Après un commit confirmé, une relecture publique en échec affiche l’avertissement de relecture au lieu d’affirmer que la carte est actualisée. Un rechargement partiel échoué ne renvoie plus un succès. Les deux lecteurs publics doivent explicitement signaler `ready`.

## Recette

Les scénarios d’écriture, de conflit, de permission et de panne de relecture sont exécutés sur le backend SQL/PGlite isolé via loopback. Le navigateur local utilise uniquement la lecture et des interactions temporaires de sélection/placement annulé ; aucune publication, suppression ou modification du profil distant n’est soumise.

- Nouvelle régression de navigation : 84 contrôles avec Leaflet, régions et données réels, dont les courses de focus et d’URL et le rejet d’une source non focalisée.
- Atelier UI : 52 contrôles ; relecture après commit : 21 contrôles SQL/Leaflet isolés.
- Suite complète `npm test -- --skip-browser` réussie après les derniers correctifs, y compris les 84 contrôles de navigation et les 21 contrôles de relecture SQL. Le test de disposition en navigateur CLI est explicitement omis ; ses catalogues ont été vérifiés dans la passe du 18 octobre, et les surfaces modifiées ici sont vérifiées en CUA.
- Compilation réussie : 13 routes, 14 fiches de boss et 1 530 entrées de recherche. Les quatre ressources modifiées `map.js`, `map-regions.js`, `map-workspace.js` et `map-workspace.css` correspondent exactement aux copies livrées dans `_site`. Les versions de cache sont synchronisées dans les pages directes et le registre SPA.
- CUA à 1 280 × 720 et 390 × 844 : Tab → Entrée sur le rail place le focus sur la fermeture visible de la fiche ; aucun ancêtre masqué ni débordement horizontal. La fermeture mesure 44 px et rend le focus à la carte. La recherche réelle « Sanglier » est restaurée par Retour et effacée par Suivant, avec retour de 1 à 12 régions.
- CUA atelier : navigation par flèches, Home et End entre les onglets ; état pressé du placement ; Échap rend le focus au bouton sans changer les deux coordonnées ; la sélection vide retire le point temporaire et désactive les actions. Le canevas mobile mesure 354 × 410 px. Aucune écriture distante soumise.
- Revue indépendante terminée sans anomalie restante. `git diff --check` sans erreur (les avertissements de conversion de fins de ligne du checkout Windows sont conservés).

Captures : [recherche et sélection mobile](map-selection-mobile.png), [région au clavier sur ordinateur](map-region-keyboard-desktop.png) et [mobile](map-region-keyboard-mobile.png), [atelier sur ordinateur](workspace-desktop.png) et [mobile](workspace-mobile.png), [placement actif](workspace-placement-desktop.png).

## Suite : démarrage et conservation du travail

Le démarrage attend désormais la fin réelle de l’initialisation de l’authentification. Une vérification en cours ne devient plus un faux message « service indisponible ». L’avertissement de publication partagée reste caché tant que la carte locale n’est pas réellement utilisable.

Une notification concernant le même compte relance la vérification de l’identité et du rôle sans reconstruire la carte ni perdre le repère non enregistré, le contour, le sommet sélectionné, le focus ou l’historique. Les outils et leurs API restent bloqués pendant cette vérification. La déconnexion, le changement de compte, la révocation et les résultats inconnus ferment toujours l’accès ; aucune permission n’est déduite d’un simple événement côté navigateur.

Les erreurs techniques d’authentification proposent Réessayer, au lieu de prétendre que le compte est déconnecté ou que son rôle a changé. Une carte qui ne s’initialise pas possède aussi un écran de reprise. L’activation au clavier de Réessayer retrouve son bouton après un échec, sans reprendre le focus si l’utilisateur l’a déplacé entre-temps. Les notifications passives n’ajoutent aucun transfert de focus.

Le retour d’opération se trouve maintenant hors des outils `inert` et du conteneur `aria-busy`. Sa barre reste visible en bas de l’atelier sur un écran de 1 280 × 720 ; la hauteur de la carte s’adapte à cette fenêtre. Le chargement possède une animation discrète, désactivée avec la réduction du mouvement, et les couleurs forcées restent prises en compte.

### Validation de cette suite

- Suite complète `npm test -- --skip-browser` réussie, puis régressions ciblées après les corrections issues de la recette : 113 contrôles d’authentification et de focus, 52 UI, 21 SQL et 28 de recette HTTP. La disposition en navigateur CLI reste explicitement remplacée par CUA.
- Les tests utilisent les vrais modules d’authentification, Leaflet et régions. Le serveur de recette utilise le SDK livré et SQL/PGlite en mémoire, une session fictive conservée en mémoire, une CSP limitée à la même origine et des écritures refusées. Il ne fait pas partie du site publié.
- CUA avec ce serveur isolé : attente de 8 secondes sans fausse alerte, récupération, erreur d’initialisation, atlas indisponible et rechargement de 5 secondes. Le message de progression est une région `status` sans ancêtre `inert` ni `aria-busy` ; à 720 px, il reste entièrement visible entre 663 et 705 px, y compris avec le bandeau de recette.
- CUA à 390 × 844 : deux écrans d’erreur sans débordement horizontal, Réessayer de 44 px et focus sur le bouton visible après Entrée. Le démarrage sur le serveur normal passe de « Vérification » à l’atelier, sans avertissement erroné. Sa relecture est uniquement une lecture des données partagées.
- Dernière compilation réussie ; les copies d’authentification, de l’atelier et de son CSS sont identiques aux sources. Cache `20261019auth1` synchronisé sur toutes les pages directes et le registre. Revue indépendante terminée et `git diff --check` sans erreur.

Captures : [démarrage en attente](workspace-auth-checking-desktop.png), [erreur de connexion mobile](workspace-auth-error-mobile.png), [erreur d’atlas mobile](workspace-map-error-mobile.png), [progression visible](workspace-refresh-progress.png) et [retour d’état sur le site normal](workspace-feedback-desktop.png).
