/* Recipe contract: actual auth initializer + delivered SDK, self-only HTTP and
   SQL reads in PGlite. This does not automate a browser or contact production. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {JSDOM} from 'jsdom';
import {createMapWorkspaceRecipeServer} from './serve-map-workspace-recipe.mjs';

const root=path.resolve(import.meta.dirname,'..');
let checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
async function request(recipe,pathname,options){return fetch(recipe.origin+pathname,options);}
async function actualAuth(recipe){
    const paths=['/qa/workspace','/js/vendor/supabase-2.117.2.min.js','/qa/workspace-boot.js','/js/auth-supabase.js'];
    const [html,sdk,boot,auth]=await Promise.all(paths.map(async pathname=>(await request(recipe,pathname)).text()));
    const dom=new JSDOM(html,{url:recipe.origin+'/qa/workspace',runScripts:'outside-only',pretendToBeVisual:true});
    const w=dom.window;
    Object.assign(w,{fetch,Headers,Request,Response,AbortController,TextEncoder,TextDecoder});
    w.eval(sdk);w.eval(boot);w.eval(auth);
    check(w.namelessAuthReadyPromise?.then,'Actual auth publishes its startup promise synchronously');
    const ready=await Promise.race([w.namelessAuthReadyPromise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Isolated auth startup timeout')),3000))]);
    return {dom,w,ready};
}

const normal=await createMapWorkspaceRecipeServer({root,refreshDelay:90});
try{
    const response=await request(normal,'/qa/workspace'),html=await response.text();
    const csp=response.headers.get('content-security-policy');
    check(response.ok&&/connect-src 'self';/.test(csp)&&!csp.includes('https:')&&!csp.includes('wss:'),'Recipe HTTP policy permits only same-origin connections');
    check(html.includes('administrateur fictif')&&html.includes('publication désactivée'),'Recipe labels fictional data and disabled publication clearly');
    check(html.includes('auth-supabase.js')&&!html.includes('supabase-public-config.js'),'Recipe loads actual auth initialization and excludes production configuration');
    check(html.indexOf('supabase-2.117.2.min.js')<html.indexOf('/qa/workspace-boot.js')&&html.indexOf('/qa/workspace-boot.js')<html.indexOf('auth-supabase.js'),'Real SDK then isolated config/storage precede actual auth source');
    const doc=new JSDOM(html);
    check([...doc.window.document.scripts].every(script=>new URL(script.src,normal.origin).origin===normal.origin),'Every frontend script is same-origin');
    check(doc.window.document.querySelector('meta[http-equiv="Content-Security-Policy"]').content===csp,'HTML and HTTP enforce the same local-only policy');
    doc.window.close();
    for(const filename of ['auth-supabase.js','map.js','map-regions.js','map-workspace.js']){
        const script=await request(normal,'/js/'+filename);
        check(script.ok&&(await script.text())===fs.readFileSync(path.join(root,'_site/js',filename),'utf8'),'Recipe serves built '+filename+' without replacing implementation');
    }
    check((await request(normal,'/js/supabase-public-config.js')).status===404,'Production public configuration cannot be fetched from recipe');
    check((await request(normal,'/docs/supabase/SAO_NAMELESS_MAP_WORKSPACE_008.sql')).status===404,'Filesystem outside public asset folders is not exposed');
    check((await request(normal,'/assets/map/catalog.json')).ok,'Normal scenario serves the actual map catalogue');
    const runtime=await actualAuth(normal);
    try{
        check(runtime.ready===true&&runtime.w.currentUser?.id===normal.actors[0].user.id,'Actual auth initializer validates the isolated admin with the real SDK over HTTP');
        check(runtime.w.userProfile?.role==='admin','Actual profile loading reads the administrator from real SQL policies');
        check(runtime.w.localStorage.length===0,'Fake session never persists in the browser origin storage');
        const db=runtime.w.supabase;
        check((await db.rpc('current_user_role')).data==='admin','Admin access comes from actual SQL role checking');
        const initial=await db.rpc('map_workspace_read');
        check(!initial.error&&initial.data&&typeof initial.data==='object','Actual SDK reads the isolated migration 008 workspace');
        const started=Date.now(),refreshed=await db.rpc('map_workspace_read');
        check(!refreshed.error&&Date.now()-started>=70,'Subsequent read is delayed for visible Recharger busy feedback');
        const denied=await db.rpc('map_workspace_save_custom_marker',{p_entity_key:'qa-denied'});
        check(denied.error?.code==='QA_READ_ONLY'&&normal.counts.blockedWrites===1,'Publication RPC is blocked before SQL even for the fake admin');
        const profileWrite=await db.from('user_profiles').insert({username:'QA denied'});
        check(profileWrite.error?.code==='QA_READ_ONLY','Non-map writes are blocked too');
    }finally{runtime.dom.window.close();}
}finally{await normal.close();}

const unavailable=await createMapWorkspaceRecipeServer({root,scenario:'unavailable',refreshDelay:0});
try{
    const runtime=await actualAuth(unavailable);
    try{
        check(runtime.ready===false&&runtime.w.namelessAuthReady===true,'Actual initializer resolves failure for missing isolated configuration');
        check(unavailable.counts.auth===0,'Unavailable initializer does not contact any auth endpoint');
    }finally{runtime.dom.window.close();}
}finally{await unavailable.close();}

const delayed=await createMapWorkspaceRecipeServer({root,scenario:'delayed',authDelay:100,refreshDelay:0});
try{
    const actor=delayed.actors[0],started=Date.now();
    const response=await request(delayed,'/qa-api/auth/v1/user',{headers:{Authorization:'Bearer '+actor.token}});
    check(response.ok&&Date.now()-started>=80,'Delayed scenario holds first auth validation for startup-gate capture');
}finally{await delayed.close();}

const failed=await createMapWorkspaceRecipeServer({root,scenario:'catalog-error',refreshDelay:0});
try{
    const response=await request(failed,'/assets/map/catalog.json'),value=await response.json();
    check(response.status===503&&value.code==='QA_CATALOG_UNAVAILABLE','Map-error scenario fails only the catalogue intentionally');
    check((await request(failed,'/js/map.js')).ok&&(await request(failed,'/qa/workspace')).ok,'Map-error scenario retains actual map module and complete admin UI');
}finally{await failed.close();}

console.log('Map workspace recipe: '+checks+' checks passed; actual auth/SDK/SQL, memory-only fake admin, self-only HTTP, no publication.');
