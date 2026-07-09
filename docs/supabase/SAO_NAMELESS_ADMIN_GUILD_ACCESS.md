# SAO Nameless — Accès admin et guilde : référence officielle

Date : 2026-07-09
Projet Supabase : `iwrvdntlrjnoqzbwbsfm`

## 1. Le modèle de rôle (à lire en premier)

Le site utilise trois rôles : `joueur`, `membre`, `admin`.

Le rôle est stocké à **deux endroits** :

| Table | Colonne | Rôle dans le système |
|---|---|---|
| `public.user_profiles` | `role` | Fiche joueur affichée ; source de secours |
| `public.user_roles` | `role` | Source **prioritaire** pour RLS et RPC |

La fonction qui décide de tout est `public.current_user_role()` :

```sql
coalesce(
  (select role from user_roles  where user_id = auth.uid()),  -- gagne toujours
  (select role from user_profiles where id = auth.uid()),     -- secours
  'anon'
)
```

**Règle critique : si `user_roles.role` existe, il GAGNE sur `user_profiles.role`.**
Si tu mets `admin` dans `user_profiles` mais que `user_roles` contient encore
`joueur`, le site affichera peut-être un badge admin, mais Supabase (RLS, RPC,
dashboard, espace guilde) refusera l'accès. C'est la cause n°1 des accès
« incohérents ».

## 2. Qui lit quoi

- **Front (affichage uniquement)** : `user_profiles.role` pour les badges et la
  visibilité des boutons « Dashboard admin » / « Espace guilde » sur le profil.
  Purement cosmétique — ne donne aucun droit.
- **Front (contrôle d'accès des pages)** : `supabase.rpc('current_user_role')`
  dans `admin-dashboard.js`, `espace-guilde.js`, `guild-chat.js`, `guild-dm.js`.
- **RLS / RPC (autorité réelle)** : `current_user_role()`, `is_admin()`,
  `is_member()`, `can_access_guild()` — toutes basées sur `user_roles` d'abord.

Aucune décision de sécurité ne repose sur localStorage, sessionStorage, ou le
rôle affiché côté client.

## 3. Rendre un utilisateur admin (procédure correcte)

Dans le SQL Editor Supabase (jamais depuis le front) :

```sql
-- 1. Trouver l'UUID
select u.id, u.email, p.username
from auth.users u
left join public.user_profiles p on p.id = u.id
order by u.created_at desc;

-- 2. Mettre à jour LES DEUX tables
update public.user_profiles
set role = 'admin'
where id = 'UUID_ICI'::uuid;

insert into public.user_roles (user_id, role, assigned_by)
values ('UUID_ICI'::uuid, 'admin', null)
on conflict (user_id) do update
set role = excluded.role,
    assigned_by = excluded.assigned_by,
    updated_at = now();
```

Note : le trigger `trg_user_profiles_role_sync` synchronise normalement
`user_profiles.role` → `user_roles` automatiquement. L'upsert explicite couvre
les cas où le trigger n'était pas encore installé quand le rôle a été modifié.

## 4. Rendre un joueur membre de la guilde

Même procédure avec `'membre'` à la place de `'admin'` :

```sql
update public.user_profiles
set role = 'membre'
where id = 'UUID_ICI'::uuid;

insert into public.user_roles (user_id, role, assigned_by)
values ('UUID_ICI'::uuid, 'membre', null)
on conflict (user_id) do update
set role = excluded.role,
    assigned_by = excluded.assigned_by,
    updated_at = now();
```

Depuis le site : un admin peut aussi le faire via Dashboard admin → onglet
Utilisateurs → « Modifier rôle ». Ce chemin met à jour les deux tables.

## 5. Tables et objets nécessaires

Le fonctionnement admin/guilde exige que ces objets existent (créés par
`SAO_NAMELESS_SCHEMA.sql`) :

- Tables : `user_profiles`, `user_roles`, `guild_planning`, `guild_objectives`,
  `guild_presence`, `guild_activity_wall`, `guild_chat`, `private_messages`,
  `messages`, `admin_logs`.
- Fonctions : `current_user_role()`, `is_admin()`, `is_member()`,
  `can_access_guild()`, `delete_user_completely()`, `write_admin_log()`.
- Triggers : `trg_user_profiles_privilege_guard` (anti auto-promotion),
  `trg_user_profiles_role_sync` (sync profils → user_roles),
  `trg_user_roles_guard` (user_roles modifiable seulement par admin),
  `on_auth_user_created` (création auto du profil à l'inscription).
- Grants : voir `SAO_NAMELESS_SECURITY_PATCH_002.sql` (sans les grants,
  `authenticated` reçoit des erreurs `permission denied` même avec RLS OK).
- Storage : bucket privé `iron-oath-storage` avec policies sur les chemins
  `chat/<user_id>/...` et `guild-activities/<user_id>/...`.

Si `current_user_role()` n'existe pas, TOUTES les pages protégées affichent
« Erreur Supabase : voir console » avec `current_user_role_failed` en console.
Dans ce cas, exécuter `SAO_NAMELESS_SCHEMA.sql` puis les patches.

## 6. Ordre d'application des scripts SQL

1. `SAO_NAMELESS_SCHEMA.sql` — base complète (idempotent).
2. `SAO_NAMELESS_RLS_PATCH_003.sql` — accès profil des utilisateurs Microsoft.
3. `SAO_NAMELESS_SECURITY_PATCH_002.sql` — dernier patch sécurité :
   lecture des profils restreinte, DM guilde verrouillés, grants.
4. `SAO_NAMELESS_MINECRAFT_PUBLIC_LINK_PATCH.sql` — colonnes Minecraft
   publiques + garde anti `minecraft_verified` côté client.

`SAO_NAMELESS_RLS_PATCH_004.sql` n'existe pas : le patch le plus récent est
`SECURITY_PATCH_002` (appliqué après `RLS_PATCH_003`).

## 7. Diagnostic

Utiliser `docs/supabase/SAO_NAMELESS_ROLE_DEBUG.sql` :

- section 0 : liste tous les comptes avec `profile_role`, `user_roles_role` et
  le rôle effectif vu par RLS ;
- section 2 : liste les désynchronisations profil/user_roles (cause n°1) ;
- sections 3-5 : simulent exactement ce que voit RLS pour un UUID donné ;
- section 6 : requêtes de réparation prêtes à copier.

Symptômes → causes :

| Symptôme | Cause probable |
|---|---|
| Badge admin visible mais dashboard refusé | `user_roles.role` ≠ `admin` |
| « Accès admin requis. Rôle admin non détecté côté Supabase. » | idem, ou patch grants manquant |
| « Erreur Supabase : voir console » + `current_user_role_failed` | fonction RPC absente → exécuter SCHEMA |
| Espace guilde refusé à un membre | `user_roles.role` ≠ `membre`/`admin` |
| Contenus guilde vides mais accès OK | policies `can_access_guild()` absentes → SCHEMA + PATCH_002 |
| Upload image chat/mur en erreur | bucket/policies storage absents ou chemin non conforme |
