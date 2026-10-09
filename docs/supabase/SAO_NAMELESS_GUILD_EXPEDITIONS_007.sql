-- Additive headquarters service. Apply after SAO_NAMELESS_SCHEMA and existing patches.
-- Existing guild_planning rows and all existing guild tools remain intact.
begin;

alter table public.guild_planning
  add column if not exists floor integer check (floor between 1 and 100),
  add column if not exists location text check (char_length(location) <= 160),
  add column if not exists capacity integer check (capacity between 1 and 300),
  add column if not exists tank_slots integer check (tank_slots between 0 and 100),
  add column if not exists dps_slots integer check (dps_slots between 0 and 100),
  add column if not exists support_slots integer check (support_slots between 0 and 100),
  add column if not exists status text not null default 'open' check (status in ('open','preparing','closed','cancelled'));

create table if not exists public.guild_event_attendance (
  event_id uuid not null references public.guild_planning(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  group_role text not null check (group_role in ('Tank','DPS','Support')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id,user_id)
);
create table if not exists public.guild_event_checklist (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.guild_planning(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 160),
  sort_order integer not null default 0 check (sort_order between 0 and 29)
);
create table if not exists public.guild_event_checks (
  checklist_id uuid not null references public.guild_event_checklist(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  done boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(checklist_id,user_id)
);
create index if not exists guild_event_attendance_user_idx on public.guild_event_attendance(user_id);
create index if not exists guild_event_checklist_event_idx on public.guild_event_checklist(event_id,sort_order);
alter table public.guild_event_attendance enable row level security;
alter table public.guild_event_checklist enable row level security;
alter table public.guild_event_checks enable row level security;
drop policy if exists "guild participants read" on public.guild_event_attendance;
create policy "guild participants read" on public.guild_event_attendance for select to authenticated using(public.can_access_guild());
drop policy if exists "guild preparation read" on public.guild_event_checklist;
create policy "guild preparation read" on public.guild_event_checklist for select to authenticated using(public.can_access_guild());
drop policy if exists "own guild preparation read" on public.guild_event_checks;
create policy "own guild preparation read" on public.guild_event_checks for select to authenticated using(public.can_access_guild() and (user_id=auth.uid() or public.is_admin()));
-- All writes go through the checked RPCs below. No client-supplied user_id is accepted.
revoke all on public.guild_event_attendance, public.guild_event_checklist, public.guild_event_checks from anon, authenticated;
grant select on public.guild_event_attendance, public.guild_event_checklist, public.guild_event_checks to authenticated;

create or replace function public.guild_event_register(target_event uuid, requested_role text)
returns void language plpgsql security definer set search_path=public as $$
declare e public.guild_planning%rowtype; total_count integer; role_count integer; role_limit integer;
begin
  if auth.uid() is null or not public.can_access_guild() then raise exception 'guild_access_denied' using errcode='42501'; end if;
  if requested_role is null or requested_role not in ('Tank','DPS','Support') then raise exception 'invalid_group_role' using errcode='22023'; end if;
  -- One event lock serializes all capacity decisions, including role changes.
  select * into e from public.guild_planning where id=target_event for update;
  if not found or e.date_event<=now() or e.status<>'open' then raise exception 'event_closed' using errcode='22023'; end if;
  select count(*) into total_count from public.guild_event_attendance where event_id=target_event and user_id<>auth.uid();
  if e.capacity is not null and total_count>=e.capacity then raise exception 'event_full' using errcode='22023'; end if;
  role_limit:=case requested_role when 'Tank' then e.tank_slots when 'DPS' then e.dps_slots else e.support_slots end;
  select count(*) into role_count from public.guild_event_attendance where event_id=target_event and group_role=requested_role and user_id<>auth.uid();
  if role_limit is not null and role_count>=role_limit then raise exception 'role_full' using errcode='22023'; end if;
  insert into public.guild_event_attendance(event_id,user_id,group_role)
    values(target_event,auth.uid(),requested_role)
    on conflict(event_id,user_id) do update set group_role=excluded.group_role,updated_at=now();
end $$;

create or replace function public.guild_event_unregister(target_event uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.can_access_guild() then raise exception 'guild_access_denied' using errcode='42501'; end if;
  perform 1 from public.guild_planning where id=target_event for update;
  delete from public.guild_event_attendance where event_id=target_event and user_id=auth.uid();
end $$;

create or replace function public.guild_event_set_check(target_checklist uuid,completed boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.can_access_guild() then raise exception 'guild_access_denied' using errcode='42501'; end if;
  if not exists(select 1 from public.guild_event_checklist where id=target_checklist) then raise exception 'unknown_preparation' using errcode='22023'; end if;
  insert into public.guild_event_checks(checklist_id,user_id,done) values(target_checklist,auth.uid(),coalesce(completed,false))
    on conflict(checklist_id,user_id) do update set done=excluded.done,updated_at=now();
end $$;

create or replace function public.guild_event_create(event_title text,event_date timestamptz,event_type text,event_description text,event_config jsonb default '{}'::jsonb,preparation text[] default '{}'::text[])
returns uuid language plpgsql security definer set search_path=public as $$
declare result_id uuid; line text; position integer:=0;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  if event_date is null or event_date<=now() then raise exception 'future_date_required' using errcode='22023'; end if;
  if char_length(coalesce(event_description,''))>8000 or coalesce(array_length(preparation,1),0)>30 then raise exception 'event_content_too_long' using errcode='22023'; end if;
  insert into public.guild_planning(titre,date_event,type_event,description,created_by,floor,location,capacity,tank_slots,dps_slots,support_slots)
  values(trim(event_title),event_date,event_type,event_description,auth.uid(),(event_config->>'floor')::integer,nullif(trim(event_config->>'location'),''),(event_config->>'capacity')::integer,(event_config->>'tank_slots')::integer,(event_config->>'dps_slots')::integer,(event_config->>'support_slots')::integer)
  returning id into result_id;
  foreach line in array coalesce(preparation,'{}'::text[]) loop
    if nullif(trim(line),'') is not null then
      insert into public.guild_event_checklist(event_id,label,sort_order) values(result_id,trim(line),position);
      position:=position+1;
    end if;
  end loop;
  return result_id;
end $$;

revoke all on function public.guild_event_register(uuid,text), public.guild_event_unregister(uuid), public.guild_event_set_check(uuid,boolean), public.guild_event_create(text,timestamptz,text,text,jsonb,text[]) from public, anon;
grant execute on function public.guild_event_register(uuid,text), public.guild_event_unregister(uuid), public.guild_event_set_check(uuid,boolean), public.guild_event_create(text,timestamptz,text,text,jsonb,text[]) to authenticated;
commit;
