-- SAO-Nameless Supabase schema from zero - strict security baseline
-- Run manually in Supabase SQL Editor.
-- No service_role key, database password, connection string, or private secret belongs in the frontend.
-- If the site calls Supabase directly from GitHub Pages, the anon/publishable key is public by design.
-- Data security must come from RLS, constraints, triggers, and RPC checks.

create extension if not exists pgcrypto;

-- =========================================================
-- Shared helpers
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_safe_https_url(raw_url text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select raw_url is null
      or (
        raw_url ~* '^https://'
        and raw_url !~* '^\s*(javascript|data|blob|vbscript|file):'
      );
$$;

create or replace function public.is_allowed_image_url(raw_url text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select raw_url is null
      or (
        public.is_safe_https_url(raw_url)
        and raw_url ~* '\.(png|jpg|jpeg|webp)(\?.*)?$'
      );
$$;

-- =========================================================
-- Profiles and roles
-- =========================================================

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  role text not null default 'joueur',
  classe text not null default 'Guerrier',
  niveau integer not null default 1,
  minecraft_username text,
  minecraft_uuid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_role_check check (role in ('joueur', 'membre', 'admin')),
  constraint user_profiles_level_check check (niveau between 1 and 100),
  constraint user_profiles_username_length_check check (char_length(username) between 2 and 32),
  constraint user_profiles_username_safe_check check (username ~ '^[A-Za-z0-9_-]+$'),
  constraint user_profiles_mc_username_check check (
    minecraft_username is null or minecraft_username ~ '^[A-Za-z0-9_]{3,16}$'
  )
);

create table if not exists public.user_roles (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  role text not null default 'joueur',
  assigned_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_roles_role_check check (role in ('joueur', 'membre', 'admin'))
);

create unique index if not exists user_profiles_username_lower_uidx
  on public.user_profiles (lower(username));

create unique index if not exists user_profiles_minecraft_uuid_uidx
  on public.user_profiles (minecraft_uuid)
  where minecraft_uuid is not null;

create index if not exists user_profiles_role_idx on public.user_profiles (role);
create index if not exists user_roles_role_idx on public.user_roles (role);

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select ur.role from public.user_roles ur where ur.user_id = auth.uid()),
    (select up.role from public.user_profiles up where up.id = auth.uid()),
    'anon'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin';
$$;

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('membre', 'admin');
$$;

create or replace function public.can_access_guild()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_member();
$$;

-- Backward-compatible alias used by earlier docs/code.
create or replace function public.is_guild_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_member();
$$;

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and new.id is distinct from auth.uid() and not public.is_admin() then
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

create or replace function public.sync_profile_role_to_user_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.user_roles (user_id, role, assigned_by)
    values (new.id, coalesce(new.role, 'joueur'), case when public.is_admin() then auth.uid() else null end)
    on conflict (user_id) do update
      set role = excluded.role,
          assigned_by = excluded.assigned_by,
          updated_at = now();
  elsif tg_op = 'UPDATE' and new.role is distinct from old.role then
    insert into public.user_roles (user_id, role, assigned_by)
    values (new.id, new.role, auth.uid())
    on conflict (user_id) do update
      set role = excluded.role,
          assigned_by = excluded.assigned_by,
          updated_at = now();
  end if;

  return new;
end;
$$;

create or replace function public.protect_user_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.users trigger / SQL Editor bootstrap can seed default roles.
  -- Browser clients are still constrained by RLS and the checks below.
  if auth.uid() is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' and new.user_id = auth.uid() and new.role = 'joueur' then
    return new;
  end if;

  if not public.is_admin() then
    raise exception 'admin role required to modify user_roles';
  end if;

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'user_id cannot be changed';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  requested_username text;
begin
  requested_username := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    split_part(new.email, '@', 1),
    'Joueur_' || substring(new.id::text from 1 for 6)
  );

  requested_username := regexp_replace(requested_username, '[^A-Za-z0-9_-]', '_', 'g');
  if char_length(requested_username) < 2 then
    requested_username := 'Joueur_' || substring(new.id::text from 1 for 6);
  end if;
  requested_username := substring(requested_username from 1 for 32);

  insert into public.user_profiles (id, username, role)
  values (new.id, requested_username, 'joueur')
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'joueur')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_roles_updated_at on public.user_roles;
create trigger trg_user_roles_updated_at
before update on public.user_roles
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_profiles_privilege_guard on public.user_profiles;
create trigger trg_user_profiles_privilege_guard
before insert or update on public.user_profiles
for each row execute function public.prevent_profile_privilege_escalation();

