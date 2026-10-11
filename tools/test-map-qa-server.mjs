/* Local HTTP + existing SQL + bundled SDK. No Chrome, external API or account. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import {createMapQaBackend} from './map-qa-backend.mjs';

const workspace = path.resolve(import.meta.dirname,'..');
const qa = await createMapQaBackend(workspace);
const server = http.createServer((request,response)=>qa.handle(request,response,new URL(request.url,'http://127.0.0.1'),{}));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin = 'http://127.0.0.1:'+server.address().port;
const [admin,member] = qa.actors;
let checks = 0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
async function call(name,params={},actor=admin) {
    const response = await fetch(origin+'/qa-api/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json',...(actor?{Authorization:'Bearer '+actor.token}:{})},body:JSON.stringify(params)});
    return {status:response.status,data:await response.json()};
}
try {
    const initial = await call('map_workspace_read');
    check(initial.status===200 && initial.data.registry.length===93 && initial.data.markers.length===0,'Local workspace uses the current 93-identity SQL publication gate with no synthetic placement overrides');
    const denied = await call('map_workspace_read',{},member);
    check(denied.status===403 && /admin/.test(denied.data.message),'HTTP member sessions cannot read the private map workspace');
    const absent = await call('map_workspace_read',{},null);
    check(absent.status===403,'HTTP anonymous sessions cannot read private workspace state');
    const suppressed = await call('read_map_marker_overrides',{},null);
    check(suppressed.status===200 && suppressed.data.length===176 && suppressed.data.every(row=>row.state==='hidden'&&row.u===null&&row.v===null),'Public HTTP reads preserve SQL tombstones for all 176 retired identities');
    const baseline = JSON.parse(fs.readFileSync(path.join(workspace,'data/map-regions.json'),'utf8')).floors[0];
    const region = baseline.regions[0];
    const params={p_entity_key:region.entityKey,p_region_id:region.id,p_floor:1,p_image_id:baseline.imageId,p_status:'draft',p_visible:true,p_vertices:region.vertices,p_expected_revision:0};
    const draft = await call('map_workspace_save_region',params);
    check(draft.status===200 && draft.data.revision===1,'Saving a private region runs the real SQL revision contract');
    const draftPublic = (await call('read_map_regions',{},null)).data.find(row=>row.entity_key===region.entityKey);
    check(draftPublic.visible===false && draftPublic.vertices===null && draftPublic.status===null,'A draft never exposes its outline or status through the public HTTP reader');
    const published = await call('map_workspace_save_region',{...params,p_status:'indicative',p_expected_revision:1});
    check(published.status===200 && published.data.revision===2,'An explicit publication commits the next actual region revision');
    const publicRegion = (await call('read_map_regions',{},null)).data.find(row=>row.entity_key===region.entityKey);
    check(publicRegion.visible===true && JSON.stringify(publicRegion.vertices)===JSON.stringify(region.vertices) && !('created_by' in publicRegion),'Public HTTP readers receive the published geometry without administrator metadata');
    const stale = await call('map_workspace_save_region',{...params,p_expected_revision:1});
    check(stale.status===400 && /revision_conflict/.test(stale.data.message),'A stale HTTP publication cannot overwrite a newer SQL revision');
    const customParams={p_entity_key:null,p_title:'QA Repère HTTP',p_description:'Isolated local verification',p_marker_type:'npc',p_floor:1,p_image_id:baseline.imageId,p_state:'draft',p_u:.4,p_v:.5,p_expected_revision:0};
    const custom = await call('map_workspace_save_custom_marker',customParams);
    check(custom.status===200 && /^custom:/.test(custom.data.record.entity_key),'The SQL server generates custom marker identity');
    check((await call('read_map_custom_markers',{},null)).data.length===0,'A custom marker draft remains absent from public HTTP output');
    const visible = await call('map_workspace_save_custom_marker',{...customParams,p_entity_key:custom.data.record.entity_key,p_state:'visible',p_expected_revision:1});
    const publicCustom = (await call('read_map_custom_markers',{},null)).data[0];
    check(visible.status===200 && publicCustom.u===.4 && publicCustom.title===customParams.p_title && !('created_by' in publicCustom),'Explicit custom-marker publication appears in the public reader with its original content and normalized coordinates');
    const memberWrite = await call('map_workspace_save_custom_marker',customParams,member);
    check(memberWrite.status===403,'The local HTTP adapter preserves SQL permission enforcement on mutations');
    const deleted = await call('map_workspace_delete_custom_marker',{p_entity_key:custom.data.record.entity_key,p_expected_revision:2});
    check(deleted.status===200 && (await call('read_map_custom_markers',{},null)).data.length===0,'Deletion uses the real revision-protected tombstone and removes the public custom marker');
    const sandbox = {fetch,Headers,Request,Response,URL,URLSearchParams,AbortController,TextEncoder,TextDecoder,setTimeout,clearTimeout,setInterval,clearInterval,console,crypto:globalThis.crypto,WebSocket:globalThis.WebSocket};
    sandbox.window=sandbox;sandbox.self=sandbox;vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(workspace,'js/vendor/supabase-2.117.2.min.js'),'utf8'),sandbox);
    let stored=JSON.stringify(admin.session);
    const client=sandbox.supabase.createClient(origin+'/qa-api','QA_LOCAL_ANON_ONLY',{auth:{storage:{getItem:()=>stored,setItem:(_key,value)=>{stored=value;},removeItem:()=>{stored=null;}},persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
    const auth=await client.auth.getUser();
    check(auth.data.user?.id===admin.user.id && !auth.error,'The shipped Supabase SDK validates the isolated session through the local auth HTTP endpoint');
    const sdkRead=await client.rpc('map_workspace_read');
    check(!sdkRead.error && sdkRead.data.registry.length===93 && sdkRead.data.regions[0].revision===2,'The shipped SDK reads actual SQL workspace results instead of frontend fixture data');
    const profile=await client.from('user_profiles').select('*').eq('id',admin.user.id).single();
    check(!profile.error && profile.data.role==='admin','The shipped SDK reads only its own local profile via the HTTP contract');
    await client.auth.signOut();
    check((await client.auth.getSession()).data.session===null,'Local sign-out clears the real SDK session without touching an external account');
} finally {
    await new Promise(resolve=>server.close(resolve));await qa.close();
}
console.log('Map QA HTTP server: '+checks+' checks passed with real SQL and the bundled Supabase SDK; no remote API or browser automation.');
