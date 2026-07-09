-- SAO Nameless RLS Patch 002
-- Purpose:
-- - keep normal users unable to change profile roles from the frontend;
-- - allow privileged SQL Editor / backend maintenance context to promote the first admin;
-- - keep user_roles synchronized through the existing trigger.

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- SQL Editor / privileged backend maintenance runs without an auth.uid().
  -- Browser clients still go through authenticated RLS policies, so anonymous
  -- or normal users cannot self-promote from the frontend.
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
  end if;

  return new;
end;
$$;

-- Roles supported by the site:
-- - joueur: normal authenticated player, can fill own profile only.
-- - membre: guild member, can access guild player panel.
-- - admin: guild/admin manager, can access admin dashboard and guild panel.
--
-- After applying this patch, promote the first admin manually:
--
-- update public.user_profiles
-- set role = 'admin'
-- where id = 'USER_UUID_HERE';
--
-- Verify synchronization:
--
-- select p.id, p.username, p.role as profile_role, r.role as mirror_role
-- from public.user_profiles p
-- left join public.user_roles r on r.user_id = p.id
-- where p.id = 'USER_UUID_HERE';
