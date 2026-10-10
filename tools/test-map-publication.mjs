// Execute migration 006 in Postgres, then feed its real public payload to the
// shipped Leaflet runtime. No build artifact, browser server or remote API.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createMapGraph} from './build-map-graph.mjs';
const require=createRequire(import.meta.url);
const {PGlite}=require('@electric-sql/pglite'),{JSDOM,VirtualConsole}=require('jsdom');
const root=path.resolve(import.meta.dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const graph=createMapGraph({root}),town='location:1:ville-depart',otherTown='location:1:hanaka',noOverride='location:1:mizunari',retired='quest:1:quest-1';
for(const key of [town,otherTown,noOverride]) assert.ok(graph.floors[1].entities[key].position,'Fixture is a real static town with known coordinates');
assert.ok(!graph.floors[1].entities[retired],'The retired main quest has no current public entity');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error));
const db=new PGlite();let dom,checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
async function visitor(query='select * from public.read_map_marker_overrides()') {
    await db.exec('begin;set local role anon;');
    try {const result=await db.query(query);await db.exec('commit;');return result.rows;}catch(error){await db.exec('rollback;');throw error;}
}
try {
    await db.exec(`create role anon;create role authenticated;
      create function public.is_admin() returns boolean language sql stable as $$select false$$;
      revoke all on function public.is_admin() from public,anon;grant execute on function public.is_admin() to authenticated;
      create table public.map_entity_registry(entity_key text primary key,kind text,floor smallint,marker_type text);
      create table public.map_marker_overrides(id uuid default gen_random_uuid(),entity_key text,floor smallint,marker_type text,state text,u double precision,v double precision);
      alter table public.map_entity_registry enable row level security;
      grant usage on schema public to anon,authenticated;
      grant select on public.map_entity_registry to anon,authenticated;
      create policy "map registry public read" on public.map_entity_registry for select to anon,authenticated using(true);`);
    for(const entry of graph.registry) await db.query('insert into public.map_entity_registry values($1,$2,$3,$4)',[entry.key,entry.kind,entry.floor,entry.markerType]);
    await db.query("insert into public.map_entity_registry values($1,'quest',1,'quest-primary')",[retired]);
    await db.query("insert into public.map_marker_overrides(entity_key,floor,marker_type,state,u,v) values($1,1,'town','hidden',.75,.85),($2,1,'town','visible',.2,.3)",[town,otherTown]);
    await db.exec(read('docs/supabase/SAO_NAMELESS_MAP_PUBLICATION_006.sql'));
    let rpc=await visitor();
    check((await visitor('select * from public.map_entity_registry')).length===0,'Migration alone exposes no registry table rows');
    check(rpc.length===graph.registry.length+1,'Every unpublished identity has exactly one suppression tombstone');
    check(rpc.every(row=>row.id===null&&row.state==='hidden'&&row.u===null&&row.v===null),'Neither historical placement IDs nor coordinates leak before publication');
    check(rpc.every(row=>Object.keys(row).sort().join(',')==='entity_key,floor,id,marker_type,state,u,v'),'RPC returns only the stable minimal projection');
    check(rpc.some(row=>row.entity_key===noOverride),'An unpublished identity without an override still suppresses its static baseline');
    check(rpc.some(row=>row.entity_key===retired),'Cached retired identities receive suppression without obsolete walkthrough content');

    dom=new JSDOM(read('pages/map.html'),{url:'https://nameless-sao.fr/carte?floor=1&entity='+encodeURIComponent(town),runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
    const w=dom.window;
    w.NamelessSpaRouter={controlsLifecycle:true};w.scrollTo=()=>{};
    w.fetch=async value=>{const url=new URL(String(value),w.location.href);let data;
      if(url.pathname==='/assets/map/catalog.json')data=graph.catalog;
      else {const match=/^\/assets\/map\/floor-([123])\.json$/.exec(url.pathname);assert.ok(match,'Map only requests the graph catalogue and selected floor');data=graph.floors[match[1]];}
      return {ok:true,json:async()=>JSON.parse(JSON.stringify(data))};};
    w.supabase={rpc:async name=>{
      if(name==='read_map_custom_markers')return {data:null,error:{code:'PGRST202',message:'Custom marker reader is not installed in migration 006'}};
      assert.equal(name,'read_map_marker_overrides');return {data:await visitor(),error:null};
    }};
    const container=w.document.getElementById('game-map');
    Object.defineProperties(container,{clientWidth:{value:900},clientHeight:{value:600}});
    container.getBoundingClientRect=()=>({top:0,left:0,bottom:600,right:900,width:900,height:600});
    w.addEventListener('error',event=>errors.push(event.error));
    w.eval(read('js/vendor/leaflet-1.9.4.js'));w.eval(read('js/map.js'));
    const bridge=await w.NamelessMapPage.init();
    check(bridge.getOverridesStatus()==='ready','A successful migration-only RPC is treated as ready');
    check(bridge.getData().points.length===0&&container.querySelectorAll('.leaflet-marker-icon').length===0,'Ready tombstones keep every static baseline marker suppressed before the seed');
    check(bridge.getData().entities[town].position===null&&bridge.getData().entities[noOverride].position===null,'Both a previously hidden town and a town without an override have no exposed baseline position');
    const initialCenter=bridge.map.getCenter();await bridge.selectEntity(town);
    check(bridge.map.getCenter().equals(initialCenter),'Selecting a known hidden town does not center on its former static coordinates');
    check(w.document.getElementById('map-panel-content').textContent.includes('Ce repère est masqué sur la carte.'),'The real public panel explains the marker is hidden');

    await db.query('update public.map_entity_registry set published=true where entity_key<>$1',[retired]);
    await db.exec(read('docs/supabase/SAO_NAMELESS_MAP_PUBLICATION_006.sql'));
    rpc=await visitor();
    check(rpc.length===3,'After publication, two stored overrides and one retired mask remain');
    check(rpc.find(row=>row.entity_key===town).id!==null&&rpc.find(row=>row.entity_key===town).u===null,'Published hidden override retains its actual identity and still hides coordinates');
    check(rpc.find(row=>row.entity_key===otherTown).u===.2&&rpc.find(row=>row.entity_key===otherTown).v===.3,'Published visible placement keeps its real normalized position');
    check(!rpc.some(row=>row.entity_key===noOverride),'A published identity without an override intentionally uses the current static baseline');
    await bridge.reloadOverrides();
    check(!bridge.getData().points.includes(town)&&bridge.getData().points.includes(noOverride),'The real reader restores published baselines while preserving hidden overrides');
    const beforeHiddenSelection=bridge.map.getCenter();await bridge.selectEntity(town);
    check(bridge.map.getCenter().equals(beforeHiddenSelection),'Published hidden town never recenters during selection');
    await bridge.selectEntity(otherTown);
    const expected=bridge.getLatLng({u:.2,v:.3});
    check(bridge.map.getCenter().equals(w.L.latLng(expected)),'A published visible town uses its actual override when selected');

    await db.query('update public.map_entity_registry set published=false where entity_key=$1',[noOverride]);
    rpc=await visitor();
    check(rpc.find(row=>row.entity_key===noOverride).id===null,'Retiring a baseline-only identity creates a synthetic tombstone without fabricating an override');
    await bridge.reloadOverrides();const centerBeforeRetiredSelection=bridge.map.getCenter();await bridge.selectEntity(noOverride);
    check(!bridge.getData().points.includes(noOverride)&&bridge.getData().entities[noOverride].position===null,'Retirement immediately suppresses an existing static town');
    check(bridge.map.getCenter().equals(centerBeforeRetiredSelection),'A newly retired baseline-only town cannot trigger centering');
    check(errors.length===0,errors.map(String).join('\n'));
} finally {if(dom){dom.window.NamelessMapPage?.destroy();dom.window.close();}await db.close();}
console.log('Map publication: '+checks+' checks passed with real SQL 006 payloads and bundled Leaflet; migration-only and retired baselines remain hidden.');
