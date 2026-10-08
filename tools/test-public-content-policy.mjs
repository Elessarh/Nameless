// Historical preservation and public data boundaries. Never contacts Supabase.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createMapGraph} from './build-map-graph.mjs';
import {createSearchIndex} from './build-search-index.mjs';
import {ARCHIVE_DIRECTORY, verifyHistoricalArchive, projectCreature, projectMapSource, assertNoCombatFields, HISTORICAL_QUEST_STATUS} from './public-content-policy.mjs';
const require = createRequire(import.meta.url);
const {JSDOM} = require('jsdom'), ts = require('typescript'), {PGlite} = require('@electric-sql/pglite');
const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const archived = file => read(ARCHIVE_DIRECTORY + '/' + file);
let checks = 0;
const check = (condition, message) => {assert.ok(condition, message); checks++;};
function literal(source, name) {
    const ast = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
    let node;
    const visit = current => {
        if (ts.isVariableDeclaration(current) && current.name.getText(ast) === name) node = current.initializer;
        ts.forEachChild(current, visit);
    };
    visit(ast);
    return JSON.parse(JSON.stringify(vm.runInNewContext('(' + node.getText(ast) + ')')));
}
const manifest = verifyHistoricalArchive(root);
check(manifest.files.length === 7, 'All historical data and translation sources retain their recorded hashes');
const historical = literal(archived('js/bestiaire.js'), 'creaturesData');
const creatures = literal(read('js/bestiaire.js'), 'creaturesData');
assert.equal(historical.length,60); assert.equal(creatures.length,60);
assert.deepEqual(creatures,historical.map(projectCreature),'All reliable creature fields and IDs survive, only unverified combat fields are removed');
check(historical.every(creature=>Number.isFinite(creature.hp)), 'The sixty historical HP values remain recoverable privately');
assertNoCombatFields(creatures);
check(!/creature\.hp|Points de vie|creature-hp|hp-label|hp-val/.test(read('js/bestiaire.js')), 'Published bestiary code cannot render historical HP');
const raw = JSON.parse(read('data/map-source.json'));
assert.equal(read('data/map-source.json'),archived('data/map-source.json'),'Raw map history is unchanged byte for byte');
const source = projectMapSource(raw);
assert.equal(raw.questData.length + raw.questDataFloor2.length,99);
assert.equal(source.questData.length + source.questDataFloor2.length,59);
const oldDom = new JSDOM(archived('pages/quetes.html')), publicDom = new JSDOM(read('pages/quetes.html'));
const oldSteps = [...oldDom.window.document.querySelectorAll('.quest-step')];
const secondary = oldSteps.filter(step=>step.closest('.quest-section').dataset.category==='secondaire');
assert.equal(oldSteps.length,125); assert.equal(secondary.length,58);
assert.deepEqual([...publicDom.window.document.querySelectorAll('.quest-step')].map(step=>step.outerHTML),secondary.map(step=>step.outerHTML),'Secondary guide instructions, coordinate links and IDs are preserved exactly');
check(!publicDom.window.document.querySelector('.quest-section[data-category="principale"]'), 'Main walkthroughs do not ship in the public legacy document');
check(publicDom.window.document.querySelector('meta[name="robots"]').content==='noindex, follow', 'Historical quest route is explicitly excluded from indexing');
check(publicDom.window.document.querySelector('.quest-archive-notice') && publicDom.window.document.querySelector('#quest-archived-target'), 'Direct old links have an accessible archive explanation');
oldDom.window.close(); publicDom.window.close();
const graph = createMapGraph({root}), index = createSearchIndex({mapGraph:graph});
const entities = Object.values(graph.floors).flatMap(floor=>Object.values(floor.entities));
assertNoCombatFields(graph); assertNoCombatFields(index);
for (const entity of entities.filter(entity=>['quest','guide','npc'].includes(entity.kind))) {
    check(entity.status===HISTORICAL_QUEST_STATUS, 'Remaining quest-related evidence is marked unverified: ' + entity.key);
    check(entity.markerType!=='quest-primary' && entity.category!=='principale', 'No principal quest survives projection: ' + entity.key);
}
for (const entry of index.entries.filter(entry=>entry.kind==='quest')) check(entry.status===HISTORICAL_QUEST_STATUS && !entry.id.includes('-principale-'), 'Search indexes separately marked secondary archives only');
assert.equal(index.entries.filter(entry=>entry.kind==='quest').length,58);
for (const primary of raw.questData.filter(entry=>entry.type==='principale')) check(!graph.floors[1].entities['quest:1:' + primary.id], 'Old main raw ID is omitted');
for (const primary of raw.questDataFloor2.filter(entry=>entry.type==='principale')) check(!graph.floors[2].entities['quest:2:' + primary.id], 'Old floor-two main raw ID is omitted');
for (const entry of index.entries.filter(entry=>['item','creature','boss'].includes(entry.kind))) check(entry.image.startsWith('/assets/'), 'Search thumbnails use original local project assets');
const output = path.join(root,'_site');
if (fs.existsSync(output)) {
    check(!fs.existsSync(path.join(output,'data')) && !fs.existsSync(path.join(output,'docs')), 'Build allowlist excludes historical data, private archives and migrations');
    check(!/<loc>[^<]*(?:\/quetes|\/pages\/quetes\.html)<\/loc>/.test(fs.readFileSync(path.join(output,'sitemap.xml'),'utf8')), 'Archive routes are absent from the sitemap');
    for (const file of ['assets/map/catalog.json','assets/map/floor-1.json','assets/map/floor-2.json','assets/search-index.json']) {
        const data=JSON.parse(fs.readFileSync(path.join(output,file),'utf8')); assertNoCombatFields(data);
        check(!JSON.stringify(data).includes('p1-principale-') && !JSON.stringify(data).includes('p2-principale-'), 'Published JSON excludes superseded walkthrough IDs');
    }
}

