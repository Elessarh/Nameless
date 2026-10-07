#!/usr/bin/env node
// Isolated PGlite + fake SDK/Leaflet only. No Supabase network or credentials.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PGlite } = require('@electric-sql/pglite');
const { JSDOM } = require('jsdom');
const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let passed = 0;
async function test(name, run) { await run(); passed++; console.log('PASS ' + name); }
const ADMIN = '44444444-4444-4444-8444-444444444444';
const PLAYER = '55555555-5555-4555-8555-555555555555';
const KEY = 'location:test-town';
const db = new PGlite();
try {
    await db.exec(`
        create role anon; create role authenticated; create role service_role bypassrls;
        create schema auth; create schema storage;
        create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
        create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
        grant usage on schema auth,storage to authenticated,service_role;
        create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
        create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,created_at timestamptz default now());
        alter table storage.objects enable row level security;
        grant select,insert,update,delete on storage.objects to authenticated;
        create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
    `);
    await db.exec(read('docs/supabase/SAO_NAMELESS_SCHEMA.sql').replace('create extension if not exists pgcrypto;', ''));
    for (const file of ['SAO_NAMELESS_RLS_PATCH_003.sql','SAO_NAMELESS_SECURITY_PATCH_002.sql','SAO_NAMELESS_MINECRAFT_PUBLIC_LINK_PATCH.sql','SAO_NAMELESS_ADMIN_ACTIONS_PATCH.sql','SAO_NAMELESS_HARDENING_004.sql','SAO_NAMELESS_MAP_MARKERS_005.sql']) await db.exec(read('docs/supabase/' + file));
    await test('map migration is additive and idempotent', async () => { await db.exec(read('docs/supabase/SAO_NAMELESS_MAP_MARKERS_005.sql')); });
    for (const [id, role] of [[ADMIN,'admin'],[PLAYER,'joueur']]) {
        await db.query('insert into auth.users(id,email) values($1,$2)', [id, role + '@example.test']);
        await db.query('update public.user_profiles set role=$1 where id=$2', [role,id]);
    }
    await db.exec(`insert into public.map_entity_registry(entity_key,kind,floor,marker_type) values
        ('${KEY}','location',1,'town'),('quest:test-quest','quest',1,'quest-primary'),('npc:test-npc','npc',2,'npc');`);
    async function asRole(role, id, run) {
        await db.exec('begin; set local role ' + role + ';');
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id || '']);
        try { const result = await run(); await db.exec('commit;'); return result; }
        catch (error) { await db.exec('rollback;'); throw error; }
    }
    const insert = (key = KEY, floor = 1, u = .2, v = .3, state = 'visible') => db.query(
        'insert into public.map_marker_overrides(entity_key,floor,marker_type,state,u,v) values($1,$2,$3,$4,$5::double precision,$6::double precision) returning *',
        [key,floor,'town',state,u,v]);
    await test('registry is public read only; players and missing sessions cannot write', async () => {
        assert.equal((await asRole('anon',null,() => db.query('select * from public.map_entity_registry'))).rows.length,3);
        await assert.rejects(asRole('authenticated',PLAYER,() => db.query("insert into public.map_entity_registry values('location:fake','location',1,'town')")), /permission denied/);
        await assert.rejects(asRole('authenticated',PLAYER,() => insert()), /row-level security|map_admin_required/);
        await assert.rejects(asRole('authenticated',null,() => insert()), /row-level security|session_required/);
    });
    await test('unknown entities, wrong floors and invalid numeric values fail', async () => {
        await assert.rejects(asRole('authenticated',ADMIN,() => insert('location:missing')), /foreign key/);
        await assert.rejects(asRole('authenticated',ADMIN,() => insert(KEY,2)), /foreign key/);
        for (const number of ['NaN','Infinity','-Infinity',-.01,1.01]) await assert.rejects(asRole('authenticated',ADMIN,() => insert(KEY,1,number)), /check constraint/);
        await assert.rejects(asRole('authenticated',ADMIN,() => insert(KEY,1,null,.2)), /check constraint/);
    });
    let marker;
    await test('server imposes identity and authors; update identity spoof is rejected', async () => {
        const result = await asRole('authenticated',ADMIN,() => db.query(`insert into public.map_marker_overrides
            (id,entity_key,floor,marker_type,u,v,created_by,updated_by,created_at,updated_at)
            values($1,$2,1,'town',0,1,$3,$3,'2000-01-01','2000-01-01') returning *`, [PLAYER,KEY,PLAYER]));
        marker = result.rows[0];
        assert.notEqual(marker.id,PLAYER); assert.equal(marker.created_by,ADMIN); assert.equal(marker.updated_by,ADMIN);
        assert.ok(new Date(marker.created_at).getUTCFullYear() > 2000);
        await assert.rejects(asRole('authenticated',ADMIN,() => db.query('update public.map_marker_overrides set created_by=$1 where id=$2',[PLAYER,marker.id])), /identity_immutable/);
        await assert.rejects(asRole('authenticated',ADMIN,() => db.query('update public.map_marker_overrides set id=$1 where id=$2',[PLAYER,marker.id])), /identity_immutable/);
    });
    await test('public RPC returns tombstones but never hidden coordinates or author metadata', async () => {
        await asRole('authenticated',ADMIN,() => db.query("update public.map_marker_overrides set state='hidden' where id=$1",[marker.id]));
        await assert.rejects(asRole('anon',null,() => db.query('select * from public.map_marker_overrides')), /permission denied/);
        assert.equal((await asRole('authenticated',PLAYER,() => db.query('select * from public.map_marker_overrides'))).rows.length,0);
        let row = (await asRole('anon',null,() => db.query('select * from public.read_map_marker_overrides()'))).rows[0];
        assert.equal(row.state,'hidden'); assert.equal(row.u,null); assert.equal(row.v,null); assert.equal('created_by' in row,false);
        await asRole('authenticated',ADMIN,() => db.query("update public.map_marker_overrides set state='deleted',u=null,v=null where id=$1",[marker.id]));
        row = (await asRole('anon',null,() => db.query('select * from public.read_map_marker_overrides()'))).rows[0];
        assert.equal(row.state,'deleted'); assert.equal(row.u,null);
        assert.equal((await asRole('authenticated',ADMIN,() => db.query('select * from public.map_marker_overrides'))).rows.length,1);
    });
    await test('delete restores static marker; hide/delete never reset server budgets', async () => {
        const before = (await db.query('select minute_attempts from nameless_private.map_write_limits where subject=$1',[ADMIN])).rows[0].minute_attempts;
        await asRole('authenticated',ADMIN,() => db.query('delete from public.map_marker_overrides where id=$1',[marker.id]));
        const after = (await db.query('select minute_attempts from nameless_private.map_write_limits where subject=$1',[ADMIN])).rows[0].minute_attempts;
        assert.equal(after,before+1);
        assert.equal((await asRole('anon',null,() => db.query('select * from public.read_map_marker_overrides()'))).rows.length,0);
        assert.equal((await db.query("select action from public.admin_logs where target_table='map_marker_overrides' order by created_at desc limit 1")).rows[0].action,'map_restore_original');
    });
    await test('minute/hour budgets reject writes and survive removal', async () => {
        await db.query('update nameless_private.map_write_limits set minute_attempts=60,minute_start=now(),hour_attempts=0,hour_start=now() where subject=$1',[ADMIN]);
        await assert.rejects(asRole('authenticated',ADMIN,() => insert()), /rate_limited/);
        await db.query('update nameless_private.map_write_limits set minute_attempts=0,hour_attempts=300 where subject=$1',[ADMIN]);
        await assert.rejects(asRole('authenticated',ADMIN,() => insert()), /rate_limited/);
        await db.query('update nameless_private.map_write_limits set minute_attempts=0,hour_attempts=0 where subject=$1',[ADMIN]);
    });
    await test('audit failure rolls back both marker and budget', async () => {
        await db.exec(`create function public.test_fail_map_audit() returns trigger language plpgsql as $$ begin
          if new.target_table='map_marker_overrides' then raise exception 'test_audit_failure'; end if; return new; end $$;
          create trigger test_fail_map_audit before insert on public.admin_logs for each row execute function public.test_fail_map_audit();`);
        await assert.rejects(asRole('authenticated',ADMIN,() => insert()), /test_audit_failure/);
        assert.equal((await db.query('select * from public.map_marker_overrides')).rows.length,0);
        assert.equal((await db.query('select minute_attempts from nameless_private.map_write_limits where subject=$1',[ADMIN])).rows[0].minute_attempts,0);
        await db.exec('drop trigger test_fail_map_audit on public.admin_logs; drop function public.test_fail_map_audit();');
    });
    await test('privileged maintenance without JWT is allowed and audited', async () => {
        await asRole('service_role',null,() => insert('quest:test-quest',1,null,null,'hidden'));
        assert.equal((await db.query("select actor_id from public.admin_logs where action='map_hide' order by created_at desc limit 1")).rows[0].actor_id,null);
    });
} finally { await db.close(); }

