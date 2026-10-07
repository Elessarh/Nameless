# Nameless — audit et améliorations du 7 octobre 2026

## Résultat et périmètre

Le projet existant a été modifié et vérifié localement. HTML/CSS/JavaScript, Supabase, les illustrations, les catalogues, les comptes et les anciennes URLs sont conservés. Aucun push, déploiement, SQL de production, compte réel ou fichier utilisateur n'a été modifié. Les protections serveur ajoutées deviennent actives après la migration et le déploiement décrits ci-dessous.

L'audit a précédé les modifications : lecture de l'architecture et des fonctionnalités publiques et réservées, des schémas/policies/RPC/Edge Functions, des dépendances et de la documentation ; inspection du site public, de ses réponses HTTP et de trois pages avec Lighthouse. Les tests de permissions utilisent des comptes fictifs dans PostgreSQL embarqué, pas les policies actuelles du projet Supabase distant. Il s'agit d'un audit du code et d'une recette locale, pas d'un pentest exhaustif de l'infrastructure de production.

## Audit initial

### Architecture et fonctionnalités trouvées

| Élément | Existant identifié |
|---|---|
| Frontend | Site statique HTML/CSS/JS, routeur SPA progressif, traductions FR/EN, audio local et carrousel |
| Hébergement | GitHub Pages avec domaine Nameless devant Cloudflare |
| Backend | Supabase PostgreSQL/RLS/RPC, Auth Microsoft/Azure, Storage et Realtime |
| Rôles | Visiteur, `joueur`, `membre`, `admin` ; aucun rôle modérateur séparé |
| Routes | Accueil, carte, bestiaire, items, quêtes, wiki, connexion, profil, espace guilde, administration ; alias `pages/*.html` |
| Contenus publics | 60 créatures, 104 items, 125 étapes de quêtes, 55 articles wiki, carte sur trois paliers |
| Recherche existante | Filtres et recherches propres aux pages ; pas de recherche commune aux contenus |
| Espace membre | Planning des dix prochains événements, objectifs hebdomadaires, présence quotidienne, mur d'activité, chat et DM |
| Administration | Gestion des rôles/comptes, recherche et pagination d'affichage, événements, objectifs et publications |
| Minecraft | Pseudo/UUID public via PlayerDB, UUID unique ; parcours OAuth officiel conservé mais dormant |
| Discord/recrutement | Invitation Discord existante ; aucune synchronisation de rôle ou notification automatique |
| Legacy | HDV et anciennes messageries présents dans le code mais hors navigation active ; aucune réactivation |

Le planning, les rôles et le suivi niveau/classe existaient déjà. Ils ont été corrigés plutôt que dupliqués. Une préparation d'expédition partagée et un état de quête synchronisé exigeraient un modèle de participants/progression avec RLS ; ils restent des évolutions distinctes. Aucun guide, butin, prérequis ou lien de quête n'a été inventé pour compléter les données manquantes.

### Problèmes prioritaires

