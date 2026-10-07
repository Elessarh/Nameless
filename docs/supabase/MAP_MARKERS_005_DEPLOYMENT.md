# Repères administrables de la carte — migration 005

Les fichiers de cette livraison sont préparés localement. Aucun SQL n’a été exécuté sur le projet Supabase réel, aucun compte de production n’a été interrogé et aucune clé serveur n’est nécessaire dans le navigateur.

## Ordre de mise en service

1. Sauvegarder le schéma, les policies, les triggers et les données actuels. Utiliser un projet Supabase de recette avec les mêmes migrations. Le schéma initial ne doit pas être relancé sur une base existante.
2. Vérifier les prérequis : `SAO_NAMELESS_SCHEMA.sql`, les grants/policies de `SAO_NAMELESS_SECURITY_PATCH_002.sql`, `SAO_NAMELESS_ADMIN_ACTIONS_PATCH.sql` et `SAO_NAMELESS_HARDENING_004.sql`. Conserver également les corrections RLS et Minecraft public décrites dans `HARDENING_004_DEPLOYMENT.md`. La migration 005 refuse de continuer si ses tables et helpers essentiels manquent.
3. Examiner puis exécuter `SAO_NAMELESS_MAP_MARKERS_005.sql` dans le SQL Editor de recette. C’est une transaction additive et idempotente : les erreurs annulent l’ensemble; elle ne réécrit aucun catalogue ou placement initial.
4. Examiner puis exécuter `SAO_NAMELESS_MAP_ENTITY_SEED_005.sql`, généré par le compilateur cartographique. Il enregistre seulement les clés, genres, paliers et types d’entités existantes. Aucune coordonnée, copie de contenu ou nouvelle entité n’est inventée. Un palier 3 sans entités reste vide.
5. Déployer les données compilées et le frontend ensemble après la migration et le seed. L’éditeur est chargé uniquement après vérification de la session et du rôle admin. Une migration absente garde l’éditeur indisponible; le site ne doit pas prétendre avoir enregistré un changement en localStorage.
6. Effectuer les vérifications ci-dessous en recette, puis appliquer le même ordre sur la production après examen des résultats et du SQL. Ce document ne constitue pas une preuve de déploiement.

## Modèle et autorisations

`map_entity_registry` est un registre de références vers les sources statiques. Les clés ont un préfixe `location:`, `quest:`, `guide:`, `npc:` ou `creature:` et une longueur maximale de 160 caractères. Le couple clé/palier est vérifié par une vraie FK sur le registre. Les lecteurs publics peuvent lire ce registre; seuls le backend privilégié et le SQL Editor le maintiennent. Les relations éditoriales et contenus détaillés restent dans les sources du compilateur.

`map_marker_overrides` contient seulement le placement ou état choisi par un admin. Les coordonnées `u` et `v` sont relatives à l’image : gauche vers droite et haut vers bas, de 0 à 1, indépendamment du zoom et du viewport. NaN et les infinis sont refusés. Un repère `visible` exige les deux coordonnées; `hidden` et `deleted` peuvent conserver un placement privé ou avoir des coordonnées nulles.

La table d’overrides n’a aucune permission de lecture anonyme. Les administrateurs authentifiés peuvent lire et écrire avec RLS `is_admin()`. Les joueurs ne peuvent ni lire les placements privés ni modifier ces lignes. Le rôle effectif suit la règle existante : `user_roles` prioritaire, puis `user_profiles`.

Le RPC public `read_map_marker_overrides()` retourne une projection étroite : identifiant, clé, palier, type et état; les coordonnées des lignes masquées ou supprimées sont toujours nulles. Il ne retourne aucun auteur ou timestamp. Il est accessible à `anon` et `authenticated` sans accorder à anon l’exécution de `is_admin()`.

Une ligne `hidden` ou `deleted` est un tombstone : le lecteur supprime le repère statique correspondant avant de dessiner la carte. Il ne faut pas fusionner uniquement les overrides visibles avec les pins d’origine. La seule opération qui supprime réellement une ligne d’override est **Rétablir le repère original**, ce qui réactive le placement statique s’il existe. Les coordonnées originales déjà publiées dans les fichiers statiques ne deviennent pas confidentielles par cette fonctionnalité; seules les positions privées de l’override sont exclues du RPC.

