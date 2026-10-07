-- Nameless map overrides 005. Apply after SCHEMA, SECURITY_PATCH_002,
-- ADMIN_ACTIONS_PATCH and HARDENING_004; then apply MAP_ENTITY_SEED_005.
-- Additive: static catalogue content and existing user data are not rewritten.
begin;

do $$ begin
  if to_regclass('public.user_profiles') is null or to_regclass('public.admin_logs') is null
    or to_regprocedure('public.is_admin()') is null
    or to_regprocedure('public.set_updated_at()') is null
    or to_regprocedure('public.consume_write_budget(uuid,text,integer,integer,integer)') is null
    or to_regprocedure('public.consume_admin_action_limit(uuid,text)') is null then
    raise exception 'map_005_prerequisites_required';
  end if;
end $$;

create table if not exists public.map_entity_registry (
  entity_key text primary key,
  kind text not null,
  floor smallint not null check (floor between 1 and 3),
  marker_type text not null check (marker_type in ('town','dungeon','zone','merchant','quest-primary','quest-secondary','npc','teleporter','boss','creature')),
  constraint map_entity_key_shape check (
    char_length(entity_key) between 1 and 160
    and entity_key ~ '^(location|quest|guide|npc|creature):[A-Za-z0-9][A-Za-z0-9._:-]*$'
    and kind = split_part(entity_key, ':', 1)
  ),
  constraint map_entity_key_floor unique (entity_key, floor)
);

create table if not exists public.map_marker_overrides (
  id uuid primary key default gen_random_uuid(),
  entity_key text not null unique,
  floor smallint not null,
  marker_type text not null check (marker_type in ('town','dungeon','zone','merchant','quest-primary','quest-secondary','npc','teleporter','boss','creature')),
  state text not null default 'visible' check (state in ('visible','hidden','deleted')),
  u double precision,
  v double precision,
  created_by uuid references public.user_profiles(id) on delete set null,
  updated_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint map_marker_entity_floor_fk foreign key (entity_key, floor)
    references public.map_entity_registry(entity_key, floor),
  constraint map_marker_u_finite check (u is null or (u >= 0 and u <= 1 and u <> 'NaN'::double precision)),
  constraint map_marker_v_finite check (v is null or (v >= 0 and v <= 1 and v <> 'NaN'::double precision)),
  constraint map_marker_visible_coordinates check (state <> 'visible' or (u is not null and v is not null))
);
create index if not exists map_marker_overrides_floor_idx on public.map_marker_overrides(floor);

create schema if not exists nameless_private;
revoke all on schema nameless_private from public, anon, authenticated;
create table if not exists nameless_private.map_write_limits (
  subject uuid primary key,
  minute_start timestamptz not null,
  minute_attempts integer not null,
  hour_start timestamptz not null,
  hour_attempts integer not null
);
revoke all on nameless_private.map_write_limits from public, anon, authenticated;

create or replace function nameless_private.consume_map_write_budget(subject_id uuid)
returns boolean language plpgsql security definer set search_path = pg_catalog, public, nameless_private as $$
declare budget nameless_private.map_write_limits%rowtype;
begin
  if subject_id is null then return false; end if;
  insert into nameless_private.map_write_limits(subject,minute_start,minute_attempts,hour_start,hour_attempts)
  values(subject_id,now(),1,now(),1)
  on conflict(subject) do update set
    minute_attempts = case when map_write_limits.minute_start <= now() - interval '1 minute' then 1 else map_write_limits.minute_attempts + 1 end,
    minute_start = case when map_write_limits.minute_start <= now() - interval '1 minute' then now() else map_write_limits.minute_start end,
    hour_attempts = case when map_write_limits.hour_start <= now() - interval '1 hour' then 1 else map_write_limits.hour_attempts + 1 end,
    hour_start = case when map_write_limits.hour_start <= now() - interval '1 hour' then now() else map_write_limits.hour_start end
  returning * into budget;
  return budget.minute_attempts <= 60 and budget.hour_attempts <= 300;
end $$;
revoke all on function nameless_private.consume_map_write_budget(uuid) from public, anon, authenticated;

