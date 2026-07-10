-- SAO Nameless - Admin actions support patch
-- Date: 2026-07-09
--
-- Support pour l'Edge Function admin-user-actions (update_role, delete_user).
-- À exécuter manuellement dans le SQL Editor, APRÈS SAO_NAMELESS_SCHEMA.sql.
-- Idempotent.
--
-- Note : il n'existe pas de vérification officielle Minecraft. La colonne
-- user_profiles.minecraft_verified reste en base pour compatibilité mais
-- n'est plus utilisée par l'UI ; le trigger anti-escalade continue de
-- bloquer sa modification par un joueur.
--
-- Rappels sécurité :
-- - la fonction Edge utilise SERVICE_ROLE_KEY côté serveur uniquement ;
-- - aucun de ces objets ne donne d'accès à anon ;
-- - un joueur ne peut jamais modifier role ou minecraft_verified lui-même
--   (trigger prevent_profile_privilege_escalation + policies RLS).

-- ------------------------------------------------------------
-- 1. user_roles : unicité de user_id
-- ------------------------------------------------------------
-- Le schéma déclare user_id en PRIMARY KEY (donc unique). Ce bloc ne crée
-- l'index qu'en réparation, si la table a été créée autrement.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_roles'::regclass
      and contype in ('p', 'u')
      and conkey = (
        select array_agg(attnum)
        from pg_attribute
        where attrelid = 'public.user_roles'::regclass
          and attname = 'user_id'
      )
  ) then
    create unique index if not exists user_roles_user_id_uidx
      on public.user_roles (user_id);
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 2. current_user_role() et grants (utilisés par le front pour l'affichage
--    et par RLS ; l'Edge Function refait son propre contrôle côté serveur)
-- ------------------------------------------------------------
grant usage on schema public to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_access_guild() to authenticated;

revoke all on function public.current_user_role() from anon;
revoke all on function public.is_admin() from anon;
revoke all on function public.can_access_guild() from anon;

-- ------------------------------------------------------------
-- 3. admin_logs : audit des actions admin
-- ------------------------------------------------------------
-- La table est créée par SAO_NAMELESS_SCHEMA.sql. L'Edge Function écrit avec
-- le service role (bypass RLS) ; les policies ci-dessous couvrent seulement
-- la lecture/écriture éventuelle depuis le front par un admin connecté.
alter table public.admin_logs enable row level security;

drop policy if exists "admins read admin logs" on public.admin_logs;
create policy "admins read admin logs" on public.admin_logs
for select to authenticated using (public.is_admin());

drop policy if exists "admins insert admin logs" on public.admin_logs;
create policy "admins insert admin logs" on public.admin_logs
for insert to authenticated with check (public.is_admin() and actor_id = auth.uid());

-- ------------------------------------------------------------
-- 4. Vérifications (lecture seule)
-- ------------------------------------------------------------
-- a) user_id bien unique :
-- select conname, contype
-- from pg_constraint
-- where conrelid = 'public.user_roles'::regclass;
--
-- b) Aucun droit anon sur les tables sensibles :
-- select table_name, grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and grantee = 'anon'
--   and table_name in ('user_profiles', 'user_roles', 'admin_logs');
-- (résultat attendu : zéro ligne, ou uniquement des droits neutralisés par RLS)
--
-- c) Un joueur ne peut pas s'auto-vérifier :
-- begin;
--   set local role authenticated;
--   select set_config('request.jwt.claim.sub', '<UUID_JOUEUR>', true);
--   update public.user_profiles set minecraft_verified = true
--   where id = '<UUID_JOUEUR>'::uuid;
--   -- attendu : exception "minecraft verification requires admin validation"
-- rollback;