// Real Postgres semantics for the additive publication gate, isolated in memory.
const db = new PGlite();
try {
    await db.exec(`create role anon; create role authenticated;
      create function public.is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('test.admin',true),'false')='true' $$;
      revoke all on function public.is_admin() from public,anon; grant execute on function public.is_admin() to authenticated;
      create table public.map_entity_registry(entity_key text primary key,kind text,floor smallint,marker_type text);
      create table public.map_marker_overrides(id uuid default gen_random_uuid(),entity_key text,floor smallint,marker_type text,state text,u double precision,v double precision);
      alter table public.map_entity_registry enable row level security;
      alter table public.map_marker_overrides enable row level security;
      grant usage on schema public to anon,authenticated;
      grant select on public.map_entity_registry to anon,authenticated;
      grant select,insert,update,delete on public.map_marker_overrides to authenticated;
      create policy "map registry public read" on public.map_entity_registry for select to anon,authenticated using(true);
      create policy "map overrides admin" on public.map_marker_overrides for all to authenticated using(public.is_admin()) with check(public.is_admin());
      insert into public.map_entity_registry values('location:test-town','location',1,'town'),('quest:1:quest-1','quest',1,'quest-primary');
      insert into public.map_marker_overrides(entity_key,floor,marker_type,state,u,v) values('location:test-town',1,'town','visible',.2,.3),('quest:1:quest-1',1,'quest-primary','visible',.4,.5);`);
    await db.exec(read('docs/supabase/SAO_NAMELESS_MAP_PUBLICATION_006.sql'));
    async function asRole(role,admin,run) {
        await db.exec('begin;set local role ' + role + ';');
        await db.query("select set_config('test.admin',$1,true)",[String(admin)]);
        try {const result=await run();await db.exec('commit;');return result;} catch(error){await db.exec('rollback;');throw error;}
    }
    check((await asRole('anon',false,()=>db.query('select * from public.map_entity_registry'))).rows.length===0, 'Migration alone fails closed before the allowlist is applied');
    const inactive=(await asRole('anon',false,()=>db.query('select * from public.read_map_marker_overrides()'))).rows;
    check(inactive.length===2 && inactive.every(row=>row.state==='hidden' && row.id===null && row.u===null && row.v===null), 'Unpublished identities expose only minimal synthetic tombstones that suppress cached static coordinates');
    await db.exec("update public.map_entity_registry set published=true where entity_key='location:test-town';");
    await db.exec(read('docs/supabase/SAO_NAMELESS_MAP_PUBLICATION_006.sql'));
    check((await asRole('anon',false,()=>db.query('select * from public.map_entity_registry'))).rows.length===1, 'Migration is idempotent without resetting the current allowlist');
    const visible=(await asRole('anon',false,()=>db.query('select * from public.read_map_marker_overrides()'))).rows;
    check(visible.length===2 && visible.find(row=>row.entity_key==='location:test-town').u===.2 && visible.find(row=>row.entity_key==='quest:1:quest-1').id===null, 'RPC publishes allowed placements and preserves the inactive baseline mask');
    await db.exec("update public.map_marker_overrides set state='hidden' where entity_key='location:test-town';");
    const hidden=(await asRole('anon',false,()=>db.query('select * from public.read_map_marker_overrides()'))).rows.find(row=>row.entity_key==='location:test-town');
    check(hidden.state==='hidden' && hidden.u===null && hidden.v===null, 'Published tombstones preserve baseline masking without disclosing hidden coordinates');
    check((await asRole('authenticated',false,()=>db.query('select * from public.map_marker_overrides'))).rows.length===0, 'Member table access remains protected by the existing administrator policy');
    check((await asRole('authenticated',true,()=>db.query('select * from public.map_marker_overrides'))).rows.length===2, 'Administrator access to all historical override data is preserved');
    check((await asRole('authenticated',true,()=>db.query('select * from public.map_entity_registry'))).rows.length===2, 'Administrator can still inspect unpublished registry identities');
    await assert.rejects(asRole('anon',false,()=>db.query('select * from public.map_marker_overrides')),/permission denied/);
    await assert.rejects(asRole('authenticated',false,()=>db.query("update public.map_entity_registry set published=true where entity_key='quest:1:quest-1'")),/permission denied/);
    check((await db.query('select count(*)::int as n from public.map_marker_overrides')).rows[0].n===2,'Publication gate never deletes historical placements');
} finally {await db.close();}
console.log('Public content policy: ' + checks + ' checks, immutable archive, secondary projection, creature stats purge and real SQL publication gate passed.');
