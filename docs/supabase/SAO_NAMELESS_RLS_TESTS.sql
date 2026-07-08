-- SAO Nameless RLS validation tests
--
-- Goal:
--   Validate real allowed vs denied access paths. This file is not a migration.
--   Run blocks manually in Supabase SQL Editor after replacing placeholders.
--
-- Replace before running:
--   USER_A_ID  -> UUID of a normal test user
--   USER_B_ID  -> UUID of a second normal test user
--   ADMIN_ID   -> UUID of an admin test user already marked admin in user_profiles/user_roles
--
-- Notes:
--   - Run on a test project or after backup.
--   - Most write tests are wrapped in transactions and roll back.
--   - For guild-specific tests, USER_A_ID and USER_B_ID are promoted to
--     "membre" inside the transaction, then rolled back.
--   - A PASS column should be true. NOTICE lines should say PASS.
--   - If a block errors with "FAIL", stop and inspect the related policy.

-- =========================================================
-- 0. Policy inventory sanity check
-- =========================================================

select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'admin_logs',
    'guild_activity_wall',
    'guild_chat',
    'guild_objectives',
    'guild_planning',
    'guild_presence',
    'market_orders',
    'messages',
    'private_messages',
    'purchase_history',
    'user_profiles',
    'user_roles'
  )
order by tablename;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname in ('public', 'storage')
  and (
    tablename in (
      'admin_logs',
      'guild_activity_wall',
      'guild_chat',
      'guild_objectives',
      'guild_planning',
      'guild_presence',
      'market_orders',
      'messages',
      'private_messages',
      'purchase_history',
      'user_profiles',
      'user_roles'
    )
    or (schemaname = 'storage' and tablename = 'objects')
  )
order by schemaname, tablename, policyname;

-- Expected:
--   - RLS enabled on every public table above.
--   - No policy to anon.
--   - The only broad true policy should be profiles authenticated read.

-- =========================================================
-- 1. User A profile and role escalation
-- =========================================================

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'USER_A_ID';
set local request.jwt.claims = '{"sub":"USER_A_ID","role":"authenticated"}';

select
  'T01 auth.uid() is USER_A_ID' as test,
  auth.uid() = 'USER_A_ID'::uuid as pass;

select
  'T02 USER_A can read own profile' as test,
  count(*) = 1 as pass
from public.user_profiles
where id = auth.uid();

do $$
begin
  begin
    update public.user_profiles
    set role = 'admin'
    where id = auth.uid();

    if found then
      raise exception 'FAIL: USER_A changed its own role through user_profiles';
    else
      raise exception 'FAIL: USER_A profile was not found, test is inconclusive';
    end if;
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise notice 'PASS T03: USER_A cannot escalate user_profiles.role: %', sqlerrm;
  end;
end $$;

do $$
begin
  begin
    insert into public.user_roles (user_id, role, assigned_by)
    values ('USER_A_ID'::uuid, 'admin', 'USER_A_ID'::uuid)
    on conflict (user_id) do update
      set role = excluded.role,
          assigned_by = excluded.assigned_by;

    raise exception 'FAIL: USER_A modified user_roles';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise notice 'PASS T04: USER_A cannot modify user_roles: %', sqlerrm;
  end;
end $$;

rollback;

-- =========================================================
-- 2. Mailbox messages: owner-only visibility
-- =========================================================

begin;
set local role authenticated;

select set_config('request.jwt.claim.sub', 'USER_A_ID', true);
select set_config('request.jwt.claims', '{"sub":"USER_A_ID","role":"authenticated"}', true);

insert into public.messages (sender_id, recipient_id, subject, content)
values (
  auth.uid(),
  'USER_B_ID'::uuid,
  'RLS test A to B',
  'Temporary mailbox message from A to B'
);

select set_config('request.jwt.claim.sub', 'USER_B_ID', true);
select set_config('request.jwt.claims', '{"sub":"USER_B_ID","role":"authenticated"}', true);