| Priorité | Constat | Conséquence / traitement |
|---|---|---|
| P1 sécurité | Identité, destinataire et visibilité de messages modifiables | Risque de détournement/publication d'un DM ; immutabilité serveur ajoutée |
| P1 sécurité | Signatures Storage très longues stockées en base | Accès persistant après partage du jeton ; nouveaux chemins et signatures de dix minutes |
| P1 sécurité | Protection locale des requêtes présentée comme une limite, avec proxy cassant des chaînes SDK | Le navigateur se contourne ; proxy retiré, budgets atomiques serveur |
| P1 sécurité | Rôles modifiables directement par le navigateur admin et invariant dernier admin incomplet | Passage obligé par Edge et protection transactionnelle en base |
| P1 stabilité | Chargement de profil attendu dans le callback Auth, caches privés et réponses asynchrones tardives | Risque de blocage SDK ou mélange de session ; callback synchrone et invalidation |
| P1 stabilité | Chat borné aux 100 plus anciens messages | Conversations récentes invisibles ; chargement des 100 derniers puis affichage chronologique |
| P1 UX | Dates UTC/locales et semaine ISO mal raccordées | Présences/jours/années erronés autour de minuit et du Nouvel An ; calendrier Europe/Paris |
| P1 UX | Modale admin hors contenu importé par SPA, collisions de fonctions globales et écouteurs accumulés | Édition cassée après navigation ; modale importable, namespaces et nettoyage |
| P1 performance | Illustrations lourdes, favicon de 2,2 Mo, cartes jusqu'à 9,76 Mo et marqueurs PNG en double | Format WebP, variantes mobiles, favicon léger, marqueurs adaptés, carte progressive |
| P1 SEO | `/wiki` et `/quetes` répondaient HTTP 404 sur le site public malgré le fallback SPA | Documents statiques pour les routes, sitemap et robots générés |
| P2 accessibilité | Modales, focus, hiérarchie de titres, filtres carte masqués au clavier, navigation wiki mobile | Interactions et styles corrigés, recette clavier et Lighthouse |

Aucun secret serveur actif n'a été démontré dans les fichiers inspectés. La clé Supabase publishable du frontend est une identité publique prévue par ce modèle d'accès ; elle ne remplace pas les permissions RLS.

### Couverture sécurité et limites

- XSS : contrôle des insertions DOM, échappement des données privées, validation des URL de média et CSP `script-src 'self'`. Les textes des catalogues versionnés restent des données locales de confiance. Les styles inline nécessaires à Leaflet restent autorisés.
- Injections : accès aux données par SDK/RPC paramétrés, contraintes et triggers PostgreSQL ; pas de backend NoSQL ni de SQL construit avec un champ de formulaire dans les parcours modifiés.
- IDOR, mass assignment et privilèges : tests de rôles, DM, objets Storage étrangers, participants immuables, rôle imposé par Edge et dernier admin.
- Uploads : chemins appartenant au compte, formats limités, 5 Mo, bucket privé, références étrangères et écrasement refusés. Il n'y a pas d'antivirus ni de décodage complet des octets côté serveur.
- CSRF/sessions : les actions Supabase utilisent un JWT explicite ; l'application n'utilise pas de cookie de session applicatif. Auth Microsoft et renouvellement restent gérés par Supabase. Les tokens de session du SDK demeurent accessibles au JavaScript : convertir en cookies HttpOnly exigerait un backend de session supplémentaire. La CSP et l'échappement réduisent ce risque sans prétendre l'annuler.
- SSRF/redirections : fournisseurs serveur fixes, validation de requêtes et origines ; le parcours Minecraft officiel dormant n'est pas certifié ni réactivé. La résolution publique d'un UUID ne prouve jamais sa propriété.
- Anti-abus : limites serveur sur messages, modifications, uploads et actions Edge. Recherche et favoris sont locaux, sans endpoint de recherche. Les quotas Auth Microsoft/Supabase, le CAPTCHA éventuel et la protection du CDN ne peuvent pas être vérifiés ou configurés depuis ce checkout.
- Logs : actions sensibles auditées avant exécution, refus si l'audit est indisponible ; pas de journalisation de JWT, clés ou corps de réponse OAuth.

## Changements effectués

### Sécurité, backend et base

Migration additive [004](supabase/SAO_NAMELESS_HARDENING_004.sql) : immutabilité des messages, dates serveur, budgets persistants, restrictions Storage, rôle via Edge, verrou du dernier admin, validation des classes modifiées et index du chat par auteur/date. Les cinq classes acceptées sont Shaman, Mage, Assassin, Guerrier et Archer. Une ancienne classe différente reste conservée et n'empêche pas une mise à jour d'un autre champ.

