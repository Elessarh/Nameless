-- Nameless hardening 004 — apply AFTER SECURITY_PATCH_002,
-- MINECRAFT_PUBLIC_LINK_PATCH and ADMIN_ACTIONS_PATCH. No user data is deleted.
-- Deploy the updated Edge Function and frontend only after this transaction.
-- New/changed profile classes must match the five game classes; unchanged
-- legacy class values remain editable through unrelated profile fields.
begin;

create schema if not exists nameless_private;
revoke all on schema nameless_private from public, anon, authenticated;
create table if not exists nameless_private.write_limits (
  subject uuid not null, channel text not null,
  minute_start timestamptz not null, minute_attempts integer not null,
  burst_start timestamptz not null, burst_attempts integer not null,
  hour_start timestamptz not null, hour_attempts integer not null,
  primary key (subject, channel)
);
create or replace function public.consume_write_budget(subject_id uuid, channel_name text,
  minute_limit integer, burst_limit integer, hour_limit integer)
returns boolean language plpgsql security definer set search_path = public, nameless_private as $$
declare budget nameless_private.write_limits%rowtype;
begin
  if subject_id is null or channel_name not in ('messages', 'uploads') then return false; end if;
  insert into nameless_private.write_limits(subject, channel,
    minute_start, minute_attempts, burst_start, burst_attempts, hour_start, hour_attempts)
  values(subject_id, channel_name, now(), 1, now(), 1, now(), 1)
  on conflict(subject, channel) do update set
    minute_attempts = case when write_limits.minute_start <= now() - interval '1 minute' then 1 else write_limits.minute_attempts + 1 end,
    minute_start = case when write_limits.minute_start <= now() - interval '1 minute' then now() else write_limits.minute_start end,
    burst_attempts = case when write_limits.burst_start <= now() - interval '10 seconds' then 1 else write_limits.burst_attempts + 1 end,
    burst_start = case when write_limits.burst_start <= now() - interval '10 seconds' then now() else write_limits.burst_start end,
    hour_attempts = case when write_limits.hour_start <= now() - interval '1 hour' then 1 else write_limits.hour_attempts + 1 end,
    hour_start = case when write_limits.hour_start <= now() - interval '1 hour' then now() else write_limits.hour_start end
  returning * into budget;
  return budget.minute_attempts <= minute_limit and budget.burst_attempts <= burst_limit and budget.hour_attempts <= hour_limit;
end;
$$;
revoke all on function public.consume_write_budget(uuid, text, integer, integer, integer) from public, anon, authenticated;

-- Accept new object paths and retain legacy Supabase URLs without rewriting rows.
create or replace function public.guild_media_path(value text)
returns text language sql immutable set search_path = public as $$
  select case when candidate ~* '^(chat|guild-activities)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]+\.(png|jpe?g|webp)$'
    then candidate else null end
  from (select split_part(regexp_replace(value,
    '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/(sign|public|authenticated)/iron-oath-storage/', '', 'i'), '?', 1) candidate) paths;
$$;

create or replace function public.is_allowed_guild_media(value text)
returns boolean language sql immutable set search_path = public as $$
  select value is null or public.guild_media_path(value) is not null
    or value ~* '^https://mc-heads\.net/[^[:space:]]+$';
$$;

alter table public.guild_chat drop constraint if exists guild_chat_image_check;
alter table public.guild_chat add constraint guild_chat_image_check
  check (public.is_allowed_guild_media(image_url)) not valid;
alter table public.private_messages drop constraint if exists private_messages_image_check;
alter table public.private_messages add constraint private_messages_image_check
  check (public.is_allowed_guild_media(image_url)) not valid;
alter table public.guild_activity_wall drop constraint if exists guild_activity_wall_image_check;
alter table public.guild_activity_wall add constraint guild_activity_wall_image_check
  check (public.is_allowed_guild_media(image_url)) not valid;

-- Per-user write throttling persists independently of content deletion. The
-- UPSERT serializes concurrent sends, and server timestamps cannot be forged.
create or replace function public.guard_message_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  caller uuid := auth.uid();
  media_path text;
