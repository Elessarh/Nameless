// Isolated Postgres execution: no Supabase credentials, browser or network.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createMapGraph} from './build-map-graph.mjs';
const require=createRequire(import.meta.url);
const {PGlite}=require('@electric-sql/pglite');
const root=path.resolve(import.meta.dirname,'..');
const sql=fs.readFileSync(path.join(root,'docs/supabase/SAO_NAMELESS_MAP_WORKSPACE_008.sql'),'utf8');
const graph=createMapGraph({root});
const baseline=JSON.parse(fs.readFileSync(path.join(root,'data/map-regions.json'),'utf8'));
const ADMIN='11111111-1111-4111-8111-111111111111',MEMBER='22222222-2222-4222-8222-222222222222';
const key='location:1:ville-depart',region=baseline.floors[0].regions[0];
const db=new PGlite();
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
async function actor(role,id,fn){
  await db.exec('begin;set local role '+role+';');
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id||'']);
  try{const result=await fn();await db.exec('commit;');return result;}catch(error){await db.exec('rollback;');throw error;}
}
const admin=fn=>actor('authenticated',ADMIN,fn);
const anon=fn=>actor('anon',null,fn);
const scalar=async(query,args=[]) => (await db.query(query,args)).rows[0].value;
const workspace=()=>admin(()=>scalar('select public.map_workspace_read() as value'));
const saveMarker=(revision=0,state='visible',u=.2,v=.3,target=key,type='town')=>admin(()=>scalar('select public.map_workspace_save_marker($1,$2,$3,$4,$5,$6) as value',[target,state,u,v,revision,type]));
const resetMarker=revision=>admin(()=>scalar('select public.map_workspace_reset_marker($1,$2) as value',[key,revision]));
const saveRegion=(revision=0,status='indicative',visible=true,vertices=region.vertices,overrides={})=>{
  const args=[region.entityKey,region.id,1,'/assets/carte.webp',status,visible,JSON.stringify(vertices),revision];
  for(const [position,value] of Object.entries(overrides)) args[Number(position)]=value;
  return admin(()=>scalar('select public.map_workspace_save_region($1,$2,$3,$4,$5,$6,$7::jsonb,$8) as value',args));
};
const saveCustom=(revision=0,state='draft',entityKey=null,overrides={})=>{
  const args=[entityKey,'Repère de test','Description de test','npc',1,'/assets/carte.webp',state,.4,.5,revision];
  for(const [position,value] of Object.entries(overrides)) args[Number(position)]=value;
  return admin(()=>scalar('select public.map_workspace_save_custom_marker($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as value',args));
};
const publicRegions=()=>anon(()=>db.query('select * from public.read_map_regions()'));
const publicCustom=()=>anon(()=>db.query('select * from public.read_map_custom_markers()'));
try{
  // Deliberately minimal prerequisites: migrations 004, 005 and 006 are absent.
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;grant usage on schema auth to anon,authenticated;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table public.user_profiles(id uuid primary key,role text not null);
    create function public.current_user_role() returns text language sql stable security definer set search_path=pg_catalog,public as $$
      select coalesce((select role from public.user_profiles where id=auth.uid()),'visiteur')$$;
    revoke all on function public.current_user_role() from public,anon;grant execute on function public.current_user_role() to authenticated;`);
  await db.query('insert into public.user_profiles values($1,\'admin\'),($2,\'membre\')',[ADMIN,MEMBER]);
  await test('standalone migration needs no 004/005/006 services and seeds only current public catalogue identities',async()=>{
    await db.exec(sql);
    const registry=(await db.query('select * from public.map_entity_registry')).rows;
    assert.equal(registry.length,graph.registry.length);
    assert.deepEqual(registry.map(r=>r.entity_key).sort(),graph.registry.map(r=>r.key).sort());
    assert.ok(registry.every(r=>r.published));
    assert.deepEqual((await workspace()).maps.map(row=>[row.floor,row.image_id]),baseline.floors.map(row=>[row.floor,row.imageId]));
    assert.equal(await scalar("select to_regprocedure('public.consume_write_budget(uuid,text,integer,integer,integer)')::text as value"),null);
  });
  await test('anonymous/member/missing-session clients cannot read private workspace or write through RPC or direct table',async()=>{
    await assert.rejects(anon(()=>db.query('select public.map_workspace_read()')),/permission denied/);
    for(const id of [MEMBER,null]){
      await assert.rejects(actor('authenticated',id,()=>db.query('select public.map_workspace_read()')),/map_admin_required/);
      await assert.rejects(actor('authenticated',id,()=>db.query('select public.map_workspace_save_marker($1,\'visible\',.2,.3,0)',[key])),/map_admin_required/);
      await assert.rejects(actor('authenticated',id,()=>db.query('select public.map_workspace_save_region($1,$2,1,\'/assets/carte.webp\',\'indicative\',true,$3::jsonb,0)',[region.entityKey,region.id,JSON.stringify(region.vertices)])),/map_admin_required/);
      await assert.rejects(actor('authenticated',id,()=>db.query('select public.map_workspace_save_custom_marker(null,\'Fake\',\'\',\'npc\',1,\'/assets/carte.webp\',\'visible\',.1,.2,0)')),/map_admin_required/);
      assert.equal((await actor('authenticated',id,()=>db.query('select * from public.map_marker_overrides'))).rows.length,0);
    }
    await assert.rejects(admin(()=>db.query('insert into public.map_marker_overrides(entity_key,floor,marker_type,state,u,v) values($1,1,\'town\',\'visible\',.2,.3)',[key])),/permission denied/);
    await assert.rejects(anon(()=>db.query('select * from public.map_region_overrides')),/permission denied/);
    await assert.rejects(admin(()=>db.query('select * from nameless_private.map_workspace_audit')),/permission denied/);
    await assert.rejects(actor('service_role',null,()=>db.query('delete from public.map_marker_overrides')),/permission denied/);
  });
  await test('marker RPC enforces registered identity, icon whitelist and finite image-relative coordinates',async()=>{
    for(const value of ['NaN','Infinity','-Infinity',-.01,1.01]) await assert.rejects(saveMarker(0,'visible',value,.3),/map_invalid_marker/);
    await assert.rejects(saveMarker(0,'visible',null,.3),/map_invalid_marker/);
    await assert.rejects(saveMarker(0,'visible',.2,.3,'location:1:invented'),/map_unknown_entity/);
    await assert.rejects(saveMarker(0,'visible',.2,.3,key,'fake-icon'),/map_invalid_marker/);
    const result=await saveMarker();assert.equal(result.revision,1);assert.equal(result.record.floor,1);
    assert.equal('created_by' in result.record,false);assert.equal('updated_by' in result.record,false);
    const stored=(await db.query('select * from public.map_marker_overrides where entity_key=$1',[key])).rows[0];
    assert.equal(stored.created_by,ADMIN);assert.equal(stored.updated_by,ADMIN);
    const readback=(await anon(()=>db.query('select * from public.read_map_marker_overrides()'))).rows[0];
    assert.deepEqual(Object.keys(readback).sort(),['id','entity_key','floor','marker_type','state','u','v'].sort());
    assert.equal(readback.u,.2);assert.equal(readback.v,.3);
  });
  await test('marker hide and delete suppress baseline without disclosing hidden coordinates',async()=>{
    await saveMarker(1,'hidden',.77,.88);
    let row=(await anon(()=>db.query('select * from public.read_map_marker_overrides()'))).rows[0];
    assert.equal(row.state,'hidden');assert.equal(row.u,null);assert.equal(row.v,null);
    await saveMarker(2,'deleted',null,null);
    row=(await anon(()=>db.query('select * from public.read_map_marker_overrides()'))).rows[0];
    assert.equal(row.state,'deleted');assert.equal(row.u,null);
  });
  await test('optimistic revisions reject stale first saves, updates, resets and reset→recreate ABA',async()=>{
    await assert.rejects(saveMarker(0),/map_revision_conflict/);
    await assert.rejects(resetMarker(2),/map_revision_conflict/);
    const reset=await resetMarker(3);assert.deepEqual(reset,{revision:4,reset:true});
    assert.equal((await anon(()=>db.query('select * from public.read_map_marker_overrides()'))).rows.length,0);
    const entry=(await workspace()).registry.find(r=>r.entity_key===key);assert.equal(entry.marker_revision,4);
    await assert.rejects(saveMarker(0),/map_revision_conflict/);
    const updated=await saveMarker(4);assert.equal(updated.revision,5);
  });
  await test('all original indicative contours pass server geometry validation without source changes',async()=>{
    for(const floor of baseline.floors) for(const item of floor.regions)
      assert.equal(await scalar('select nameless_private.map_geometry_valid($1::jsonb) as value',[JSON.stringify(item.vertices)]),true,item.id);
  });
  await test('polygon validation rejects malformed, duplicate, collinear, out-of-bounds and crossing geometry',async()=>{
    const ring=count=>Array.from({length:count},(_,i)=>({u:.5+.4*Math.cos(2*Math.PI*i/count),v:.5+.4*Math.sin(2*Math.PI*i/count)}));
    assert.equal(await scalar('select nameless_private.map_geometry_valid($1::jsonb) as value',[JSON.stringify(ring(96))]),true,'The shipped validator maximum accepts a simple 96-vertex polygon');
    await assert.rejects(saveRegion(0,'indicative',true,ring(97)),/map_invalid_region/,'97 vertices cannot produce a shared polygon the public reader rejects');
    const invalid=[null,{},[],[{u:0,v:0},{u:1,v:1}],
      [{u:0,v:0},{u:1,v:1},{u:0,v:0}],
      [{u:0,v:0},{u:.5,v:.5},{u:1,v:1}],
      [{u:0,v:0},{u:'0.5',v:0},{u:1,v:1}],
      [{u:0,v:0},{u:1.01,v:0},{u:1,v:1}],
      [{u:0,v:0,private:'extra'},{u:1,v:0},{u:1,v:1}],
      [{u:0,v:0},{u:1,v:1},{u:0,v:.7},{u:1,v:0}],
      [{u:0,v:0},{u:1,v:0},{u:1,v:1},{u:.5,v:0},{u:0,v:1}],
      Array.from({length:97},(_,i)=>({u:i/97,v:i%2}))];
    for(const vertices of invalid) await assert.rejects(saveRegion(0,'indicative',true,vertices),/map_invalid_region/);
    await assert.rejects(saveRegion(0,'indicative',true,region.vertices,{2:2}),/map_region_identity_mismatch/);
    await assert.rejects(saveRegion(0,'indicative',true,region.vertices,{3:'/assets/Palier2-map.webp'}),/map_region_identity_mismatch/);
    await assert.rejects(saveRegion(0,'indicative',true,region.vertices,{0:'quest:1:invented'}),/map_region_identity_mismatch/);
  });
  await test('draft region is private; indicative/verified publication and hide are explicit and metadata-free',async()=>{
    const draft=await saveRegion(0,'draft');assert.equal(draft.revision,1);
    let row=(await publicRegions()).rows[0];assert.equal(row.visible,false);assert.equal(row.vertices,null);assert.equal(row.status,null);
    assert.deepEqual(Object.keys(row).sort(),['floor','image_id','entity_key','region_id','status','visible','vertices','revision'].sort());
    const publication=await saveRegion(1);assert.equal(publication.revision,2);
    row=(await publicRegions()).rows[0];assert.equal(row.visible,true);assert.equal(row.status,'indicative');assert.deepEqual(row.vertices,region.vertices);
    await saveRegion(2,'verified');row=(await publicRegions()).rows[0];assert.equal(row.status,'verified');
    await saveRegion(3,'verified',false);row=(await publicRegions()).rows[0];assert.equal(row.visible,false);assert.equal(row.vertices,null);assert.equal(row.status,null);
    assert.ok((await workspace()).regions[0].vertices.length>=3);
  });
  await test('region identity cannot be relabelled and stale save/reset cannot overwrite newer geometry',async()=>{
    await assert.rejects(saveRegion(4,'indicative',true,region.vertices,{1:'renamed-area'}),/map_region_identity_immutable/);
    await assert.rejects(saveRegion(3),/map_revision_conflict/);
    await assert.rejects(admin(()=>scalar('select public.map_workspace_reset_region($1,3) as value',[region.entityKey])),/map_revision_conflict/);
    const result=await admin(()=>scalar('select public.map_workspace_reset_region($1,4) as value',[region.entityKey]));assert.equal(result.revision,5);
    assert.equal((await publicRegions()).rows.length,0);
    await assert.rejects(saveRegion(0),/map_revision_conflict/);
    assert.equal((await saveRegion(5)).revision,6);
  });
  let custom;
  await test('custom marker key is generated server-side; a draft remains unpublished until explicit save',async()=>{
    const draft=await saveCustom();custom=draft.record.entity_key;
    assert.match(custom,/^custom:[0-9a-f-]{36}$/);assert.equal(draft.revision,1);assert.equal(draft.record.state,'draft');
    assert.equal((await publicCustom()).rows.length,0);
    const published=await saveCustom(1,'visible',custom);assert.equal(published.revision,2);
    const row=(await publicCustom()).rows[0];assert.equal(row.title,'Repère de test');assert.equal(row.u,.4);
    assert.deepEqual(Object.keys(row).sort(),['entity_key','title','description','floor','image_id','marker_type','state','u','v','revision'].sort());
    await assert.rejects(saveCustom(0,'visible','custom:11111111-1111-4111-8111-111111111111'),/map_unknown_entity/);
    await assert.rejects(saveCustom(0,'visible',null,{1:' '}),/map_invalid_custom_marker/);
    await assert.rejects(saveCustom(0,'visible',null,{2:'x'.repeat(2049)}),/map_invalid_custom_marker/);
    await assert.rejects(saveCustom(0,'visible',null,{5:'https://attacker.test/map.webp'}),/map_region_identity_mismatch/);
    await assert.rejects(saveCustom(2,'visible',custom,{4:2,5:'/assets/Palier2-map.webp'}),/map_custom_identity_immutable/);
  });
  await test('custom hide/delete are revision-protected tombstones; deleted private records never leak',async()=>{
    await saveCustom(2,'hidden',custom);assert.equal((await publicCustom()).rows.length,0);
    await assert.rejects(saveCustom(2,'visible',custom),/map_revision_conflict/);
    await assert.rejects(admin(()=>scalar('select public.map_workspace_delete_custom_marker($1,2) as value',[custom])),/map_revision_conflict/);
    const result=await admin(()=>scalar('select public.map_workspace_delete_custom_marker($1,3) as value',[custom]));assert.equal(result.revision,4);assert.equal(result.record.state,'deleted');assert.equal(result.record.u,null);
    assert.equal((await publicCustom()).rows.length,0);
    assert.equal((await workspace()).custom_markers.find(row=>row.entity_key===custom).revision,4);
    await assert.rejects(saveCustom(0,'visible',custom),/map_revision_conflict/);
  });
  await test('publication gate suppresses retired markers and regions without coordinate or author leakage',async()=>{
    await db.query('update public.map_entity_registry set published=false where entity_key in($1,$2)',[key,region.entityKey]);
    const markers=(await anon(()=>db.query('select * from public.read_map_marker_overrides()'))).rows;
    assert.ok(markers.every(row=>row.state==='hidden'&&row.id===null&&row.u===null&&row.v===null));
    const row=(await publicRegions()).rows[0];assert.equal(row.visible,false);assert.equal(row.vertices,null);
    await assert.rejects(saveMarker(5),/map_unknown_entity/);
    await db.query('update public.map_entity_registry set published=true where entity_key in($1,$2)',[key,region.entityKey]);
  });
  await test('write limits are atomic and shared by marker, region, reset and custom operations',async()=>{
    await db.query('update nameless_private.map_workspace_limits set minute_attempts=60,minute_start=now(),hour_attempts=0,hour_start=now() where subject=$1',[ADMIN]);
    await assert.rejects(saveMarker(5),/map_write_rate_limited/);
    await assert.rejects(saveRegion(6),/map_write_rate_limited/);
    await assert.rejects(resetMarker(5),/map_write_rate_limited/);
    await assert.rejects(saveCustom(),/map_write_rate_limited/);
    assert.equal((await workspace()).registry.find(row=>row.entity_key===key).marker_revision,5);
    await db.query('update nameless_private.map_workspace_limits set minute_attempts=0,hour_attempts=300 where subject=$1',[ADMIN]);
    await assert.rejects(saveCustom(),/map_write_rate_limited/);
    await db.query('update nameless_private.map_workspace_limits set minute_attempts=0,hour_attempts=0 where subject=$1',[ADMIN]);
  });
  await test('audit failure rolls back geometry, revision, custom identity and rate budget together',async()=>{
    await db.exec(`create function nameless_private.test_fail_audit() returns trigger language plpgsql as $$begin raise exception 'test_audit_failure';end$$;
      create trigger test_fail_audit before insert on nameless_private.map_workspace_audit for each row execute function nameless_private.test_fail_audit();`);
    const before=await workspace(),count=Number(await scalar('select count(*) as value from public.map_custom_markers'));
    await assert.rejects(saveMarker(5),/test_audit_failure/);
    await assert.rejects(saveRegion(6),/test_audit_failure/);
    await assert.rejects(saveCustom(),/test_audit_failure/);
    assert.deepEqual(await workspace(),before);
    assert.equal(Number(await scalar('select count(*) as value from public.map_custom_markers')),count);
    assert.equal(await scalar('select minute_attempts as value from nameless_private.map_workspace_limits where subject=$1',[ADMIN]),0);
    await db.exec('drop trigger test_fail_audit on nameless_private.map_workspace_audit;drop function nameless_private.test_fail_audit();');
  });
  await test('audit records real actor and operations; role revocation blocks later mutations immediately',async()=>{
    const audit=(await db.query('select * from nameless_private.map_workspace_audit')).rows;
    assert.ok(audit.length>=15);assert.ok(audit.every(row=>row.actor_id===ADMIN));
    assert.ok(audit.some(row=>row.action==='region_restore_original'));assert.ok(audit.some(row=>row.action==='custom_delete'));
    await db.query('update public.user_profiles set role=\'membre\' where id=$1',[ADMIN]);
    await assert.rejects(workspace(),/map_admin_required/);await assert.rejects(saveMarker(5),/map_admin_required/);
    await db.query('update public.user_profiles set role=\'admin\' where id=$1',[ADMIN]);
  });
  await test('migration reapplication preserves overrides, authors, revisions, budgets, audit and other roles',async()=>{
    // An administrator's previous publication decision must survive reapply.
    await db.query("update public.map_entity_registry set published=false where entity_key='location:1:hanaka'");
    const before=await workspace();
    const audit=await scalar('select count(*) as value from nameless_private.map_workspace_audit');
    const budget=await scalar('select minute_attempts as value from nameless_private.map_workspace_limits where subject=$1',[ADMIN]);
    await db.exec(sql);
    assert.deepEqual(await workspace(),before);
    assert.equal(await scalar('select count(*) as value from nameless_private.map_workspace_audit'),audit);
    assert.equal(await scalar('select minute_attempts as value from nameless_private.map_workspace_limits where subject=$1',[ADMIN]),budget);
    assert.equal(await scalar('select role as value from public.user_profiles where id=$1',[MEMBER]),'membre');
    assert.equal(await scalar("select published as value from public.map_entity_registry where entity_key='location:1:hanaka'"),false);
  });
  await test('legacy 005/006 records and publication gates survive upgrading without hardening 004',async()=>{
    const legacy=new PGlite();
    try{
      await legacy.exec(`create role anon;create role authenticated;create role service_role bypassrls;
        create schema auth;grant usage on schema auth to anon,authenticated;
        create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
        create table public.user_profiles(id uuid primary key,role text);
        create table public.admin_logs(id uuid default gen_random_uuid(),actor_id uuid,action text,target_table text,target_id uuid,details jsonb,created_at timestamptz default now());
        create function public.current_user_role() returns text language sql stable security definer as $$select coalesce((select role from public.user_profiles where id=auth.uid()),'visiteur')$$;
        create function public.is_admin() returns boolean language sql stable security definer as $$select public.current_user_role()='admin'$$;
        create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at:=now();return new;end$$;
        create function public.consume_write_budget(uuid,text,integer,integer,integer) returns boolean language sql as $$select true$$;
        create function public.consume_admin_action_limit(uuid,text) returns boolean language sql as $$select true$$;`);
      await legacy.exec(fs.readFileSync(path.join(root,'docs/supabase/SAO_NAMELESS_MAP_MARKERS_005.sql'),'utf8'));
      await legacy.exec(fs.readFileSync(path.join(root,'docs/supabase/SAO_NAMELESS_MAP_PUBLICATION_006.sql'),'utf8'));
      await legacy.query("insert into public.map_entity_registry(entity_key,kind,floor,marker_type,published) values($1,'location',1,'town',true),('location:1:hanaka','location',1,'town',false),('quest:1:retired-test','quest',1,'quest-primary',false)",[key]);
      await legacy.query("insert into public.map_marker_overrides(entity_key,floor,marker_type,state,u,v) values($1,1,'town','visible',.63,.72)",[key]);
      const old=(await legacy.query('select * from public.map_marker_overrides')).rows[0];
      await legacy.exec(sql);
      const upgraded=(await legacy.query('select * from public.map_marker_overrides')).rows[0];
      assert.deepEqual({...upgraded,revision:undefined},{...old,revision:undefined});
      assert.equal((await legacy.query("select published from public.map_entity_registry where entity_key='location:1:hanaka'")).rows[0].published,false);
      assert.equal((await legacy.query("select published from public.map_entity_registry where entity_key='quest:1:retired-test'")).rows[0].published,false);
      await legacy.exec('begin;set local role anon;');
      const published=(await legacy.query('select * from public.read_map_marker_overrides()')).rows;
      await legacy.exec('commit;');
      assert.ok(published.some(row=>row.entity_key===key&&row.u===.63&&row.v===.72));
      assert.ok(published.some(row=>row.entity_key==='quest:1:retired-test'&&row.state==='hidden'&&row.u===null));
      await legacy.query('insert into public.user_profiles values($1,\'admin\')',[ADMIN]);
      await legacy.exec('begin;set local role authenticated;');
      await legacy.query("select set_config('request.jwt.claim.sub',$1,true)",[ADMIN]);
      const update=(await legacy.query("select public.map_workspace_save_marker($1,'visible',.2,.3,0) as value",[key])).rows[0].value;
      await legacy.exec('commit;');assert.equal(update.revision,1);
      assert.equal((await legacy.query("select count(*) as count from nameless_private.map_workspace_audit")).rows[0].count,1);
    }finally{await legacy.close();}
  });
  console.log(`Map workspace server: ${passed} isolated checks passed.`);
}finally{await db.close();}
