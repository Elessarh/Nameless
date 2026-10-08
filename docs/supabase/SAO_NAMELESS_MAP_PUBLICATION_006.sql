-- Additive publication gate for map identities. Apply after map schema 005.
-- Then apply the generated entity seed 005 and publication allowlist seed 006.
-- Existing registry identities and administrator overrides are retained.
begin;

do $$ begin
  if to_regclass('public.map_entity_registry') is null
    or to_regclass('public.map_marker_overrides') is null
    or to_regprocedure('public.is_admin()') is null then
    raise exception 'map_006_prerequisites_required';
  end if;
end $$;

-- Default false fails closed for old identities and any newly added identity.
alter table public.map_entity_registry add column if not exists published boolean not null default false;
drop policy if exists "map registry public read" on public.map_entity_registry;
create policy "map registry public read" on public.map_entity_registry
  for select to anon, authenticated using (published);
drop policy if exists "map registry admin read" on public.map_entity_registry;
create policy "map registry admin read" on public.map_entity_registry
  for select to authenticated using (public.is_admin());

-- Keep the RPC signature stable. Unpublished identities return only synthetic
-- tombstones, including identities with no override. These minimal keys are
-- required to suppress coordinates in older cached static catalogues. No
-- historical override ID, title, position or author is exposed.
create or replace function public.read_map_marker_overrides()
returns table(id uuid,entity_key text,floor smallint,marker_type text,state text,u double precision,v double precision)
language sql stable security definer set search_path = pg_catalog, public as $$
  select m.id,m.entity_key,m.floor,m.marker_type,m.state,
    case when m.state = 'visible' then m.u else null end,
    case when m.state = 'visible' then m.v else null end
  from public.map_marker_overrides m
  join public.map_entity_registry r on r.entity_key = m.entity_key and r.floor = m.floor
  where r.published
  union all
  select null::uuid,r.entity_key,r.floor,r.marker_type,'hidden'::text,
    null::double precision,null::double precision
  from public.map_entity_registry r
  where not r.published
  order by entity_key;
$$;
revoke all on function public.read_map_marker_overrides() from public, anon, authenticated;
grant execute on function public.read_map_marker_overrides() to anon, authenticated;
commit;