insert into public.messages (sender_id, recipient_id, subject, content)
values (
  auth.uid(),
  'ADMIN_ID'::uuid,
  'RLS test B to admin',
  'Temporary mailbox message from B to admin'
);

select
  'T05 USER_B can read message addressed by USER_A' as test,
  count(*) >= 1 as pass
from public.messages
where sender_id = 'USER_A_ID'::uuid
  and recipient_id = auth.uid()
  and subject = 'RLS test A to B';

select set_config('request.jwt.claim.sub', 'USER_A_ID', true);
select set_config('request.jwt.claims', '{"sub":"USER_A_ID","role":"authenticated"}', true);

select
  'T06 USER_A cannot read third-party mailbox message B/admin' as test,
  count(*) = 0 as pass
from public.messages
where sender_id = 'USER_B_ID'::uuid
  and recipient_id = 'ADMIN_ID'::uuid
  and subject = 'RLS test B to admin';

rollback;

-- =========================================================
-- 3. Guild private messages table: participant-only visibility
-- =========================================================

begin;
set local role authenticated;

-- Temporarily make USER_A and USER_B guild members for this transaction.
select set_config('request.jwt.claim.sub', 'ADMIN_ID', true);
select set_config('request.jwt.claims', '{"sub":"ADMIN_ID","role":"authenticated"}', true);

update public.user_profiles
set role = 'membre'
where id in ('USER_A_ID'::uuid, 'USER_B_ID'::uuid);

select set_config('request.jwt.claim.sub', 'USER_A_ID', true);
select set_config('request.jwt.claims', '{"sub":"USER_A_ID","role":"authenticated"}', true);

insert into public.private_messages (sender_id, recipient_id, content)
values (
  auth.uid(),
  'USER_B_ID'::uuid,
  'RLS test private message A to B'
);

select set_config('request.jwt.claim.sub', 'USER_B_ID', true);
select set_config('request.jwt.claims', '{"sub":"USER_B_ID","role":"authenticated"}', true);

insert into public.private_messages (sender_id, recipient_id, content)
values (
  auth.uid(),
  'ADMIN_ID'::uuid,
  'RLS test private message B to admin'
);

select
  'T07 USER_B can read private message from USER_A' as test,
  count(*) >= 1 as pass
from public.private_messages
where sender_id = 'USER_A_ID'::uuid
  and recipient_id = auth.uid()
  and content = 'RLS test private message A to B';

select set_config('request.jwt.claim.sub', 'USER_A_ID', true);
select set_config('request.jwt.claims', '{"sub":"USER_A_ID","role":"authenticated"}', true);

select
  'T08 USER_A cannot read private message B/admin' as test,
  count(*) = 0 as pass
from public.private_messages
where sender_id = 'USER_B_ID'::uuid
  and recipient_id = 'ADMIN_ID'::uuid
  and content = 'RLS test private message B to admin';

rollback;

-- =========================================================
-- 4. Legacy guild_chat private DMs: suspect policy validation
-- =========================================================

begin;
set local role authenticated;

select set_config('request.jwt.claim.sub', 'ADMIN_ID', true);
select set_config('request.jwt.claims', '{"sub":"ADMIN_ID","role":"authenticated"}', true);

update public.user_profiles
set role = 'membre'
where id in ('USER_A_ID'::uuid, 'USER_B_ID'::uuid);

select set_config('request.jwt.claim.sub', 'USER_A_ID', true);
select set_config('request.jwt.claims', '{"sub":"USER_A_ID","role":"authenticated"}', true);

insert into public.guild_chat (user_id, recipient_id, message, is_private)
values (
  auth.uid(),
  'USER_B_ID'::uuid,
  'RLS test legacy guild DM A to B',
  true
);

select set_config('request.jwt.claim.sub', 'USER_B_ID', true);
select set_config('request.jwt.claims', '{"sub":"USER_B_ID","role":"authenticated"}', true);

select
  'T09 USER_B can read legacy guild DM from USER_A' as test,
  count(*) >= 1 as pass
from public.guild_chat
where is_private = true
  and user_id = 'USER_A_ID'::uuid
  and recipient_id = auth.uid()
  and message = 'RLS test legacy guild DM A to B';