Les compteurs ne sont pas réinitialisés en supprimant messages ou fichiers. Limites : six envois/éditions par dix secondes, trente par minute et mille par heure ; dix uploads par minute et soixante par heure ; vingt changements de rôle et cinq suppressions admin par minute. Les requêtes Edge sont des objets JSON de 8 Ko maximum ; les confirmations doivent être des booléens. JWT et rôle sont contrôlés avant les actions ; CORS n'est pas une permission.

Les médias privés sont signés pour dix minutes à la lecture. Cache en mémoire par compte, purge à la déconnexion, ancienne URL interprétée comme chemin. Les anciens jetons de cinq ans déjà émis ne peuvent pas être révoqués rétroactivement par ce patch. Ils restent utilisables jusqu'à expiration ou retrait de l'objet ; aucun objet n'a été retiré.

La suppression Auth ne purge les fichiers qu'après un succès. Si Supabase refuse la suppression d'un propriétaire Storage, le code renvoie 409 et conserve ses fichiers. Cela exige une résolution ciblée avec sauvegarde dans l'administration Supabase ; aucune atomicité Storage/Auth n'est promise.

### Frontend et stabilité

Callbacks Auth sans attente bloquante, SDK épinglé local, caches bornés avec TTL propre à chaque clé, déduplication et protection contre les réponses d'une ancienne session. Nettoyage des timers/écouteurs/chat lors du démontage. Routeur corrige les courses entre navigations, les liens relatifs, les erreurs de chargement, le focus, les métadonnées et les query strings. Les événements de route atteignent réellement les modules de page.

Planning et présence utilisent Europe/Paris et l'année ISO correcte. Les dates inexistantes lors du passage à l'heure d'été sont rejetées. Validation stricte du niveau entier 1–100 et des classes, sauvegardes protégées contre les doubles clics, lookup Minecraft annulable et conservation de l'image d'activité lors d'une édition de texte.

### UX, accessibilité et contenus reliés

Palette globale et favoris, liens directs vers fiches, butins reliés aux items connus et sources dérivées du bestiaire. Les coordonnées de quêtes et zones connues ouvrent la carte. Wiki : ancres, fil d'Ariane, sommaire d'article, groupes clavier et panneau mobile avec focus, fermeture, restauration du défilement et contenu temporairement inactif.

Modales : focus initial, Tab, Échap et retour au déclencheur. Une palette ouverte au-dessus d'une fiche ne ferme plus la fiche et ne bloque plus Tab. Navigation mobile sans accumulation d'écouteurs, labels et feedbacks de formulaires, titres ordonnés, filtres carte accessibles au clavier, contraste du texte secondaire renforcé. Carrousel suspendable, slides inactives non interactives, respect de `prefers-reduced-motion`.

### Performance et SEO

WebP, fonds mobiles, dimensions conservées, lazy loading hors écran, préchargement des deux polices latines locales et du hero approprié. Les cartes complètes sont compressées sans perte. Le palier 1 commence par un aperçu adapté à l'écran puis charge la carte complète quand le zoom dépasse sa résolution ; les mêmes bounds et coordonnées sont conservés. Les marqueurs de 32–40 pixels utilisent des fichiers de 96 pixels et une seule URL commune avec les filtres.

Le build publie uniquement les dossiers publics autorisés et crée de vraies routes HTML, conservant les anciennes pages et les illustrations sources. Canonical, description, OpenGraph/Twitter, image de couverture, 404 compréhensible, sitemap public et exclusions des espaces privés. Les 18 boss ont chacun un document statique, une image existante, leurs métadonnées et un fil d'Ariane JSON-LD, lisibles par les robots de partage Discord sans JavaScript. L'administration, les profils, la guilde et la connexion restent volontairement non indexables.

## Nouvelles fonctionnalités effectivement ajoutées

