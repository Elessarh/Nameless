/* Isolated guild recipe: delivered frontend + bundled Supabase SDK + migration
   007 in an in-memory PostgreSQL engine. Never included in the public build. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {JSDOM} from 'jsdom';
import {PGlite} from '@electric-sql/pglite';

const workspace = path.resolve(import.meta.dirname, '..');
const rpc = {
    current_user_role: [],
    guild_event_register: ['target_event', 'requested_role'],
    guild_event_unregister: ['target_event'],
    guild_event_set_check: ['target_checklist', 'completed'],
    guild_event_create: ['event_title', 'event_date', 'event_type', 'event_description', 'event_config', 'preparation']
};
const tableColumns = {
    user_profiles: ['id','role','username','minecraft_username','minecraft_uuid','classe','niveau','created_at'],
    guild_planning: ['id','titre','description','date_event','type_event','created_by','created_at','floor','location','capacity','tank_slots','dps_slots','support_slots','status'],
    guild_event_attendance: ['event_id','user_id','group_role','created_at','updated_at'],
    guild_event_checklist: ['id','event_id','label','sort_order'],
    guild_event_checks: ['checklist_id','user_id','done','updated_at'],
    guild_objectives: ['id','titre','description','progression','statut','semaine_numero','annee','created_at'],
    guild_presence: ['id','user_id','date_presence','statut','created_at'],
    guild_activity_wall: ['id','titre','contenu','type','created_at','created_by','image_url'],
    guild_chat: ['id','user_id','recipient_id','is_private','message','created_at']
};
const scripts = new Set(['i18n-en.js','i18n-en-reviewed.js','i18n-quests-en-reviewed.js','i18n-game-en-reviewed.js','i18n-information-en-reviewed.js','i18n.js','guild-date-utils.js','cache-manager.js','security-utils.js','navbar-mobile.js','global-search.js','reference-shell.js','world-atmosphere.js','guild-expeditions.js','espace-guilde.js','supabase-2.117.2.min.js']);
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; media-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self';";
const headers = {'Content-Security-Policy':csp,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'};
const types = {'.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2','.woff':'font/woff','.mp3':'audio/mpeg'};
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const json = (response, status, value, extra={}) => {response.writeHead(status,{...headers,'Content-Type':types['.json'],...extra});response.end(JSON.stringify(value));};

export async function createGuildRecipeBackend(root=workspace) {
    const db = new PGlite();
    const expires = Math.floor(Date.now()/1000)+12*3600;
    const actors = ['admin','membre','joueur','peer'].map((mode,index) => {
        const role = mode==='peer'?'membre':mode;
        const digit=String(index+1), id=digit.repeat(8)+'-'+digit.repeat(4)+'-4'+digit.repeat(3)+'-8'+digit.repeat(3)+'-'+digit.repeat(12);
        const user={id,aud:'authenticated',role:'authenticated',email:mode+'@qa.invalid',user_metadata:{},app_metadata:{provider:'qa'},created_at:'2026-01-01T12:00:00Z'};
        const token=encode({alg:'none',typ:'JWT'})+'.'+encode({sub:id,aud:'authenticated',role:'authenticated',exp:expires})+'.QA_LOCAL_ONLY';
        return {mode,role,user,token,session:{access_token:token,refresh_token:'QA_LOCAL_ONLY',token_type:'bearer',expires_at:expires,expires_in:12*3600,user}};
    });
    await db.exec(`create role anon;create role authenticated;create schema auth;
        grant usage on schema auth,public to anon,authenticated;
        create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
        create table public.user_profiles(id uuid primary key,role text not null,username text,minecraft_username text,minecraft_uuid text,classe text,niveau integer,created_at timestamptz default now());
        create function public.current_user_role() returns text language sql stable security definer set search_path=public as $$select coalesce((select role from user_profiles where id=auth.uid()),'visiteur')$$;
        create function public.can_access_guild() returns boolean language sql stable security definer set search_path=public as $$select coalesce((select role in ('membre','admin') from user_profiles where id=auth.uid()),false)$$;
        create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$select coalesce((select role='admin' from user_profiles where id=auth.uid()),false)$$;
        create table public.guild_planning(id uuid primary key default gen_random_uuid(),titre text not null check(char_length(titre) between 1 and 120),description text,date_event timestamptz not null,type_event text not null check(type_event in ('raid','reunion','event','pvp','construction','autre')),created_by uuid references user_profiles(id),created_at timestamptz default now());
        create table public.guild_objectives(id uuid primary key default gen_random_uuid(),titre text,description text,progression integer,statut text,semaine_numero integer,annee integer,created_at timestamptz default now());
        create table public.guild_presence(id uuid primary key default gen_random_uuid(),user_id uuid references user_profiles(id),date_presence date,statut text,created_at timestamptz default now(),unique(user_id,date_presence));
        create table public.guild_activity_wall(id uuid primary key default gen_random_uuid(),titre text,contenu text,type text,created_at timestamptz default now(),created_by uuid references user_profiles(id),image_url text);
        create table public.guild_chat(id uuid primary key default gen_random_uuid(),user_id uuid,recipient_id uuid,is_private boolean,message text,created_at timestamptz default now());
        grant select on public.user_profiles,public.guild_planning,public.guild_objectives,public.guild_presence,public.guild_activity_wall,public.guild_chat to authenticated;
        alter table public.user_profiles enable row level security;
        create policy qa_profile_read on public.user_profiles for select to authenticated using(id=auth.uid() or (public.can_access_guild() and role in ('membre','admin')));`);
    for (const table of ['guild_planning','guild_objectives','guild_presence','guild_activity_wall','guild_chat']) await db.exec(`alter table public.${table} enable row level security;create policy qa_guild_read on public.${table} for select to authenticated using(public.can_access_guild());`);
    for (const actor of actors) await db.query('insert into user_profiles(id,role,username,classe,niveau) values($1,$2,$3,$4,$5)',[actor.user.id,actor.role,'QA '+actor.mode,'Guerrier',40]);
    await db.exec(fs.readFileSync(path.join(root,'docs/supabase/SAO_NAMELESS_GUILD_EXPEDITIONS_007.sql'),'utf8'));
    let queue = Promise.resolve();
    function asActor(actor, sql, params=[]) {
        const job=queue.then(async()=>{
            await db.exec('begin;set local role '+(actor?'authenticated':'anon')+';');
            try {await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor?.user.id||'']);const result=await db.query(sql,params);await db.exec('commit;');return result;}
            catch(error){await db.exec('rollback;');throw error;}
        });
        queue=job.catch(()=>{});return job;
    }
    const eventDate=new Date(Date.now()+2*86400000).toISOString();
    const seeded=await asActor(actors[0],'select public.guild_event_create($1,$2,$3,$4,$5::jsonb,$6::text[]) as id',[
        'QA · Recette des expéditions',eventDate,'raid','Événement fictif isolé pour la recette : aucune expédition distante.',JSON.stringify({capacity:4,tank_slots:1,dps_slots:2,support_slots:1,floor:1,location:'Lieu de test QA'}),['Préparer deux potions QA','Vérifier le rôle QA']
    ]);
    const eventId=seeded.rows[0].id;
    async function body(request) {let text='';for await(const chunk of request){text+=chunk;if(Buffer.byteLength(text)>64*1024)throw new Error('QA request too large');}return text?JSON.parse(text):{};}
    async function handle(request,response,url) {
        const actor=actors.find(value=>value.token===String(request.headers.authorization||'').replace(/^Bearer\s+/i,''))||null;
        const relative=url.pathname.replace(/^\/qa-api/,'');
        try {
            if(relative==='/auth/v1/user'&&request.method==='GET'){json(response,actor?200:401,actor?.user||{code:'bad_jwt',message:'No isolated session'});return;}
            if(relative==='/auth/v1/logout'&&request.method==='POST'){json(response,200,{});return;}
            const name=/^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(relative)?.[1];
            if(name&&Object.hasOwn(rpc,name)&&request.method==='POST'){
                const values=await body(request);
                if(Object.keys(values).some(key=>!rpc[name].includes(key)))throw new Error('Unknown QA parameter');
                const placeholders=rpc[name].map((key,index)=>'$'+(index+1)+(key==='event_config'?'::jsonb':key==='preparation'?'::text[]':''));
                const result=await asActor(actor,'select public.'+name+'('+placeholders.join(',')+') as value',rpc[name].map(key=>key==='event_config'?JSON.stringify(values[key]??{}):values[key]??null));
                json(response,200,result.rows[0].value);return;
            }
            const table=/^\/rest\/v1\/([a-z_]+)$/.exec(relative)?.[1];
            if(!table||!Object.hasOwn(tableColumns,table)||!['GET','HEAD'].includes(request.method)){json(response,403,{code:'QA_OUTSIDE_RECIPE',message:'Only guild reads and migration 007 RPCs are available; chat writes are disabled.'});return;}
            const parameters=[], clauses=[], columns=new Set(tableColumns[table]);
            for(const [column,value] of url.searchParams){
                if(['select','order','limit','offset','or'].includes(column))continue;
                if(!columns.has(column))throw new Error('Unknown QA column');
                const match=/^(eq|neq|gte|gt|lte|lt|in)\.(.*)$/.exec(value);if(!match)throw new Error('Unsupported QA filter');
                if(match[1]==='in'){
                    const entries=match[2].replace(/^\(|\)$/g,'').split(',').map(item=>item.replace(/^"|"$/g,''));
                    const placeholders=entries.map(item=>{parameters.push(item);return '$'+parameters.length;});clauses.push(column+' in ('+placeholders.join(',')+')');
                }else{parameters.push(match[2]);clauses.push(column+({eq:'=',neq:'<>',gte:'>=',gt:'>',lte:'<=',lt:'<'}[match[1]])+'$'+parameters.length);}
            }
            const order=(url.searchParams.get('order')||'').split(',').filter(Boolean).map(value=>{const [column,direction]=value.split('.');if(!columns.has(column))throw new Error('Unknown QA order');return column+(direction==='desc'?' desc':' asc');});
            const limit=Number(url.searchParams.get('limit')||500);if(!Number.isInteger(limit)||limit<0||limit>500)throw new Error('Invalid QA limit');
            const sql='select * from public.'+table+(clauses.length?' where '+clauses.join(' and '):'')+(order.length?' order by '+order.join(','):'')+' limit '+limit;
            const result=await asActor(actor,sql,parameters), single=String(request.headers.accept||'').includes('application/vnd.pgrst.object');
            if(single&&result.rows.length!==1){json(response,406,{code:'PGRST116',message:'Expected one isolated row'});return;}
            if(request.method==='HEAD'){response.writeHead(200,{...headers,'Content-Range':'0-'+Math.max(0,result.rows.length-1)+'/'+result.rows.length});response.end();return;}
            json(response,200,single?result.rows[0]:result.rows);return;
        }catch(error){json(response,error.code==='42501'?403:400,{code:error.code||'QA_ERROR',message:String(error.message),details:null,hint:null});}
    }
    function boot(mode='membre'){
        const actor=actors.find(value=>value.mode===mode)||null;
        return `(()=>{'use strict';const session=${JSON.stringify(actor?.session||null)};let stored=session?JSON.stringify(session):null;
            const sdk=window.supabase;window.supabase=sdk.createClient(location.origin+'/qa-api','QA_LOCAL_ANON_ONLY',{auth:{storage:{getItem(){return stored},setItem(_key,value){stored=value},removeItem(){stored=null}},storageKey:'nameless-guild-recipe',persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
            window.currentUser=session?.user||null;window.userProfile=null;window.namelessAuthReady=true;
            const image=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');Object.defineProperty(HTMLImageElement.prototype,'src',{...image,set(value){const url=new URL(value,location.href);image.set.call(this,url.origin===location.origin?value:'/assets/ui/player-avatar.svg')}});
            document.addEventListener('DOMContentLoaded',async()=>{window.NamelessWorldAtmosphere?.sync('espace-guilde');document.getElementById('login-link')?.style.setProperty('display',session?'none':'flex');document.getElementById('user-info')?.style.setProperty('display',session?'flex':'none');
                if(session){const result=await window.supabase.from('user_profiles').select('*').eq('id',session.user.id).single();window.userProfile=result.data;const name=document.getElementById('username');if(name)name.textContent=result.data?.username||'QA';}
                document.getElementById('logout-btn')?.addEventListener('click',async()=>{await window.supabase.auth.signOut();window.currentUser=null;window.userProfile=null;document.getElementById('user-info')?.style.setProperty('display','none');document.getElementById('login-link')?.style.setProperty('display','flex');document.dispatchEvent(new CustomEvent('nameless:auth-changed',{detail:{user:null}}));});
            });})();`;
    }
    return {actors,eventId,eventDate,handle,boot,close:async()=>{await queue;await db.close();}};
}

export async function createGuildRecipeServer({root=workspace,port=0}={}){
    const built=path.join(root,'_site'), qa=await createGuildRecipeBackend(root);
    function fixture(mode){
        const dom=new JSDOM(fs.readFileSync(path.join(built,'espace-guilde/index.html'),'utf8')), doc=dom.window.document;
        for(const meta of doc.querySelectorAll('meta[http-equiv="Content-Security-Policy"]'))meta.content=csp;
        for(const script of [...doc.scripts]){const file=path.basename((script.getAttribute('src')||'').split('?')[0]);if(!scripts.has(file))script.remove();else script.src='/js/'+(file.startsWith('supabase-')?'vendor/':'')+file;}
        const boot=doc.createElement('script');boot.src='/qa/guild-boot.js?role='+encodeURIComponent(mode);boot.defer=true;doc.querySelector('script[src="/js/vendor/supabase-2.117.2.min.js"]').after(boot);
        for(const element of doc.querySelectorAll('[href],[src]'))for(const attribute of ['href','src']){const value=element.getAttribute(attribute);if(value?.startsWith('../'))element.setAttribute(attribute,'/'+value.slice(3));}
        for(const link of doc.querySelectorAll('a[href="/espace-guilde"]'))link.href='/qa/guild?role='+encodeURIComponent(mode);
        const banner=doc.createElement('aside');banner.setAttribute('aria-label','Recette guilde isolée');banner.style.cssText='position:relative;z-index:1;padding:12px;color:#f1ebdd;background:#35454a;font:13px/1.5 system-ui';banner.textContent='QA guilde · événements et comptes fictifs · SQL 007 réel en mémoire · aucun service distant · chat désactivé';doc.querySelector('header').after(banner);
        doc.title='QA SQL guilde — '+doc.title;const html='<!doctype html>\n'+doc.documentElement.outerHTML;dom.window.close();return html;
    }
    const server=http.createServer(async(request,response)=>{
        const url=new URL(request.url,'http://127.0.0.1');
        if(url.pathname.startsWith('/qa-api/')){await qa.handle(request,response,url);return;}
        if(url.pathname==='/qa/guild'){response.writeHead(200,{...headers,'Content-Type':'text/html; charset=utf-8'});response.end(fixture(url.searchParams.get('role')||'membre'));return;}
        if(url.pathname==='/qa/guild-boot.js'){response.writeHead(200,{...headers,'Content-Type':types['.js']});response.end(qa.boot(url.searchParams.get('role')||'membre'));return;}
        let filename;try{filename=decodeURIComponent(url.pathname);}catch{response.writeHead(400,headers);response.end();return;}
        const extension=path.extname(filename), target=path.resolve(built,'.'+filename), folder=filename.split('/')[1];
        if(!['css','js','assets'].includes(folder)||!target.startsWith(path.join(built,folder)+path.sep)||!types[extension]||!fs.existsSync(target)||!fs.statSync(target).isFile()||(folder==='js'&&!scripts.has(path.basename(target)))){response.writeHead(404,headers);response.end('Outside isolated guild recipe');return;}
        response.writeHead(200,{...headers,'Content-Type':types[extension]});if(request.method==='HEAD')response.end();else fs.createReadStream(target).pipe(response);
    });
    await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
    return {...qa,server,origin:'http://127.0.0.1:'+server.address().port,close:async()=>{await new Promise(resolve=>server.close(resolve));await qa.close();}};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
    const port=Number(process.argv.find(value=>value.startsWith('--port='))?.slice(7)||4185);
    if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid QA port');
    const recipe=await createGuildRecipeServer({port});
    console.log('Guild SQL recipe: '+recipe.origin+'/qa/guild?role=membre · role=admin|peer|joueur|visiteur · in-memory event '+recipe.eventId);
    async function shutdown(){await recipe.close();process.exit(0);}process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
}
