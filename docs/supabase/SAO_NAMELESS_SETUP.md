# SAO-Nameless Supabase Setup

Objectif: repartir d'un projet Supabase vide nomme `SAO-Nameless`, sans reutiliser les anciennes donnees.

## Ce que couvre le SQL

Le fichier [SAO_NAMELESS_SCHEMA.sql](SAO_NAMELESS_SCHEMA.sql) cree:

- `user_profiles`
- `guild_planning`
- `guild_objectives`
- `guild_presence`
- `guild_activity_wall`
- `guild_chat`
- `messages`
- `market_orders` et `purchase_history` pour support HDV legacy uniquement
- le bucket Storage `iron-oath-storage`
- les fonctions `is_admin`, `is_guild_member`, `delete_user_completely`
- les triggers anti-escalade de role et `updated_at`
- les policies RLS de base

## Ordre d'installation

1. Creer le projet Supabase `SAO-Nameless`.
2. Ouvrir `SQL Editor`.
3. Coller et executer `docs/supabase/SAO_NAMELESS_SCHEMA.sql`.
4. Verifier que la requete finale liste des policies pour chaque table.
5. Dans Authentication, activer Email/Password.
6. Activer Microsoft/Azure OAuth seulement si les identifiants OAuth sont prets.
7. Dans Realtime, verifier que `guild_chat` est publie.
8. Dans Storage, verifier que le bucket `iron-oath-storage` existe et est public.
9. Ne modifier les cles frontend qu'apres validation de la Phase 2.

## Premier admin

Apres creation du premier compte depuis le site:

Si le site renvoie `403 Forbidden` sur `user_profiles` apres une connexion Microsoft, executer d'abord:

```sql
-- docs/supabase/SAO_NAMELESS_RLS_PATCH_004.sql
```

Si le projet a deja ete initialise avant le patch 002, executer d'abord:

```sql
-- docs/supabase/SAO_NAMELESS_RLS_PATCH_002.sql
```

```sql
update public.user_profiles
set role = 'admin'
where username = 'PSEUDO_A_REMPLACER';
```

Ensuite, les changements de role doivent passer par le dashboard admin ou par SQL Editor. Le client ne doit jamais pouvoir s'auto-promouvoir.

## Checks de securite

Verifier dans Supabase:

- RLS active sur toutes les tables publiques listees.
- Aucun secret `service_role` dans le repo frontend.
- La cle utilisee cote site est uniquement la cle anon/public.
- `delete_user_completely` est `security definer` et reserve aux admins via la fonction.
- Les DM de `guild_chat` ne sont lisibles que par expediteur/destinataire.
- `messages` ne laisse modifier que `read_at` aux destinataires.
- HDV reste hors SPA et hors navigation.

## Points observes dans le code actuel

- `auth-supabase.js` cree les profils avec `id = auth.users.id`.
- `profil.js` met a jour seulement `classe` et `niveau`.
- `espace-guilde.js`, `guild-chat.js` et `guild-dm.js` supposent que seuls `membre` et `admin` accedent aux espaces guilde.
- `admin-dashboard.js` appelle `delete_user_completely` avec le parametre `user_id`.
- `mailbox-supabase.js` contient encore une creation automatique de profil destinataire quand un pseudo n'existe pas. Le schema strict ne l'ouvre pas largement: il faudra remplacer ce comportement par une recherche explicite d'utilisateur existant, ou par une RPC controlee.
- `hdv.js` et `hdv-supabase.js` restent legacy et ne doivent pas etre integres a la SPA.

## Tests manuels minimum

1. Creer un compte joueur.
2. Confirmer que le profil apparait dans `user_profiles`.
3. Tenter de changer son propre `role` depuis le client: attendu, echec.
4. Promouvoir le compte en `admin` via SQL Editor.
5. Depuis le dashboard admin, passer un autre compte en `membre`.
6. Tester l'espace guilde avec un membre.
7. Tester un message public guilde.
8. Tester un DM guilde entre deux membres.
9. Tester une lecture de DM depuis un troisieme compte: attendu, aucun message.
10. Tester le profil: classe/niveau persistants.

## Limites restantes

- Le SQL n'est pas execute par Codex.
- Les cles Supabase ne sont pas modifiees dans `js/crypto-keys.js`.
- La suppression d'un compte dans `auth.users` doit passer par Supabase Admin API ou par une action serveur separee; elle ne doit pas etre faite depuis le frontend.
- Le bucket conserve le nom `iron-oath-storage` parce que le JavaScript existant l'utilise deja.
- Les pages connectees ne sont pas encore migrees en SPA dans cette phase.