begin
  if caller is null then return new; end if;
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
      raise exception 'message_identity_is_immutable';
    end if;
    if tg_table_name = 'guild_chat' then
      if new.user_id is distinct from old.user_id
        or new.recipient_id is distinct from old.recipient_id
        or new.is_private is distinct from old.is_private
        or new.reply_to_message_id is distinct from old.reply_to_message_id then
        raise exception 'message_participants_are_immutable';
      end if;
      if not public.consume_write_budget(caller, 'messages', 30, 6, 1000) then raise exception 'message_rate_limited'; end if;
    elsif tg_table_name = 'private_messages' then
      if new.sender_id is distinct from old.sender_id or new.recipient_id is distinct from old.recipient_id
        or new.content is distinct from old.content or new.image_url is distinct from old.image_url then
        raise exception 'only_read_at_can_be_updated';
      end if;
    end if;
  else
    new.created_at := now();
    if not public.consume_write_budget(caller, 'messages', 30, 6, 1000) then raise exception 'message_rate_limited'; end if;
    if tg_table_name = 'messages' then
      if new.message_type = 'system' and not public.is_admin() then raise exception 'system_messages_require_admin'; end if;
      select coalesce(minecraft_username, username) into new.sender_username from public.user_profiles where id = caller;
      select coalesce(minecraft_username, username) into new.recipient_username from public.user_profiles where id = new.recipient_id;
    end if;
  end if;
  if tg_table_name in ('guild_chat', 'private_messages') then
    media_path := public.guild_media_path(new.image_url);
    if media_path is not null and split_part(media_path, '/', 2) <> caller::text
      and (tg_op = 'INSERT' or new.image_url is distinct from old.image_url) then
      raise exception 'message_media_must_be_owned';
    end if;
    if tg_table_name = 'guild_chat' and tg_op = 'INSERT' then
      if new.reply_to_message_id is not null then
        if not exists (
          select 1 from public.guild_chat original where original.id = new.reply_to_message_id
            and (not original.is_private or original.user_id = caller or original.recipient_id = caller)
        ) then raise exception 'reply_message_not_accessible'; end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guild_chat_write_guard on public.guild_chat;
create trigger trg_guild_chat_write_guard before insert or update on public.guild_chat
  for each row execute function public.guard_message_write();
drop trigger if exists trg_private_messages_write_guard on public.private_messages;
create trigger trg_private_messages_write_guard before insert or update on public.private_messages
  for each row execute function public.guard_message_write();
drop trigger if exists trg_messages_write_guard on public.messages;
create trigger trg_messages_write_guard before insert or update on public.messages
  for each row execute function public.guard_message_write();

-- Preserve private-message ownership after guild access is revoked.
drop policy if exists "users read own private messages" on public.private_messages;
create policy "users read own private messages" on public.private_messages for select to authenticated
  using (public.can_access_guild() and (sender_id = auth.uid() or recipient_id = auth.uid()));
drop policy if exists "recipients mark private messages read" on public.private_messages;
create policy "recipients mark private messages read" on public.private_messages for update to authenticated
  using (public.can_access_guild() and recipient_id = auth.uid())
  with check (public.can_access_guild() and recipient_id = auth.uid());
drop policy if exists "participants delete private messages" on public.private_messages;
create policy "participants delete private messages" on public.private_messages for delete to authenticated
  using (public.can_access_guild() and (sender_id = auth.uid() or recipient_id = auth.uid()));

-- Role changes are handled by the JWT-verified Edge Function. This closes the
-- alternate browser route that skipped its confirmations and audit logging.
create or replace function public.validate_profile_class()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.classe is not distinct from old.classe then return new; end if;
  end if;
  if new.classe is null or new.classe not in ('Shaman', 'Mage', 'Assassin', 'Guerrier', 'Archer') then
    raise exception 'invalid_profile_class' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_class_validation on public.user_profiles;
create trigger trg_profiles_class_validation before insert or update of classe on public.user_profiles
  for each row execute function public.validate_profile_class();

create or replace function public.guard_browser_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role then
    raise exception 'role_changes_require_admin_edge_function';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_profiles_browser_role_guard on public.user_profiles;
create trigger trg_profiles_browser_role_guard before update of role on public.user_profiles
  for each row execute function public.guard_browser_role_change();
revoke insert, update, delete on public.user_roles from authenticated;

-- The same lock protects profile deletion and both role mirrors. It lives in
-- the database transaction, including Supabase Auth's cascading deletion.
create or replace function public.guard_last_admin()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target uuid;
  effective_role text;
  admin_count integer;
  removes_admin boolean := false;
begin
  perform pg_advisory_xact_lock(hashtextextended('nameless-admin-roles', 0));
  if tg_table_name = 'user_profiles' then
    target := old.id;
    select coalesce((select role from public.user_roles where user_id = target), old.role) into effective_role;
    removes_admin := effective_role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin');
  else
    target := old.user_id;
    if tg_op = 'DELETE' then
      removes_admin := old.role = 'admin' and not exists (
        select 1 from public.user_profiles where id = target and role = 'admin'
      );
    else
      removes_admin := old.role = 'admin' and new.role <> 'admin';
    end if;
  end if;
  if removes_admin then
    select count(*) into admin_count
    from public.user_profiles p full join public.user_roles r on r.user_id = p.id
    where coalesce(r.role, p.role) = 'admin';
    if admin_count <= 1 then raise exception 'cannot_remove_last_admin'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists trg_profiles_last_admin on public.user_profiles;
