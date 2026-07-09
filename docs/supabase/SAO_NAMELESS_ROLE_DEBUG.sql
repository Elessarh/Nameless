-- ============================================================
-- SAO Nameless - Role / Admin / Guild access debug
-- ============================================================
-- Usage:
-- 1. Run in Supabase SQL Editor.
-- 2. Replace USER_ID and ADMIN_ID with real auth.users UUIDs.
-- 3. Do not paste service_role keys, database passwords, or client secrets.
--
-- Roles used by the site:
-- - joueur : connected player, can fill the public player sheet.
-- - membre : guild member, can access the guild player panel.
-- - admin  : administrator, can access admin dashboard and guild panel.
--
-- Important:
-- The frontend and RLS checks use public.current_user_role().
-- That function reads public.user_roles first, then falls back to
-- public.user_profiles.role. If these two tables are out of sync, the UI can
-- display one role while Supabase policies enforce another one.

-- ------------------------------------------------------------
-- 0. Parameters
-- ------------------------------------------------------------
-- Replace USER_ID and ADMIN_ID below with real UUIDs.
-- If you forget to replace them, the script will not crash; targeted checks
-- will simply return no row / simulate the nil UUID.
drop table if exists pg_temp.nameless_role_debug_params;
create temp table nameless_role_debug_params as
select
  nullif('USER_ID', 'USER_ID')::uuid as user_id,
  nullif('ADMIN_ID', 'ADMIN_ID')::uuid as admin_id;

-- Find real UUIDs to copy into the block above.
select
  u.id,
  u.email,
  p.username,
  p.role as profile_role,
  r.role as user_roles_role,
  coalesce(r.role, p.role, 'missing_profile') as effective_role,
  u.created_at as auth_created_at
from auth.users u
left join public.user_profiles p on p.id = u.id
left join public.user_roles r on r.user_id = u.id
order by u.created_at desc;

-- ------------------------------------------------------------
-- 1. Inspect one user role state
-- ------------------------------------------------------------
select
  p.id,
  u.email,
  p.username,
  p.role as profile_role,
  r.role as user_roles_role,
  coalesce(r.role, p.role, 'joueur') as effective_role,
  p.minecraft_username,
  p.minecraft_uuid,
  p.minecraft_verified,
  p.created_at,
  p.updated_at
from public.user_profiles p
left join auth.users u on u.id = p.id
left join public.user_roles r on r.user_id = p.id
where p.id = (select user_id from pg_temp.nameless_role_debug_params);

-- ------------------------------------------------------------
-- 2. List mismatches that can cause admin/guild access bugs
-- ------------------------------------------------------------
select
  p.id,
  u.email,
  p.username,
  p.role as profile_role,
  r.role as user_roles_role,
  coalesce(r.role, p.role, 'joueur') as effective_role,
  case
    when r.user_id is null then 'missing user_roles row'
    when r.role is distinct from p.role then 'profile/user_roles mismatch'
    else 'ok'
  end as status
from public.user_profiles p
left join auth.users u on u.id = p.id
left join public.user_roles r on r.user_id = p.id
where r.user_id is null
   or r.role is distinct from p.role
order by p.updated_at desc nulls last, p.created_at desc;

-- ------------------------------------------------------------
-- 3. Simulate the role seen by RLS for a normal authenticated user
-- ------------------------------------------------------------
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claim.sub',
    coalesce((select user_id::text from pg_temp.nameless_role_debug_params), '00000000-0000-0000-0000-000000000000'),
    true
  );
  select set_config('request.jwt.claim.role', 'authenticated', true);

  select
    auth.uid() as simulated_auth_uid,
    public.current_user_role() as current_user_role,
    public.can_access_guild() as can_access_guild,
    public.is_admin() as is_admin;

  -- Expected:
  -- - joueur: current_user_role = joueur, guild/admin false.
  -- - membre: current_user_role = membre, guild true, admin false.
  -- - admin:  current_user_role = admin, guild true, admin true.
rollback;

-- ------------------------------------------------------------
-- 4. Simulate admin dashboard access checks
-- ------------------------------------------------------------
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claim.sub',
    coalesce((select admin_id::text from pg_temp.nameless_role_debug_params), '00000000-0000-0000-0000-000000000000'),
    true
  );
  select set_config('request.jwt.claim.role', 'authenticated', true);

  select public.current_user_role() as admin_effective_role;
  select count(*) as visible_profiles from public.user_profiles;
  select count(*) as visible_admin_logs from public.admin_logs;
rollback;

-- ------------------------------------------------------------
-- 5. Simulate guild member access checks
-- ------------------------------------------------------------
begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claim.sub',
    coalesce((select user_id::text from pg_temp.nameless_role_debug_params), '00000000-0000-0000-0000-000000000000'),
    true
  );
  select set_config('request.jwt.claim.role', 'authenticated', true);

  select public.current_user_role() as guild_effective_role;
  select count(*) as visible_planning from public.guild_planning;
  select count(*) as visible_objectives from public.guild_objectives;
  select count(*) as visible_presence from public.guild_presence;
  select count(*) as visible_activity from public.guild_activity_wall;
rollback;

-- ------------------------------------------------------------
-- 6. Safe role repair examples for SQL Editor only
-- ------------------------------------------------------------
-- Promote first admin from SQL Editor:
-- update public.user_profiles
-- set role = 'admin'
-- where id = 'ADMIN_ID'::uuid;
--
-- If user_roles is still missing or stale, repair the mirror explicitly:
-- insert into public.user_roles (user_id, role, assigned_by)
-- values ('ADMIN_ID'::uuid, 'admin', null)
-- on conflict (user_id) do update
-- set role = excluded.role,
--     assigned_by = excluded.assigned_by,
--     updated_at = now();
--
-- Promote a guild member from SQL Editor:
-- update public.user_profiles
-- set role = 'membre'
-- where id = 'USER_ID'::uuid;
--
-- Mirror repair for a member:
-- insert into public.user_roles (user_id, role, assigned_by)
-- values ('USER_ID'::uuid, 'membre', null)
-- on conflict (user_id) do update
-- set role = excluded.role,
--     assigned_by = excluded.assigned_by,
--     updated_at = now();

-- ------------------------------------------------------------
-- 7. Final consistency check after repair
-- ------------------------------------------------------------
select
  p.id,
  u.email,
  p.username,
  p.role as profile_role,
  r.role as user_roles_role,
  coalesce(r.role, p.role, 'joueur') as effective_role
from public.user_profiles p
left join auth.users u on u.id = p.id
left join public.user_roles r on r.user_id = p.id
where p.id in (
  select user_id from pg_temp.nameless_role_debug_params where user_id is not null
  union all
  select admin_id from pg_temp.nameless_role_debug_params where admin_id is not null
)
order by effective_role desc, p.username;
