/* Local map QA only. The shipped Supabase SDK calls this HTTP adapter; every
   permission, revision and publication operation runs the existing SQL in PGlite.
   Never imported by the site build and never connects to a remote service. */
import fs from 'node:fs';
import path from 'node:path';
import {PGlite} from '@electric-sql/pglite';

const roles = ['admin','membre','joueur'];
const ids = ['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
const rpc = {
    current_user_role: [], read_map_marker_overrides: [], read_map_regions: [], read_map_custom_markers: [], map_workspace_read: [],
    map_workspace_save_marker: ['p_entity_key','p_state','p_u','p_v','p_expected_revision','p_marker_type'],
    map_workspace_reset_marker: ['p_entity_key','p_expected_revision'],
    map_workspace_save_region: ['p_entity_key','p_region_id','p_floor','p_image_id','p_status','p_visible','p_vertices','p_expected_revision'],
    map_workspace_reset_region: ['p_entity_key','p_expected_revision'],
    map_workspace_save_custom_marker: ['p_entity_key','p_title','p_description','p_marker_type','p_floor','p_image_id','p_state','p_u','p_v','p_expected_revision'],
    map_workspace_delete_custom_marker: ['p_entity_key','p_expected_revision']
};
const rowReaders = new Set(['read_map_marker_overrides','read_map_regions','read_map_custom_markers']);
const jwt = payload => Buffer.from(JSON.stringify(payload)).toString('base64url');

export async function createMapQaBackend(workspace) {
    const db = new PGlite();
    const expires = Math.floor(Date.now()/1000) + 12*3600;
    const actors = roles.map((role,index) => {
        const user = {id:ids[index],aud:'authenticated',role:'authenticated',email:role+'@qa.invalid',user_metadata:{},app_metadata:{provider:'qa'},created_at:'2026-01-01T12:00:00.000Z'};
        const token = jwt({alg:'none',typ:'JWT'})+'.'+jwt({sub:user.id,aud:'authenticated',role:'authenticated',exp:expires})+'.QA_LOCAL_ONLY';
        return {role,user,token,session:{access_token:token,refresh_token:'QA_LOCAL_ONLY',token_type:'bearer',expires_at:expires,expires_in:12*3600,user}};
    });
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
        create schema auth; grant usage on schema auth to anon,authenticated;
        create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
        create table public.user_profiles(id uuid primary key,role text not null,username text,minecraft_uuid text,minecraft_username text,classe text,niveau integer,created_at timestamptz default now());
        create function public.current_user_role() returns text language sql stable security definer set search_path=pg_catalog,public as $$select coalesce((select role from public.user_profiles where id=auth.uid()),'visiteur')$$;
        revoke all on function public.current_user_role() from public,anon; grant execute on function public.current_user_role() to authenticated;
        grant select on public.user_profiles to authenticated;
        alter table public.user_profiles enable row level security;
        create policy qa_own_profile on public.user_profiles for select to authenticated using(id=auth.uid());`);
    for (const actor of actors) await db.query('insert into public.user_profiles(id,role,username,classe,niveau) values($1,$2,$3,$4,$5)',[actor.user.id,actor.role,'QA '+actor.role,'Guerrier',40]);
    for (const file of ['SAO_NAMELESS_MAP_WORKSPACE_008.sql','SAO_NAMELESS_MAP_ENTITY_SEED_005.sql','SAO_NAMELESS_MAP_PUBLICATION_SEED_006.sql']) {
        await db.exec(fs.readFileSync(path.join(workspace,'docs/supabase',file),'utf8'));
    }
    let queue = Promise.resolve();
    function asActor(actor,sql,params=[]) {
        const job = queue.then(async() => {
            await db.exec('begin;set local role '+(actor?'authenticated':'anon')+';');
            try {
                await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor?.user.id||'']);
                const data = await db.query(sql,params);
                await db.exec('commit;'); return data;
            } catch(error) { await db.exec('rollback;'); throw error; }
        });
        queue = job.catch(()=>{}); return job;
    }
    function actorFor(request) {
        const token = String(request.headers.authorization||'').replace(/^Bearer\s+/i,'');
        return actors.find(actor=>actor.token===token)||null;
    }
    const json = (response,headers,status,value) => {response.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8'});response.end(JSON.stringify(value));};
    async function body(request) {
        let value = ''; for await(const chunk of request) {value+=chunk; if(Buffer.byteLength(value)>256*1024)throw new Error('QA request too large');}
        return value?JSON.parse(value):{};
    }
    async function handle(request,response,url,headers) {
        const relative = url.pathname.replace(/^\/qa-api/,'');
        const actor = actorFor(request);
        try {
            if (relative==='/auth/v1/user' && request.method==='GET') {
                json(response,headers,actor?200:401,actor?.user||{code:'bad_jwt',msg:'No isolated QA session.'}); return;
            }
            if (relative==='/auth/v1/logout' && request.method==='POST') {json(response,headers,200,{});return;}
            if (relative==='/rest/v1/user_profiles' && request.method==='GET') {
                const wanted = (url.searchParams.get('id')||'').replace(/^eq\./,'');
                const data = await asActor(actor,'select * from public.user_profiles where id=$1::uuid',[wanted||actor?.user.id||null]);
                const single = String(request.headers.accept||'').includes('application/vnd.pgrst.object');
                if(single && data.rows.length!==1) {json(response,headers,406,{code:'PGRST116',message:'Expected one QA profile.'});return;}
                json(response,headers,200,single?data.rows[0]:data.rows);return;
            }
            const name = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(relative)?.[1];
            if (!name || !Object.hasOwn(rpc,name) || !['POST','GET'].includes(request.method)) {json(response,headers,404,{code:'QA_NOT_FOUND',message:'Endpoint outside the isolated map QA contract.'});return;}
            const params = request.method==='POST'?await body(request):Object.fromEntries(url.searchParams);
            if (Object.keys(params).some(key=>!rpc[name].includes(key))) {json(response,headers,400,{code:'QA_UNKNOWN_PARAMETER',message:'Unknown QA RPC parameter.'});return;}
            const values = rpc[name].map(key=>key==='p_vertices'?JSON.stringify(params[key]??null):(params[key]??null));
            const placeholders = rpc[name].map((key,index)=>'$'+(index+1)+(key==='p_vertices'?'::jsonb':''));
            const sql = rowReaders.has(name)?'select * from public.'+name+'()':'select public.'+name+'('+placeholders.join(',')+') as value';
            const result = await asActor(actor,sql,values);
            json(response,headers,200,rowReaders.has(name)?result.rows:result.rows[0].value);
        } catch(error) {
            json(response,headers,error.code==='42501'?403:400,{code:error.code||'QA_ERROR',message:String(error.message),details:null,hint:null});
        }
    }
    function boot(role='admin') {
        const actor = actors.find(value=>value.role===role)||null;
        return `(() => {'use strict';
            const session=${JSON.stringify(actor?.session||null)}, user=session?.user||null;
            let stored=session?JSON.stringify(session):null;
            const storage={getItem(){return stored},setItem(_key,value){stored=value},removeItem(){stored=null}};
            const sdk=window.supabase; if(!sdk?.createClient)throw new Error('The real bundled Supabase SDK must precede map QA boot.');
            window.supabase=sdk.createClient(location.origin+'/qa-api','QA_LOCAL_ANON_ONLY',{auth:{storage,storageKey:'nameless-map-qa',persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
            window.currentUser=user;window.userProfile=null;window.namelessAuthReady=true;
            function aliasLinks(){for(const link of document.querySelectorAll('a[href]')){const value=link.getAttribute('href');if(value==='/carte')link.setAttribute('href','/qa/map?role=visiteur');else if(value==='/admin-carte')link.setAttribute('href','/qa/map-admin?role=${actor?.role||'visiteur'}');}}
            new MutationObserver(aliasLinks).observe(document.documentElement,{childList:true,subtree:true});
            document.addEventListener('DOMContentLoaded',async()=>{
                window.NamelessWorldAtmosphere?.sync('carte');aliasLinks();
                document.getElementById('login-link')?.style.setProperty('display',user?'none':'flex');document.getElementById('user-info')?.style.setProperty('display',user?'flex':'none');
                if(user){const result=await window.supabase.from('user_profiles').select('*').eq('id',user.id).single();window.userProfile=result.data;const name=document.getElementById('username');if(name)name.textContent=result.data?.username||'QA';}
                document.getElementById('logout-btn')?.addEventListener('click',async()=>{await window.supabase.auth.signOut();window.currentUser=null;window.userProfile=null;document.getElementById('user-info')?.style.setProperty('display','none');document.getElementById('login-link')?.style.setProperty('display','flex');document.dispatchEvent(new CustomEvent('nameless:auth-changed',{detail:{user:null}}));});
            });
        })();`;
    }
    return {handle,boot,actors,close:async()=>{await queue;await db.close();}};
}
