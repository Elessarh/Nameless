# Durcissement du 7 octobre 2026

Le fichier `SAO_NAMELESS_HARDENING_004.sql` est une migration additive pour la
base existante. Il ne supprime ni comptes, ni messages, ni objets Storage. Les
tests ont utilisé PostgreSQL embarqué PGlite avec des comptes fictifs, jamais
le projet de production. La concurrence multi-connexion et la suppression
Auth réelle restent à vérifier dans un projet de recette Supabase.

## Ordre de mise en service

1. Exporter le schéma, les policies, les données et la configuration Storage
   actuels. Examiner `pg_policies` : une ancienne policy permissive avec un
   autre nom peut s'ajouter aux nouvelles règles. Ne pas relancer le schéma
   initial sur une production déjà configurée.
2. Vérifier que les objets des migrations précédentes existent : schéma de
   base, `RLS_PATCH_003`, `SECURITY_PATCH_002`,
   `MINECRAFT_PUBLIC_LINK_PATCH`, `ADMIN_ACTIONS_PATCH`. Les patches RLS 001/002
   et le patch Minecraft strict sont historiques et ne doivent pas être
   réappliqués après le patch Minecraft public.
3. Exécuter `SAO_NAMELESS_HARDENING_004.sql` en recette, puis en production après
   les vérifications ci-dessous. La transaction échoue entièrement en cas
   d'erreur. Les contraintes d'image `NOT VALID` préservent les anciennes
   lignes et s'appliquent aux nouvelles écritures.
4. Déployer `admin-user-actions`, puis le frontend. Le frontend stocke désormais
   le chemin des nouveaux médias : ses écritures nécessitent la migration 004.
   L'ancien frontend utilisant des URL reste accepté pendant cette transition.
   Ne pas réactiver `link-minecraft`, dont le parcours officiel est dormant.
5. Vérifier les versions des fichiers statiques et conserver le SDK Supabase
   local épinglé. Tester les comptes visiteur, joueur, membre et admin.

## Protections ajoutées

- Les nouvelles classes de profil sont validées côté serveur : Shaman, Mage,
  Assassin, Guerrier ou Archer. Une ancienne valeur différente inchangée reste
  compatible lors de la mise à jour d'un autre champ ; aucune ligne n'est réécrite.

- Les changements de rôle provenant du navigateur, y compris d'un admin,
  passent obligatoirement par l'Edge Function existante. Le SQL Editor et le
  backend continuent à pouvoir maintenir les rôles. Le dernier admin ne peut
  être rétrogradé ou supprimé, y compris par une cascade Auth concurrente.
- Les participants, l'identifiant, la visibilité et la date d'un message
  sont immuables. Le destinataire d'un `private_messages` peut seulement
  modifier sa lecture. Les messages système sont réservés aux admins.
- Des compteurs privés persistants limitent les créations et éditions du chat : 6 messages par
  10 secondes, 30 par minute et 1 000 par heure ; 10 uploads par minute et
  60 par heure. Supprimer une ligne ou un fichier ne remet pas le budget à
  zéro. Les UPSERT PostgreSQL sérialisent les créations concurrentes.
- L'Edge Function limite chaque admin à 20 changements de rôle et
  5 suppressions par minute. L'ancien démarrage Minecraft, s'il est appelé
  explicitement, est limité à 6 par minute.
- Le bucket reste privé, limité à PNG/JPEG/WebP et 5 Mo. Les lecteurs
  autorisés peuvent signer les images publiques de guilde et celles de leurs
  propres DM. La référence à l'objet d'un autre auteur est refusée à l'écriture.
  Les fichiers ne sont pas remplacés sur place.
- Le navigateur conserve seulement les nouveaux chemins en base et demande
  des signatures de 10 minutes à la lecture. Les anciennes URL signées sont
  interprétées comme chemins. Le cache de signatures est en mémoire, lié au
  compte connecté, et vidé à la déconnexion.

Une signature de cinq ans **déjà émise** reste utilisable jusqu'à son expiration
ou la suppression de l'objet. Cette migration ne peut pas révoquer
rétroactivement ces jetons. Ne pas supprimer d'objets pour les révoquer sans
préparer une migration sauvegardée des fichiers et de leurs références.

## Configuration Edge

`SERVICE_ROLE_KEY` reste côté serveur. `SUPABASE_URL` est fourni par Supabase.
La nouvelle variable facultative `ALLOWED_ORIGINS` contient les origines
autorisées séparées par des virgules ; par défaut :
`https://nameless-sao.fr,https://www.nameless-sao.fr`.
Ajouter explicitement une origine de recette ou locale si nécessaire. Un
appel serveur sans header Origin reste possible avec un JWT valide ; CORS ne
remplace jamais la vérification JWT et du rôle.

Les requêtes JSON sont limitées à 8 Ko, doivent être des objets, et les
confirmations sont des booléens. Les réponses sont `no-store`, `nosniff` et
`no-referrer`. Les actions sensibles ont une entrée d'audit préalable ; si
l'audit est indisponible, l'action est refusée. Les secrets et corps de réponse
des fournisseurs ne sont pas journalisés.

## Vérifications de recette

Exécuter `npm test` ; les tests de sécurité couvrent aussi la migration dans
une base PostgreSQL isolée. Puis vérifier avec des comptes de recette :

- Un joueur ne lit pas les messages de guilde et ne peut pas changer son rôle.
- Deux membres échangent un DM avec image ; un troisième membre ne lit ni le
  DM ni son objet Storage. Une révocation de rôle bloque les nouvelles lectures
  et signatures ; une signature déjà émise peut rester valable dix minutes.
- L'auteur ne transforme pas un DM en message public et ne change pas son
  destinataire. Modifier `read_at` reste possible sur `private_messages`.
- Plus de 100 messages : les 100 derniers s'affichent dans l'ordre chronologique.
- Envoi puis suppression répétés et upload puis suppression répétés sont
  limités. Deux sessions simultanées partagent le même budget serveur.
- Un admin met à jour le rôle d'un autre compte via le dashboard. Le retrait du
  dernier admin échoue depuis deux sessions concurrentes et depuis Auth.
- Une suppression Auth refusée conserve tous les fichiers. Supabase peut
  refuser la suppression d'un compte propriétaire de fichiers : le code renvoie
  alors un 409 et ne purge rien. Résoudre ce cas dans l'administration Supabase
  après sauvegarde, sans promettre une suppression atomique Storage/Auth.

La liaison Minecraft actuelle reste une déclaration publique : PlayerDB
confirme un pseudo/UUID existant, sans preuve de propriété. L'unicité de l'UUID
évite les doublons mais ne supprime pas le risque d'usurpation. Ne pas afficher
ce statut comme vérifié et ne pas l'utiliser pour attribuer des droits.

## Retour arrière

Avant mise en service, une erreur SQL annule toute la transaction. Après mise
en service, conserver le patch et les helpers média compatibles tant que des
chemins ont été écrits ; revenir à un ancien lecteur qui attend uniquement des
URL ferait disparaître ces nouvelles images. Les modifications UX peuvent être
reverties séparément. Restaurer policies/triggers depuis l'export initial doit
être évalué en recette : cela retire les protections, mais ne nécessite aucune
suppression de données. Ne pas réappliquer le schéma initial pour annuler le patch.