-- Demote USER_A while keeping the DM in place.
select set_config('request.jwt.claim.sub', 'ADMIN_ID', true);
select set_config('request.jwt.claims', '{"sub":"ADMIN_ID","role":"authenticated"}', true);

update public.user_profiles
set role = 'joueur'
where id = 'USER_A_ID'::uuid;

select set_config('request.jwt.claim.sub', 'USER_A_ID', true);
select set_config('request.jwt.claims', '{"sub":"USER_A_ID","role":"authenticated"}', true);

select
  'T10 demoted USER_A cannot read legacy guild DM after PATCH_001' as test,
  count(*) = 0 as pass
from public.guild_chat
where is_private = true
  and user_id = auth.uid()
  and recipient_id = 'USER_B_ID'::uuid
  and message = 'RLS test legacy guild DM A to B';

-- Expected:
--   - Before SAO_NAMELESS_RLS_PATCH_001.sql: T10 may be false.
--   - After SAO_NAMELESS_RLS_PATCH_001.sql: T10 should be true.

rollback;

-- =========================================================
-- 5. Guild presence: only own insert/update for members
-- =========================================================

begin;
set local role authenticated;

select set_config('request.jwt.claim.sub', 'ADMIN_ID', true);
select set_config('request.jwt.claims', '{"sub":"ADMIN_ID","role":"authenticated"}', true);

update public.user_profiles
set role = 'membre'
where id in ('USER_A_ID'::uuid, 'USER_B_ID'::uuid);

select set_config('request.jwt.claim.sub', 'USER_A_ID', true);
select set_config('request.jwt.claims', '{"sub":"USER_A_ID","role":"authenticated"}', true);

insert into public.guild_presence (user_id, date_presence, statut, commentaire)
values (auth.uid(), current_date + 90, 'present', 'RLS test A own presence')
on conflict (user_id, date_presence) do update
set statut = excluded.statut,
    commentaire = excluded.commentaire;

select set_config('request.jwt.claim.sub', 'USER_B_ID', true);
select set_config('request.jwt.claims', '{"sub":"USER_B_ID","role":"authenticated"}', true);

insert into public.guild_presence (user_id, date_presence, statut, commentaire)
values (auth.uid(), current_date + 90, 'present', 'RLS test B own presence')
on conflict (user_id, date_presence) do update
set statut = excluded.statut,
    commentaire = excluded.commentaire;

select set_config('request.jwt.claim.sub', 'USER_A_ID', true);
select set_config('request.jwt.claims', '{"sub":"USER_A_ID","role":"authenticated"}', true);

with attempted_update as (
  update public.guild_presence
  set commentaire = 'RLS forbidden update by USER_A'
  where user_id = 'USER_B_ID'::uuid
    and date_presence = current_date + 90
  returning id
)
select
  'T11 USER_A cannot update USER_B presence' as test,
  count(*) = 0 as pass
from attempted_update;

rollback;

-- =========================================================
-- 6. Planning and objectives: admin write only
-- =========================================================

begin;
set local role authenticated;

select set_config('request.jwt.claim.sub', 'USER_A_ID', true);
select set_config('request.jwt.claims', '{"sub":"USER_A_ID","role":"authenticated"}', true);

do $$
begin
  begin
    insert into public.guild_planning (titre, description, type_event, date_event, created_by)
    values (
      'RLS forbidden planning',
      'Normal user should not create planning',
      'event',
      now() + interval '14 days',
      auth.uid()
    );
    raise exception 'FAIL: normal USER_A inserted guild_planning';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise notice 'PASS T12: normal USER_A cannot insert guild_planning: %', sqlerrm;
  end;
end $$;

do $$
begin
  begin
    insert into public.guild_objectives (titre, description, semaine_numero, annee, progression, statut, created_by)
    values (
      'RLS forbidden objective',
      'Normal user should not create objective',
      extract(week from current_date)::int,
      extract(year from current_date)::int,
      0,
      'en_cours',
      auth.uid()
    );
    raise exception 'FAIL: normal USER_A inserted guild_objectives';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise notice 'PASS T13: normal USER_A cannot insert guild_objectives: %', sqlerrm;
  end;
