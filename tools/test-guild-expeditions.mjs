// Isolated fixtures and PostgreSQL-compatible database; never writes to Supabase.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { PGlite } from '@electric-sql/pglite';
const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', ADMIN = '33333333-3333-4333-8333-333333333333', PLAYER = '44444444-4444-4444-8444-444444444444';
const EVENT = '55555555-5555-4555-8555-555555555555', CHECK = '66666666-6666-4666-8666-666666666666';
function page({missing = false, role = 'membre'} = {}) {
    const dom = new JSDOM(read('pages/espace-guilde.html'), {url:'https://nameless-sao.fr/espace-guilde',runScripts:'outside-only',pretendToBeVisual:true});
    const w = dom.window;
    w.currentUser = {id:A};
    w.HTMLDialogElement.prototype.showModal = function () { this.open = true; this.querySelector('button').focus(); };
    w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
    const date = new Date(); date.setUTCDate(date.getUTCDate() + 1); date.setUTCHours(18,0,0,0);
    const tables = {
        guild_planning:[{id:EVENT,titre:'QA <script> expedition',description:'Actual <preparation>',date_event:date.toISOString(),type_event:'raid',capacity:4,tank_slots:1,dps_slots:2,support_slots:1,status:'open'}],
        user_profiles:[{id:A,username:'QA member',minecraft_username:'QaMember',role:'membre',classe:'Guerrier'},{id:B,username:'QA other',role:'membre',classe:'Mage'}],
        guild_event_attendance:[],guild_event_checklist:[{id:CHECK,event_id:EVENT,label:'QA <checklist>',sort_order:0}],guild_event_checks:[]
    };
    const reads = [], writes = [];
    const client = {
        from(table) {
            reads.push(table); const filters = []; let limit = null;
            const query = {
                select(){return this;},order(){return this;},limit(value){limit=value;return this;},
                eq(k,v){filters.push(r=>r[k]===v);return this;},in(k,v){filters.push(r=>v.includes(r[k]));return this;},gte(k,v){filters.push(r=>r[k]>=v);return this;},lt(k,v){filters.push(r=>r[k]<v);return this;},
                insert(payload){writes.push({table,payload});tables[table].push({...payload,id:EVENT});return this;},
                then(resolve){let data=(tables[table]||[]).filter(r=>filters.every(f=>f(r)));if(limit!=null)data=data.slice(0,limit);return Promise.resolve({data,error:missing&&table.startsWith('guild_event_')?{code:'42P01'}:null}).then(resolve);}
            }; return query;
        },
        async rpc(name,args) {
            writes.push({name,args});
            if(name==='guild_event_register') { const old=tables.guild_event_attendance.find(r=>r.user_id===A); if(old)old.group_role=args.requested_role;else tables.guild_event_attendance.push({event_id:EVENT,user_id:A,group_role:args.requested_role}); }
            if(name==='guild_event_unregister')tables.guild_event_attendance=tables.guild_event_attendance.filter(r=>r.user_id!==A);
            if(name==='guild_event_set_check')tables.guild_event_checks=[{checklist_id:args.target_checklist,user_id:A,done:args.completed}];
            return {data:null,error:null};
        }
    };
    w.eval(read('js/guild-date-utils.js')); w.eval(read('js/guild-expeditions.js'));
    return {dom,w,client,tables,reads,writes,root:w.document.querySelector('[data-guild-hq]'),options:{client,user:w.currentUser,role}};
}
{
    const p=page(); const {w,root,writes,dom}=p;
    await w.NamelessGuildExpeditions.init(root,p.options);
    assert.equal(writes.length,0,'Opening the HQ must never write attendance or events');
    const card=root.querySelector('.hq-event');
    assert.equal(card.querySelector('strong').textContent,p.tables.guild_planning[0].titre);
    assert.equal(card.querySelector('script'),null);
    assert.match(card.querySelector('.item-date').textContent,/20:00/,'Event time uses Paris');
    assert.equal(root.querySelector('[data-guild-member-count]').textContent,'(2)');
    assert.ok(root.querySelector('.hq-day[data-count="1"]'),'Calendar uses actual dated records');
    const tab=root.querySelector('[data-hq-tab="overview"]');tab.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
    assert.equal(root.querySelector('[data-hq-tab="expeditions"]').getAttribute('aria-selected'),'true');
    assert.equal(root.querySelector('#hq-overview').hidden,true);
    assert.equal(root.querySelector('[data-guild-create]').hidden,true,'Only admins see event creation');
    const prev=root.querySelector('#hq-month-label').textContent;root.querySelector('[data-calendar-offset="1"]').click();await tick();assert.notEqual(root.querySelector('#hq-month-label').textContent,prev);
    root.querySelector('[data-hq-tab="overview"]').click();
    card.focus();card.click();await tick();
    const dialog=root.querySelector('dialog');assert.equal(dialog.open,true);
    const role=dialog.querySelector('[name="group_role"]');role.value='Tank';
    dialog.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();
    assert.equal(p.tables.guild_event_attendance[0].group_role,'Tank');
    assert.ok(writes.some(r=>r.name==='guild_event_register'&&r.args.target_event===EVENT));
    assert.equal(dialog.querySelector('[name="group_role"]'),w.document.activeElement,'Mutation preserves focus inside the dialog');
    const check=dialog.querySelector('input[type="checkbox"]');check.checked=true;check.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();
    assert.equal(p.tables.guild_event_checks[0].done,true);
    [...dialog.querySelectorAll('button')].find(button=>button.textContent==='Me désinscrire').click();await tick();await tick();
    assert.equal(p.tables.guild_event_attendance.length,0,'Unregistration uses the persisted service');
    assert.match(dialog.querySelector('.hq-feedback').textContent,/Désinscription/);
    root.querySelector('[data-guild-dialog-close]').click();
    assert.equal(w.document.activeElement.dataset.eventId,EVENT,'Closing after refresh returns focus to the current event card');
    const reads=p.reads.length;w.NamelessGuildExpeditions.destroy();root.querySelector('[data-guild-refresh]').click();await tick();assert.equal(p.reads.length,reads,'Destroyed route stops requests');dom.window.close();
}
{
    const p=page({missing:true,role:'admin'});await p.w.NamelessGuildExpeditions.init(p.root,p.options);
    assert.match(p.root.querySelector('[data-guild-setup]').textContent,/activation/);
    assert.ok(p.root.querySelector('.hq-day[data-count="1"]'),'Calendar survives unavailable attendance services');
    p.root.querySelector('.hq-event').click();await tick();assert.equal(p.root.querySelector('dialog form'),null,'No fake registration action when persistence is unavailable');
    p.root.querySelector('[data-guild-dialog-close]').click();p.root.querySelector('[data-guild-create]').click();
    const form=p.root.querySelector('dialog form');form.querySelector('[name="titre"]').value='QA basic event';form.querySelector('[name="date_event"]').value='2099-01-10T20:00';
    form.dispatchEvent(new p.w.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();
    assert.ok(p.writes.some(row=>row.table==='guild_planning'&&row.payload.created_by===A),'Pre-migration event creation reuses real existing planning persistence');
    p.w.NamelessGuildExpeditions.destroy();p.dom.window.close();
}
{
    const p=page({role:'joueur'});await p.w.NamelessGuildExpeditions.init(p.root,p.options);assert.equal(p.reads.length,0,'No guild reads before the member gate');p.dom.window.close();
}

const db=new PGlite();
await db.exec(`create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('qa.actor',true),'')::uuid $$;
grant usage on schema auth,public to authenticated; grant execute on function auth.uid() to authenticated;
create table public.user_profiles(id uuid primary key,role text not null);
insert into public.user_profiles values('${A}','membre'),('${B}','membre'),('${ADMIN}','admin'),('${PLAYER}','joueur');
create function public.can_access_guild() returns boolean language sql stable security definer set search_path=public as $$ select coalesce((select role in ('membre','admin') from user_profiles where id=auth.uid()),false) $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select coalesce((select role='admin' from user_profiles where id=auth.uid()),false) $$;
create table public.guild_planning(id uuid primary key default gen_random_uuid(),titre text not null check(char_length(titre) between 1 and 120),description text,date_event timestamptz not null,type_event text not null check(type_event in ('raid','reunion','event','pvp','construction','autre')),created_by uuid references user_profiles(id));`);
const migration=read('docs/supabase/SAO_NAMELESS_GUILD_EXPEDITIONS_007.sql');await db.exec(migration);
async function actor(id){await db.exec(`reset role;select set_config('qa.actor','${id}',false);set role authenticated;`);}
await actor(A);
await assert.rejects(db.query("select public.guild_event_create('QA',now()+interval '2 days','raid','{}','{}','{}')"),/admin_required/);
await actor(ADMIN);
const created=await db.query("select public.guild_event_create('QA Expedition',now()+interval '2 days','raid','QA description','{\"capacity\":1,\"tank_slots\":1,\"support_slots\":1}'::jsonb,ARRAY['QA preparation']) as id");
const id=created.rows[0].id;
await db.exec('reset role');const checklist=(await db.query('select id from guild_event_checklist where event_id=$1',[id])).rows[0].id;
await actor(A);await db.query('select guild_event_register($1,$2)',[id,'Tank']);
await db.query('select guild_event_register($1,$2)',[id,'Support']);
await db.query('select guild_event_set_check($1,true)',[checklist]);
assert.equal((await db.query('select group_role from guild_event_attendance')).rows[0].group_role,'Support','Changing your role excludes your own capacity');
await assert.rejects(db.query('insert into guild_event_attendance(event_id,user_id,group_role) values($1,$2,$3)',[id,B,'Tank']),/permission denied/,'Direct writes cannot impersonate another member');
await actor(B);await assert.rejects(db.query('select guild_event_register($1,$2)',[id,'Tank']),/event_full/);
assert.equal((await db.query('select * from guild_event_checks')).rows.length,0,'Personal preparation is private to its actor');
await actor(A);await db.query('select guild_event_unregister($1)',[id]);
await actor(B);await db.query('select guild_event_register($1,$2)',[id,'Tank']);
await actor(ADMIN);
const roleEvent=(await db.query("select guild_event_create('QA role limits',now()+interval '2 days','raid','','{\"capacity\":2,\"tank_slots\":1,\"dps_slots\":1}'::jsonb,'{}') as id")).rows[0].id;
await actor(A);await db.query('select guild_event_register($1,$2)',[roleEvent,'Tank']);
await actor(B);await assert.rejects(db.query('select guild_event_register($1,$2)',[roleEvent,'Tank']),/role_full/,'Role capacity is enforced even when total places remain');
await db.query('select guild_event_register($1,$2)',[roleEvent,'DPS']);
await db.exec('reset role');await db.query("update guild_planning set status='closed' where id=$1",[roleEvent]);
await actor(A);await assert.rejects(db.query('select guild_event_register($1,$2)',[roleEvent,'Support']),/event_closed/);
await actor(PLAYER);assert.equal((await db.query('select * from guild_event_attendance')).rows.length,0);
await assert.rejects(db.query('select guild_event_register($1,$2)',[id,'DPS']),/guild_access_denied/);
await db.exec('reset role');await db.exec(migration);
assert.equal((await db.query('select * from guild_event_attendance')).rows.length,3,'Reapplying the additive migration preserves existing participation');
assert.equal((await db.query('select * from guild_event_checklist')).rows.length,1);
await db.close();
console.log('PASS: real HQ calendar, member gate, keyboard tabs, event details/focus, persisted role/checklist actions, migration fallback, SPA cleanup; PostgreSQL admin create, own attendance, capacity/role change, private checks, RLS and idempotence.');
