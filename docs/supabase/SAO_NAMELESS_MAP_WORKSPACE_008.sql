-- Nameless atlas workspace 008. Standalone, additive migration.
-- Requires only the existing auth.uid() and public.current_user_role() helpers.
-- Does NOT require or install hardening 004, marker migration 005 or gate 006.
-- Existing marker overrides are retained. Browser writes now use checked RPCs;
-- the legacy direct-write editor must be replaced before deploying this file.
begin;

do $$ begin
  if to_regprocedure('auth.uid()') is null or to_regprocedure('public.current_user_role()') is null then
    raise exception 'map_workspace_role_helpers_required';
  end if;
end $$;

create schema if not exists nameless_private;
revoke all on schema nameless_private from public, anon, authenticated;

create table if not exists public.map_entity_registry (
  entity_key text primary key,
  kind text not null,
  floor smallint not null check(floor between 1 and 3),
  marker_type text not null check(marker_type in ('town','dungeon','zone','merchant','quest-primary','quest-secondary','npc','teleporter','boss','creature')),
  constraint map_entity_key_shape check(char_length(entity_key) between 1 and 160
    and entity_key ~ '^(location|quest|guide|npc|creature):[A-Za-z0-9][A-Za-z0-9._:-]*$'
    and kind=split_part(entity_key,':',1)),
  constraint map_entity_key_floor unique(entity_key,floor)
);
do $$ begin
  perform set_config('nameless.map_workspace_new_publication',case when exists(
    select 1 from information_schema.columns where table_schema='public' and table_name='map_entity_registry' and column_name='published'
  ) then 'false' else 'true' end,true);
end $$;
alter table public.map_entity_registry add column if not exists published boolean not null default false;

create table if not exists public.map_marker_overrides (
  id uuid primary key default gen_random_uuid(),
  entity_key text not null unique,
  floor smallint not null,
  marker_type text not null check(marker_type in ('town','dungeon','zone','merchant','quest-primary','quest-secondary','npc','teleporter','boss','creature')),
  state text not null default 'visible' check(state in ('visible','hidden','deleted')),
  u double precision,
  v double precision,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint map_marker_entity_floor_fk foreign key(entity_key,floor) references public.map_entity_registry(entity_key,floor),
  constraint map_marker_u_finite check(u is null or (u between 0 and 1 and u<>'NaN'::double precision)),
  constraint map_marker_v_finite check(v is null or (v between 0 and 1 and v<>'NaN'::double precision)),
  constraint map_marker_visible_coordinates check(state<>'visible' or (u is not null and v is not null))
);
alter table public.map_marker_overrides add column if not exists revision integer not null default 0 check(revision>=0);

-- An atlas identity is server-owned. Coordinates cannot be silently reused on
-- a different image: region saves must match this exact floor/image pair.
create table if not exists public.map_workspace_atlases (
  floor smallint primary key check(floor between 1 and 3),
  image_id text not null,
  constraint map_atlas_identity unique(floor,image_id)
);
insert into public.map_workspace_atlases(floor,image_id) values
  (1,'/assets/carte.webp'),(2,'/assets/Palier2-map.webp'),(3,'/assets/Palier3-map.webp')
on conflict(floor) do nothing;