drop trigger if exists trg_user_profiles_role_sync on public.user_profiles;
create trigger trg_user_profiles_role_sync
after insert or update of role on public.user_profiles
for each row execute function public.sync_profile_role_to_user_roles();

drop trigger if exists trg_user_roles_guard on public.user_roles;
create trigger trg_user_roles_guard
before insert or update or delete on public.user_roles
for each row execute function public.protect_user_roles();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- =========================================================
-- Guild content
-- =========================================================

create table if not exists public.guild_planning (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  description text,
  date_event timestamptz not null,
  type_event text not null default 'raid',
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guild_planning_title_check check (char_length(titre) between 1 and 120),
  constraint guild_planning_type_check check (type_event in ('reunion', 'raid', 'event', 'pvp', 'construction', 'autre'))
);

create table if not exists public.guild_objectives (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  description text,
  semaine_numero integer not null,
  annee integer not null,
  statut text not null default 'en_cours',
  progression integer not null default 0,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guild_objectives_title_check check (char_length(titre) between 1 and 120),
  constraint guild_objectives_week_check check (semaine_numero between 1 and 53),
  constraint guild_objectives_year_check check (annee between 2024 and 2100),
  constraint guild_objectives_status_check check (statut in ('en_cours', 'termine', 'abandonne')),
  constraint guild_objectives_progress_check check (progression between 0 and 100)
);

create table if not exists public.guild_presence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  date_presence date not null,
  statut text not null,
  commentaire text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guild_presence_status_check check (statut in ('present', 'absent', 'en_mission', 'retard', 'indisponible')),
  constraint guild_presence_comment_check check (commentaire is null or char_length(commentaire) <= 500),
  constraint guild_presence_unique_user_day unique (user_id, date_presence)
);

create table if not exists public.guild_activity_wall (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  type text not null default 'info',
  contenu text,
  image_url text,
  author_id uuid references public.user_profiles(id) on delete set null,
  author_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guild_activity_wall_title_check check (char_length(titre) between 1 and 140),
  constraint guild_activity_wall_content_check check (contenu is null or char_length(contenu) <= 8000),
  constraint guild_activity_wall_type_check check (type in ('info', 'annonce', 'evenement', 'event', 'raid', 'victoire')),
  constraint guild_activity_wall_image_check check (public.is_allowed_image_url(image_url))
);

create table if not exists public.guild_chat (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  content text not null default '',
  image_url text,
  is_private boolean not null default false,
  recipient_id uuid references public.user_profiles(id) on delete cascade,
  reply_to_message_id uuid references public.guild_chat(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guild_chat_content_check check (char_length(content) <= 4000),
  constraint guild_chat_image_check check (public.is_allowed_image_url(image_url)),
  constraint guild_chat_private_recipient_check check (
    (is_private = false and recipient_id is null)
    or
    (is_private = true and recipient_id is not null and recipient_id <> user_id)
  ),
  constraint guild_chat_non_empty_check check (
    char_length(content) > 0 or image_url is not null
  )
);

-- Future zero-secret/backend shape. Current frontend still stores guild DM in guild_chat with is_private=true.
create table if not exists public.private_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.user_profiles(id) on delete cascade,
  recipient_id uuid not null references public.user_profiles(id) on delete cascade,
  content text not null default '',
  image_url text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint private_messages_parties_check check (sender_id <> recipient_id),
  constraint private_messages_content_check check (char_length(content) <= 4000),
  constraint private_messages_image_check check (public.is_allowed_image_url(image_url)),
  constraint private_messages_non_empty_check check (char_length(content) > 0 or image_url is not null)
);