## Écriture, budget et audit

Le navigateur conserve un brouillon en mémoire. Cliquer sur l’image ou déplacer le marqueur de brouillon ne persiste rien; **Enregistrer**, **Masquer**, **Supprimer de la carte** ou **Rétablir le repère original** déclenchent explicitement une écriture. Le module vérifie à nouveau le JWT avec `auth.getUser`, le rôle serveur et la stabilité de la session avant cette écriture. Pendant une requête, les contrôles sont désactivés; navigation et déconnexion nettoient les écouteurs et le brouillon.

Le trigger serveur impose UUID, auteurs et dates de création/mise à jour. Identifiant, clé, palier et date/auteur de création restent immuables depuis le navigateur. Un backend privilégié peut maintenir des données sans JWT utilisateur; une requête `anon` ou `authenticated` sans UUID n’est jamais assimilée à de la maintenance. La suppression privilégiée d’un profil peut mettre sa référence d’auteur à null via la FK sans bloquer les autres données.

Un compteur privé partagé entre sessions limite les mutations réussies à **60 par minute et 300 par heure par administrateur**. Masquer, supprimer ou rétablir un repère consomme également ce budget. Supprimer un override ne supprime ni ne remet à zéro le compteur. Les UPSERT sérialisent les comptes; les appels concurrents réels restent à vérifier sur PostgreSQL de recette.

Chaque mutation écrit dans `admin_logs` dans la même transaction, avec l’action, le UUID du marqueur, la clé de l’entité et les anciennes/nouvelles coordonnées, type et état. Aucun JWT n’y est écrit. Un échec d’audit annule la mutation et son compteur. Les logs existants sont lisibles uniquement par les admins. La maintenance sans acteur utilisateur est auditée avec un acteur null.

## Vérifications

`node tools/test-map-admin.mjs` utilise PGlite et JSDOM avec des comptes fictifs, un faux SDK et un faux Leaflet. Ces tests ne font aucun appel réseau. Ils couvrent les RLS/grants, FK et paliers, coordonnées limites/NaN/infinis, auteurs imposés, tombstones publics, budgets, restauration et rollback de l’audit, ainsi que les brouillons, actions explicites, changement de compte/rôle, contrôles pending et nettoyage.

Compléter en recette Supabase et dans le navigateur :

- Un visiteur lit le registre et le RPC, mais reçoit un refus sur la table privée et ne reçoit aucune coordonnée de tombstone.
- Un joueur reçoit un refus sur les écritures et ne lit aucun override privé. Un admin voit et édite les lignes, y compris masquées.
- Une référence inconnue, un palier incorrect, NaN/infinis ou une position hors image échoue. Les erreurs ne modifient ni le repère ni l’audit.
- Cliquer puis glisser un brouillon ne change pas la carte dans une seconde session avant Enregistrer. Un repère masqué ou supprimé ne réapparaît pas lors du rechargement public. Rétablir le repère original retire le tombstone.
- Deux sessions du même admin partagent le budget. Tester 61 mutations rapides et le plafond horaire; supprimer puis recréer ne contourne pas la limite.
- Révoquer le rôle pendant l’édition bloque la prochaine mutation. Déconnexion/navigation nettoient les contrôles et une réponse tardive ne rouvre pas l’éditeur.
- Vérifier tous les paliers et formats d’image, y compris un palier 3 sans entités; les offsets du jeu et bounds de l’image restent distincts des coordonnées relatives.
- Vérifier l’inventaire réel `pg_policies`/grants et l’audit après chaque action. Ne pas déduire la réussite de déploiement du seul succès PGlite.

## Retour arrière

Avant commit, une erreur SQL annule la migration. Après utilisation, conserver la table et le RPC tant que des tombstones existent : un ancien frontend ignorant ces tombstones ferait réapparaître les pins statiques. Revenir au frontend précédent doit donc être évalué avec les overrides sauvegardés. Ne supprimer ni overrides, ni compteurs, ni logs pour annuler le parcours UI; conserver les données et l’audit pour une restauration contrôlée.
