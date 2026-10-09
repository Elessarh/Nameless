import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const source = fs.readFileSync(new URL('../js/map.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../pages/map.html', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const copy = value => JSON.parse(JSON.stringify(value));
const location = (key, floor, title, u, v, markerType = 'zone') => ({ key, id: key.split(':').at(-1), floor, title, titleEn: 'EN ' + title, kind: 'location', markerType, position: { u, v }, positionRef: key, description: '', creatureKeys: [], guideKeys: [], relatedKeys: [], drops: [] });
const a = location('location:1:a', 1, 'Zone Alpha', .25, .75);
const b = location('location:2:b', 2, 'Zone Beta', .5, .5);
const quest1 = { ...location('quest:1:q1', 1, 'Quête partagée', .25, .75, 'quest-primary'), kind: 'quest', id: 'q1' };
const quest2 = { ...location('quest:1:q2', 1, 'Deuxième quête', .25, .75, 'quest-primary'), kind: 'quest', id: 'q2' };
const creature = { key: 'creature:1', id: 1, floor: 1, title: 'Gorbel', titleEn: 'Gorbel', kind: 'creature', markerType: 'boss', position: null, positionRef: a.key, placeKey: a.key, url: '/boss/gorbel', drops: [{ name: 'Gelée', itemKey: 'item:gel', rate: 30 }], relatedKeys: [], creatureKeys: [], guideKeys: [] };
const unknown = { ...creature, key: 'creature:2', id: 2, title: '<img src=x onerror=alert(1)>', titleEn: null, markerType: 'creature', positionRef: null, placeKey: null, url: 'javascript:alert(1)', drops: [] };
const item = { ...unknown, key: 'item:gel', id: 'gel', title: 'Gelée', titleEn: 'Slime Gel', kind: 'item', markerType: null, url: '/items?item=gel' };
const guide = { ...quest1, key: 'guide:p1-guide', id: 'p1-guide', kind: 'guide', title: 'Guide connu', position: { u: .3, v: .6 }, url: '/quetes?quest=p1-guide' };
a.creatureKeys = [creature.key];
const floors = [
    { id: 1, title: 'Palier 1', bounds: [[85, 85], [5036, 5036]], maxBounds: [[-1000, -1000], [6120, 6120]], gameOffset: 5121, image: '/assets/carte.webp', overview: '/assets/carte-overview.webp', overviewMobile: '/assets/carte-overview-mobile.webp', overviewWidth: 1600, overviewMobileWidth: 1024, dataUrl: '/assets/map/floor-1.json' },
    { id: 2, title: 'Palier 2', bounds: [[3842, -1059], [6180, 1059]], maxBounds: [[3300, -1500], [6700, 1500]], gameOffset: 5121, image: '/assets/Palier2-map.webp', dataUrl: '/assets/map/floor-2.json' },
    { id: 3, title: 'Palier 3', bounds: [[0, 0], [1513, 1274]], maxBounds: [[0, 0], [1513, 1274]], gameOffset: null, image: '/assets/Palier3-map.webp', dataUrl: '/assets/map/floor-3.json' }
];
const entities = [a, b, quest1, quest2, creature, unknown, item, guide];
const catalog = { version: 1, floors, index: entities.map(({ position, drops, ...entity }) => entity), registry: entities.map(({ key, kind, floor, markerType }) => ({ key, kind, floor, markerType })) };
const data = {
    1: { version: 1, floor: 1, entities: Object.fromEntries(entities.filter(entity => entity.floor === 1).map(entity => [entity.key, entity])), points: [a.key, quest1.key, quest2.key] },
    2: { version: 1, floor: 2, entities: { [b.key]: b }, points: [b.key] },
    3: { version: 1, floor: 3, entities: {}, points: [] }
};
function page({ url = '/carte', mobile = false, rpc, waits = {}, stored, deniedStorage = false, extraEntities = [], previews = false } = {}) {
    const dom = new JSDOM(html, { url: 'https://nameless-sao.fr' + url, runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    if (mobile) Object.defineProperty(w, 'innerWidth', { value: 390 });
    w.NamelessSpaRouter = { controlsLifecycle: true };
    const calls = { images: [], markers: [], fetches: [], views: [], fits: 0, maps: [], rpc: [] };
    class Events {
        handlers = new Map();
        on(name, handler) { const list = this.handlers.get(name) || new Set(); list.add(handler); this.handlers.set(name, list); return this; }
        off(name) { if (name) this.handlers.delete(name); else this.handlers.clear(); return this; }
        fire(name, detail = {}) { for (const fn of [...(this.handlers.get(name) || [])]) fn(detail); return this; }
    }
    class MapMock extends Events {
        constructor(element, options) { super(); this.options = options; this.layers = new Set(); this.center = { lat: options.center[0], lng: options.center[1] }; this.zoom = options.zoom; this.element = element; calls.maps.push(this); }
        addLayer(layer) { this.layers.add(layer); layer.map = this; return this; }
        removeLayer(layer) { this.layers.delete(layer); return this; }
        fitBounds(bounds, options = {}) { calls.fits++; this.center = { lat: (bounds[0][0] + bounds[1][0]) / 2, lng: (bounds[0][1] + bounds[1][1]) / 2 }; this.zoom = options.maxZoom ?? -3; this.fire('moveend'); this.fire('zoomend'); return this; }
        setMaxBounds(bounds) { this.bounds = bounds; return this; }
        getCenter() { return this.center; }
        getZoom() { return this.zoom; }
        getMinZoom() { return this.options.minZoom; }
        getMaxZoom() { return this.options.maxZoom; }
        latLngToLayerPoint(coord) { return { x: coord[1] * Math.pow(2, this.zoom), y: coord[0] * Math.pow(2, this.zoom) }; }
        setView(coord, zoom) { this.center = { lat: coord[0], lng: coord[1] }; this.zoom = zoom; calls.views.push({ coord: [...coord], zoom }); this.fire('moveend'); this.fire('zoomend'); return this; }
        invalidateSize() { return this; }
        remove() { this.removed = true; this.layers.clear(); return this; }
    }
    class Layer extends Events {
        constructor(coord, options) { super(); this.coord = coord; this.options = options || {}; this.opacity = options?.opacity ?? 1; }
        addTo(target) { target.addLayer(this); return this; }
        setOpacity(value) { this.opacity = value; return this; }
        bindTooltip(value) { this.tooltip = value; return this; }
    }
    class Group extends Layer {
        layers = new Set();
        addLayer(layer) { this.layers.add(layer); return this; }
        clearLayers() { this.layers.clear(); return this; }
        eachLayer(fn) { this.layers.forEach(fn); return this; }
    }
    w.L = { CRS: { Simple: {} }, map: (element, options) => new MapMock(element, options), layerGroup: () => new Group(), divIcon: options => options,
        imageOverlay: (url, bounds, options) => { const layer = new Layer(bounds, options); layer.url = url; calls.images.push(layer); return layer; },
        marker: (coord, options) => { const layer = new Layer(coord, options); calls.markers.push(layer); return layer; } };
    w.fetch = async path => {
        calls.fetches.push(path); const id = /floor-(\d+)\.json/.exec(path)?.[1];
        if (waits[id]) await waits[id].promise;
        const value = copy(id ? data[id] : catalog);
        if (!id) value.index.push(...copy(extraEntities));
        if (!id && previews) for (const floor of value.floors.filter(floor => floor.id !== 1)) Object.assign(floor, { overview: '/assets/map-preview/floor-' + floor.id + '.webp', overviewMobile: '/assets/map-preview/floor-' + floor.id + '-mobile.webp', overviewWidth: floor.id === 2 ? 1400 : 1274, overviewMobileWidth: 768 });
        else for (const entity of extraEntities.filter(entity => entity.floor === Number(id))) { value.entities[entity.key] = copy(entity); value.points.push(entity.key); }
        return { ok: true, json: async () => value };
    };
    if (rpc) w.supabase = { rpc: async name => { calls.rpc.push(name); return rpc(name); }, auth: { getUser: async () => ({ data: { user: null } }) } };
    if (stored) w.localStorage.setItem('ironOathMapState', JSON.stringify(stored));
    if (deniedStorage) Object.defineProperty(w, 'localStorage', { get() { throw new Error('storage denied'); } });
    let lang = 'fr'; w.NamelessI18n = { getLanguage: () => lang, translate: value => value };
    w.eval(source);
    return { w, dom, calls, init: () => w.NamelessMapPage.init(), bridge: () => w.NamelessMapPage.active,
        language(value) { lang = value; w.document.dispatchEvent(new w.CustomEvent('nameless:languagechange')); },
        async floor(id) { const element = w.document.getElementById('floor-select'); element.value = String(id); element.dispatchEvent(new w.Event('change')); await tick(); },
        route(value, event = 'popstate') { w.history.pushState(null, '', value); (event === 'popstate' ? w : w.document).dispatchEvent(new w.Event(event)); },
        cleanup() { w.NamelessMapPage.destroy(); dom.window.close(); } };
}
{
    const p = page(); const bridge = await p.init();
    assert.equal(bridge.getFloor(), 1);
    assert.deepEqual(p.calls.fetches, ['/assets/map/catalog.json', '/assets/map/floor-1.json'], 'only the selected floor is fetched');
    assert.equal(p.calls.images[0].url, '/assets/carte-overview.webp');
    assert.equal(p.calls.images.length, 1, 'initial map only requests the overview');
    assert.equal(p.calls.maps[0].options.keyboard, true, 'Leaflet keyboard pan and zoom are enabled');
    assert.equal(p.w.document.querySelector('[data-marker-type="quest-primary"]').checked, false, 'quests start hidden');
    let markerCount; bridge.on('markers', event => { markerCount = event.markers.size; });
    bridge.setEditorMode(false); assert.equal(markerCount, 1, 'only default visible places have markers');
    await bridge.selectEntity(creature.key);
    assert.match(p.w.document.getElementById('map-panel-content').textContent, /Zone associée.*position exacte.*inconnue/);
    assert.equal(markerCount, 1, 'creature selection highlights its known zone without inventing a spawn');
    assert.match(p.w.location.search, /entity=creature%3A1/);
    const center = p.calls.views.at(-1).coord;
    assert.deepEqual(center, [5036 - .75 * 4951, 85 + .25 * 4951]);
    await bridge.selectEntity(unknown.key);
    assert.equal(p.w.document.querySelector('#map-panel-content img'), null, 'entity text cannot create HTML');
    assert.equal(p.w.document.querySelector('#map-panel-content a'), null, 'unsafe entity links are ignored');
    assert.deepEqual(p.calls.views.at(-1).coord, center, 'unknown coordinates do not move the map');
    await bridge.selectEntity(guide.key); assert.equal(markerCount, 2, 'known guide position appears only when selected');
    const filter = p.w.document.querySelector('[data-marker-type="quest-primary"]'); filter.checked = true; filter.dispatchEvent(new p.w.Event('change'));
    p.calls.markers.at(-2).fire('click');
    const shared = p.calls.markers.findLast(marker => marker.options.title?.includes('Quête partagée') && marker.options.title?.includes('Deuxième quête'));
    shared.fire('click');
    assert.equal(p.w.document.querySelectorAll('.map-choice').length, 3, 'same-coordinate places and quests open a choice list');
    const fits = p.calls.fits; p.w.document.getElementById('map-search-input').dispatchEvent(new p.w.KeyboardEvent('keydown', { key: '0', bubbles: true }));
    assert.equal(p.calls.fits, fits, 'zero outside map focus does not recenter');
    p.w.document.getElementById('game-map').dispatchEvent(new p.w.KeyboardEvent('keydown', { key: '0', bubbles: true })); assert.equal(p.calls.fits, fits + 1);
    assert.deepEqual([...bridge.getLatLng({ u: .5, v: .5 })], [2560.5, 2560.5]);
    assert.equal(bridge.getLatLng({ u: -1, v: .5 }), null);
    p.calls.maps[0].setView(center, 0);
    const detailed = p.calls.images.find(image => image.url === '/assets/carte.webp');
    assert.equal(detailed.opacity, 0, 'detail is invisible before load'); assert.equal(p.calls.images[0].opacity, 1);
    detailed.fire('load'); assert.equal(detailed.opacity, 1); assert.equal(p.calls.images[0].opacity, 0);
    await p.floor(2); await p.floor(1); p.calls.maps[0].setView(center, 0);
    assert.equal(p.calls.images.filter(image => image.url === '/assets/carte.webp').length, 1, 'loaded floor-one detail is reused on return');
    const before = p.calls.maps.length; await p.init(); assert.equal(p.calls.maps.length, before, 'init on the same root is idempotent');
    p.cleanup(); assert.equal(p.calls.maps[0].removed, true);
    assert.equal(p.calls.maps[0].handlers.size, 0, 'all Leaflet listeners are removed');
}
{
    const p = page({ mobile: true, deniedStorage: true }); await p.init();
    assert.equal(p.calls.images[0].url, '/assets/carte-overview-mobile.webp');
    p.calls.maps[0].setView([2560, 2560], -2); assert.equal(p.calls.images.some(image => image.url === '/assets/carte.webp'), true, 'mobile detail loads only after exceeding overview resolution');
    const detail = p.calls.images.find(image => image.url === '/assets/carte.webp'); await p.floor(2); detail.fire('load');
    assert.equal(detail.opacity, 0, 'a late detail load cannot cover another floor');
    assert.equal(p.calls.images.at(-1).url, '/assets/Palier2-map.webp');
    await p.floor(3); assert.equal(p.calls.images.at(-1).url, '/assets/Palier3-map.webp');
    assert.equal(p.w.document.getElementById('map-filters').childElementCount, 0, 'image-only floor has no invented categories');
    p.cleanup(); detail.fire('load'); assert.equal(detail.opacity, 0, 'destroyed views ignore late image responses');
}
{
    const p = page(); await p.init(); p.calls.maps[0].setView([2000, 2000], 0);
    const detail = p.calls.images.find(image => image.url === '/assets/carte.webp'); detail.fire('error');
    p.calls.maps[0].setView([2000, 2000], 1); p.calls.maps[0].setView([2000, 2000], 2);
    assert.equal(p.calls.images.filter(image => image.url === '/assets/carte.webp').length, 1, 'detail failure does not retry on every zoom');
    assert.equal(p.calls.images[0].opacity, 1, 'failed detail leaves the preview visible');
    p.cleanup();
}
{
    const p = page({ stored: { floor: 2, lat: 5121, lng: 0, zoom: 0 } }); await p.init();
    assert.equal(p.bridge().getFloor(), 2); assert.deepEqual(p.calls.views.at(-1), { coord: [5121, 0], zoom: 0 }, 'valid stored zero values are restored');
    p.route('/carte?floor=2&x=-40&y=-888'); await tick();
    assert.deepEqual(p.calls.views.at(-1).coord, [6009, -40], 'negative game coordinates retain the historic conversion');
    p.route('/carte?floor=2&x=0.5&y=-888.25'); await tick(); assert.deepEqual(p.calls.views.at(-1).coord, [6009.25, .5], 'finite decimal coordinates work');
    p.route('/carte?floor=3&x=12&y=30'); await tick(); assert.match(p.w.document.getElementById('map-route-status').textContent, /pas calibrées/);
    assert.equal(p.calls.views.at(-1).coord[0], 6009.25, 'uncalibrated floor never interprets X/Z');
    p.route('/carte?floor=1&boss=gorbel'); await tick(); assert.match(p.w.document.getElementById('map-panel-content').textContent, /Gorbel/);
    await p.floor(2); assert.equal(new URL(p.w.location.href).searchParams.has('boss'), false, 'manual floor changes clear old targets');
    p.route('/carte?floor=1&quest=q1', 'nameless:routechange'); await tick(); assert.equal(p.bridge().getFloor(), 1); assert.match(p.w.document.getElementById('map-panel-content').textContent, /Quête partagée/);
    p.cleanup();
}
{
    const wait2 = deferred(); const p = page({ waits: { 2: wait2 } }); await p.init();
    const search = p.w.document.getElementById('map-search-input'); search.value = 'Zone'; search.dispatchEvent(new p.w.Event('input'));
    assert.equal(p.w.document.querySelector('.search-result-item').dataset.entityKey, a.key, 'search prioritizes active floor');
    const request = p.bridge().selectEntity(b.key); await tick(); assert.equal(p.bridge().getFloor(), 2);
    await p.floor(3); wait2.resolve(); await request; await tick();
    assert.equal(p.bridge().getFloor(), 3, 'late floor response cannot undo a newer floor choice');
    assert.equal(p.w.document.getElementById('map-panel').hidden, true, 'late selection cannot reopen stale details');
    await p.bridge().selectEntity(b.key); assert.equal(p.bridge().getFloor(), 2); assert.match(p.w.document.getElementById('map-panel-content').textContent, /Zone Beta/);
    assert.equal(p.calls.fetches.filter(url => url.includes('floor-2')).length, 1, 'floor data is cached lazily');
    p.cleanup();
}
{
    const wait1 = deferred(); const p = page({ waits: { 1: wait1 } }); const initializing = p.init(); await tick(); p.w.NamelessMapPage.destroy(); wait1.resolve(); await initializing;
    assert.equal(p.w.NamelessMapPage.active, null, 'destroy during data load does not revive the page');
    assert.equal(p.calls.views.length, 0); p.dom.window.close();
}
{
    let result = { data: [{ id: 'hidden-a', entity_key: a.key, floor: 1, state: 'hidden', marker_type: 'zone', u: null, v: null }], error: null };
    const p = page({ rpc: () => result }); await p.init();
    assert.equal(p.bridge().getData().points.includes(a.key), false, 'hidden overrides suppress baseline markers');
    await p.bridge().selectEntity(a.key); assert.match(p.w.document.getElementById('map-panel-content').textContent, /masqué/);
    assert.equal(p.calls.views.length, 0, 'hidden markers do not gain an invented position');
    result = { data: [{ id: 'visible-a', entity_key: a.key, floor: 1, state: 'visible', marker_type: 'zone', u: .4, v: .4 }], error: null }; await p.bridge().reloadOverrides();
    assert.equal(p.bridge().getData().entities[a.key].position.source, 'override');
    result = { data: null, error: { code: '500', message: 'server down' } }; await p.bridge().reloadOverrides();
    assert.equal(p.bridge().getData().entities[a.key].position.u, .4, 'outages retain the last successful override snapshot');
    assert.match(p.w.document.getElementById('map-route-status').textContent, /indisponibles/);
    p.cleanup();
}
{
    const p = page({ rpc: () => ({ data: null, error: { code: '500', message: 'server down' } }) }); await p.init();
    assert.equal(p.bridge().getData().points.length, 0, 'first-read outage fails closed instead of resurrecting hidden baseline markers');
    await p.bridge().selectEntity(a.key); await p.bridge().selectEntity(creature.key); await p.bridge().selectEntity(guide.key);
    assert.equal(p.calls.views.length, 0, 'first-read outage also prevents baseline centering and selected markers');
    assert.equal(p.bridge().getData().entities[a.key].position, null);
    p.cleanup();
    const archived = page({ rpc: () => ({ data: null, error: { code: 'PGRST202', message: 'function missing' } }) }); await archived.init();
    assert.equal(archived.bridge().getData().points.includes(a.key), true, 'missing RPC preserves the public archival map'); archived.cleanup();
}
{
    const p = page({ url: '/carte?floor=2&entity=location%3A2%3Ab', stored: { floor: 1, lat: 100, lng: 100, zoom: 0 } }); await p.init();
    assert.equal(p.bridge().getFloor(), 2, 'URL takes priority over stored floor');
    p.language('en'); assert.match(p.w.document.getElementById('map-panel-content').textContent, /EN Zone Beta/); assert.equal(p.w.document.getElementById('map-recenter').textContent, 'Recenter');
    await p.w.document.getElementById('map-fullscreen').click(); await tick();
    assert.equal(p.w.document.getElementById('map-workspace').classList.contains('is-fullscreen'), true, 'fullscreen fallback contains the entire workspace');
    assert.equal(p.w.document.getElementById('map-panel').inert, undefined, 'details do not make the map inert');
    p.cleanup();
}
{
    const nearby = location('location:1:nearby', 1, 'Zone voisine', .254, .75);
    const p = page({ extraEntities: [nearby] }); await p.init();
    const group = [...p.bridge().map.layers].find(layer => layer.layers);
    assert.equal(group.layers.size, 1, 'nearby real positions form one visual group when zoomed out');
    const grouped = [...group.layers][0];
    assert.equal(grouped.options.title, 'Zone Alpha · Zone voisine');
    assert.deepEqual([...grouped.coord], [5036 - .75 * 4951, 85 + .25 * 4951], 'a proximity group anchors at a real entity position');
    grouped.fire('click');
    const choices = [...p.w.document.querySelectorAll('.map-choice')];
    assert.equal(choices.length, 2); choices[0].focus(); choices[0].dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    assert.equal(p.w.document.activeElement, choices[1], 'group choices support keyboard navigation');
    choices[1].click(); await tick();
    assert.match(p.w.document.getElementById('map-panel-content').textContent, /Zone voisine/);
    assert.deepEqual([...([...group.layers][0].coord)], [5036 - .75 * 4951, 85 + .254 * 4951], 'selected entity anchors its visual group');
    p.bridge().map.setView([2560, 2560], 2); assert.equal(group.layers.size, 2, 'the real positions separate when zoomed in');
    p.cleanup();
}
{
    const read = deferred(); const p = page({ url: '/carte?floor=1&entity=location%3A1%3Aa', rpc: () => read.promise });
    const initializing = p.init(); await tick(); await tick();
    assert.equal(p.calls.images[0].url, '/assets/carte-overview.webp', 'the map image mounts while the remote override RPC is pending');
    assert.equal(p.bridge().getData().points.length, 0, 'pending overrides keep baseline markers closed');
    assert.equal(p.w.document.getElementById('map-filters').classList.contains('is-ready'), false, 'pending filter space remains reserved');
    assert.equal(p.calls.markers.length, 0); assert.equal(p.calls.views.length, 0, 'pending overrides do not center on baseline target coordinates');
    read.resolve({ data: [{ id: 'a', entity_key: a.key, floor: 1, state: 'visible', marker_type: 'zone', u: .4, v: .4 }], error: null });
    await initializing;
    assert.deepEqual(p.calls.views.at(-1).coord, [5036 - .4 * 4951, 85 + .4 * 4951], 'a pending selection centers on the successful override');
    assert.equal(p.calls.markers.every(marker => marker.coord[1] !== 85 + .25 * 4951), true, 'the historical target position never flashes before its override');
    p.cleanup();
}
{
    const read = deferred(); const p = page({ url: '/carte?entity=location%3A1%3Aa', rpc: () => read.promise }); const initializing = p.init(); await tick(); await tick();
    read.resolve({ data: [{ id: 'a', entity_key: a.key, floor: 1, state: 'deleted', marker_type: 'zone', u: null, v: null }], error: null }); await initializing;
    assert.equal(p.calls.markers.length, 0, 'a tombstone cannot flash its archived baseline while RPC loads'); assert.equal(p.calls.views.length, 0); p.cleanup();
}
{
    const read = deferred(); const p = page({ url: '/carte?entity=location%3A1%3Aa', rpc: () => read.promise }); const initializing = p.init(); await tick(); await tick();
    await p.floor(3); read.resolve({ data: [], error: null }); await initializing;
    assert.equal(p.bridge().getFloor(), 3); assert.equal(p.calls.views.length, 0, 'late initial RPC does not center an old target after a manual floor change'); p.cleanup();
}
{
    const p = page({ url: '/carte?floor=2', previews: true }); await p.init();
    assert.equal(p.calls.images[0].url, '/assets/map-preview/floor-2.webp', 'floor two starts with its configured compressed preview');
    assert.equal(p.calls.images.length, 1);
    p.bridge().map.setView([5121, 0], -1); assert.equal(p.calls.images.length, 1, 'floor two detail waits for preview-resolution threshold');
    p.bridge().map.setView([5121, 0], 0);
    const detail = p.calls.images.find(image => image.url === '/assets/Palier2-map.webp'); assert.equal(detail.opacity, 0); assert.equal(p.calls.images[0].opacity, 1);
    await p.floor(3); detail.fire('load'); assert.equal(detail.opacity, 0, 'late floor-two detail cannot cover floor three');
    assert.equal(p.calls.images.at(-1).url, '/assets/map-preview/floor-3.webp');
    await p.floor(2); p.bridge().map.setView([5121, 0], 0);
    assert.equal(p.calls.images.filter(image => image.url === '/assets/Palier2-map.webp').length, 1, 'floor-two detail is reused from its own cache');
    assert.equal(detail.opacity, 1); assert.equal(p.calls.images.at(-1).opacity, 0);
    p.cleanup();
}
{
    const p = page({ url: '/carte?floor=2', previews: true }); await p.init(); p.bridge().map.setView([5121, 0], 0);
    const detail = p.calls.images.find(image => image.url === '/assets/Palier2-map.webp'); detail.fire('error');
    p.bridge().map.setView([5121, 0], 2); await p.floor(1); p.bridge().map.setView([2560, 2560], 0);
    assert.equal(p.calls.images.some(image => image.url === '/assets/carte.webp'), true, 'one failed floor does not block another floor’s detail');
    await p.floor(2); p.bridge().map.setView([5121, 0], 2);
    assert.equal(p.calls.images.filter(image => image.url === '/assets/Palier2-map.webp').length, 1, 'failed detail stays cached without zoom or floor-switch retry loops');
    assert.equal(p.calls.images.at(-1).opacity, 1, 'returning to a failed detail still shows that floor preview'); p.cleanup();
}
{
    const p = page({ url: '/carte?floor=3', previews: true, mobile: true }); await p.init();
    assert.equal(p.calls.images[0].url, '/assets/map-preview/floor-3-mobile.webp');
    assert.equal(p.w.document.getElementById('map-filters').classList.contains('is-ready'), true);
    p.bridge().map.setView([700, 600], -1); assert.equal(p.calls.images.length, 1);
    p.bridge().map.setView([700, 600], 0); const detail = p.calls.images.find(image => image.url === '/assets/Palier3-map.webp');
    assert.equal(detail.opacity, 0); p.cleanup(); detail.fire('load'); assert.equal(detail.opacity, 0, 'destroy detaches all floor detail callbacks');
}
{
    const p = page({ url: '/carte?floor=1&u=-0.1&v=1.1&zoom=-2' }); await p.init();
    const center = p.calls.views.at(-1).coord;
    assert.ok(Math.abs(center[0] - (5036 - 1.1 * 4951)) < .000001); assert.ok(Math.abs(center[1] - (85 - .1 * 4951)) < .000001, 'precise view parameters may restore allowed margins outside the image');
    assert.equal(p.bridge().getLatLng({ u: -.1, v: .5 }), null, 'admin draft coordinates remain limited to the image');
    p.route('/carte?floor=1&u=-0.5&v=1.1&zoom=-2'); await tick(); assert.equal(p.calls.views.length, 1, 'a center beyond maxBounds is rejected');
    p.route('/carte?floor=3&u=-0.1&v=0.5&zoom=-2'); await tick(); assert.equal(p.calls.views.length, 1, 'image-only floor bounds reject outside-image relative centers');
    p.cleanup();
}
{
    const p = page({ url: '/carte?floor=2' }); await p.init(); p.bridge().map.setView([6500, -1400], -2);
    p.w.document.getElementById('map-share').click(); await tick();
    const share = new URL(p.w.location.href); assert.ok(Number(share.searchParams.get('u')) < 0); assert.ok(Number(share.searchParams.get('v')) < 0);
    p.route('/carte?floor=1'); await tick(); p.route(share.pathname + share.search); await tick();
    const restored = p.calls.views.at(-1).coord;
    assert.ok(Math.abs(restored[0] - 6500) < .01 && Math.abs(restored[1] + 1400) < .01, 'shared margin views round-trip with normalized coordinates'); p.cleanup();
}
{
    const p = page(); await p.init(); await p.bridge().selectEntity(a.key);
    const close = p.w.document.getElementById('map-panel-close'); close.focus(); close.click();
    assert.equal(p.w.document.activeElement.id, 'game-map', 'Closing the focused details returns focus to the usable map');
    await p.bridge().selectEntity(a.key);
    const search = p.w.document.getElementById('map-search-input'); search.focus(); close.click();
    assert.equal(p.w.document.activeElement, search, 'Closing details from another control does not steal its focus');
    p.cleanup();
}
console.log('Map view: lazy floors, async navigation, truthful positions, URLs and margins, progressive images on all floors, visual groups, overrides, keyboard/focus and lifecycle passed.');