-- Mailbox used by mailbox.js / mailbox-supabase.js
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.user_profiles(id) on delete cascade,
  sender_username text not null,
  recipient_id uuid not null references public.user_profiles(id) on delete cascade,
  recipient_username text not null,
  subject text not null,
  content text not null,
  message_type text not null default 'user',
  order_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messages_parties_check check (sender_id <> recipient_id),
  constraint messages_subject_check check (char_length(subject) between 1 and 160),
  constraint messages_content_check check (char_length(content) between 1 and 12000),
  constraint messages_type_check check (message_type in ('normal', 'system', 'hdv', 'guild', 'user', 'order'))
);

create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.user_profiles(id) on delete set null,
  action text not null,
  target_table text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_logs_action_check check (char_length(action) between 1 and 120)
);

create index if not exists guild_planning_date_idx on public.guild_planning (date_event);
create index if not exists guild_objectives_week_idx on public.guild_objectives (annee, semaine_numero);
create index if not exists guild_presence_day_idx on public.guild_presence (date_presence, statut);
create index if not exists guild_activity_wall_created_idx on public.guild_activity_wall (created_at desc);
create index if not exists guild_chat_public_idx on public.guild_chat (created_at) where is_private = false;
create index if not exists guild_chat_dm_lookup_idx on public.guild_chat (is_private, user_id, recipient_id, created_at);
create index if not exists private_messages_sender_idx on public.private_messages (sender_id, created_at desc);
create index if not exists private_messages_recipient_idx on public.private_messages (recipient_id, created_at desc);
create index if not exists messages_recipient_idx on public.messages (recipient_id, created_at desc);
create index if not exists messages_sender_idx on public.messages (sender_id, created_at desc);
create index if not exists messages_unread_idx on public.messages (recipient_id) where read_at is null;
create index if not exists admin_logs_actor_idx on public.admin_logs (actor_id, created_at desc);

drop trigger if exists trg_guild_planning_updated_at on public.guild_planning;
create trigger trg_guild_planning_updated_at before update on public.guild_planning
for each row execute function public.set_updated_at();

drop trigger if exists trg_guild_objectives_updated_at on public.guild_objectives;
create trigger trg_guild_objectives_updated_at before update on public.guild_objectives
for each row execute function public.set_updated_at();

drop trigger if exists trg_guild_presence_updated_at on public.guild_presence;
create trigger trg_guild_presence_updated_at before update on public.guild_presence
for each row execute function public.set_updated_at();

drop trigger if exists trg_guild_activity_wall_updated_at on public.guild_activity_wall;
create trigger trg_guild_activity_wall_updated_at before update on public.guild_activity_wall
for each row execute function public.set_updated_at();

drop trigger if exists trg_guild_chat_updated_at on public.guild_chat;
create trigger trg_guild_chat_updated_at before update on public.guild_chat
for each row execute function public.set_updated_at();

drop trigger if exists trg_private_messages_updated_at on public.private_messages;
create trigger trg_private_messages_updated_at before update on public.private_messages
for each row execute function public.set_updated_at();

drop trigger if exists trg_messages_updated_at on public.messages;
create trigger trg_messages_updated_at before update on public.messages
for each row execute function public.set_updated_at();

create or replace function public.protect_message_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.sender_id is distinct from old.sender_id
    or new.sender_username is distinct from old.sender_username
    or new.recipient_id is distinct from old.recipient_id
    or new.recipient_username is distinct from old.recipient_username
    or new.subject is distinct from old.subject
    or new.content is distinct from old.content
    or new.message_type is distinct from old.message_type
    or new.order_id is distinct from old.order_id
  then
    raise exception 'only read_at can be updated on messages';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_messages_update_guard on public.messages;
