-- SAO Nameless Security Patch 002
-- Purpose:
-- - keep guild private messages on public.guild_chat, because the current
--   frontend still uses guild_chat with is_private=true;
-- - require current guild access for reading/updating/deleting guild chat rows;
-- - require private DM recipients to be guild members/admins;
-- - keep public chat readable only by guild members/admins.
--
-- Run in Supabase SQL Editor after PATCH_003.

grant usage on schema public to authenticated;

-- Table privileges open the door only to the authenticated role; RLS policies
-- below still decide which rows/actions are actually allowed.
grant select, insert, update on public.user_profiles to authenticated;
grant select, insert, update, delete on public.user_roles to authenticated;
grant select, insert, update, delete on public.guild_planning to authenticated;
grant select, insert, update, delete on public.guild_objectives to authenticated;
grant select, insert, update, delete on public.guild_presence to authenticated;
grant select, insert, update, delete on public.guild_activity_wall to authenticated;
grant select, insert, update, delete on public.guild_chat to authenticated;
grant select, insert, update, delete on public.private_messages to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant select, insert on public.admin_logs to authenticated;

drop policy if exists "profiles authenticated read" on public.user_profiles;
create policy "profiles authenticated read" on public.user_profiles
for select to authenticated
using (
  id = auth.uid()
  or public.can_access_guild()
  or public.is_admin()
);

-- Helper expression repeated inline to avoid adding a new RPC:
-- A target user is guild-eligible if user_roles.role or user_profiles.role is
-- "membre" or "admin". user_roles wins when present, matching current_user_role().

drop policy if exists "users read own guild dm" on public.guild_chat;
drop policy if exists "guild members read own guild dm" on public.guild_chat;
create policy "guild members read own guild dm" on public.guild_chat
for select to authenticated
using (
  is_private = true
  and public.can_access_guild()
  and (user_id = auth.uid() or recipient_id = auth.uid())
);

drop policy if exists "members send guild chat" on public.guild_chat;
create policy "members send guild chat" on public.guild_chat
for insert to authenticated
with check (
  user_id = auth.uid()
  and public.can_access_guild()
  and (
    (is_private = false and recipient_id is null)
    or
    (
      is_private = true
      and recipient_id is not null
      and recipient_id <> auth.uid()
      and exists (
        select 1
        from public.user_profiles recipient
        left join public.user_roles recipient_role
          on recipient_role.user_id = recipient.id
        where recipient.id = recipient_id
          and coalesce(recipient_role.role, recipient.role, 'joueur') in ('membre', 'admin')
      )
    )
  )
);

drop policy if exists "authors update guild chat" on public.guild_chat;
create policy "authors update guild chat" on public.guild_chat
for update to authenticated
using (
  public.is_admin()
  or (user_id = auth.uid() and public.can_access_guild())
)
with check (
  public.is_admin()
  or (user_id = auth.uid() and public.can_access_guild())
);

drop policy if exists "authors delete guild chat" on public.guild_chat;
create policy "authors delete guild chat" on public.guild_chat
for delete to authenticated
using (
  public.is_admin()
  or (user_id = auth.uid() and public.can_access_guild())
);

drop policy if exists "users send private messages" on public.private_messages;
create policy "users send private messages" on public.private_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and public.can_access_guild()
  and recipient_id <> auth.uid()
  and exists (
    select 1
    from public.user_profiles recipient
    left join public.user_roles recipient_role
      on recipient_role.user_id = recipient.id
    where recipient.id = recipient_id
      and coalesce(recipient_role.role, recipient.role, 'joueur') in ('membre', 'admin')
  )
);

-- Verification helpers:
--
-- select policyname, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('guild_chat', 'private_messages')
-- order by tablename, policyname;
