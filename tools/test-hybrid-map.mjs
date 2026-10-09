// Hybrid atlas controls run against the real Leaflet bundle and current graph.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {JSDOM, VirtualConsole} from 'jsdom';
const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const catalog = JSON.parse(read('assets/map/catalog.json'));
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function waitFor(check) { for (let n = 0; n < 30 && !check(); n++) await tick(); assert.ok(check()); }
function surface(width) {
    const errors = [], requests = [], console = new VirtualConsole();
    console.on('jsdomError', error => errors.push(error));
    const dom = new JSDOM(read('pages/map.html'), {url:'https://nameless-sao.fr/carte?floor=1',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console});
    const w = dom.window;
    Object.defineProperty(w, 'innerWidth', {value:width,writable:true});
    w.NamelessSpaRouter = {controlsLifecycle:true}; w.scrollTo = () => {};
    w.fetch = async url => { requests.push(url); return {ok:true,json:async () => JSON.parse(read(String(url).replace(/^\//, '')))}; };
    w.supabase = {rpc:async () => ({data:null,error:{code:'PGRST202',message:'Function missing'}})};
    const map = w.document.getElementById('game-map');
    Object.defineProperties(map, {clientWidth:{value:width <= 768 ? width - 32 : 850},clientHeight:{value:600}});
    map.getBoundingClientRect = () => ({top:0,left:0,bottom:600,right:width,width,height:600});
    w.addEventListener('error', event => errors.push(event.error));
    w.eval(read('js/vendor/leaflet-1.9.4.js')); w.eval(read('js/map.js'));
    return {w,dom,errors,requests,doc:w.document,init:() => w.NamelessMapPage.init(),destroy:() => {w.NamelessMapPage.destroy();w.close();}};
}
{
    const p = surface(1440); const bridge = await p.init(); const d = p.doc;
    assert.deepEqual([...d.querySelectorAll('#map-floor-buttons button')].map(button => Number(button.dataset.floor)), catalog.floors.map(floor => Number(floor.id)), 'Floor shortcuts come only from available map data');
    assert.equal(d.querySelector('#map-floor-buttons button[aria-pressed="true"]').textContent, '01');
    assert.equal(d.getElementById('map-floor-previous').disabled, true); assert.equal(d.getElementById('map-floor-next').disabled, false);
    assert.equal(d.getElementById('map-filter-rail').hidden, false, 'Desktop exposes the filter rail');
    const actualPlaces = Object.values(bridge.getData().entities).filter(entity => entity.kind === 'location' && entity.position);
    assert.equal(d.getElementById('map-places').hidden, false, 'A floor with real located places shows its discovery strip');
    for (const button of d.querySelectorAll('.map-place-card')) assert.ok(actualPlaces.some(entity => entity.key === button.dataset.entityKey), 'Every location card is a real positioned graph entity');
    assert.ok(d.querySelector('.map-place-card .map-location-preview').style.backgroundImage.includes('floor-1-desktop.webp'), 'Location previews use the calibrated atlas, without imaginary server screenshots');
    d.getElementById('map-places-toggle').click(); assert.equal(d.querySelectorAll('.map-place-card').length, actualPlaces.length, 'Show all exposes the documented locations');
    d.getElementById('map-display-names').click(); assert.equal(d.querySelector('main').classList.contains('map-hide-names'), true);
    d.getElementById('map-display-markers').click(); assert.equal(d.querySelector('main').classList.contains('map-hide-markers'), true);
    d.getElementById('map-filters-reset').click(); assert.equal(d.querySelector('main').classList.contains('map-hide-markers'), false); assert.equal(d.getElementById('map-display-names').checked, true, 'Reset restores display controls as well as marker filters');
    const legend = d.getElementById('map-legend'); legend.showModal = () => { legend.open = true; }; legend.close = () => { legend.open = false; };
    d.getElementById('map-legend-open').click(); assert.equal(legend.open, true); assert.ok(d.querySelectorAll('.map-legend-row').length > 0); assert.ok(!d.getElementById('map-legend-content').textContent.includes('Quêtes principales'), 'Legend lists only actual public marker types'); d.getElementById('map-legend-close').click();
    assert.ok(d.querySelector('.map-body > #map-filter-rail'), 'Filters sit beside the map rather than consuming a second toolbar');
    assert.equal(p.requests.filter(url => /floor-\d+\.json$/.test(url)).length, 1, 'Shortcuts do not preload other floors');
    d.getElementById('map-floor-next').click(); await waitFor(() => bridge.getData()?.floor === 2);
    assert.equal(new URL(p.w.location.href).searchParams.get('floor'), '2');
    assert.equal(d.getElementById('map-floor-title').textContent, 'Palier 02');
    const two = d.querySelector('#map-floor-buttons [data-floor="2"]'); two.focus();
    two.dispatchEvent(new p.w.KeyboardEvent('keydown', {key:'ArrowRight',bubbles:true,cancelable:true}));
    await waitFor(() => bridge.getData()?.floor === 3);
    assert.equal(d.activeElement.dataset.floor, '3'); assert.equal(d.getElementById('map-floor-next').disabled, true);
    assert.equal(d.getElementById('map-filters-empty').hidden, false, 'Image-only floor explains the absence of filters');
    assert.equal(d.getElementById('map-places').hidden, true, 'The uncalibrated floor receives no fabricated location strip');
    d.activeElement.dispatchEvent(new p.w.KeyboardEvent('keydown', {key:'Home',bubbles:true,cancelable:true}));
    await waitFor(() => bridge.getData()?.floor === 1);
    const archive = d.querySelector('[data-marker-type="quest-secondary"]'); archive.checked = true; archive.dispatchEvent(new p.w.Event('change'));
    d.getElementById('map-filters-reset').click(); assert.equal(d.querySelector('[data-marker-type="quest-secondary"]').checked, false, 'Reset keeps unverified archives off by default');
    await bridge.selectEntity('creature:1');
    d.querySelector('[data-panel-tab="items"]').click(); assert.equal(d.getElementById('map-panel-pane-items').hidden, false); assert.equal(d.getElementById('map-panel-pane-overview').hidden, true, 'Tab selection exposes documented drop relations');
    d.querySelector('[data-panel-tab="items"]').dispatchEvent(new p.w.KeyboardEvent('keydown', {key:'ArrowRight',bubbles:true,cancelable:true})); assert.equal(d.activeElement.dataset.panelTab, 'places', 'Detail tabs support keyboard navigation');
    const relatedImages = [...d.querySelectorAll('.map-relations img')]; assert.ok(relatedImages.length > 0, 'Known drops use their actual catalogue artwork');
    for (const image of relatedImages) { assert.equal(image.getAttribute('loading'), 'lazy'); assert.equal(image.getAttribute('width'), '64'); assert.ok(fs.existsSync(path.join(root, decodeURIComponent(new URL(image.src).pathname).slice(1)))); }
    const pixel = d.querySelector('.map-relation-image.is-item img');
    Object.defineProperties(pixel, {naturalWidth:{value:24},naturalHeight:{value:24}}); pixel.dispatchEvent(new p.w.Event('load'));
    assert.equal(pixel.style.width, '48px'); assert.equal(pixel.style.height, '48px', 'Small item sprites scale by whole pixels');
    assert.match(d.getElementById('map-panel-content').textContent, /position exacte.*inconnue/, 'Artwork never turns a zone reference into an invented creature spawn');
    const secondary = Object.values(bridge.getData().entities).find(entity => entity.kind === 'guide' && entity.status === 'historical-unverified');
    await bridge.selectEntity(secondary.key); assert.match(d.getElementById('map-panel-content').textContent, /Archive non vérifiée/);
    await bridge.selectEntity('location:1:ville-depart'); assert.equal(d.querySelector('.map-entity-heading img'), null, 'Locations without source artwork do not receive an invented image');
    assert.equal(p.errors.length, 0, p.errors.map(String).join('\n')); p.destroy();
}
{
    const p = surface(390); const bridge = await p.init(); const d = p.doc;
    const rail = d.getElementById('map-filter-rail'), toggle = d.getElementById('map-filters-toggle');
    assert.equal(rail.hidden, true); assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    toggle.click(); assert.equal(rail.hidden, false); assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    const palette = d.createElement('dialog'); palette.open = true;
    const paletteInput = d.createElement('input'); palette.append(paletteInput); d.body.append(palette); paletteInput.focus();
    const paletteEscape = new p.w.KeyboardEvent('keydown', {key:'Escape',bubbles:true,cancelable:true}); paletteInput.dispatchEvent(paletteEscape);
    assert.equal(rail.hidden, false, 'Escape in the global palette leaves the underlying map drawer intact');
    assert.equal(d.activeElement, paletteInput, 'The map never steals focus from a native modal palette');
    assert.equal(paletteEscape.defaultPrevented, false); palette.remove();
    assert.equal(d.querySelector('main [aria-modal="true"], main [inert]'), null, 'Mobile filters remain nonmodal'); assert.equal(d.body.style.overflow, '');
    d.getElementById('game-map').focus(); const before = bridge.map.getCenter(); bridge.map.panBy([30,15], {animate:false}); assert.notDeepEqual(bridge.map.getCenter(), before, 'The map can still pan while filters are open');
    d.querySelector('#map-filters input').dispatchEvent(new p.w.KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
    assert.equal(rail.hidden, true); assert.equal(d.activeElement, toggle, 'Escape closes filters and returns focus to their trigger');
    toggle.click(); await bridge.selectEntity('creature:1'); assert.equal(rail.hidden, true, 'Selection clears the compact drawer to expose the chosen map reference');
    d.getElementById('map-panel-expand').click(); assert.equal(d.getElementById('map-panel-expand').getAttribute('aria-expanded'), 'true'); assert.equal(d.querySelector('main [inert]'), null);
    p.w.innerWidth = 1024; p.w.dispatchEvent(new p.w.Event('resize')); assert.equal(rail.hidden, false); assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    p.w.innerWidth = 360; p.w.dispatchEvent(new p.w.Event('resize')); assert.equal(rail.hidden, true, 'Returning to mobile starts with the drawer closed');
    for (const id of ['map-recenter','map-fullscreen','map-share','map-filters-toggle']) assert.ok(d.getElementById(id).getAttribute('aria-label'), 'Icon controls retain an accessible name');
    await p.init(); toggle.click(); assert.equal(toggle.getAttribute('aria-expanded'), 'true', 'Repeated init keeps one toggle listener');
    p.w.NamelessMapPage.destroy(); toggle.click(); assert.equal(toggle.getAttribute('aria-expanded'), 'false', 'Destroy removes mobile drawer listeners');
    assert.equal(d.getElementById('game-map').querySelectorAll('.leaflet-marker-icon').length, 0); assert.equal(p.errors.length, 0, p.errors.map(String).join('\n')); p.dom.window.close();
}
console.log('Hybrid map passed: actual floor shortcuts, keyboard, filter rail/drawer, nonmodal mobile, genuine thumbnails, archives and Leaflet lifecycle.');