1. Recherche globale de 403 entrées publiques, catégories, accents/casse, clavier et bouton mobile ; Ctrl/Cmd+K ouvre la palette.
2. Favoris sur le navigateur courant, jusqu'à 100 identifiants de contenu. Aucune synchronisation de compte n'est annoncée.
3. Liens partageables vers créatures, items et étapes de quêtes, relations entre les données disponibles.
4. Dix-huit fiches boss publiques, dont `/boss/illfang`, avec aperçu Discord spécifique et navigation vers bestiaire/carte/wiki.
5. Sommaire automatique et navigation accessible des articles du wiki.

## Tests exécutés

| Vérification | Résultat |
|---|---|
| `npm test` et syntaxe de tous les modules JS principaux | Réussite |
| Contenus et traductions FR/EN | 60 créatures ; 2 126 chaînes ; 13 pages d'entrée ; audits quêtes/carte réussis |
| Catalogue, liens, map et wiki mobile | 72 contrôles DOM réussis, y compris conflits palette/fiches et restauration du panneau |
| Sécurité | 26 contrôles réussis ; SQL appliqué deux fois dans PostgreSQL isolé ; RLS, validations, médias, limites, révocation et dernier admin |
| Dates guilde | Dix contrôles Paris/ISO/heure d'été réussis |
| Cache, routeur, recherche et erreurs réseau | Réussite, y compris réponse tardive après changement de session/navigation |
| Espace membre et admin | DOM contrôlé : modale SPA, onglets clavier, profil, planning et conservation d'image |
| Build boss | 186 contrôles sur 18 fiches |
| Artefact publié | 42 documents HTML ; 2 094 références locales, CSP dans head, anciennes URLs, sitemap/robots et exclusion des fichiers serveur validés |
| Dépendances npm | `npm audit` : zéro vulnérabilité signalée lors du contrôle |
| Contrôle navigateur | Huit pages, largeurs 360/390/768/1920/2560/3440, aucun débordement horizontal mesuré ; revue visuelle supplémentaire à 1440 |

Parcours navigateur confirmés : menu mobile ; recherche Illfang → fiche boss → carte ; changement de palier et filtre avec Espace ; wiki → article/sommaire ; palette au-dessus d'une fiche avec Tab/Échap ; recherche item depuis la page items déjà ouverte ; refus visiteur sur administration et espace guilde. Captures et mesures sont dans [verification](verification/).

Les parcours membre et admin avec vrais comptes, les JWT OAuth, le service Storage distant, les policies déployées et la concurrence multi-connexion restent à tester en recette Supabase. Aucune mutation de production n'a été utilisée comme test.

## Performance mesurée

Les scores et métriques sont détaillés dans [lighthouse-summary-2026-10-07.json](performance/lighthouse-summary-2026-10-07.json). Lighthouse 13.5.0 mobile, throttling simulé par défaut, un passage par route. Avant : domaine HTTPS de production ; après : recette HTTP locale avec compression gzip. **Les environnements diffèrent : ces chiffres ne constituent pas une mesure comparative d'un déploiement.** Les écarts de réseau/cache et la variabilité de Lighthouse comptent, en particulier pour la carte. INP réel non mesuré ; TBT est un indicateur de laboratoire distinct.

| Page | Perf. avant public | Perf. après local | Accessibilité | Bonnes pratiques | SEO | LCP local | CLS local |
|---|---:|---:|---:|---:|---:|---:|---:|
| Accueil | 70 | 91 | 100 | 100 | 100 | 3.53 s | 0.0058 |
| Wiki | 69 | 89 | 100 | 100 | 100 | 3.76 s | 0.0058 |
| Carte | 67 | 77 | 96 | 100 | 100 | 6.69 s | 0.0058 |
| Bestiaire | — | 90 | 100 | 100 | 100 | 3.61 s | 0.0073 |
| Items | — | 88 | 100 | 100 | 100 | 3.83 s | 0.0058 |
| Quêtes | — | 91 | 100 | 100 | 100 | 3.45 s | 0.0000 |
| Connexion | — | 94 | 100 | 100 | 69 | 3.16 s | 0.0058 |