create or replace function nameless_private.map_geometry_valid(vertices jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog as $$
declare
  n integer; a jsonb; b jsonb; c jsonb; d jsonb; i integer; j integer;
  ax numeric; ay numeric; bx numeric; byn numeric; cx numeric; cy numeric; dx numeric; dy numeric;
  o1 numeric; o2 numeric; o3 numeric; o4 numeric; area numeric:=0;
begin
  if vertices is null or jsonb_typeof(vertices)<>'array' then return false; end if;
  n:=jsonb_array_length(vertices);
  if n<3 or n>96 then return false; end if;
  for i in 0..n-1 loop
    a:=vertices->i;
    if jsonb_typeof(a)<>'object' or not(a ? 'u' and a ? 'v')
      or (select count(*) from jsonb_object_keys(a))<>2
      or jsonb_typeof(a->'u')<>'number' or jsonb_typeof(a->'v')<>'number' then return false; end if;
    ax:=(a->>'u')::numeric; ay:=(a->>'v')::numeric;
    if ax not between 0 and 1 or ay not between 0 and 1 then return false; end if;
    for j in 0..i-1 loop
      b:=vertices->j;
      if ax=(b->>'u')::numeric and ay=(b->>'v')::numeric then return false; end if;
    end loop;
    b:=vertices->((i+1)%n);
    -- This next point is checked on its own iteration; invalid casts fail closed.
    bx:=(b->>'u')::numeric; byn:=(b->>'v')::numeric;
    area:=area+ax*byn-bx*ay;
  end loop;
  if abs(area)<=0.00000001 then return false; end if;
  -- Nonadjacent edge intersection, including touching and collinear overlap.
  for i in 0..n-1 loop
    a:=vertices->i; b:=vertices->((i+1)%n);
    ax:=(a->>'u')::numeric; ay:=(a->>'v')::numeric;
    bx:=(b->>'u')::numeric; byn:=(b->>'v')::numeric;
    for j in i+1..n-1 loop
      if j=i+1 or (i=0 and j=n-1) then continue; end if;
      c:=vertices->j; d:=vertices->((j+1)%n);
      cx:=(c->>'u')::numeric; cy:=(c->>'v')::numeric;
      dx:=(d->>'u')::numeric; dy:=(d->>'v')::numeric;
      o1:=(bx-ax)*(cy-ay)-(byn-ay)*(cx-ax); o2:=(bx-ax)*(dy-ay)-(byn-ay)*(dx-ax);
      o3:=(dx-cx)*(ay-cy)-(dy-cy)*(ax-cx); o4:=(dx-cx)*(byn-cy)-(dy-cy)*(bx-cx);
      if ((o1>0 and o2<0 or o1<0 and o2>0) and (o3>0 and o4<0 or o3<0 and o4>0))
        or (o1=0 and cx between least(ax,bx) and greatest(ax,bx) and cy between least(ay,byn) and greatest(ay,byn))
        or (o2=0 and dx between least(ax,bx) and greatest(ax,bx) and dy between least(ay,byn) and greatest(ay,byn))
        or (o3=0 and ax between least(cx,dx) and greatest(cx,dx) and ay between least(cy,dy) and greatest(cy,dy))
        or (o4=0 and bx between least(cx,dx) and greatest(cx,dx) and byn between least(cy,dy) and greatest(cy,dy)) then return false; end if;
    end loop;
  end loop;
  return true;
exception when others then return false;
end $$;
revoke all on function nameless_private.map_geometry_valid(jsonb) from public,anon,authenticated;

create table if not exists public.map_region_overrides (
  entity_key text primary key,
  region_id text not null check(region_id ~ '^[a-z0-9][a-z0-9._-]{0,99}$'),
  floor smallint not null,
  image_id text not null,
  status text not null check(status in ('draft','indicative','verified')),
  visible boolean not null default true,
  vertices jsonb not null check(nameless_private.map_geometry_valid(vertices)),
  revision integer not null check(revision>0),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(entity_key,floor) references public.map_entity_registry(entity_key,floor),
  foreign key(floor,image_id) references public.map_workspace_atlases(floor,image_id),
  unique(floor,region_id)
);
create table if not exists nameless_private.map_workspace_revisions (
  kind text not null check(kind in ('marker','region')),
  entity_key text not null references public.map_entity_registry(entity_key),
  revision integer not null check(revision>=0),
  primary key(kind,entity_key)
);
create table if not exists public.map_custom_markers (
  entity_key text primary key check(entity_key ~ '^custom:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  title text not null check(char_length(btrim(title)) between 1 and 160),
  description text not null default '' check(char_length(description)<=2048),
  floor smallint not null,
  image_id text not null,
  marker_type text not null check(marker_type in ('town','dungeon','zone','merchant','quest-primary','quest-secondary','npc','teleporter','boss','creature')),
  state text not null check(state in ('draft','visible','hidden','deleted')),
  u double precision,
  v double precision,
  revision integer not null check(revision>0),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(floor,image_id) references public.map_workspace_atlases(floor,image_id),
  check(u is null or (u between 0 and 1 and u<>'NaN'::double precision)),
  check(v is null or (v between 0 and 1 and v<>'NaN'::double precision)),
  check(state<>'visible' or (u is not null and v is not null))
);
create table if not exists nameless_private.map_workspace_limits (
  subject uuid primary key,
  minute_start timestamptz not null,
  minute_attempts integer not null,
  hour_start timestamptz not null,
  hour_attempts integer not null
);
create table if not exists nameless_private.map_workspace_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  action text not null,
  entity_key text not null,
  before_record jsonb,
  after_record jsonb,
  created_at timestamptz not null default now()
);
revoke all on nameless_private.map_workspace_revisions,nameless_private.map_workspace_limits,nameless_private.map_workspace_audit from public,anon,authenticated;

create or replace function nameless_private.map_workspace_require_admin()
returns uuid language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare caller uuid:=auth.uid();
begin
  if caller is null or public.current_user_role() is distinct from 'admin' then
    raise exception 'map_admin_required' using errcode='42501';
  end if;
  return caller;
end $$;
revoke all on function nameless_private.map_workspace_require_admin() from public,anon,authenticated;

create or replace function nameless_private.map_workspace_consume_budget(subject_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,nameless_private as $$
declare budget nameless_private.map_workspace_limits%rowtype;
begin
  insert into nameless_private.map_workspace_limits values(subject_id,now(),1,now(),1)
  on conflict(subject) do update set
    minute_attempts=case when map_workspace_limits.minute_start<=now()-interval '1 minute' then 1 else map_workspace_limits.minute_attempts+1 end,
    minute_start=case when map_workspace_limits.minute_start<=now()-interval '1 minute' then now() else map_workspace_limits.minute_start end,
    hour_attempts=case when map_workspace_limits.hour_start<=now()-interval '1 hour' then 1 else map_workspace_limits.hour_attempts+1 end,
    hour_start=case when map_workspace_limits.hour_start<=now()-interval '1 hour' then now() else map_workspace_limits.hour_start end
  returning * into budget;
  if budget.minute_attempts>60 or budget.hour_attempts>300 then raise exception 'map_write_rate_limited' using errcode='54000'; end if;
end $$;
revoke all on function nameless_private.map_workspace_consume_budget(uuid) from public,anon,authenticated;

create or replace function nameless_private.map_workspace_next_revision(p_kind text,p_entity_key text,p_expected_revision integer)
returns integer language plpgsql security definer set search_path=pg_catalog,public,nameless_private as $$
declare found_revision integer;
begin
  -- Parent identity exists even before the first override, so this row lock also
  -- serializes concurrent first saves and resets. Revisions survive reset.
  perform 1 from public.map_entity_registry where entity_key=p_entity_key and published for update;
  if not found then raise exception 'map_unknown_entity' using errcode='22023'; end if;
  insert into nameless_private.map_workspace_revisions(kind,entity_key,revision) values(p_kind,p_entity_key,0) on conflict do nothing;
  select revision into found_revision from nameless_private.map_workspace_revisions where kind=p_kind and entity_key=p_entity_key for update;
  if p_expected_revision is null or p_expected_revision<0 or found_revision<>p_expected_revision then
    raise exception 'map_revision_conflict' using errcode='40001';
  end if;
  update nameless_private.map_workspace_revisions set revision=found_revision+1 where kind=p_kind and entity_key=p_entity_key;
  return found_revision+1;
end $$;
revoke all on function nameless_private.map_workspace_next_revision(text,text,integer) from public,anon,authenticated;

-- Replace legacy 005 browser triggers only. Their validation is now performed
-- inside the checked RPC; private atomic budgets/audit below need no 004 helpers.
drop trigger if exists trg_map_marker_guard on public.map_marker_overrides;
drop trigger if exists trg_map_marker_audit on public.map_marker_overrides;

alter table public.map_entity_registry enable row level security;
alter table public.map_marker_overrides enable row level security;
alter table public.map_region_overrides enable row level security;
alter table public.map_workspace_atlases enable row level security;
alter table public.map_custom_markers enable row level security;
revoke all on public.map_entity_registry,public.map_marker_overrides,public.map_region_overrides,public.map_workspace_atlases,public.map_custom_markers from public,anon,authenticated;
-- Legacy 005 service grants cannot bypass the RPC-only validation layer.
revoke insert,update,delete on public.map_entity_registry,public.map_marker_overrides,public.map_region_overrides,public.map_workspace_atlases,public.map_custom_markers from service_role;
grant usage on schema public to anon,authenticated;
grant select on public.map_entity_registry,public.map_workspace_atlases to anon,authenticated;
grant select on public.map_marker_overrides,public.map_region_overrides,public.map_custom_markers to authenticated;
drop policy if exists "map registry public read" on public.map_entity_registry;
create policy "map registry public read" on public.map_entity_registry for select to anon,authenticated using(published);
drop policy if exists "map registry admin read" on public.map_entity_registry;
create policy "map registry admin read" on public.map_entity_registry for select to authenticated using(public.current_user_role()='admin');
drop policy if exists "map overrides admin" on public.map_marker_overrides;
create policy "map overrides admin" on public.map_marker_overrides for all to authenticated using(public.current_user_role()='admin') with check(public.current_user_role()='admin');
drop policy if exists "map regions admin" on public.map_region_overrides;
create policy "map regions admin" on public.map_region_overrides for all to authenticated using(public.current_user_role()='admin') with check(public.current_user_role()='admin');
drop policy if exists "map atlas public read" on public.map_workspace_atlases;
create policy "map atlas public read" on public.map_workspace_atlases for select to anon,authenticated using(true);
drop policy if exists "map custom admin" on public.map_custom_markers;
create policy "map custom admin" on public.map_custom_markers for all to authenticated using(public.current_user_role()='admin') with check(public.current_user_role()='admin');

create or replace function public.read_map_marker_overrides()
returns table(id uuid,entity_key text,floor smallint,marker_type text,state text,u double precision,v double precision)
language sql stable security definer set search_path=pg_catalog,public as $$
  select m.id,m.entity_key,m.floor,m.marker_type,m.state,
    case when m.state='visible' then m.u else null end,
    case when m.state='visible' then m.v else null end
  from public.map_marker_overrides m join public.map_entity_registry r on r.entity_key=m.entity_key and r.floor=m.floor where r.published
  union all
  select null::uuid,r.entity_key,r.floor,r.marker_type,'hidden'::text,null::double precision,null::double precision
  from public.map_entity_registry r where not r.published
  order by entity_key;
$$;
revoke all on function public.read_map_marker_overrides() from public,anon,authenticated;
grant execute on function public.read_map_marker_overrides() to anon,authenticated;

create or replace function public.read_map_regions()
returns table(floor smallint,image_id text,entity_key text,region_id text,status text,visible boolean,vertices jsonb,revision integer)
language sql stable security definer set search_path=pg_catalog,public as $$
  select g.floor,g.image_id,g.entity_key,g.region_id,
    case when g.visible and g.status<>'draft' and r.published then g.status else null end,
    (g.visible and g.status<>'draft' and r.published),
    case when g.visible and g.status<>'draft' and r.published then g.vertices else null end,
    g.revision
  from public.map_region_overrides g join public.map_entity_registry r on r.entity_key=g.entity_key and r.floor=g.floor
  order by g.floor,g.entity_key;
$$;
revoke all on function public.read_map_regions() from public,anon,authenticated;
grant execute on function public.read_map_regions() to anon,authenticated;

create or replace function public.read_map_custom_markers()
returns table(entity_key text,title text,description text,floor smallint,image_id text,marker_type text,state text,u double precision,v double precision,revision integer)
language sql stable security definer set search_path=pg_catalog,public as $$
  select m.entity_key,m.title,m.description,m.floor,m.image_id,m.marker_type,m.state,m.u,m.v,m.revision
  from public.map_custom_markers m where m.state='visible' order by m.floor,m.entity_key;
$$;
revoke all on function public.read_map_custom_markers() from public,anon,authenticated;
grant execute on function public.read_map_custom_markers() to anon,authenticated;

create or replace function public.map_workspace_read()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,nameless_private as $$
begin
  perform nameless_private.map_workspace_require_admin();
  return jsonb_build_object(
    'markers',coalesce((select jsonb_agg(to_jsonb(m)-'created_by'-'updated_by' order by m.entity_key) from public.map_marker_overrides m),'[]'::jsonb),
    'regions',coalesce((select jsonb_agg(to_jsonb(g)-'created_by'-'updated_by' order by g.entity_key) from public.map_region_overrides g),'[]'::jsonb),
    'custom_markers',coalesce((select jsonb_agg(to_jsonb(c)-'created_by'-'updated_by' order by c.entity_key) from public.map_custom_markers c),'[]'::jsonb),
    'maps',coalesce((select jsonb_agg(to_jsonb(a) order by a.floor) from public.map_workspace_atlases a),'[]'::jsonb),
    'registry',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object(
      'marker_revision',coalesce((select v.revision from nameless_private.map_workspace_revisions v where v.kind='marker' and v.entity_key=r.entity_key),0),
      'region_revision',coalesce((select v.revision from nameless_private.map_workspace_revisions v where v.kind='region' and v.entity_key=r.entity_key),0)) order by r.entity_key)
      from public.map_entity_registry r where r.published),'[]'::jsonb));
