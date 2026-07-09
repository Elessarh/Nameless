-- SAO Nameless - Public Minecraft identity link patch
-- Date: 2026-07-09
--
-- Purpose:
-- - allow a normal authenticated player to attach a public Minecraft username
--   and UUID resolved through a public API;
-- - keep minecraft_verified=true reserved for admins/backend verification;
-- - keep role/admin and privileged Minecraft fields protected.

begin;

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
end;
$$;

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

    if not public.is_admin() then
      if coalesce(new.minecraft_verified, false) is distinct from false then
        raise exception 'minecraft verification requires admin validation';
      end if;

      if (
        new.minecraft_avatar_url is not null
        or new.minecraft_skin_url is not null
        or new.microsoft_provider_id is not null
      ) then
        raise exception 'privileged minecraft fields require admin validation';
      end if;
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

    if not public.is_admin() then
      if new.minecraft_verified is distinct from old.minecraft_verified then
        raise exception 'minecraft verification requires admin validation';
      end if;

      if coalesce(old.minecraft_verified, false) = true and (
        new.minecraft_username is distinct from old.minecraft_username
        or new.minecraft_uuid is distinct from old.minecraft_uuid
        or new.minecraft_linked_at is distinct from old.minecraft_linked_at
      ) then
        raise exception 'verified minecraft profile cannot be changed by this user';
      end if;

      if (
        new.minecraft_avatar_url is distinct from old.minecraft_avatar_url
        or new.minecraft_skin_url is distinct from old.minecraft_skin_url
        or new.microsoft_provider_id is distinct from old.microsoft_provider_id
      ) then
        raise exception 'privileged minecraft fields require admin validation';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_user_profiles_guard on public.user_profiles;
drop trigger if exists trg_user_profiles_privilege_guard on public.user_profiles;

create trigger trg_user_profiles_privilege_guard
before insert or update on public.user_profiles
for each row execute function public.prevent_profile_privilege_escalation();

-- Admin validation remains a separate future action:
-- update public.user_profiles
-- set minecraft_verified = true
-- where id = '<USER_ID>' and minecraft_uuid is not null;

commit;
