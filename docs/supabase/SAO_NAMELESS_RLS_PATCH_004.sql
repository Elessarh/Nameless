-- SAO Nameless RLS Patch 004
-- Purpose:
-- - repair persistent 403 Forbidden responses on public.user_profiles;
-- - reapply the minimal grants needed by authenticated browser users;
-- - reload the PostgREST schema cache used by Supabase REST.
--
-- Safe intent:
-- - anonymous users still get no table privileges on user_profiles;
-- - normal users can only insert/update their own profile through RLS;
-- - role escalation remains blocked by prevent_profile_privilege_escalation().

grant usage on schema public to anon, authenticated;

grant select, insert, update on table public.user_profiles to authenticated;
grant select on table public.user_roles to authenticated;

alter table public.user_profiles enable row level security;

drop policy if exists "profiles authenticated read" on public.user_profiles;
create policy "profiles authenticated read" on public.user_profiles
for select to authenticated
using (true);

drop policy if exists "profiles insert own" on public.user_profiles;
create policy "profiles insert own" on public.user_profiles
for insert to authenticated
with check (id = auth.uid() and role = 'joueur');

drop policy if exists "profiles update own safe fields" on public.user_profiles;
create policy "profiles update own safe fields" on public.user_profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "profiles admin update" on public.user_profiles;
create policy "profiles admin update" on public.user_profiles
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "profiles admin delete" on public.user_profiles;
create policy "profiles admin delete" on public.user_profiles
for delete to authenticated
using (public.is_admin());

notify pgrst, 'reload schema';

-- Expected verification results after running this patch:
--
-- 1) The authenticated role must have SELECT, INSERT and UPDATE:
--
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name = 'user_profiles'
--   and grantee = 'authenticated'
-- order by privilege_type;
--
-- 2) The policies must include authenticated read, insert own and update own:
--
-- select policyname, cmd, roles, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename = 'user_profiles'
-- order by policyname;