end $$;
revoke all on function public.map_workspace_read() from public,anon,authenticated;
grant execute on function public.map_workspace_read() to authenticated;

create or replace function public.map_workspace_save_marker(p_entity_key text,p_state text,p_u double precision,p_v double precision,p_expected_revision integer,p_marker_type text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,nameless_private as $$
declare caller uuid; identity public.map_entity_registry%rowtype; old_record jsonb; saved public.map_marker_overrides%rowtype; new_revision integer; requested_type text;
begin
  caller:=nameless_private.map_workspace_require_admin();
  select * into identity from public.map_entity_registry where entity_key=p_entity_key and published;
  if not found then raise exception 'map_unknown_entity' using errcode='22023'; end if;
  requested_type:=coalesce(p_marker_type,identity.marker_type);
  if p_state is null or p_state not in ('visible','hidden','deleted') or requested_type not in ('town','dungeon','zone','merchant','quest-primary','quest-secondary','npc','teleporter','boss','creature')
    or (p_state='visible' and (p_u is null or p_v is null))
    or (p_u is not null and not(p_u between 0 and 1 and p_u<>'NaN'::double precision))
    or (p_v is not null and not(p_v between 0 and 1 and p_v<>'NaN'::double precision)) then raise exception 'map_invalid_marker' using errcode='22023'; end if;
  new_revision:=nameless_private.map_workspace_next_revision('marker',p_entity_key,p_expected_revision);
  perform nameless_private.map_workspace_consume_budget(caller);
  select to_jsonb(m) into old_record from public.map_marker_overrides m where m.entity_key=p_entity_key;
  insert into public.map_marker_overrides(entity_key,floor,marker_type,state,u,v,revision,created_by,updated_by)
    values(p_entity_key,identity.floor,requested_type,p_state,p_u,p_v,new_revision,caller,caller)
  on conflict(entity_key) do update set marker_type=excluded.marker_type,state=excluded.state,u=excluded.u,v=excluded.v,
    revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now()
  returning * into saved;
  insert into nameless_private.map_workspace_audit(actor_id,action,entity_key,before_record,after_record)
    values(caller,'marker_'||p_state,p_entity_key,old_record,to_jsonb(saved));
  return jsonb_build_object('revision',new_revision,'record',to_jsonb(saved)-'created_by'-'updated_by');
end $$;
revoke all on function public.map_workspace_save_marker(text,text,double precision,double precision,integer,text) from public,anon,authenticated;
grant execute on function public.map_workspace_save_marker(text,text,double precision,double precision,integer,text) to authenticated;

create or replace function public.map_workspace_save_region(p_entity_key text,p_region_id text,p_floor integer,p_image_id text,p_status text,p_visible boolean,p_vertices jsonb,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,nameless_private as $$
declare caller uuid; old_record jsonb; saved public.map_region_overrides%rowtype; new_revision integer;
begin
  caller:=nameless_private.map_workspace_require_admin();
  if p_region_id is null or p_region_id !~ '^[a-z0-9][a-z0-9._-]{0,99}$'
    or p_status is null or p_status not in ('draft','indicative','verified') or p_visible is null
    or not nameless_private.map_geometry_valid(p_vertices) then raise exception 'map_invalid_region' using errcode='22023'; end if;
  if not exists(select 1 from public.map_entity_registry where entity_key=p_entity_key and floor=p_floor and kind='location' and published)
    or not exists(select 1 from public.map_workspace_atlases where floor=p_floor and image_id=p_image_id) then
    raise exception 'map_region_identity_mismatch' using errcode='22023'; end if;
  new_revision:=nameless_private.map_workspace_next_revision('region',p_entity_key,p_expected_revision);
  perform nameless_private.map_workspace_consume_budget(caller);
  select to_jsonb(g) into old_record from public.map_region_overrides g where g.entity_key=p_entity_key;
  if old_record is not null and (old_record->>'region_id'<>p_region_id or (old_record->>'floor')::integer<>p_floor or old_record->>'image_id'<>p_image_id) then
    raise exception 'map_region_identity_immutable' using errcode='22023'; end if;
  insert into public.map_region_overrides(entity_key,region_id,floor,image_id,status,visible,vertices,revision,created_by,updated_by)
    values(p_entity_key,p_region_id,p_floor,p_image_id,p_status,p_visible,p_vertices,new_revision,caller,caller)
  on conflict(entity_key) do update set status=excluded.status,visible=excluded.visible,vertices=excluded.vertices,
    revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now()
  returning * into saved;
  insert into nameless_private.map_workspace_audit(actor_id,action,entity_key,before_record,after_record)
    values(caller,'region_'||p_status,p_entity_key,old_record,to_jsonb(saved));
  return jsonb_build_object('revision',new_revision,'record',to_jsonb(saved)-'created_by'-'updated_by');
end $$;
revoke all on function public.map_workspace_save_region(text,text,integer,text,text,boolean,jsonb,integer) from public,anon,authenticated;
grant execute on function public.map_workspace_save_region(text,text,integer,text,text,boolean,jsonb,integer) to authenticated;

create or replace function nameless_private.map_workspace_reset(p_kind text,p_entity_key text,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,nameless_private as $$
declare caller uuid; old_record jsonb; new_revision integer;
begin
  caller:=nameless_private.map_workspace_require_admin();
  new_revision:=nameless_private.map_workspace_next_revision(p_kind,p_entity_key,p_expected_revision);
  perform nameless_private.map_workspace_consume_budget(caller);
  if p_kind='marker' then
    select to_jsonb(m) into old_record from public.map_marker_overrides m where m.entity_key=p_entity_key;
    delete from public.map_marker_overrides where entity_key=p_entity_key;
  elsif p_kind='region' then
    select to_jsonb(g) into old_record from public.map_region_overrides g where g.entity_key=p_entity_key;
    delete from public.map_region_overrides where entity_key=p_entity_key;
  else raise exception 'map_invalid_kind' using errcode='22023'; end if;
  insert into nameless_private.map_workspace_audit(actor_id,action,entity_key,before_record,after_record)
    values(caller,p_kind||'_restore_original',p_entity_key,old_record,null);
  return jsonb_build_object('revision',new_revision,'reset',true);
end $$;
revoke all on function nameless_private.map_workspace_reset(text,text,integer) from public,anon,authenticated;

create or replace function public.map_workspace_reset_marker(p_entity_key text,p_expected_revision integer)
returns jsonb language sql security definer set search_path=pg_catalog,nameless_private as $$
  select nameless_private.map_workspace_reset('marker',p_entity_key,p_expected_revision);
$$;
create or replace function public.map_workspace_reset_region(p_entity_key text,p_expected_revision integer)
returns jsonb language sql security definer set search_path=pg_catalog,nameless_private as $$
  select nameless_private.map_workspace_reset('region',p_entity_key,p_expected_revision);
$$;
revoke all on function public.map_workspace_reset_marker(text,integer),public.map_workspace_reset_region(text,integer) from public,anon,authenticated;
grant execute on function public.map_workspace_reset_marker(text,integer),public.map_workspace_reset_region(text,integer) to authenticated;

create or replace function public.map_workspace_save_custom_marker(p_entity_key text,p_title text,p_description text,p_marker_type text,p_floor integer,p_image_id text,p_state text,p_u double precision,p_v double precision,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,nameless_private as $$
declare caller uuid; target_key text; previous public.map_custom_markers%rowtype; saved public.map_custom_markers%rowtype; old_record jsonb; new_revision integer;
begin
  caller:=nameless_private.map_workspace_require_admin();
  if p_title is null or char_length(btrim(p_title)) not between 1 and 160 or char_length(coalesce(p_description,''))>2048
    or p_marker_type is null or p_marker_type not in ('town','dungeon','zone','merchant','quest-primary','quest-secondary','npc','teleporter','boss','creature')
    or p_state is null or p_state not in ('draft','visible','hidden')
    or (p_state='visible' and (p_u is null or p_v is null))
    or (p_u is not null and not(p_u between 0 and 1 and p_u<>'NaN'::double precision))
    or (p_v is not null and not(p_v between 0 and 1 and p_v<>'NaN'::double precision)) then raise exception 'map_invalid_custom_marker' using errcode='22023'; end if;
  if not exists(select 1 from public.map_workspace_atlases where floor=p_floor and image_id=p_image_id) then
    raise exception 'map_region_identity_mismatch' using errcode='22023'; end if;
  if p_entity_key is null then
    if p_expected_revision is distinct from 0 then raise exception 'map_revision_conflict' using errcode='40001'; end if;
    target_key:='custom:'||gen_random_uuid()::text; new_revision:=1;
  else
    select * into previous from public.map_custom_markers where entity_key=p_entity_key for update;
    if not found then raise exception 'map_unknown_entity' using errcode='22023'; end if;
    if p_expected_revision is null or previous.revision<>p_expected_revision then raise exception 'map_revision_conflict' using errcode='40001'; end if;
    if previous.floor<>p_floor or previous.image_id<>p_image_id then raise exception 'map_custom_identity_immutable' using errcode='22023'; end if;
    target_key:=previous.entity_key; new_revision:=previous.revision+1; old_record:=to_jsonb(previous);
  end if;
  perform nameless_private.map_workspace_consume_budget(caller);
  insert into public.map_custom_markers(entity_key,title,description,floor,image_id,marker_type,state,u,v,revision,created_by,updated_by)
    values(target_key,btrim(p_title),coalesce(p_description,''),p_floor,p_image_id,p_marker_type,p_state,p_u,p_v,new_revision,caller,caller)
  on conflict(entity_key) do update set title=excluded.title,description=excluded.description,marker_type=excluded.marker_type,state=excluded.state,
    u=excluded.u,v=excluded.v,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now()
  returning * into saved;
  insert into nameless_private.map_workspace_audit(actor_id,action,entity_key,before_record,after_record)
    values(caller,'custom_'||p_state,target_key,old_record,to_jsonb(saved));
  return jsonb_build_object('revision',new_revision,'record',to_jsonb(saved)-'created_by'-'updated_by');
end $$;
revoke all on function public.map_workspace_save_custom_marker(text,text,text,text,integer,text,text,double precision,double precision,integer) from public,anon,authenticated;
grant execute on function public.map_workspace_save_custom_marker(text,text,text,text,integer,text,text,double precision,double precision,integer) to authenticated;

create or replace function public.map_workspace_delete_custom_marker(p_entity_key text,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,nameless_private as $$
declare caller uuid; previous public.map_custom_markers%rowtype; saved public.map_custom_markers%rowtype;
begin
  caller:=nameless_private.map_workspace_require_admin();
  select * into previous from public.map_custom_markers where entity_key=p_entity_key for update;
  if not found then raise exception 'map_unknown_entity' using errcode='22023'; end if;
  if p_expected_revision is null or previous.revision<>p_expected_revision then raise exception 'map_revision_conflict' using errcode='40001'; end if;
  perform nameless_private.map_workspace_consume_budget(caller);
  update public.map_custom_markers set state='deleted',u=null,v=null,revision=previous.revision+1,updated_by=caller,updated_at=now()
    where entity_key=p_entity_key returning * into saved;
  insert into nameless_private.map_workspace_audit(actor_id,action,entity_key,before_record,after_record)
    values(caller,'custom_delete',p_entity_key,to_jsonb(previous),to_jsonb(saved));
  return jsonb_build_object('revision',saved.revision,'record',to_jsonb(saved)-'created_by'-'updated_by');
end $$;
revoke all on function public.map_workspace_delete_custom_marker(text,integer) from public,anon,authenticated;
grant execute on function public.map_workspace_delete_custom_marker(text,integer) to authenticated;

-- Existing public map catalogue identities only; no fabricated entity seed.
insert into public.map_entity_registry(entity_key,kind,floor,marker_type,published) values
  ('location:1:ville-depart','location',1,'town',true),
  ('location:1:hanaka','location',1,'town',true),
  ('location:1:mizunari','location',1,'town',true),
  ('location:1:tolbana','location',1,'town',true),
  ('location:1:virelune','location',1,'town',true),
  ('location:1:valhat','location',1,'town',true),
  ('location:1:donjon-geldorak','location',1,'dungeon',true),
  ('location:1:donjon-ruine','location',1,'dungeon',true),
  ('location:1:donjon-labyrinthe','location',1,'dungeon',true),
  ('location:1:donjon-xalzirith','location',1,'dungeon',true),
  ('location:1:donjon-kobold','location',1,'dungeon',true),
  ('location:1:marchand-depart','location',1,'merchant',true),
  ('location:1:marchand-outils','location',1,'merchant',true),
  ('location:1:forgeron-armure-depart','location',1,'merchant',true),
  ('location:1:forgeron-arme-depart','location',1,'merchant',true),
  ('location:1:marchand-mizunari','location',1,'merchant',true),
  ('location:1:marchand-tolbana','location',1,'merchant',true),
  ('location:1:marchand-donjon-ruine','location',1,'merchant',true),
  ('location:1:forgeron-arme-tolbana','location',1,'merchant',true),
  ('location:1:forgeron-armure-tolbana','location',1,'merchant',true),
  ('location:1:forgeron-donjon','location',1,'merchant',true),
  ('location:1:zone-sanglier','location',1,'zone',true),
  ('location:1:vallee-loups','location',1,'zone',true),
  ('location:1:ruines-maudites','location',1,'zone',true),
  ('location:1:archipel-ika','location',1,'zone',true),
  ('location:1:montagnes-bandits','location',1,'zone',true),
  ('location:1:bois-sacree','location',1,'zone',true),
  ('location:1:marecage-putride','location',1,'zone',true),
  ('location:1:champ-nephantes','location',1,'zone',true),
  ('location:1:foret-noir','location',1,'zone',true),
  ('location:1:atlantide','location',1,'zone',true),
  ('location:1:montagne-cerfs','location',1,'zone',true),
  ('location:1:citadelle-glace','location',1,'zone',true),
  ('quest:1:secondary-varn','quest',1,'quest-secondary',true),
  ('quest:1:secondary-nacht','quest',1,'quest-secondary',true),
  ('quest:1:secondary-milla','quest',1,'quest-secondary',true),
  ('quest:1:secondary-inari','quest',1,'quest-secondary',true),
  ('quest:1:secondary-orin','quest',1,'quest-secondary',true),
  ('quest:1:secondary-rikyu','quest',1,'quest-secondary',true),
  ('quest:1:secondary-bunta','quest',1,'quest-secondary',true),
  ('quest:1:secondary-meiko','quest',1,'quest-secondary',true),
  ('quest:1:secondary-saria','quest',1,'quest-secondary',true),
  ('quest:1:secondary-tilda','quest',1,'quest-secondary',true),
  ('quest:1:secondary-lila','quest',1,'quest-secondary',true),
  ('quest:1:secondary-genzo','quest',1,'quest-secondary',true),
  ('quest:1:secondary-bartok','quest',1,'quest-secondary',true),
  ('quest:1:secondary-greta','quest',1,'quest-secondary',true),
  ('quest:1:secondary-therra','quest',1,'quest-secondary',true),
  ('quest:1:secondary-toban','quest',1,'quest-secondary',true),
  ('quest:1:secondary-rina','quest',1,'quest-secondary',true),
  ('quest:1:secondary-maya','quest',1,'quest-secondary',true),
  ('quest:1:secondary-michelle','quest',1,'quest-secondary',true),
  ('quest:1:secondary-martine','quest',1,'quest-secondary',true),
  ('quest:1:secondary-elwyn','quest',1,'quest-secondary',true),
  ('quest:1:secondary-louise','quest',1,'quest-secondary',true),
  ('quest:1:secondary-phares','quest',1,'quest-secondary',true),
  ('quest:1:secondary-zebulgarath','quest',1,'quest-secondary',true),
  ('quest:1:secondary-saya','quest',1,'quest-secondary',true),
  ('quest:1:secondary-ayaka','quest',1,'quest-secondary',true),
  ('quest:1:secondary-daiki','quest',1,'quest-secondary',true),
  ('quest:1:secondary-jean','quest',1,'quest-secondary',true),
  ('quest:1:secondary-corentin','quest',1,'quest-secondary',true),
  ('quest:1:secondary-fira','quest',1,'quest-secondary',true),
  ('quest:1:secondary-yannis','quest',1,'quest-secondary',true),
  ('quest:1:secondary-gilmar','quest',1,'quest-secondary',true),
  ('quest:1:secondary-tomoko','quest',1,'quest-secondary',true),
  ('quest:1:secondary-pierre','quest',1,'quest-secondary',true),
  ('quest:1:secondary-romeo','quest',1,'quest-secondary',true),
  ('quest:1:secondary-emilie','quest',1,'quest-secondary',true),
  ('quest:1:secondary-juliette','quest',1,'quest-secondary',true),
  ('quest:1:secondary-luc','quest',1,'quest-secondary',true),
  ('quest:1:secondary-sam','quest',1,'quest-secondary',true),
  ('quest:1:secondary-monique','quest',1,'quest-secondary',true),
  ('quest:1:secondary-gilbert','quest',1,'quest-secondary',true),
  ('quest:1:secondary-horace','quest',1,'quest-secondary',true),
  ('quest:1:secondary-haruto','quest',1,'quest-secondary',true),
  ('quest:2:floor2-secondary-1','quest',2,'quest-secondary',true),
  ('quest:2:floor2-secondary-2','quest',2,'quest-secondary',true),
  ('quest:2:floor2-secondary-3','quest',2,'quest-secondary',true),
  ('quest:2:floor2-secondary-4','quest',2,'quest-secondary',true),
  ('quest:2:floor2-secondary-5','quest',2,'quest-secondary',true),
  ('quest:2:floor2-secondary-6','quest',2,'quest-secondary',true),
  ('quest:2:floor2-secondary-7','quest',2,'quest-secondary',true),
  ('quest:2:floor2-secondary-8','quest',2,'quest-secondary',true),
  ('quest:2:floor2-secondary-9','quest',2,'quest-secondary',true),
  ('quest:2:floor2-secondary-10','quest',2,'quest-secondary',true),
  ('quest:2:floor2-secondary-11','quest',2,'quest-secondary',true),
  ('quest:2:floor2-secondary-12','quest',2,'quest-secondary',true),
  ('quest:2:floor2-secondary-13','quest',2,'quest-secondary',true),
  ('quest:2:floor2-secondary-14','quest',2,'quest-secondary',true),
  ('quest:2:floor2-secondary-15','quest',2,'quest-secondary',true),
  ('quest:2:floor2-secondary-16','quest',2,'quest-secondary',true),
  ('guide:p1-secondaire-varn','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-milla','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-inari','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-orin','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-rikyu','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-bunta','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-meiko','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-saria','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-tilda','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-lila','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-genzo','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-bartok','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-greta','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-soeur-therra','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-toban','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-rina','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-maya','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-michelle','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-martine','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-elwyn','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-louise','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-phares','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-zebulgarath','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-saya','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-ayaka','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-daiki','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-jean','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-corentin','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-fira','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-yannis','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-gilmar','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-tomoko','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-pierre','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-romeo','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-emilie','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-juliette','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-luc','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-sam','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-monique','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-gilbert','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-horace','guide',1,'quest-secondary',true),
  ('guide:p1-secondaire-haruto','guide',1,'quest-secondary',true),
  ('guide:p2-secondaire-minutiare','guide',2,'quest-secondary',true),
  ('guide:p2-secondaire-shii','guide',2,'quest-secondary',true),
  ('guide:p2-secondaire-elyen','guide',2,'quest-secondary',true),
  ('guide:p2-secondaire-charles','guide',2,'quest-secondary',true),
  ('guide:p2-secondaire-ifa','guide',2,'quest-secondary',true),
  ('guide:p2-secondaire-ife','guide',2,'quest-secondary',true),
  ('guide:p2-secondaire-sissou','guide',2,'quest-secondary',true),
  ('guide:p2-secondaire-frank','guide',2,'quest-secondary',true),
  ('guide:p2-secondaire-poris','guide',2,'quest-secondary',true),
  ('guide:p2-secondaire-itamii','guide',2,'quest-secondary',true),
  ('guide:p2-secondaire-baraka','guide',2,'quest-secondary',true),
  ('guide:p2-secondaire-mansa','guide',2,'quest-secondary',true),
  ('guide:p2-secondaire-nora','guide',2,'quest-secondary',true),
  ('guide:p2-secondaire-chasseur-de-dragon','guide',2,'quest-secondary',true),
  ('guide:p2-secondaire-samaeltvs','guide',2,'quest-secondary',true),
  ('guide:p2-secondaire-havca','guide',2,'quest-secondary',true),
  ('npc:1:varn','npc',1,'npc',true),
  ('npc:1:milla','npc',1,'npc',true),
  ('npc:1:inari','npc',1,'npc',true),
  ('npc:1:orin','npc',1,'npc',true),
  ('npc:1:rikyu','npc',1,'npc',true),
  ('npc:1:bunta','npc',1,'npc',true),
  ('npc:1:meiko','npc',1,'npc',true),
  ('npc:1:saria','npc',1,'npc',true),
  ('npc:1:tilda','npc',1,'npc',true),
  ('npc:1:lila','npc',1,'npc',true),
  ('npc:1:genzo','npc',1,'npc',true),
  ('npc:1:bartok','npc',1,'npc',true),
  ('npc:1:greta','npc',1,'npc',true),
  ('npc:1:soeur-therra','npc',1,'npc',true),
  ('npc:1:toban','npc',1,'npc',true),
  ('npc:1:rina','npc',1,'npc',true),
  ('npc:1:maya','npc',1,'npc',true),
  ('npc:1:michelle','npc',1,'npc',true),
  ('npc:1:martine','npc',1,'npc',true),
  ('npc:1:elwyn','npc',1,'npc',true),
  ('npc:1:louise','npc',1,'npc',true),
  ('npc:1:phares','npc',1,'npc',true),
  ('npc:1:zebulgarath','npc',1,'npc',true),
  ('npc:1:saya','npc',1,'npc',true),
  ('npc:1:ayaka','npc',1,'npc',true),
  ('npc:1:daiki','npc',1,'npc',true),
  ('npc:1:jean','npc',1,'npc',true),
  ('npc:1:corentin','npc',1,'npc',true),
  ('npc:1:fira','npc',1,'npc',true),
  ('npc:1:yannis','npc',1,'npc',true),
  ('npc:1:gilmar','npc',1,'npc',true),
  ('npc:1:tomoko','npc',1,'npc',true),
  ('npc:1:pierre','npc',1,'npc',true),
  ('npc:1:romeo','npc',1,'npc',true),
  ('npc:1:emilie','npc',1,'npc',true),
  ('npc:1:juliette','npc',1,'npc',true),
  ('npc:1:luc','npc',1,'npc',true),
  ('npc:1:sam','npc',1,'npc',true),
  ('npc:1:monique','npc',1,'npc',true),
  ('npc:1:gilbert','npc',1,'npc',true),
  ('npc:1:horace','npc',1,'npc',true),
  ('npc:1:haruto','npc',1,'npc',true),
  ('npc:2:minutiare','npc',2,'npc',true),
  ('npc:2:shii','npc',2,'npc',true),
  ('npc:2:elyen','npc',2,'npc',true),
  ('npc:2:charles','npc',2,'npc',true),
  ('npc:2:ifa','npc',2,'npc',true),
  ('npc:2:ife','npc',2,'npc',true),
  ('npc:2:sissou','npc',2,'npc',true),
  ('npc:2:frank','npc',2,'npc',true),
  ('npc:2:poris','npc',2,'npc',true),
  ('npc:2:itamii','npc',2,'npc',true),
  ('npc:2:baraka','npc',2,'npc',true),
  ('npc:2:mansa','npc',2,'npc',true),
  ('npc:2:nora','npc',2,'npc',true),
  ('npc:2:chasseur-de-dragon','npc',2,'npc',true),
  ('npc:2:samaeltvs','npc',2,'npc',true),
  ('npc:2:havca','npc',2,'npc',true),
  ('npc:1:nacht','npc',1,'npc',true),
  ('creature:1','creature',1,'boss',true),
  ('creature:2','creature',1,'creature',true),
  ('creature:3','creature',1,'creature',true),
  ('creature:4','creature',1,'creature',true),
  ('creature:5','creature',1,'creature',true),
  ('creature:6','creature',1,'creature',true),
  ('creature:7','creature',1,'creature',true),
  ('creature:8','creature',1,'creature',true),
  ('creature:9','creature',1,'creature',true),
  ('creature:10','creature',1,'creature',true),
  ('creature:11','creature',1,'boss',true),
  ('creature:12','creature',1,'creature',true),
  ('creature:13','creature',1,'creature',true),
  ('creature:14','creature',1,'creature',true),
  ('creature:15','creature',1,'boss',true),
  ('creature:16','creature',1,'boss',true),
  ('creature:17','creature',1,'boss',true),
  ('creature:18','creature',1,'boss',true),
  ('creature:19','creature',1,'boss',true),
  ('creature:20','creature',1,'creature',true),
  ('creature:21','creature',1,'boss',true),
  ('creature:22','creature',1,'creature',true),
  ('creature:23','creature',1,'creature',true),
  ('creature:24','creature',1,'creature',true),
  ('creature:25','creature',1,'creature',true),
  ('creature:26','creature',1,'creature',true),
  ('creature:27','creature',1,'creature',true),
  ('creature:28','creature',1,'creature',true),
  ('creature:29','creature',1,'creature',true),
  ('creature:30','creature',1,'creature',true),
  ('creature:31','creature',1,'creature',true),
  ('creature:32','creature',1,'creature',true),
  ('creature:33','creature',1,'creature',true),
  ('creature:34','creature',1,'creature',true),
  ('creature:35','creature',1,'creature',true),
  ('creature:36','creature',1,'creature',true),
  ('creature:37','creature',1,'creature',true),
  ('creature:38','creature',1,'creature',true),
  ('creature:39','creature',1,'creature',true),
  ('creature:40','creature',1,'creature',true),
  ('creature:41','creature',1,'creature',true),
  ('creature:42','creature',1,'creature',true),
  ('creature:43','creature',1,'boss',true),
  ('creature:44','creature',1,'boss',true),
  ('creature:45','creature',1,'creature',true),
  ('creature:46','creature',1,'creature',true),
  ('creature:47','creature',1,'creature',true),
  ('creature:48','creature',1,'creature',true),
  ('creature:49','creature',1,'creature',true),
  ('creature:50','creature',1,'creature',true),
  ('creature:51','creature',1,'creature',true),
  ('creature:52','creature',1,'creature',true),
  ('creature:53','creature',1,'boss',true),
  ('creature:54','creature',1,'boss',true),
  ('creature:55','creature',1,'boss',true),
  ('creature:56','creature',1,'boss',true),
  ('creature:57','creature',1,'boss',true),
  ('creature:58','creature',1,'boss',true),
  ('creature:59','creature',1,'boss',true),
  ('creature:60','creature',1,'boss',true)
on conflict(entity_key) do update set published=case when current_setting('nameless.map_workspace_new_publication',true)='true' then excluded.published else map_entity_registry.published end;


commit;
