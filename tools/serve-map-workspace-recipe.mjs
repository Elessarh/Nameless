/* Browser recipe only: built administration page, actual auth/map modules and
   bundled Supabase SDK. The fake admin and map SQL exist only in this process.
   No production endpoint, real session storage or write RPC is reachable. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {JSDOM} from 'jsdom';
import {createMapQaBackend} from './map-qa-backend.mjs';

const workspace=path.resolve(import.meta.dirname,'..');
const scenarios=new Set(['normal','delayed','unavailable','catalog-error']);
const scripts=new Set(['leaflet-1.9.4.js','i18n-en.js','i18n-en-reviewed.js','i18n-quests-en-reviewed.js','i18n-game-en-reviewed.js','i18n-information-en-reviewed.js','i18n.js','supabase-2.117.2.min.js','db-guard.js','cache-manager.js','security-utils.js','auth-supabase.js','map-regions.js','map.js','navbar-mobile.js','audio-controller.js','global-search.js','world-atmosphere.js','reference-shell.js','map-workspace.js']);
const readRpcs=new Set(['current_user_role','read_map_marker_overrides','read_map_regions','read_map_custom_markers','map_workspace_read']);
const csp="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; media-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self';";
const headers={'Content-Security-Policy':csp,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'};
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2','.woff':'font/woff','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const json=(response,status,value)=>{response.writeHead(status,{...headers,'Content-Type':types['.json']});response.end(JSON.stringify(value));};

export async function createMapWorkspaceRecipeServer({root=workspace,port=0,scenario='normal',authDelay=8000,refreshDelay=5000}={}) {
    if(!scenarios.has(scenario))throw new Error('Unknown map workspace QA scenario');
    for(const value of [authDelay,refreshDelay])if(!Number.isFinite(value)||value<0||value>30000)throw new Error('Invalid QA delay');
    const built=path.join(root,'_site'), qa=await createMapQaBackend(root);
    const counts={auth:0,workspaceReads:0,blockedWrites:0};
    function boot(){
        const actor=qa.actors.find(value=>value.role==='admin');
        return `(()=>{'use strict';
            const sdk=window.supabase,session=${JSON.stringify(actor.session)};let stored=JSON.stringify(session);
            if(!sdk?.createClient)throw new Error('The actual bundled SDK must load before QA bootstrap.');
            window.NamelessPublicConfig=${scenario==='unavailable'?'{}':"{supabaseUrl:location.origin+'/qa-api',supabasePublishableKey:'QA_LOCAL_ANON_ONLY'}"};
            window.supabase={...sdk,createClient(url,key,options={}){
                if(url!==location.origin+'/qa-api'||key!=='QA_LOCAL_ANON_ONLY')throw new Error('QA rejects external client configuration.');
                return sdk.createClient(url,key,{...options,auth:{...options.auth,storage:{getItem(){return stored},setItem(_key,value){stored=value},removeItem(){stored=null}},storageKey:'nameless-workspace-recipe',persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
            }};
        })();`;
    }
    function fixture(){
        const dom=new JSDOM(fs.readFileSync(path.join(built,'admin-carte/index.html'),'utf8')),doc=dom.window.document;
        for(const meta of doc.querySelectorAll('meta[http-equiv="Content-Security-Policy"]'))meta.content=csp;
        for(const script of [...doc.scripts]){
            const file=path.basename((script.getAttribute('src')||'').split('?')[0]);
            if(!scripts.has(file))script.remove();
        }
        const bootstrap=doc.createElement('script');bootstrap.src='/qa/workspace-boot.js';bootstrap.defer=true;
        doc.querySelector('script[src*="supabase-2.117.2.min.js"]').after(bootstrap);
        for(const element of doc.querySelectorAll('[href],[src]'))for(const attribute of ['href','src']){
            const value=element.getAttribute(attribute);if(value?.startsWith('../'))element.setAttribute(attribute,'/'+value.slice(3));
        }
        const banner=doc.createElement('aside');banner.setAttribute('aria-label','Recette cartographique isolée');
        banner.style.cssText='position:relative;z-index:1;padding:10px 16px;color:#f1ebdd;background:#35454a;font:12px/1.5 system-ui';
        banner.textContent='QA carte · '+scenario+' · administrateur fictif · SQL 008 en mémoire · aucun service distant · publication désactivée';
        doc.querySelector('header').after(banner);doc.title='QA atelier — '+scenario+' — Nameless';
        const html='<!doctype html>\n'+doc.documentElement.outerHTML;dom.window.close();return html;
    }
    const server=http.createServer(async(request,response)=>{
        let url;try{url=new URL(request.url,'http://127.0.0.1');}catch{response.writeHead(400,headers);response.end();return;}
        if(url.pathname.startsWith('/qa-api/')){
            const relative=url.pathname.slice('/qa-api'.length),rpc=/^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(relative)?.[1];
            const allowed=(relative==='/auth/v1/user'&&request.method==='GET')
                ||(relative==='/auth/v1/logout'&&request.method==='POST')
                ||(relative==='/rest/v1/user_profiles'&&request.method==='GET')
                ||(readRpcs.has(rpc)&&['POST','GET'].includes(request.method));
            if(!allowed){counts.blockedWrites++;json(response,403,{code:'QA_READ_ONLY',message:'This isolated recipe permits session validation and map reads only. Publication is disabled.'});return;}
            if(relative==='/auth/v1/user'&&++counts.auth===1&&scenario==='delayed')await pause(authDelay);
            if(rpc==='map_workspace_read'&&++counts.workspaceReads>1)await pause(refreshDelay);
            if(!response.destroyed)await qa.handle(request,response,url,headers);return;
        }
        if(url.pathname==='/qa/workspace'||url.pathname==='/admin-carte'||url.pathname==='/admin-carte/'){
            response.writeHead(200,{...headers,'Content-Type':types['.html']});response.end(fixture());return;
        }
        if(url.pathname==='/qa/workspace-boot.js'){
            response.writeHead(200,{...headers,'Content-Type':types['.js']});response.end(boot());return;
        }
        if(scenario==='catalog-error'&&url.pathname==='/assets/map/catalog.json'){
            json(response,503,{code:'QA_CATALOG_UNAVAILABLE',message:'Intentional isolated map catalogue failure.'});return;
        }
        let filename;try{filename=decodeURIComponent(url.pathname);}catch{response.writeHead(400,headers);response.end();return;}
        const extension=path.extname(filename),folder=filename.split('/')[1],target=path.resolve(built,'.'+filename);
        if(!['css','js','assets'].includes(folder)||!target.startsWith(path.join(built,folder)+path.sep)||!types[extension]
            ||!fs.existsSync(target)||!fs.statSync(target).isFile()||(folder==='js'&&!scripts.has(path.basename(target)))){
            response.writeHead(404,headers);response.end('Outside isolated map workspace recipe');return;
        }
        response.writeHead(200,{...headers,'Content-Type':types[extension]});if(request.method==='HEAD')response.end();else fs.createReadStream(target).pipe(response);
    });
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
    return {server,scenario,actors:qa.actors,counts,origin:'http://127.0.0.1:'+server.address().port,
        close:async()=>{await new Promise(resolve=>server.close(resolve));await qa.close();}};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
    const port=Number(process.argv.find(value=>value.startsWith('--port='))?.slice(7)||4186);
    const scenario=process.argv.find(value=>value.startsWith('--scenario='))?.slice(11)||'normal';
    if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid QA port');
    const recipe=await createMapWorkspaceRecipeServer({port,scenario});
    console.log('Isolated map workspace recipe: '+recipe.origin+'/qa/workspace · scenario='+scenario+' · fake admin · actual auth/SQL 008 · no writes or remote services');
    async function shutdown(){await recipe.close();process.exit(0);}process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
}
