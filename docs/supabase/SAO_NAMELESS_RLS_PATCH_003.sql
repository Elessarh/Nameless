-- SAO Nameless RLS Patch 003
-- Purpose:
-- - fix 403 errors on user_profiles for authenticated Microsoft users;
-- - allow a normal player to read/create/update their own profile through RLS;
-- - keep role escalation blocked by the existing privilege guard trigger.

grant usage on schema public to authenticated;
grant select, insert, update on public.user_profiles to authenticated;

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

-- Verification helpers:
--
-- select policyname, cmd, roles, qual, with_check
-- from pg_policies
-- where schemaname = 'public' and tablename = 'user_profiles'
-- order by policyname;
--
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name = 'user_profiles'
--   and grantee = 'authenticated'
-- order by privilege_type;