La connexion est volontairement `noindex`, ce qui réduit son score SEO : elle n'a pas été rendue indexable pour améliorer un score. Les cibles 90+ performance ne sont pas atteintes partout. Avant l’aperçu progressif, une mesure intermédiaire locale de la carte donnait un LCP de 64,4 s ; la dernière mesure donne 6,7 s. Cela ne constitue pas une garantie de vitesse réelle sur le domaine distant. Les marqueurs proches se recouvrent à la vue d'ensemble de la carte ; recherche, filtres et zoom fournissent des accès précis. Un score automatisé ne certifie pas WCAG AA.

Gains de fichiers mesurables indépendamment du réseau :

| Ressource | Avant | Après |
|---|---:|---:|
| Carte complète palier 1 | 9,76 Mo | 8,38 Mo sans perte ; aperçu mobile chargé d'abord : 0,53 Mo |
| Carte palier 2 | 6,74 Mo | 2,53 Mo sans perte |
| Carte palier 3 | 2,60 Mo | 0,96 Mo sans perte |
| Hero principal | 2,32 Mo | 0,28 Mo en version desktop, variante mobile plus petite |
| Six marqueurs carte | 1,97 Mo, téléchargés deux fois avec des URLs différentes | Environ 26 Ko, une URL par marqueur |

Les sources artistiques originales restent présentes. Les variantes et leurs tailles sont consignées dans [asset-optimization-2026-10-07.json](performance/asset-optimization-2026-10-07.json).

## Migration, configuration et opérations manuelles

La migration 004 est préparée, **pas exécutée sur le projet distant**. Elle est transactionnelle, additive et n'efface aucune donnée. Les contraintes médias `NOT VALID` conservent les anciennes lignes et contrôlent les écritures suivantes. Les protections de classe acceptent les valeurs anciennes inchangées. Le build lui-même ne contacte pas la base.

Suivre [HARDENING_004_DEPLOYMENT.md](supabase/HARDENING_004_DEPLOYMENT.md), qui décrit prérequis, compatibilité et retour arrière. Vérifier les patches déjà installés ; ne pas réappliquer le schéma initial ni les anciens patches contradictoires. Une ancienne policy permissive d'un autre nom peut compléter les nouvelles : l'inventaire des policies distantes est indispensable.

Ce qui nécessite encore l'accès aux services concernés :

1. Sauvegarder et examiner le schéma, les policies et Storage actuels ; appliquer 004 en recette, vérifier les vrais rôles/DM/uploads/concurrence, puis en production.
2. Déployer `admin-user-actions`, puis publier le frontend via la workflow Pages. L'ordre est important : les nouveaux chemins de médias nécessitent 004. Garder les helpers de lecture compatibles en cas de retour arrière.
3. Confirmer `SERVICE_ROLE_KEY` dans les seuls secrets Edge ; `SUPABASE_URL` est fourni par Supabase. `ALLOWED_ORIGINS` est la seule nouvelle variable facultative, pour ajouter une origine de recette/local ; les domaines Nameless sont autorisés par défaut.
4. Appliquer les en-têtes HTTP sur Cloudflare selon [CSP_AND_HEADERS.md](security/CSP_AND_HEADERS.md), puis vérifier OAuth/images/Realtime/vidéos. La CSP meta est déjà incluse ; elle ne peut pas appliquer HSTS ou `frame-ancestors`.
5. Examiner les limites Auth et les anciennes signatures longues dans l'administration Supabase. Si une rotation de fichiers est décidée, préparer une migration sauvegardée des références ; ne pas supprimer des fichiers pour révoquer des jetons sans cette préparation.

Installation, commandes, structure et workflow sont dans [README.md](../README.md). Aucun changement Microsoft/Discord, nouveau secret Minecraft ou service d'indexation n'est requis pour les fonctionnalités ajoutées.

## Prochaines améliorations possibles — cinq maximum

