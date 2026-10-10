// A real Leaflet map must recover from hidden authentication gates and SPA
// layout changes without saving a microscopic atlas or shifting its markers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {JSDOM, VirtualConsole} from 'jsdom';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const catalog = JSON.parse(read('assets/map/catalog.json'));
const frame = () => new Promise(resolve => setTimeout(resolve, 45));
function surface({url='/admin-carte?floor=1',width=0,height=0,stored=null,admin=true}={}) {
    const errors=[], observers=[], log=new VirtualConsole();
    log.on('jsdomError',error=>errors.push(error));
    const dom=new JSDOM(read('pages/map.html'),{url:'https://nameless-sao.fr'+url,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:log});
    const w=dom.window,container=w.document.getElementById('game-map');
    if(admin)w.document.querySelector('main').classList.add('map-admin-workspace');
    w.NamelessSpaRouter={controlsLifecycle:true};w.scrollTo=()=>{};
    w.matchMedia=()=>({matches:true});
    w.fetch=async url=>({ok:true,json:async()=>JSON.parse(read(String(url).replace(/^\//,'')))});
    w.supabase={rpc:async()=>({data:null,error:{code:'PGRST202',message:'Function missing'}})};
    if(stored)w.localStorage.setItem(admin?'namelessMapWorkspaceView':'ironOathMapState',JSON.stringify(stored));
    Object.defineProperties(container,{clientWidth:{get:()=>width},clientHeight:{get:()=>height}});
    container.getBoundingClientRect=()=>({top:0,left:0,bottom:height,right:width,width,height});
    w.ResizeObserver=class{
        constructor(callback){this.callback=callback;observers.push(this)}
        observe(element){this.element=element}
        disconnect(){this.disconnected=true}
    };
    w.addEventListener('error',event=>errors.push(event.error));
    w.eval(read('js/vendor/leaflet-1.9.4.js'));w.eval(read('js/map.js'));
    return {w,container,errors,observers,init:()=>w.NamelessMapPage.init(),
        async size(nextWidth,nextHeight){width=nextWidth;height=nextHeight;for(const observer of observers)observer.callback([{target:container}]);await frame()},
        destroy(){w.NamelessMapPage.destroy();w.close()}};
}
function atlasFits(bridge) {
    const floor=catalog.floors.find(floor=>floor.id===bridge.getFloor());
    const bounds=bridge.map.getBounds(),[[south,west],[north,east]]=floor.bounds;
    assert.ok(bounds.contains([south,west])&&bounds.contains([north,east]),'The current atlas fits completely inside the current Leaflet viewport');
    const span=(north-south)*2**bridge.map.getZoom();
    const padding=bridge.map.getSize().x<=700?[24,24]:[48,48];
    assert.equal(bridge.map.getZoom(),bridge.map.getBoundsZoom(floor.bounds,false,padding),'Overview zoom is fitted to the current viewport rather than the hidden initial size');
    assert.ok(span>=bridge.map.getSize().y*.45,'The current atlas fills the viewport rather than remaining a 155px thumbnail');
}
function sameCamera(map,before) {
    const after=map.getCenter();
    assert.equal(map.getZoom(),before.zoom,'Layout changes preserve the chosen zoom');
    const rounding=1/2**before.zoom;
    assert.ok(Math.abs(after.lat-before.center.lat)<=rounding&&Math.abs(after.lng-before.center.lng)<=rounding,'Layout changes preserve the map center to pixel rounding');
}
function alignedLayers(p,bridge) {
    let markers=0,images=0;
    bridge.map.eachLayer(layer=>{
        if(layer instanceof p.w.L.Marker){
            const actual=p.w.L.DomUtil.getPosition(layer.getElement()),expected=bridge.map.latLngToLayerPoint(layer.getLatLng());
            assert.ok(actual.equals(expected),'Marker pixels use the same current camera projection as the atlas');markers++;
        }else if(layer instanceof p.w.L.ImageOverlay){
            const actual=p.w.L.DomUtil.getPosition(layer.getElement()),expected=bridge.map.latLngToLayerPoint(layer.getBounds().getNorthWest());
            assert.ok(actual.equals(expected),'Atlas pixels use the same current camera projection as its markers');images++;
        }
    });
    assert.ok(markers>0&&images>0);
}

{
    const p=surface(),bridge=await p.init();
    try{
        assert.ok(bridge);assert.equal(bridge.map.getZoom(),-3,'A zero-size container never executes a minimum-zoom fit');
        assert.equal(p.w.localStorage.getItem('namelessMapWorkspaceView'),null,'Hidden initial layouts do not persist invalid camera preferences');
        await p.size(1260,760);atlasFits(bridge);alignedLayers(p,bridge);
        const first=bridge.map.getZoom();await p.size(820,580);atlasFits(bridge);assert.notEqual(bridge.map.getZoom(),first,'An untouched overview adjusts to its available viewport');
        bridge.map.fire('dragstart');bridge.map.setView([2450,2630],-2,{animate:false});
        const camera={center:bridge.map.getCenter(),zoom:bridge.map.getZoom()};
        await p.size(620,580);sameCamera(bridge.map,camera);alignedLayers(p,bridge);
        await p.size(1560,980);p.w.document.dispatchEvent(new p.w.Event('fullscreenchange'));sameCamera(bridge.map,camera);alignedLayers(p,bridge);
        await p.size(0,0);await p.size(980,680);sameCamera(bridge.map,camera);
        p.w.document.getElementById('map-recenter').click();atlasFits(bridge);
        for(const floor of [2,3,1]){await bridge.chooseFloor(floor);atlasFits(bridge)}
        alignedLayers(p,bridge);
        assert.equal(p.errors.length,0,p.errors.map(String).join('\n'));
    }finally{p.destroy()}
    assert.ok(p.observers.every(observer=>observer.disconnected),'Destroy removes viewport observers');
}
{
    const p=surface({url:'/admin-carte?floor=1&u=.43&v=.57&zoom=-1'}),bridge=await p.init();
    try{
        await p.size(1180,780);
        assert.equal(bridge.map.getZoom(),-1,'A shared camera queued behind an authentication gate overrides the initial overview');
        const relative=bridge.getRelative(bridge.map.getCenter());assert.ok(Math.abs(relative.u-.43)<.001&&Math.abs(relative.v-.57)<.001);
        await p.size(0,0);await bridge.chooseFloor(2);await bridge.chooseFloor(3);await p.size(940,640);
        assert.equal(bridge.getFloor(),3);atlasFits(bridge);
        assert.ok([...p.container.querySelectorAll('.leaflet-image-layer')].every(image=>image.src.includes('floor-3-')),'Only the latest hidden floor is mounted and framed after reveal');
        assert.equal(p.errors.length,0,p.errors.map(String).join('\n'));
    }finally{p.destroy()}
}
{
    const p=surface({url:'/carte',width:1100,height:700,admin:false,stored:{lat:2560,lng:2560,zoom:-5,floor:1}}),bridge=await p.init();
    try{atlasFits(bridge);assert.ok(bridge.map.getZoom()>-5,'Broken legacy minimum-zoom preferences are repaired when opening the map');}
    finally{p.destroy()}
}
{
    const p=surface({url:'/admin-carte',width:1100,height:700});
    p.w.localStorage.setItem('ironOathMapState',JSON.stringify({lat:2560,lng:2560,zoom:-5,floor:2}));
    const bridge=await p.init();
    try{
        assert.equal(bridge.getFloor(),1,'Administration does not inherit another public-map camera');
        atlasFits(bridge);
    }finally{p.destroy()}
}
{
    const p=surface({url:'/carte?floor=1',admin:false}),bridge=await p.init();
    try{
        await p.size(338,423);
        atlasFits(bridge);
        assert.ok((catalog.floors[0].bounds[1][1]-catalog.floors[0].bounds[0][1])*2**bridge.map.getZoom()>338*.84,'A narrow mobile overview uses its width instead of leaving large margins');
        assert.equal(JSON.parse(p.w.localStorage.getItem('ironOathMapState')).version,2,'Only a valid positive viewport persists the overview');
    }finally{p.destroy()}
}
console.log('Real Leaflet viewport passed: hidden gates, late sizing, neutral overview, manual camera, fullscreen, hidden floor races, shared camera, legacy repair and observer cleanup.');
