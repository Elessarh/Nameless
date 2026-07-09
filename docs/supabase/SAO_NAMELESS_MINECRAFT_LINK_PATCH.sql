-- SAO Nameless - Minecraft account linking profile patch
-- Date: 2026-07-09
--
-- Apply manually in the Supabase SQL editor after SAO_NAMELESS_SCHEMA.sql.
-- This patch prepares verified Minecraft identity storage without trusting
-- browser-supplied usernames, UUIDs, or Microsoft user_metadata claims.

begin;

-- 1) Profile columns.
alter table public.user_profiles
  add column if not exists minecraft_username text,
  add column if not exists minecraft_uuid text,
  add column if not exists minecraft_verified boolean,
  add column if not exists minecraft_avatar_url text,
  add column if not exists minecraft_skin_url text,
  add column if not exists minecraft_linked_at timestamptz,
  add column if not exists microsoft_provider_id text;

alter table public.user_profiles
  alter column minecraft_verified set default false;

update public.user_profiles
set minecraft_verified = false
where minecraft_verified is null;

alter table public.user_profiles
  alter column minecraft_verified set not null;

create unique index if not exists user_profiles_minecraft_uuid_uidx
  on public.user_profiles (minecraft_uuid)
  where minecraft_uuid is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_mc_username_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_mc_username_check
      check (minecraft_username is null or minecraft_username ~ '^[A-Za-z0-9_]{3,16}$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_mc_uuid_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_mc_uuid_check
      check (minecraft_uuid is null or minecraft_uuid ~* '^[0-9a-f]{32}$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_mc_avatar_url_safe_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_mc_avatar_url_safe_check
      check (minecraft_avatar_url is null or public.is_safe_https_url(minecraft_avatar_url));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_mc_skin_url_safe_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_mc_skin_url_safe_check
      check (minecraft_skin_url is null or public.is_safe_https_url(minecraft_skin_url));
  end if;
end;
$$;

-- 2) Guard privileged profile fields.
-- Normal authenticated users may keep editing their safe player fields through
-- the existing own-profile policy, but they cannot write verified Minecraft
-- identity fields from the browser. Admins and backend/service contexts remain
-- able to set verified data after a real Xbox/Minecraft Services check.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- SQL editor, auth triggers, and backend service-role maintenance contexts.
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.id is distinct from auth.uid() and not public.is_admin() then
      raise exception 'profile id must match authenticated user';
    end if;

    if coalesce(new.role, 'joueur') <> 'joueur' and not public.is_admin() then
      raise exception 'profile role cannot be assigned by this user';
    end if;

    if (
      new.minecraft_username is not null
      or new.minecraft_uuid is not null
      or new.minecraft_avatar_url is not null
      or new.minecraft_skin_url is not null
      or new.minecraft_linked_at is not null
      or new.microsoft_provider_id is not null
      or coalesce(new.minecraft_verified, false) is distinct from false
    ) and not public.is_admin() then
      raise exception 'minecraft link fields require backend verification';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'profile id cannot be changed';
    end if;

    if new.created_at is distinct from old.created_at and not public.is_admin() then
      raise exception 'created_at cannot be changed by this user';
    end if;

    if new.role is distinct from old.role and not public.is_admin() then
      raise exception 'profile role cannot be changed by this user';
    end if;

    if (
      new.minecraft_username is distinct from old.minecraft_username
      or new.minecraft_uuid is distinct from old.minecraft_uuid
      or new.minecraft_verified is distinct from old.minecraft_verified
      or new.minecraft_avatar_url is distinct from old.minecraft_avatar_url
      or new.minecraft_skin_url is distinct from old.minecraft_skin_url
      or new.minecraft_linked_at is distinct from old.minecraft_linked_at
      or new.microsoft_provider_id is distinct from old.microsoft_provider_id
    ) and not public.is_admin() then
      raise exception 'minecraft link fields require backend verification';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_user_profiles_guard on public.user_profiles;
create trigger trg_user_profiles_guard
before insert or update on public.user_profiles
for each row execute function public.prevent_profile_privilege_escalation();

-- 3) Keep the existing RLS shape explicit.
-- Own-profile reads/writes stay available to authenticated users.
-- The trigger above is what makes class/level edits safe while blocking
-- role/admin and Minecraft verification escalation.
drop policy if exists "profiles authenticated read" on public.user_profiles;
create policy "profiles authenticated read" on public.user_profiles
for select to authenticated using (true);

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

commit;

-- Manual validation ideas:
-- 1. Normal user can update own classe/niveau.
-- 2. Normal user cannot update role to admin.
-- 3. Normal user cannot update minecraft_username, minecraft_uuid,
--    minecraft_verified, minecraft_avatar_url, minecraft_skin_url,
--    minecraft_linked_at, or microsoft_provider_id.
-- 4. Admin/backend can write verified Minecraft fields only after the real
--    Xbox/Minecraft Services linking flow has verified ownership.