create or replace function public.guard_map_marker_override()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, nameless_private as $$
declare caller uuid := auth.uid(); request_role text;
begin
  if caller is null then
    -- current_user is the function owner here; use the request's SET ROLE.
    request_role := coalesce(nullif(current_setting('role', true), 'none'), session_user);
    if request_role not in ('postgres','supabase_admin','service_role') then
      raise exception 'map_admin_session_required';
    end if;
  else
    if not public.is_admin() then raise exception 'map_admin_required'; end if;
    if not nameless_private.consume_map_write_budget(caller) then raise exception 'map_write_rate_limited'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if tg_op = 'INSERT' then
    new.id := gen_random_uuid();
    new.created_by := caller;
    new.created_at := now();
  else
    if new.id is distinct from old.id or new.entity_key is distinct from old.entity_key
      or new.floor is distinct from old.floor or new.created_at is distinct from old.created_at
      -- ON DELETE SET NULL may clear a removed profile during privileged
      -- maintenance; browser clients still cannot change the original author.
      or (new.created_by is distinct from old.created_by and not (caller is null and new.created_by is null)) then
      raise exception 'map_marker_identity_immutable';
    end if;
  end if;
  new.updated_by := caller;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.guard_map_marker_override() from public, anon, authenticated;

create or replace function public.audit_map_marker_override()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare marker uuid; entity text; action_name text; details jsonb;
begin
  marker := case when tg_op = 'DELETE' then old.id else new.id end;
  entity := case when tg_op = 'DELETE' then old.entity_key else new.entity_key end;
  action_name := case when tg_op = 'DELETE' then 'map_restore_original'
    when new.state = 'hidden' then 'map_hide' when new.state = 'deleted' then 'map_delete'
    when tg_op = 'INSERT' then 'map_place' else 'map_update' end;
  details := jsonb_build_object('entity_key', entity, 'operation', tg_op,
    'before', case when tg_op = 'INSERT' then null else jsonb_build_object('floor',old.floor,'marker_type',old.marker_type,'state',old.state,'u',old.u,'v',old.v) end,
    'after', case when tg_op = 'DELETE' then null else jsonb_build_object('floor',new.floor,'marker_type',new.marker_type,'state',new.state,'u',new.u,'v',new.v) end);
  -- Failure rolls back the marker and its budget in the same transaction.
  insert into public.admin_logs(actor_id,action,target_table,target_id,details)
  values(auth.uid(),action_name,'map_marker_overrides',marker,details);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function public.audit_map_marker_override() from public, anon, authenticated;

drop trigger if exists trg_map_marker_guard on public.map_marker_overrides;
create trigger trg_map_marker_guard before insert or update or delete on public.map_marker_overrides
  for each row execute function public.guard_map_marker_override();
drop trigger if exists trg_map_marker_audit on public.map_marker_overrides;
create trigger trg_map_marker_audit after insert or update or delete on public.map_marker_overrides
  for each row execute function public.audit_map_marker_override();

alter table public.map_entity_registry enable row level security;
alter table public.map_marker_overrides enable row level security;
revoke all on public.map_entity_registry, public.map_marker_overrides from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.map_entity_registry to anon, authenticated;
grant select, insert, update, delete on public.map_marker_overrides to authenticated;
grant select, insert, update, delete on public.map_entity_registry, public.map_marker_overrides to service_role;
drop policy if exists "map registry public read" on public.map_entity_registry;
create policy "map registry public read" on public.map_entity_registry for select to anon, authenticated using (true);
drop policy if exists "map overrides admin" on public.map_marker_overrides;
create policy "map overrides admin" on public.map_marker_overrides for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Public tombstones suppress baked-in pins without revealing hidden positions
-- or any author metadata. is_admin() remains unavailable to anon.
create or replace function public.read_map_marker_overrides()
returns table(id uuid,entity_key text,floor smallint,marker_type text,state text,u double precision,v double precision)
language sql stable security definer set search_path = pg_catalog, public as $$
  select m.id,m.entity_key,m.floor,m.marker_type,m.state,
    case when m.state = 'visible' then m.u else null end,
    case when m.state = 'visible' then m.v else null end
  from public.map_marker_overrides m order by m.entity_key;
$$;
revoke all on function public.read_map_marker_overrides() from public, anon, authenticated;
grant execute on function public.read_map_marker_overrides() to anon, authenticated;
commit;
