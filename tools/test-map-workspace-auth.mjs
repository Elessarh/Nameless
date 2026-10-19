/* Real auth initializer/workspace/Leaflet/regions with deferred isolated RPCs.
   No browser session, production endpoint, or shared write is used. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {JSDOM,VirtualConsole} from 'jsdom';

const root=path.resolve(import.meta.dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const catalog=JSON.parse(read('assets/map/catalog.json'));
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
async function until(predicate){for(let i=0;i<80;i++){if(predicate())return;await tick();}assert.ok(predicate(),'The isolated async condition must settle');}

function fixture(options={}){
    const errors=[],output=new VirtualConsole();output.on('jsdomError',error=>errors.push(error));
    const dom=new JSDOM(read('pages/admin-carte.html'),{url:'https://nameless-sao.fr/admin-carte?floor=1',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:output});
    const w=dom.window,d=w.document,calls=[],writes=[];
    const control={user:{id:A},role:'admin',userQueue:[],roleQueue:[],writeQueue:[],readQueue:[],authListener:null};
    const shared=()=>({registry:catalog.registry.map(row=>({entity_key:row.key,marker_revision:0,region_revision:0})),markers:[],regions:[],custom_markers:[],maps:[]});
    const db={auth:{
        async getUser(){calls.push('getUser');const next=control.userQueue.shift();return next?typeof next==='function'?await next():await next:{data:{user:control.user},error:null};},
        async getSession(){calls.push('getSession');return {data:{session:null},error:null};},
        onAuthStateChange(callback){control.authListener=callback;return {data:{subscription:{unsubscribe(){}}}};}
    },async rpc(name,params){
        calls.push(name);
        if(name==='current_user_role'){const next=control.roleQueue.shift();return next?typeof next==='function'?await next():await next:{data:control.role,error:null};}
        if(name==='map_workspace_read'){const next=control.readQueue.shift();return next?typeof next==='function'?await next():await next:{data:shared(),error:null};}
        if(/^map_workspace_(save|reset|delete)/.test(name)){
            writes.push({name,params:JSON.parse(JSON.stringify(params))});const next=control.writeQueue.shift();
            return next?await next:{data:{revision:1,record:{entity_key:params.p_entity_key,marker_type:params.p_marker_type,floor:1,state:params.p_state,u:params.p_u,v:params.p_v}},error:null};
        }
        return {data:[],error:null};
    }};
    w.NamelessSpaRouter={controlsLifecycle:true};w.matchMedia=()=>({matches:true});w.scrollTo=()=>{};
    w.fetch=async input=>({ok:true,json:async()=>JSON.parse(read(new URL(String(input),w.location.href).pathname.slice(1)))});
    const map=d.getElementById('game-map');Object.defineProperties(map,{clientWidth:{value:900},clientHeight:{value:600}});
    map.getBoundingClientRect=()=>({top:0,left:0,bottom:600,right:900,width:900,height:600});w.SVGSVGElement.prototype.createSVGRect=()=>({});
    if(options.auth){
        w.NamelessPublicConfig={supabaseUrl:'https://isolated.invalid',supabasePublishableKey:'isolated-public-fixture'};
        w.supabase={createClient(){if(options.failAuth)throw new Error('isolated startup failure');return db;}};
        if(options.startupUser)control.userQueue.push(options.startupUser.promise);
        w.eval(read('js/auth-supabase.js'));
    }else w.supabase=db;
    for(const file of ['js/vendor/leaflet-1.9.4.js','js/map-regions.js','js/map.js','js/map-workspace.js'])w.eval(read(file));
    return {w,d,db,control,calls,writes,errors,shared,
        api:()=>w.NamelessMapWorkspace.active,
        auth(user){d.dispatchEvent(new w.CustomEvent('nameless:auth-changed',user===undefined?{}:{detail:{user}}));},
        gate:()=>d.getElementById('map-workspace-gate'),
        async close(){w.NamelessMapWorkspace.destroy();w.NamelessMapRegions.destroy();w.NamelessMapPage.destroy();check(errors.length===0,errors.map(String).join('\n'));w.close();}
    };
}

// The actual auth script publishes its readiness promise before its first await.
{
    const startup=deferred(),p=fixture({auth:true,startupUser:startup});
    try{
        check(typeof p.w.namelessAuthReadyPromise?.then==='function'&&!p.w.namelessAuthReady,'The real auth initializer exposes pending readiness synchronously');
        const opening=p.w.NamelessMapWorkspace.init(p.d);await tick();
        check(p.gate().dataset.state==='checking'&&p.gate().getAttribute('aria-busy')==='true'&&p.d.getElementById('workspace-retry').hidden,'Direct entry waits for auth startup with a busy checking gate and no premature retry');
        check(p.d.getElementById('workspace-service').hidden,'Auth startup cannot claim the shared service is unavailable or the local editor is accessible before access and map readiness');
        check(!p.calls.includes('current_user_role')&&!p.calls.includes('map_workspace_read'),'No privileged RPC runs before the actual SDK/session initialization settles');
        startup.resolve({data:{user:{id:A}},error:null});await opening;
        check(await p.w.namelessAuthReadyPromise===true&&p.w.namelessAuthReady===true&&p.api().getState().authorized,'Successful real auth startup resolves readiness and then independently verifies the administrator');
        check(p.calls.filter(name=>name==='getUser').length>=2&&p.calls.includes('current_user_role'),'Startup readiness does not substitute for the workspace authoritative user and role checks');
        check(p.writes.length===0,'Opening the editor performs no write');
    }finally{await p.close();}
}
{
    const p=fixture({auth:true,failAuth:true});
    try{
        await p.w.NamelessMapWorkspace.init(p.d);
        check(await p.w.namelessAuthReadyPromise===false&&p.w.namelessAuthReady===true,'A real failed auth startup also settles readiness without hanging protected pages');
        check(p.gate().dataset.state==='unavailable'&&!p.d.getElementById('workspace-retry').hidden&&!p.api().getState().checkingAccess,'A terminal missing client offers a retry instead of a perpetual loading screen');
        check(p.d.getElementById('workspace-service').hidden,'Missing authentication does not display a local-editor service warning');
        p.w.supabase=p.db;p.d.getElementById('workspace-retry').click();await until(()=>p.api().getState().authorized);
        check(p.gate().hidden&&p.w.NamelessMapPage.active,'Retry can recover after the client becomes available');
    }finally{await p.close();}
}

// Supabase generally resolves {data,error}; a connection failure must offer
// retry in that contract as well as when a request actually rejects.
for(const stage of ['user','role'])for(const delivery of ['resolved','rejected']){
    const p=fixture();
    const failure=()=>delivery==='resolved'?{data:null,error:{code:'NETWORK_ERROR',message:'isolated transport failure'}}:Promise.reject(new Error('isolated rejected transport failure'));
    try{
        p.control[stage+'Queue'].push(failure);await p.w.NamelessMapWorkspace.init(p.d);
        check(p.gate().dataset.state==='unavailable'&&!p.gate().hidden&&!p.d.getElementById('workspace-retry').hidden&&p.d.getElementById('map-workspace-login').hidden&&!p.api().getState().authorized,'A '+delivery+' '+stage+' verification failure is closed and technically retryable without claiming sign-out or role revocation');
        p.d.getElementById('workspace-retry').click();await until(()=>p.api().getState().authorized);
        check(p.gate().hidden&&p.writes.length===0,'Retry recovers after the '+delivery+' '+stage+' startup error without a write');
        p.api().mode('markers');p.api().selectMarker('location:1:ville-depart');p.api().moveMarker({u:.4,v:.5});await tick();
        p.control[stage+'Queue'].push(failure);
        check(await p.api().publishMarker()===false&&p.gate().dataset.state==='unavailable'&&!p.d.getElementById('workspace-retry').hidden&&!p.api().getState().authorized&&p.api().getState().marker===null&&p.writes.length===0,'A '+delivery+' '+stage+' error in pre-write verification also closes unknown access, clears private editing and offers retry without publishing');
        p.d.getElementById('workspace-retry').click();await until(()=>p.api().getState().authorized);
        check(p.api().getState().marker===null&&p.writes.length===0,'A pre-write '+delivery+' '+stage+' failure never grants access from cached role or restores an unknown private draft');
    }finally{await p.close();}
}
for(const missing of ['absent','sdk-error']){
    const p=fixture();
    try{
        if(missing==='absent')p.control.user=null;
        else p.control.userQueue.push(Promise.resolve({data:{user:null},error:{name:'AuthSessionMissingError',status:400,message:'Auth session missing!'}}));
        await p.w.NamelessMapWorkspace.init(p.d);
        check(p.gate().dataset.state==='signin'&&!p.d.getElementById('map-workspace-login').hidden&&p.d.getElementById('workspace-retry').hidden&&!p.api().getState().authorized,'A normal '+missing+' session offers sign-in rather than a misleading technical retry');
    }finally{await p.close();}
}
for(const outcome of ['failure','success','moved','passive','destroy','superseded']){
    const p=fixture();
    try{
        const technical={data:null,error:{code:'NETWORK_ERROR',message:'isolated transport failure'}};
        p.control.userQueue.push(Promise.resolve(technical));await p.w.NamelessMapWorkspace.init(p.d);
        check(p.d.activeElement===p.d.body,'Initial passive access failure does not move focus');
        const retry=p.d.getElementById('workspace-retry'),pending=deferred(),other=p.d.querySelector('.workspace-gate-actions a[href="/carte"]');
        const userChecksBefore=p.calls.filter(name=>name==='getUser').length;
        p.control.userQueue.push(pending.promise);
        if(outcome!=='passive')retry.focus();
        retry.click();
        await tick();
        // JSDOM keeps hidden-button focus; native Chromium sends it to BODY.
        // Blur simulates that native loss without inventing a new focusin.
        if(outcome!=='passive')retry.blur();
        if(outcome==='moved')other.focus();
        if(outcome==='destroy')p.w.NamelessMapWorkspace.destroy();
        if(outcome==='superseded')p.auth(null);
        pending.resolve(outcome==='success'?{data:{user:{id:A}},error:null}:technical);await tick();await tick();
        if(outcome==='success')await until(()=>p.api().getState().authorized);
        if(outcome==='failure')check(p.d.activeElement===retry&&!retry.hidden&&p.gate().dataset.state==='unavailable','Focused Retry restores native lost focus to its visible retry result');
        if(outcome==='success')check(p.d.activeElement!==p.d.body&&!p.d.activeElement.closest('[hidden]')&&p.d.getElementById('map-workspace').contains(p.d.activeElement),'Focused Retry opens the successful map with focus on a visible map/editor control');
        if(outcome==='moved')check(p.d.activeElement===other,'Retry completion cannot take focus after the user chooses another control');
        if(outcome==='passive')check(p.d.activeElement===p.d.body&&p.calls.filter(name=>name==='getUser').length>userChecksBefore&&p.control.userQueue.length===0,'A real programmatic unfocused Retry request completes without creating a user focus intent');
        if(outcome==='destroy')check(p.d.activeElement===p.d.body&&!p.w.NamelessMapWorkspace.active,'Destroyed retry completion cannot focus controls on the former page');
        if(outcome==='superseded')check(p.d.activeElement===p.d.body&&p.gate().dataset.state==='signin','A newer explicit sign-out supersedes the old focused Retry without reopening or refocusing its result');
        check(p.writes.length===0,'The '+outcome+' Retry focus path never writes shared data');
    }finally{await p.close();}
}
{
    const p=fixture();
    try{
        p.control.role='member';await p.w.NamelessMapWorkspace.init(p.d);
        check(p.gate().dataset.state==='restricted'&&p.d.getElementById('workspace-retry').hidden&&p.d.getElementById('map-workspace-login').hidden&&!p.api().getState().authorized,'A successful non-admin role response remains a restricted gate rather than a technical failure');
    }finally{await p.close();}
}

// Fixtures without the new readiness promise remain supported. Failed map
// initialization cannot leave a blank authorized surface or call a null bridge.
for(const failure of ['null','throw']){
    const p=fixture();
    try{
        const init=p.w.NamelessMapPage.init;let attempts=0;
        p.w.NamelessMapPage.init=(...args)=>{if(attempts++===0){if(failure==='throw')throw new Error('isolated map failure');return Promise.resolve(null);}return init(...args);};
        await p.w.NamelessMapWorkspace.init(p.d);
        check(p.gate().dataset.state==='map-error'&&!p.gate().hidden&&p.gate().getAttribute('aria-busy')==='false'&&!p.d.getElementById('workspace-retry').hidden,'A '+failure+' map initialization restores an accessible retryable failure gate');
        check(p.d.getElementById('workspace-service').hidden,'A '+failure+' map failure cannot advertise an accessible local editor');
        const before=p.calls.length;
        check(await p.api().refresh()===false&&p.calls.length===before&&!p.api().getState().authorized,'A failed map has no editable access and refresh cannot dereference or query a missing bridge');
        p.d.getElementById('workspace-retry').click();await until(()=>p.api().getState().authorized);
        check(p.gate().hidden&&p.w.NamelessMapPage.active&&attempts===2,'A '+failure+' failure recovers through one explicit retry');
    }finally{await p.close();}
}
{
    const p=fixture();
    try{
        p.control.readQueue.push(Promise.resolve({data:null,error:{code:'XX000',message:'isolated shared service unavailable'}}));
        await p.w.NamelessMapWorkspace.init(p.d);
        check(p.api().getState().authorized&&!p.api().getState().serverReady&&!p.d.getElementById('workspace-service').hidden&&p.gate().hidden,'The shared-service warning remains available once a verified administrator really has a usable local map editor');
        const role=deferred();p.control.roleQueue.push(role.promise);p.auth({id:A});await tick();
        check(!p.d.getElementById('workspace-service').hidden&&p.gate().hidden,'Same-user revalidation preserves the existing local-editor service warning without pretending the editor must restart');
        role.resolve({data:'admin',error:null});await until(()=>!p.api().getState().checkingAccess);
    }finally{await p.close();}
}

{
    const p=fixture();
    try{
        await p.w.NamelessMapWorkspace.init(p.d);const api=p.api(),bridge=p.w.NamelessMapPage.active;
        api.mode('markers');api.selectMarker('location:1:ville-depart');api.moveMarker({u:.41,v:.51});api.moveMarker({u:.42,v:.52});
        const snapshot=JSON.stringify(api.getState().marker),role=deferred();p.control.roleQueue.push(role.promise);
        p.auth({id:A});await tick();
        check(api.getState().checkingAccess&&!api.getState().authorized&&p.gate().hidden&&p.w.NamelessMapPage.active===bridge,'A same-user event keeps the map visible but blocks editing while its authoritative access is rechecked');
        check(p.d.querySelector('.map-body').getAttribute('aria-busy')==='true'&&p.d.getElementById('workspace-inspector').inert&&p.d.getElementById('workspace-marker-publish').disabled,'Access revalidation makes tools inert and exposes their busy state');
        const live=p.d.getElementById('workspace-message');
        check(live.getAttribute('role')==='status'&&!live.closest('[inert]')&&!live.closest('[aria-busy="true"]'),'The shared feedback live region stays outside busy and inert tools during access revalidation');
        const localBefore=p.w.localStorage.length;
        api.selectMarker('');api.newMarker();api.mode('atlas');
        check(!api.moveMarker({u:.1,v:.2})&&!api.saveLocal()&&await api.publishMarker()===false&&await api.publishRegion()===false&&await api.resetMarker()===false&&await api.resetRegion()===false&&await api.refresh()===false,'Direct editing, local-save, refresh and all publication APIs remain blocked during revalidation');
        check(JSON.stringify(api.getState().marker)===snapshot&&api.getState().mode==='markers'&&p.w.localStorage.length===localBefore&&p.writes.length===0,'Blocked actions cannot alter the unsaved marker, mode, history or storage');
        role.resolve({data:'admin',error:null});await until(()=>!api.getState().checkingAccess);
        check(api.getState().authorized&&p.w.NamelessMapPage.active===bridge&&JSON.stringify(api.getState().marker)===snapshot,'A valid same-user event preserves the exact unsaved marker and original map instance');
        p.d.getElementById('workspace-marker-undo').click();check(api.getState().marker.u===.41,'The marker Undo history survives successful same-user revalidation');
        api.mode('regions');const regions=p.w.NamelessMapRegions.active,region=regions.editor.getDraft();
        const vertex=p.d.querySelector('.map-region-vertex');vertex.focus();vertex.dispatchEvent(new p.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
        const regionState=JSON.stringify(regions.editor.getDraft()),focused=p.d.activeElement;
        const nextRole=deferred();p.control.roleQueue.push(nextRole.promise);p.auth();await tick();
        check(api.getState().checkingAccess&&JSON.stringify(regions.editor.getDraft())===regionState,'An auth event without user detail still revalidates role while preserving the selected region');
        check(regions.editor.load({...region,title:'Blocked replacement'})===false&&regions.editor.save()===false,'Direct region editing and local saving cannot bypass a pending access check');
        nextRole.resolve({data:'admin',error:null});await until(()=>!api.getState().checkingAccess);
        check(p.w.NamelessMapRegions.active===regions&&JSON.stringify(regions.editor.getDraft())===regionState&&api.getState().mode==='regions'&&p.d.activeElement===focused,'A region draft, focused vertex and editor instance survive successful no-detail revalidation');
        regions.editor.undo();check(JSON.stringify(regions.editor.getDraft())===JSON.stringify(region),'The region Undo history survives revalidation without being reconstructed');
        const revoked=deferred();p.control.roleQueue.push(revoked.promise);p.auth({id:A});await tick();revoked.resolve({data:'member',error:null});await until(()=>!api.getState().checkingAccess);
        check(!api.getState().authorized&&p.gate().dataset.state==='restricted'&&!p.gate().hidden&&p.d.getElementById('workspace-retry').hidden&&!p.w.NamelessMapPage.active,'A revoked role destroys private editing access and does not offer a misleading technical retry');
        check(p.writes.length===0,'Draft preservation and role revocation perform no writes');
    }finally{await p.close();}
}

// Later verification must win over stale success/failure, explicit sign-out,
// account switches and a destroyed page.
for(const outcome of ['signout','switch','newer','destroy','failure']){
    const p=fixture();
    try{
        await p.w.NamelessMapWorkspace.init(p.d);const api=p.api();api.mode('markers');api.newMarker();api.moveMarker({u:.4,v:.5});
        const pending=deferred();p.control.roleQueue.push(pending.promise);p.auth({id:A});await tick();
        if(outcome==='signout')p.auth(null);
        if(outcome==='switch'){p.control.user={id:B};p.auth({id:B});await until(()=>api.getState().authorized);}
        if(outcome==='newer'){p.control.role='member';p.auth();await until(()=>!api.getState().checkingAccess);}
        if(outcome==='destroy')p.w.NamelessMapWorkspace.destroy();
        if(outcome==='failure')pending.reject(new Error('isolated verification failure'));else pending.resolve({data:'admin',error:null});
        await tick();await tick();
        if(outcome==='switch')check(api.getState().authorized&&api.getState().marker===null&&p.d.getElementById('workspace-marker-title').value===''&&p.d.getElementById('workspace-marker-undo').disabled,'A different account gets a clean editor and cannot inherit or restore the prior account draft/history');
        else check(!api.getState().authorized&&!p.w.NamelessMapPage.active,'A stale authorization cannot reopen the editor after '+outcome);
        if(outcome==='signout')check(p.gate().dataset.state==='signin'&&!p.d.getElementById('map-workspace-login').hidden&&p.d.getElementById('workspace-retry').hidden,'Explicit sign-out locks immediately with its accessible sign-in action');
        if(outcome==='failure')check(p.gate().dataset.state==='unavailable'&&!p.d.getElementById('workspace-retry').hidden,'A failed verification closes access and offers a technical retry');
        check(p.writes.length===0,'The '+outcome+' race cannot initiate a shared write');
    }finally{await p.close();}
}

// An access event between pre-write verification and the actual RPC blocks the
// write. A write already confirmed before that event remains a confirmed commit.
{
    const p=fixture();
    try{
        await p.w.NamelessMapWorkspace.init(p.d);const api=p.api();api.mode('markers');api.selectMarker('location:1:ville-depart');api.moveMarker({u:.4,v:.5});
        const prewrite=deferred();p.control.roleQueue.push(prewrite.promise);const publishing=api.publishMarker();await tick();
        const recheck=deferred();p.control.roleQueue.push(recheck.promise);p.auth({id:A});await tick();
        prewrite.resolve({data:'admin',error:null});
        check(await publishing===false&&p.writes.length===0,'A newer access check invalidates stale pre-write permission immediately before the write RPC');
        recheck.resolve({data:'admin',error:null});await until(()=>!api.getState().checkingAccess);
        check(p.d.getElementById('workspace-message').textContent==='Modifications privées. Enregistrez le brouillon ou publiez pour les partager.'&&p.d.getElementById('workspace-edit-state').dataset.editState==='private','An interrupted pre-write check restores private-draft feedback and never leaves a phantom publication in progress');
        const commit=deferred();p.control.writeQueue.push(commit.promise);const confirmed=api.publishMarker();await until(()=>p.writes.length===1);
        const duringCommit=deferred();p.control.roleQueue.push(duringCommit.promise);p.auth({id:A});await tick();
        commit.resolve({data:{revision:1,record:{entity_key:'location:1:ville-depart',marker_type:'town',floor:1,state:'visible',u:.4,v:.5}},error:null});await tick();
        check(api.getState().busy&&api.getState().checkingAccess&&p.writes.length===1,'A confirmed in-flight commit waits for the independent access revalidation without resubmitting');
        duringCommit.resolve({data:'admin',error:null});
        check(await confirmed===true&&p.writes.length===1&&p.d.getElementById('workspace-edit-state').dataset.editState==='published','A confirmed write survives successful same-user revalidation and reports publication exactly once');
        api.moveMarker({u:.45,v:.55});p.control.readQueue.push(()=>{throw new Error('isolated post-commit read failure');});
        check(await api.publishMarker()===true&&p.writes.length===2&&/enregistrée sur le serveur/.test(p.d.getElementById('workspace-message').textContent)&&!api.getState().serverReady,'A confirmed commit with a thrown reread stays confirmed and disables further writes until refresh');
    }finally{await p.close();}
}
console.log('Map workspace auth: '+checks+' isolated real-auth/Leaflet checks passed for startup, same-user draft preservation, role/account races, map retry and pre-write/confirmed-write guards.');