1. **Prouver la propriété Minecraft** avant toute attribution de droits : résoudre l'enregistrement officiel Microsoft ou prévoir un challenge côté serveur Minecraft ; conserver UUID comme identifiant.
2. **Préparation d'expédition partagée** raccordée au planning existant : participants/rôles/checklist, avec RLS et confirmations simples ; c'est l'outil collectif à plus forte valeur.
3. **Progression des quêtes synchronisée** et checklist de palier, si les membres utilisent effectivement les favoris de préparation.
4. **Pagination serveur des membres admin** lorsque les effectifs justifient de ne plus charger la liste complète ; ajouter les index à partir des vraies requêtes et volumes.
5. **Mesurer les Core Web Vitals en production** après déploiement, puis décider de tuiler les cartes pour les zooms détaillés. L'aperçu progressif réduit déjà fortement leur chargement initial.

## Passe de cohérence demandée ensuite

L'accueil est désormais explicite sur SAO France, les boss, les quêtes et les outils du site. La signature Nameless est conservée. Douze cartes répétitives et leurs arguments de recrutement génériques ont été remplacées par trois étapes utiles (Discord, profil, planning). Les liens conduisent aux fonctions existantes, dont la fiche d'Illfang ; les chiffres du contenu viennent des catalogues.

CTA à 4–6 px, cartes de catalogue conservées seulement pour leurs unités de contenu, fiches boss en sections ouvertes, fonds de lecture opaques, halos et flous décoratifs réduits. Les textes sont visibles immédiatement ; les apparitions au scroll, l'entrée retardée du hero et son scintillement sont retirés. Recherche, favoris, pièces jointes et suppression utilisent des SVG cohérents ; les badges et contenus communautaires restent distincts des contrôles. Aucun faux témoignage, chiffre promotionnel ou label technologique n'a été ajouté. Le [guide visuel](NAMELESS_DIRECTION_VISUELLE.md) sert aux prochains changements.

Favicon SVG existant complété par un secours PNG 32 px et un masque d'onglet épinglé issu du monogramme. Footer commun sur toutes les pages avec deux documents factuels : confidentialité et conditions d'utilisation. Ils sont explicitement en brouillon, non indexés et exclus du sitemap. Les [coordonnées, durées, bases juridiques et configurations à valider](INFORMATIONS_LEGALES_A_VALIDER.md) restent à fournir par le responsable ; aucune conformité juridique n'est annoncée.

Cette passe a retrouvé un défaut manqué lors de l'audit précédent : le helper d'upload des DM portait le même nom global que celui du chat et créait encore une signature de cinq ans. Il utilise maintenant les chemins validés du helper commun, sous un nom distinct. Un test charge les deux modules ensemble et vérifie les uploads. La suite passe avec **26 contrôles sécurité**, **72 contrôles catalogue**, **13 pages traduites** et **42 documents du build**. Les signatures longues déjà émises restent une limite historique.

Les mesures du tableau principal correspondent à la première passe. Les nouvelles mesures après cette passe sont consignées séparément, pour ne pas présenter un ancien relevé comme la performance de la dernière version.

Dernière vérification de la passe : 56 contrôles de largeur sur sept pages (360, 390, 820, 1024, 1440, 1920, 2560 et 3440 px), sans débordement horizontal mesuré. Les liens de footer sont maintenant dégagés du lecteur audio sur mobile ; conditions et confidentialité ont été ouvertes en FR et EN. L'audio a été désactivé après les tests.

Les [nouveaux relevés Lighthouse locaux](performance/lighthouse-summary-coherence-2026-10-07.json) donnent 90 en performance pour l'accueil, le bestiaire et les quêtes ; 88 pour wiki et items ; 77 pour la carte. Accessibilité 100 sauf carte 96, bonnes pratiques 100, SEO public 100. La connexion reste volontairement non indexable (SEO 69). Même protocole de laboratoire, aucune garantie de résultat en production.