end $$;

select set_config('request.jwt.claim.sub', 'ADMIN_ID', true);
select set_config('request.jwt.claims', '{"sub":"ADMIN_ID","role":"authenticated"}', true);

insert into public.guild_planning (titre, description, type_event, date_event, created_by)
values (
  'RLS allowed planning',
  'Admin should create planning',
  'event',
  now() + interval '15 days',
  auth.uid()
);

insert into public.guild_objectives (titre, description, semaine_numero, annee, progression, statut, created_by)
values (
  'RLS allowed objective',
  'Admin should create objective',
  extract(week from current_date)::int,
  extract(year from current_date)::int,
  10,
  'en_cours',
  auth.uid()
);

select
  'T14 ADMIN can insert planning and objectives' as test,
  true as pass;

rollback;

-- =========================================================
-- 7. Admin logs: admin only
-- =========================================================

begin;
set local role authenticated;

select set_config('request.jwt.claim.sub', 'ADMIN_ID', true);
select set_config('request.jwt.claims', '{"sub":"ADMIN_ID","role":"authenticated"}', true);

insert into public.admin_logs (actor_id, action, target_table, target_id, details)
values (
  auth.uid(),
  'rls_test_admin_log',
  'admin_logs',
  gen_random_uuid(),
  jsonb_build_object('source', 'SAO_NAMELESS_RLS_TESTS')
);

select
  'T15 ADMIN can read admin_logs' as test,
  count(*) >= 1 as pass
from public.admin_logs
where action = 'rls_test_admin_log';

select set_config('request.jwt.claim.sub', 'USER_A_ID', true);
select set_config('request.jwt.claims', '{"sub":"USER_A_ID","role":"authenticated"}', true);

select
  'T16 normal USER_A cannot read admin_logs' as test,
  count(*) = 0 as pass
from public.admin_logs
where action = 'rls_test_admin_log';

do $$
begin
  begin
    insert into public.admin_logs (actor_id, action, target_table, target_id, details)
    values (
      auth.uid(),
      'rls_forbidden_admin_log',
      'admin_logs',
      gen_random_uuid(),
      '{}'::jsonb
    );
    raise exception 'FAIL: normal USER_A inserted admin_logs';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise notice 'PASS T17: normal USER_A cannot insert admin_logs: %', sqlerrm;
  end;
end $$;

rollback;

-- =========================================================
-- 8. Storage objects: owner prefix only
-- =========================================================

-- SQL Editor can validate visibility/update policies against existing objects.
-- Upload/delete behavior is better tested through the Supabase Storage API and
-- the manual checklist because direct writes to storage.objects bypass normal
-- Storage API behavior.
--
-- Before running, create or identify an existing object:
--   bucket: iron-oath-storage
--   name:   chat/USER_B_ID/existing-test-image.png

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'USER_A_ID';
set local request.jwt.claims = '{"sub":"USER_A_ID","role":"authenticated"}';

select
  'T18 USER_A cannot read USER_B storage object' as test,
  count(*) = 0 as pass
from storage.objects
where bucket_id = 'iron-oath-storage'
  and name = 'chat/USER_B_ID/existing-test-image.png';

with attempted_update as (
  update storage.objects
  set metadata = coalesce(metadata, '{}'::jsonb)
  where bucket_id = 'iron-oath-storage'
    and name = 'chat/USER_B_ID/existing-test-image.png'
  returning id
)
select
  'T19 USER_A cannot update USER_B storage object' as test,
  count(*) = 0 as pass
from attempted_update;

with attempted_delete as (
  delete from storage.objects
  where bucket_id = 'iron-oath-storage'
    and name = 'chat/USER_B_ID/existing-test-image.png'
  returning id
)
select
  'T20 USER_A cannot delete USER_B storage object' as test,
  count(*) = 0 as pass
from attempted_delete;

rollback;

-- End of manual RLS validation script.