create trigger trg_messages_update_guard before update on public.messages
for each row execute function public.protect_message_update();

-- =========================================================
-- HDV legacy support, excluded from SPA routing
-- =========================================================

create table if not exists public.market_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  username text not null,
  type text not null,
  item_name text not null,
  item_image text,
  item_category text,
  item_type text,
  quantity integer not null,
  price numeric(12, 2) not null,
  total_price numeric(12, 2) not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_orders_type_check check (type in ('buy', 'sell', 'achat', 'vente')),
  constraint market_orders_quantity_check check (quantity > 0),
  constraint market_orders_price_check check (price >= 0 and total_price >= 0),
  constraint market_orders_status_check check (status in ('active', 'completed', 'cancelled')),
  constraint market_orders_item_image_check check (public.is_allowed_image_url(item_image))
);

create table if not exists public.purchase_history (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.user_profiles(id) on delete set null,
  seller_name text,
  buyer_id uuid references public.user_profiles(id) on delete set null,
  buyer_name text,
  item_name text not null,
  item_image text,
  item_category text,
  quantity integer not null,
  price numeric(12, 2) not null,
  total_price numeric(12, 2) not null,
  transaction_type text,
  created_at timestamptz not null default now(),
  constraint purchase_history_quantity_check check (quantity > 0),
  constraint purchase_history_price_check check (price >= 0 and total_price >= 0),
  constraint purchase_history_item_image_check check (public.is_allowed_image_url(item_image))
);

create index if not exists market_orders_active_idx on public.market_orders (status, created_at desc);
create index if not exists market_orders_user_idx on public.market_orders (user_id, status);
create index if not exists purchase_history_parties_idx on public.purchase_history (seller_id, buyer_id, created_at desc);

drop trigger if exists trg_market_orders_updated_at on public.market_orders;
create trigger trg_market_orders_updated_at before update on public.market_orders
for each row execute function public.set_updated_at();

-- =========================================================
-- Admin RPC
-- =========================================================