const dom = new JSDOM('<html lang="fr"><body><main><div id="map-admin-host"></div></main></body></html>', { url: 'https://nameless-sao.fr/map',runScripts:'outside-only' });
const w = dom.window;
let actor = ADMIN, role = 'admin', token = 'test-token', reads = 0;
let rows = [], calls = [], pendingResolve, readDelay, userDelay, readFailures = 0;
w.supabase = {
    auth: { async getSession() { return { data:{session:actor ? { access_token:token,user:{id:actor} } : null},error:null }; }, async getUser() { if(userDelay) await userDelay();return {data:{user:actor ? {id:actor} : null},error:null}; } },
    async rpc() { return {data:role,error:null}; },
    from(table) {
        assert.equal(table,'map_marker_overrides'); let operation = 'read',payload,id,queryFloor;
        return {
            select() { return this; }, eq(column,value) { if (column==='id') id=value; if(column==='floor') queryFloor=value;return this; },
            insert(value) { operation='insert';payload=value;return this; }, update(value) { operation='update';payload=value;return this; }, delete() { operation='delete';return this; },
            async then(resolve) {
                if(operation==='read') { reads++;if(readFailures){readFailures--;resolve({data:null,error:{message:'private_read_failed'}});return;}const captured=rows.map(row=>({...row}));if(readDelay) await readDelay(queryFloor);resolve({data:captured,error:null});return; }
                calls.push({operation,payload,id});
                if(pendingResolve) { await new Promise(res => { pendingResolve = res; }); pendingResolve = null; }
                if(operation==='delete') rows=[];
                else rows=[{id:'test-row',...payload}];
                resolve({data:[{id:'test-row'}],error:null});
            }
        };
    }
};
const mapEvents = new Map(),bridgeEvents = new Map();
let preview;
w.L = { marker(position) { preview={position,handlers:{},dragging:{enable(){},disable(){}},addTo(){return this;},on(event,callback){this.handlers[event]=callback;return this;},off(){this.handlers={};},setLatLng(p){this.position=p;},getLatLng(){return this.position;}};return preview; } };
const controller = new w.AbortController();
const registry = [{key:KEY,kind:'location',floor:1,markerType:'town'}];
let floor = 1,reloads = 0, mode = false, overridesStatus = 'ready';
const bridge = {
    map:{on(event,fn){mapEvents.set(event,fn);},off(event){mapEvents.delete(event);},removeLayer(){}},root:w.document.querySelector('main'),signal:controller.signal,
    catalog:{index:[{key:KEY,floor:1,markerType:'town',title:'<script>Town</script>'}],registry},getFloor:()=>floor,getData:()=>({entities:{},points:[]}),
    selectEntity(key){bridgeEvents.get('entityselect')?.(key);},notice(){},async reloadOverrides(){reloads++;},setEditorMode(value){mode=value;},
    getOverridesStatus:()=>overridesStatus,
    getRelative:position=>({u:position.lng,v:position.lat}),getLatLng:position=>({lng:position.u,lat:position.v}),
    on(event,fn){bridgeEvents.set(event,fn);return ()=>bridgeEvents.delete(event);}
};
w.eval(read('js/map-admin.js'));
const flush = async () => { for(let index=0;index<12;index++) await new Promise(resolve=>setTimeout(resolve,0)); };
const selectEntity = () => { const field=w.document.getElementById('map-editor-entity');field.value=KEY;field.dispatchEvent(new w.Event('change')); };
const click = action=>w.document.querySelector('.map-editor-'+action).click();
try {
    await test('editor uses safe labels, draft click/drag never writes, save is explicit',async()=>{
        assert.equal(await w.NamelessMapAdmin.init(bridge),true); selectEntity();
        assert.equal(w.document.querySelector('#map-admin-host script'),null);
        click('place');assert.equal(mode,true);
        mapEvents.get('click')({latlng:{lng:-.1,lat:.3}});assert.equal(w.document.querySelector('.map-editor-save').disabled,true);
        mapEvents.get('click')({latlng:{lng:.2,lat:.3}});assert.equal(calls.length,0);
        preview.position={lng:.4,lat:.5};preview.handlers.dragend();assert.equal(calls.length,0);
        click('save');await flush();assert.equal(calls.length,1);assert.equal(calls[0].payload.u,.4);assert.equal(calls[0].payload.v,.5);assert.equal('created_by' in calls[0].payload,false);assert.equal(reloads,1);
    });
    await test('hide/remove are tombstones and restore is the only real DELETE',async()=>{
        click('hide');await flush();assert.equal(calls.at(-1).payload.state,'hidden');
        click('remove');await flush();assert.equal(calls.at(-1).payload.state,'deleted');
        click('restore');await flush();assert.equal(calls.at(-1).operation,'delete');
    });
    await test('archive or failed public RPC disables editing despite a readable private table',async()=>{
        const before=calls.length;overridesStatus='archive';bridgeEvents.get('overrides')?.({status:'archive'});
        assert.equal(w.document.querySelector('.map-editor-hide').disabled,true);click('hide');await flush();assert.equal(calls.length,before);
        overridesStatus='ready';await w.NamelessMapAdmin.init(bridge);selectEntity();
        overridesStatus='error';click('hide');await flush();assert.equal(calls.length,before);
        overridesStatus='ready';await w.NamelessMapAdmin.init(bridge);selectEntity();
        w.document.documentElement.lang='en';w.document.dispatchEvent(new w.CustomEvent('nameless:languagechange'));
        assert.equal(w.document.querySelector('.map-editor-restore').textContent,'Restore original marker');
        w.document.documentElement.lang='fr';w.document.dispatchEvent(new w.CustomEvent('nameless:languagechange'));
    });
    await test('P1 → P2 → P1 stale private read cannot replace the newest override identity',async()=>{
        let release, first=true;
        rows=[{id:'stale-id',entity_key:KEY,floor:1,marker_type:'town',state:'visible',u:.1,v:.1}];
        readDelay=async()=>{if(first){first=false;await new Promise(resolve=>{release=resolve;});}};
        bridgeEvents.get('floor')?.({floor:1});await flush();assert.equal(typeof release,'function');
        floor=2;bridgeEvents.get('floor')?.({floor:2});await flush();
        rows=[{id:'fresh-id',entity_key:KEY,floor:1,marker_type:'town',state:'visible',u:.8,v:.8}];
        floor=1;bridgeEvents.get('floor')?.({floor:1});await flush();
        release();await flush();readDelay=null;selectEntity();click('hide');await flush();
        assert.equal(calls.at(-1).id,'fresh-id');assert.equal(calls.at(-1).payload.u,.8);
    });
    await test('write freezes type before auth awaits and changed floor abandons the pending intent',async()=>{
        let release;userDelay=()=>new Promise(resolve=>{release=resolve;});
        selectEntity();const before=calls.length;click('hide');await flush();
        w.document.getElementById('map-editor-type').value='dungeon';
        userDelay=null;release();await flush();assert.equal(calls.length,before+1);assert.equal(calls.at(-1).payload.marker_type,'town');
        userDelay=()=>new Promise(resolve=>{release=resolve;});click('hide');await flush();
        floor=2;bridgeEvents.get('floor')?.({floor:2});userDelay=null;release();await flush();
        assert.equal(calls.length,before+1);assert.ok(w.document.getElementById('map-admin-host').childElementCount>0);
        assert.match(w.document.querySelector('.map-editor-status').textContent,/Aucune entité/);
        floor=1;bridgeEvents.get('floor')?.({floor:1});await flush();
        assert.equal(w.document.getElementById('map-editor-entity').disabled,false);selectEntity();
        assert.equal(w.document.querySelector('.map-editor-hide').disabled,false);
    });
    await test('a committed request refreshes public overrides after a floor change and keeps the editor reusable',async()=>{
        const before=calls.length,beforeReloads=reloads;pendingResolve=true;
        click('hide');await flush();assert.equal(calls.length,before+1);
        const release=pendingResolve;floor=2;bridgeEvents.get('floor')?.({floor:2});await flush();
        assert.ok(w.document.getElementById('map-admin-host').childElementCount>0);
        assert.match(w.document.querySelector('.map-editor-status').textContent,/Aucune entité/);
        release();await flush();assert.equal(reloads,beforeReloads+1);
        floor=1;bridgeEvents.get('floor')?.({floor:1});await flush();
        assert.equal(w.document.getElementById('map-editor-entity').disabled,false);selectEntity();
        assert.equal(w.document.querySelector('.map-editor-hide').disabled,false);
    });
    await test('public refresh happens before a suspended post-commit private read, even across floors',async()=>{
        let release,first=true;const beforeReloads=reloads;
        readDelay=async()=>{if(first){first=false;await new Promise(resolve=>{release=resolve;});}};
        click('hide');await flush();assert.equal(typeof release,'function');
        assert.equal(reloads,beforeReloads+1);assert.equal(rows[0].state,'hidden');
        floor=2;bridgeEvents.get('floor')?.({floor:2});await flush();
        release();await flush();readDelay=null;
        assert.ok(w.document.getElementById('map-admin-host').childElementCount>0);
        floor=1;bridgeEvents.get('floor')?.({floor:1});await flush();selectEntity();
        assert.equal(w.document.querySelector('.map-editor-hide').disabled,false);
    });
    await test('a committed write still refreshes the public view when its private cache read fails',async()=>{
        const before=calls.length,beforeReloads=reloads;readFailures=1;click('hide');await flush();
        assert.equal(calls.length,before+1);assert.equal(reloads,beforeReloads+1);
        assert.match(w.document.querySelector('.map-editor-status').textContent,/Modification enregistrée, mais affichage non actualisé/);
        assert.equal(w.document.querySelector('.map-editor-hide').disabled,true);
        await w.NamelessMapAdmin.init(bridge);selectEntity();
    });
    await test('role/session changes refuse mutation and logout clears editor',async()=>{
        const before=calls.length;role='joueur';click('hide');await flush();assert.equal(calls.length,before);
        role='admin';await w.NamelessMapAdmin.init(bridge);selectEntity();actor=PLAYER;click('hide');await flush();assert.equal(calls.length,before);
        w.document.dispatchEvent(new w.CustomEvent('nameless:auth-changed',{detail:{user:null}}));
        assert.equal(w.document.getElementById('map-admin-host').childElementCount,0);assert.equal(mapEvents.size,0);assert.equal(mode,false);
    });
    await test('pending writes disable duplicate actions and late completion leaves a destroyed editor alone',async()=>{
        actor=ADMIN;floor=1;await w.NamelessMapAdmin.init(bridge);selectEntity();
        const before=calls.length, beforeReloads=reloads;pendingResolve=true;
        click('hide');await flush();
        assert.equal(calls.length,before+1);
        assert.ok([...w.document.querySelectorAll('#map-admin-host button, #map-admin-host select')].every(node=>node.disabled));
        click('hide');assert.equal(calls.length,before+1);
        const release=pendingResolve;
        w.document.dispatchEvent(new w.CustomEvent('nameless:auth-changed',{detail:{user:null}}));
        release();await flush();
        assert.equal(w.document.getElementById('map-admin-host').childElementCount,0);
        assert.equal(reloads,beforeReloads);
    });
    await test('floor with empty registry does not invent an entity; navigation cleans listeners',async()=>{
        actor=ADMIN;floor=3;assert.equal(await w.NamelessMapAdmin.init(bridge),false);
        assert.match(w.document.querySelector('.map-editor-status').textContent,/Aucune entité/);
        assert.equal(w.document.querySelector('.map-editor-save').disabled,true);
        controller.abort();assert.equal(w.document.getElementById('map-admin-host').childElementCount,0);
    });
} finally { w.NamelessMapAdmin.destroy();dom.window.close(); }
console.log(`${passed} isolated map admin checks passed.`);
