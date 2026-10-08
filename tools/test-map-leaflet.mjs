// Exercise the real bundled Leaflet lifecycle, including its remove-event hooks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {JSDOM, VirtualConsole} = require('jsdom');
const root = path.resolve(import.meta.dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const errors = [];
const console = new VirtualConsole(); console.on('jsdomError', error => errors.push(error));
const dom = new JSDOM(read('pages/map.html'), {url:'https://nameless-sao.fr/carte?floor=1', runScripts:'outside-only', pretendToBeVisual:true, virtualConsole:console});
const w = dom.window;
w.NamelessSpaRouter = {controlsLifecycle:true};
w.scrollTo = () => {};
w.fetch = async url => ({ok:true, json:async () => JSON.parse(read(String(url).replace(/^\//, '')))});
w.supabase = {rpc:async () => ({data:null,error:{code:'PGRST202',message:'Function missing'}})};
const container = w.document.getElementById('game-map');
Object.defineProperties(container, {clientWidth:{value:900},clientHeight:{value:600}});
container.getBoundingClientRect = () => ({top:0,left:0,bottom:600,right:900,width:900,height:600});
w.addEventListener('error', event => errors.push(event.error));
w.eval(read('js/vendor/leaflet-1.9.4.js'));
w.eval(read('js/map.js'));
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
try {
    const bridge = await w.NamelessMapPage.init();
    assert.ok(bridge && bridge.getData().points.length > 0);
    for (const zoom of [-2, 0, 1, -3]) bridge.map.setZoom(zoom, {animate:false});
    await bridge.selectEntity('creature:1');
    assert.ok(w.document.getElementById('map-panel-content').textContent.includes('Gorbel'));
    for (const floor of [2, 3, 1, 2, 1]) {
        const field = w.document.getElementById('floor-select'); field.value = String(floor); field.dispatchEvent(new w.Event('change'));
        for (let n = 0; n < 20 && bridge.getData()?.floor !== floor; n++) await tick();
        assert.equal(bridge.getData()?.floor, floor, 'Actual Leaflet floor switch completes after zoom and selection');
        const images = [...container.querySelectorAll('img.leaflet-image-layer')];
        assert.ok(images.some(image => image.getAttribute('src').includes('floor-' + floor + '-')), 'The mounted image belongs to the selected floor');
        bridge.map.setZoom(0, {animate:false}); bridge.map.panBy([40,20], {animate:false});
    }
    w.NamelessMapPage.destroy();
    assert.equal(errors.length, 0, errors.map(error => String(error)).join('\n'));
    assert.equal(container.querySelectorAll('.leaflet-marker-icon').length, 0);
} finally {w.NamelessMapPage.destroy();w.close();}
globalThis.console.log('Real Leaflet lifecycle passed: zoom, selection, repeated floor changes, pan and destruction.');