create or replace function public.write_admin_log(action text, target_table text default null, target_id uuid default null, details jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if not public.is_admin() then
    raise exception 'admin role required';
  end if;

  insert into public.admin_logs (actor_id, action, target_table, target_id, details)
  values (auth.uid(), action, target_table, target_id, coalesce(details, '{}'::jsonb))
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.delete_user_completely(user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid := $1;
  deleted_profile boolean := false;
begin
  if not public.is_admin() then
    raise exception 'admin role required';
  end if;

  if target_id = auth.uid() then
    raise exception 'admins cannot delete their own account here';
  end if;

  delete from public.messages where sender_id = target_id or recipient_id = target_id;
  delete from public.private_messages where sender_id = target_id or recipient_id = target_id;
  delete from public.guild_chat where user_id = target_id or recipient_id = target_id;
  delete from public.guild_presence where user_id = target_id;
  delete from public.market_orders where user_id = target_id;
  delete from public.purchase_history where seller_id = target_id or buyer_id = target_id;

  delete from public.user_profiles
  where id = target_id
  returning true into deleted_profile;

  perform public.write_admin_log(
    'delete_user_public_data',
    'user_profiles',
    target_id,
    jsonb_build_object('deletedAuthUser', false)
  );

  return jsonb_build_object(
    'success', coalesce(deleted_profile, false),
    'deletedAuthUser', false,
    'note', 'auth.users deletion must use Supabase Admin API outside the frontend'
  );
end;
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_member() from public;
revoke all on function public.can_access_guild() from public;
revoke all on function public.is_guild_member() from public;
revoke all on function public.write_admin_log(text, text, uuid, jsonb) from public;
revoke all on function public.delete_user_completely(uuid) from public;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_member() to authenticated;
grant execute on function public.can_access_guild() to authenticated;
grant execute on function public.is_guild_member() to authenticated;
grant execute on function public.write_admin_log(text, text, uuid, jsonb) to authenticated;
grant execute on function public.delete_user_completely(uuid) to authenticated;

-- =========================================================
-- RLS policies
-- =========================================================

alter table public.user_profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.guild_planning enable row level security;
alter table public.guild_objectives enable row level security;
alter table public.guild_presence enable row level security;
alter table public.guild_activity_wall enable row level security;
alter table public.guild_chat enable row level security;
alter table public.private_messages enable row level security;
alter table public.messages enable row level security;
alter table public.admin_logs enable row level security;
alter table public.market_orders enable row level security;
alter table public.purchase_history enable row level security;

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

drop policy if exists "profiles admin delete" on public.user_profiles;
create policy "profiles admin delete" on public.user_profiles
for delete to authenticated
using (public.is_admin());

drop policy if exists "roles read own or admin" on public.user_roles;
create policy "roles read own or admin" on public.user_roles
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "roles admin manage" on public.user_roles;
create policy "roles admin manage" on public.user_roles
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "members read planning" on public.guild_planning;
create policy "members read planning" on public.guild_planning
for select to authenticated using (public.can_access_guild());

drop policy if exists "admins write planning" on public.guild_planning;
create policy "admins write planning" on public.guild_planning
for all to authenticated
using (public.is_admin())
with check (public.is_admin() and created_by = auth.uid());

drop policy if exists "members read objectives" on public.guild_objectives;
create policy "members read objectives" on public.guild_objectives
for select to authenticated using (public.can_access_guild());

drop policy if exists "admins write objectives" on public.guild_objectives;
create policy "admins write objectives" on public.guild_objectives
for all to authenticated
using (public.is_admin())
with check (public.is_admin() and created_by = auth.uid());

drop policy if exists "members read presence" on public.guild_presence;
create policy "members read presence" on public.guild_presence
for select to authenticated using (public.can_access_guild());

drop policy if exists "users insert own presence" on public.guild_presence;
create policy "users insert own presence" on public.guild_presence
for insert to authenticated
with check (user_id = auth.uid() and public.can_access_guild());

drop policy if exists "users update own presence" on public.guild_presence;
create policy "users update own presence" on public.guild_presence
for update to authenticated
using (user_id = auth.uid() and public.can_access_guild())
with check (user_id = auth.uid() and public.can_access_guild());

drop policy if exists "admins manage presence" on public.guild_presence;
create policy "admins manage presence" on public.guild_presence
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "members read activity wall" on public.guild_activity_wall;
create policy "members read activity wall" on public.guild_activity_wall
for select to authenticated using (public.can_access_guild());

drop policy if exists "admins manage activity wall" on public.guild_activity_wall;
create policy "admins manage activity wall" on public.guild_activity_wall
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "members read public guild chat" on public.guild_chat;
create policy "members read public guild chat" on public.guild_chat
for select to authenticated
using (is_private = false and public.can_access_guild());

drop policy if exists "users read own guild dm" on public.guild_chat;
create policy "users read own guild dm" on public.guild_chat
for select to authenticated
using (is_private = true and (user_id = auth.uid() or recipient_id = auth.uid()));

drop policy if exists "members send guild chat" on public.guild_chat;
create policy "members send guild chat" on public.guild_chat
for insert to authenticated
with check (
  user_id = auth.uid()
  and public.can_access_guild()
  and (
    (is_private = false and recipient_id is null)
    or
    (is_private = true and recipient_id is not null)
  )
);

drop policy if exists "authors update guild chat" on public.guild_chat;
create policy "authors update guild chat" on public.guild_chat
for update to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "authors delete guild chat" on public.guild_chat;
create policy "authors delete guild chat" on public.guild_chat
for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "users read own private messages" on public.private_messages;
create policy "users read own private messages" on public.private_messages
for select to authenticated
using (sender_id = auth.uid() or recipient_id = auth.uid() or public.is_admin());

drop policy if exists "users send private messages" on public.private_messages;
create policy "users send private messages" on public.private_messages
for insert to authenticated
with check (sender_id = auth.uid() and public.can_access_guild());

drop policy if exists "recipients mark private messages read" on public.private_messages;
create policy "recipients mark private messages read" on public.private_messages
for update to authenticated
using (recipient_id = auth.uid() or public.is_admin())
with check (recipient_id = auth.uid() or public.is_admin());

drop policy if exists "participants delete private messages" on public.private_messages;
create policy "participants delete private messages" on public.private_messages
for delete to authenticated
using (sender_id = auth.uid() or recipient_id = auth.uid() or public.is_admin());

drop policy if exists "users read own mailbox" on public.messages;
create policy "users read own mailbox" on public.messages
for select to authenticated
using (sender_id = auth.uid() or recipient_id = auth.uid() or public.is_admin());

drop policy if exists "users send own mailbox" on public.messages;
create policy "users send own mailbox" on public.messages
for insert to authenticated
with check (sender_id = auth.uid());

drop policy if exists "recipients mark mailbox read" on public.messages;
create policy "recipients mark mailbox read" on public.messages
for update to authenticated
using (recipient_id = auth.uid() or public.is_admin())
with check (recipient_id = auth.uid() or public.is_admin());

drop policy if exists "users delete own mailbox" on public.messages;
create policy "users delete own mailbox" on public.messages
for delete to authenticated
using (sender_id = auth.uid() or recipient_id = auth.uid() or public.is_admin());

drop policy if exists "admins read admin logs" on public.admin_logs;
create policy "admins read admin logs" on public.admin_logs
for select to authenticated using (public.is_admin());

drop policy if exists "admins insert admin logs" on public.admin_logs;
create policy "admins insert admin logs" on public.admin_logs
for insert to authenticated with check (public.is_admin() and actor_id = auth.uid());

drop policy if exists "users read own active market" on public.market_orders;
create policy "users read own active market" on public.market_orders
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "users create own market order" on public.market_orders;
create policy "users create own market order" on public.market_orders
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "users delete own market order" on public.market_orders;
create policy "users delete own market order" on public.market_orders
for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "users read own purchase history" on public.purchase_history;
create policy "users read own purchase history" on public.purchase_history
for select to authenticated
using (seller_id = auth.uid() or buyer_id = auth.uid() or public.is_admin());

drop policy if exists "users create own purchase history" on public.purchase_history;
create policy "users create own purchase history" on public.purchase_history
for insert to authenticated
with check (seller_id = auth.uid() or buyer_id = auth.uid() or public.is_admin());

-- =========================================================
-- Storage: private bucket, signed URL model
-- =========================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'iron-oath-storage',
  'iron-oath-storage',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "guild media read own or admin" on storage.objects;
create policy "guild media read own or admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'iron-oath-storage'
  and (
    public.is_admin()
    or (storage.foldername(name))[2] = auth.uid()::text
  )
);

drop policy if exists "guild media upload own prefix" on storage.objects;
create policy "guild media upload own prefix"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'iron-oath-storage'
  and (storage.foldername(name))[1] in ('chat', 'guild-activities')
  and (storage.foldername(name))[2] = auth.uid()::text
  and lower(name) ~ '\.(png|jpg|jpeg|webp)$'
);

drop policy if exists "guild media owner update" on storage.objects;
create policy "guild media owner update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'iron-oath-storage'
  and ((storage.foldername(name))[2] = auth.uid()::text or public.is_admin())
)
with check (
  bucket_id = 'iron-oath-storage'
  and ((storage.foldername(name))[2] = auth.uid()::text or public.is_admin())
  and lower(name) ~ '\.(png|jpg|jpeg|webp)$'
);

drop policy if exists "guild media owner delete" on storage.objects;
create policy "guild media owner delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'iron-oath-storage'
  and ((storage.foldername(name))[2] = auth.uid()::text or public.is_admin())
);

-- =========================================================
-- Realtime
-- =========================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'guild_chat'
     )
  then
    alter publication supabase_realtime add table public.guild_chat;
  end if;
end;
$$;

-- =========================================================
-- Post-install policy inventory
-- =========================================================

select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;
