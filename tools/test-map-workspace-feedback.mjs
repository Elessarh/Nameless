/* Actual workspace + Leaflet with the isolated SQL backend over loopback HTTP.
   Only the public reader failures are injected. No production URL or account. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {JSDOM,VirtualConsole} from 'jsdom';
import {createMapQaBackend} from './map-qa-backend.mjs';

const root=path.resolve(import.meta.dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const qa=await createMapQaBackend(root),[admin]=qa.actors;
const server=http.createServer((request,response)=>qa.handle(request,response,new URL(request.url,'http://127.0.0.1'),{}));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port,errors=[],output=new VirtualConsole();
output.on('jsdomError',error=>errors.push(error));
const dom=new JSDOM(read('pages/admin-carte.html'),{url:'https://nameless-sao.fr/admin-carte?floor=1',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:output});
const w=dom.window,d=w.document,failures=new Map(),writes=[];
let checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
async function call(name,params={}){
    const endpoint=new URL(origin+'/qa-api/rest/v1/rpc/'+name);
    assert.equal(endpoint.hostname,'127.0.0.1','Every SQL call stays on the isolated loopback server');
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+admin.token},body:JSON.stringify(params)});
    const data=await response.json();return response.ok?{data,error:null}:{data:null,error:data};
}
w.NamelessSpaRouter={controlsLifecycle:true};w.matchMedia=()=>({matches:true});w.scrollTo=()=>{};
w.fetch=async input=>({ok:true,json:async()=>JSON.parse(read(new URL(String(input),w.location.href).pathname.slice(1)))});
w.supabase={auth:{getUser:async()=>({data:{user:admin.user},error:null})},rpc:async(name,params)=>{
    if(failures.has(name))return {data:null,error:failures.get(name)};
    if(/^map_workspace_(save|reset|delete)/.test(name))writes.push({name,params:JSON.parse(JSON.stringify(params))});
    return call(name,params);
}};
const map=d.getElementById('game-map');Object.defineProperties(map,{clientWidth:{value:900},clientHeight:{value:600}});
map.getBoundingClientRect=()=>({top:0,left:0,bottom:600,right:900,width:900,height:600});w.SVGSVGElement.prototype.createSVGRect=()=>({});
for(const file of ['js/vendor/leaflet-1.9.4.js','js/map-regions.js','js/map.js','js/map-workspace.js'])w.eval(read(file));
const key='location:1:ville-depart',message=()=>d.getElementById('workspace-message').textContent,status=()=>d.getElementById('workspace-edit-state').dataset.editState;
const previewWarning=()=>message()==='Données de publication rechargées. L’aperçu reste indisponible ; réessayez pour l’actualiser.';
try {
    await w.NamelessMapWorkspace.init(d);const api=w.NamelessMapWorkspace.active;
    check(api.getState().authorized&&api.getState().serverReady,'The actual administrator workspace opens against the isolated SQL permission gate');
    api.mode('markers');api.selectMarker(key);
    check(api.moveMarker({u:.41,v:.51})&&api.saveLocal(),'A private marker draft exists before testing publication feedback');
    failures.set('read_map_regions',{code:'XX000',message:'Isolated public region read failure'});
    check(await api.publishMarker(),'A confirmed SQL commit still reports commit success when its public region reread fails');
    const committed=(await call('map_workspace_read')).data.markers.find(row=>row.entity_key===key);
    check(committed?.revision===1&&committed.u===.41&&committed.v===.51&&writes.length===1,'The commit really persisted one exact marker revision and was not retried after the reader failure');
    check(status()==='published'&&message()==='Modification enregistrée sur le serveur. La relecture est indisponible : rechargez les données avant une nouvelle publication.','Confirmed storage is distinguished from an unavailable public preview instead of falsely claiming the map is current');
    check(!d.getElementById('workspace-marker-place').disabled&&!d.getElementById('workspace-marker-local').disabled,'Post-commit form rebuilding releases private placement and save controls after the busy state');
    const regionResult=await w.NamelessMapRegions.active.reloadRemote();
    check(regionResult?.status==='error','A caught public region failure resolves with an explicit error status');
    api.moveMarker({u:.42,v:.52});api.saveLocal();
    const privateDraft=JSON.stringify(api.getState().marker),saved=w.localStorage.getItem('nameless.map-marker-drafts.v1.'+admin.user.id);
    check(await api.refresh()===false&&previewWarning(),'A fulfilled but failed public region reader makes refresh report incomplete preview rather than success');
    check(JSON.stringify(api.getState().marker)===privateDraft&&w.localStorage.getItem('nameless.map-marker-drafts.v1.'+admin.user.id)===saved&&status()==='local','The incomplete refresh preserves the current private marker and its saved browser draft');
    for(const [reader,code] of [['read_map_marker_overrides','XX000'],['read_map_custom_markers','XX000'],['read_map_regions','PGRST202'],['read_map_marker_overrides','PGRST202']]){
        failures.clear();failures.set(reader,{code,message:'Isolated unavailable public reader'});
        check(await api.refresh()===false&&previewWarning(),'Refresh detects '+reader+' '+code+' despite a fulfilled reader promise');
        check(JSON.stringify(api.getState().marker)===privateDraft&&writes.length===1,'The '+reader+' failure cannot move or republish the private draft');
    }
    failures.clear();
    check(await api.refresh()===true&&message()==='Données rechargées. Votre brouillon peut être publié sur cette nouvelle révision.','A later complete read restores the success message only after both public readers are ready');
    check(await api.publishMarker(),'The preserved private draft can be explicitly published after the public readers recover');
    const final=(await call('map_workspace_read')).data.markers.find(row=>row.entity_key===key);
    check(final?.revision===2&&final.u===.42&&final.v===.52&&writes.length===2&&message()==='Modification publiée. La carte publique utilise ces données.','A healthy explicit publication commits exactly revision two and reports a verified public reread');
    check(status()==='published'&&errors.length===0,'Successful publication keeps its confirmed status without runtime DOM errors');
} finally {
    w.NamelessMapWorkspace.destroy();w.NamelessMapRegions.destroy();w.NamelessMapPage.destroy();w.close();
    await new Promise(resolve=>server.close(resolve));await qa.close();
}
console.log('Map workspace feedback: '+checks+' actual Leaflet/isolated SQL checks passed for confirmed commits and public reread failures; zero production calls.');