create trigger trg_profiles_last_admin before update of role or delete on public.user_profiles
  for each row execute function public.guard_last_admin();
drop trigger if exists trg_roles_last_admin on public.user_roles;
create trigger trg_roles_last_admin before update of role or delete on public.user_roles
  for each row execute function public.guard_last_admin();

-- Correct the legacy DELETE return value (NEW is NULL on DELETE).
create or replace function public.protect_user_roles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'INSERT' and new.user_id = auth.uid() and new.role = 'joueur' then return new; end if;
  if not public.is_admin() then raise exception 'admin role required to modify user_roles'; end if;
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then raise exception 'user_id cannot be changed'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Persistent, atomic Edge throttling; the counter table is never public.
create schema if not exists nameless_private;
revoke all on schema nameless_private from public, anon, authenticated;
create table if not exists nameless_private.action_limits (
  subject uuid not null, action text not null, window_start timestamptz not null,
  attempts integer not null, primary key (subject, action)
);
create or replace function public.consume_admin_action_limit(subject_id uuid, action_name text)
returns boolean language plpgsql security definer set search_path = public, nameless_private as $$
declare amount integer;
begin
  if subject_id is null or action_name not in ('update_role', 'delete_user', 'minecraft_start') then return false; end if;
  insert into nameless_private.action_limits(subject, action, window_start, attempts)
  values(subject_id, action_name, now(), 1)
  on conflict(subject, action) do update set
    attempts = case when action_limits.window_start <= now() - interval '1 minute' then 1 else action_limits.attempts + 1 end,
    window_start = case when action_limits.window_start <= now() - interval '1 minute' then now() else action_limits.window_start end
  returning attempts into amount;
  return amount <= case when action_name = 'delete_user' then 5 when action_name = 'minecraft_start' then 6 else 20 end;
end;
$$;
revoke all on function public.consume_admin_action_limit(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_admin_action_limit(uuid, text) to service_role;

-- Storage authorization follows the message/activity row rather than a
-- five-year bearer URL. Copying another user's object reference is forbidden
-- by the write trigger above. Owners remain able to clean up their uploads.
create or replace function public.can_upload_guild_media(object_name text)
returns boolean language plpgsql security definer set search_path = public, storage as $$
declare caller uuid := auth.uid(); prefix text := split_part(object_name, '/', 1);
begin
  if caller is null or not public.can_access_guild() or public.guild_media_path(object_name) is null
    or split_part(object_name, '/', 2) <> caller::text then return false; end if;
  if prefix = 'guild-activities' and not public.is_admin() then return false; end if;
  return public.consume_write_budget(caller, 'uploads', 10, 10, 60);
end;
$$;
revoke all on function public.can_upload_guild_media(text) from public, anon;
grant execute on function public.can_upload_guild_media(text) to authenticated;

drop policy if exists "guild media read own or admin" on storage.objects;
drop policy if exists "guild media read authorized" on storage.objects;
create policy "guild media read authorized" on storage.objects for select to authenticated
using (bucket_id = 'iron-oath-storage' and public.can_access_guild() and (
  public.is_admin() or split_part(name, '/', 2) = auth.uid()::text
  or exists (select 1 from public.guild_chat m where public.guild_media_path(m.image_url) = name
    and (not m.is_private or m.user_id = auth.uid() or m.recipient_id = auth.uid()))
  or exists (select 1 from public.private_messages m where public.guild_media_path(m.image_url) = name
    and (m.sender_id = auth.uid() or m.recipient_id = auth.uid()))
  or exists (select 1 from public.guild_activity_wall a where public.guild_media_path(a.image_url) = name)
));
drop policy if exists "guild media upload own prefix" on storage.objects;
create policy "guild media upload own prefix" on storage.objects for insert to authenticated
  with check (bucket_id = 'iron-oath-storage' and public.can_upload_guild_media(name));
-- Object paths are immutable; replacement uses a new object and new message reference.
drop policy if exists "guild media owner update" on storage.objects;

update storage.buckets set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'] where id = 'iron-oath-storage';

create index if not exists guild_chat_author_recent_idx on public.guild_chat (user_id, created_at desc);
-- No index/table rewrite is required for existing user data.
commit;
