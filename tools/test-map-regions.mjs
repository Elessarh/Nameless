// Isolated geometry, public access and administrator drafts; no network or database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const source = fs.readFileSync(new URL('../js/map-regions.js', import.meta.url), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const square = [{ u: .1, v: .1 }, { u: .3, v: .1 }, { u: .3, v: .3 }, { u: .1, v: .3 }];
const catalog = { floors: [
    { id: 1, originalImage: '/assets/carte.webp', image: '/assets/preview.webp', bounds: [[85, 85], [5036, 5036]] },
    { id: 2, originalImage: '/assets/Palier2-map.webp', bounds: [[3842, -1059], [6180, 1059]] }
], index: [{ key: 'location:1:alpha', kind: 'location', markerType: 'zone', floor: 1, title: 'Alpha', titleEn: 'EN Alpha' },
    { key: 'location:1:beta', kind: 'location', markerType: 'zone', floor: 1, title: 'Beta' },
    { key: 'location:2:gamma', kind: 'location', markerType: 'zone', floor: 2, title: 'Gamma' }] };
const region = { id: 'zone-alpha', entityKey: 'location:1:alpha', title: 'Zone Alpha', titleEn: 'Alpha zone', status: 'indicative', vertices: square, wikiUrl: '/wiki#zones' };
const seed = { schemaVersion: 1, coordinateSystem: 'image-relative-top-left', floors: [
    { floor: 1, imageId: '/assets/carte.webp', regions: [region] }, { floor: 2, imageId: '/assets/Palier2-map.webp', regions: [] }
] };
function page({ stored, wait, fetchError = false, reduced = false, documentSeed = seed, nativeCatalog = catalog, canEdit = false, remoteRows = [], remoteError = null, regionRevision } = {}) {
    const dom = new JSDOM('<main><label><input id="map-regions-toggle" type="checkbox" checked>Contours</label><button id="map-regions-tools">Dessiner</button><div id="map-region-list"></div><p id="map-region-status"></p><aside id="map-regions-editor" hidden></aside><div id="map"></div></main>',
        { url: 'https://nameless-sao.fr/carte', runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window, calls = { polygons: [], markers: [], fetches: [], rpc: [], fits: [], views: [], selections: [], editor: [], removes: [] };
    const handlers = new Map(); let floor = 1, dataFloor = 1, status = 'ready', lang = 'fr';
    const controller = new w.AbortController();
    const fixtureCatalog = clone(nativeCatalog);
    const entities = Object.fromEntries(fixtureCatalog.index.map(item => [item.key, clone(item)]));
    class Events {
        handlers = new Map();
        on(name, fn) { if (!this.handlers.has(name)) this.handlers.set(name, new Set()); this.handlers.get(name).add(fn); return this; }
        off(name, fn) { if (!name) this.handlers.clear(); else if (fn) this.handlers.get(name)?.delete(fn); else this.handlers.delete(name); return this; }
        fire(name, value) { for (const fn of [...(this.handlers.get(name) || [])]) fn(value); }
    }
    class MapMock extends Events {
        panes = new Map(); layers = new Set();
        createPane(name) { const pane = w.document.createElement('div'); this.panes.set(name, pane); return pane; }
        getPane(name) { return this.panes.get(name); }
        addLayer(layer) { this.layers.add(layer); return this; }
        removeLayer(layer) { this.layers.delete(layer); calls.removes.push(layer); layer.clearLayers?.(); return this; }
        fitBounds(bounds, options) { calls.fits.push({ bounds, options }); return this; }
        setView(center, zoom, options) { calls.views.push({ center: clone(center), zoom, options }); return this; }
        getMinZoom() { return -5; }
        getMaxZoom() { return 3; }
        invalidateSize() { return this; }
        stop() { return this; }
    }
    class Layer extends Events {
        constructor(coord, options) { super(); this.coord = coord; this.options = options || {}; this.element = w.document.createElement(options?.icon ? 'div' : 'span');
            this.element.className = options?.icon?.className || ''; if (options?.icon?.html) this.element.innerHTML = options.icon.html; w.document.getElementById('map').append(this.element); }
        addTo(target) { target.addLayer(this); return this; }
        getElement() { return this.element; }
        setStyle(options) { this.options = { ...this.options, ...options }; return this; }
        bindTooltip(value) { this.tooltip = value; return this; }
        getLatLng() { return { lat: this.coord[0], lng: this.coord[1] }; }
    }
    class Group {
        layers = new Set();
        addTo(target) { target.addLayer(this); return this; }
        addLayer(layer) { this.layers.add(layer); return this; }
        clearLayers() { for (const layer of this.layers) { layer.off?.(); layer.element?.remove(); } this.layers.clear(); return this; }
    }
    const map = new MapMock();
    w.L = { layerGroup: () => new Group(), divIcon: value => value, latLngBounds: value => value,
        polygon: (coord, options) => { const layer = new Layer(coord, options); calls.polygons.push(layer); return layer; },
        polyline: (coord, options) => new Layer(coord, options), marker: (coord, options) => { const layer = new Layer(coord, options); calls.markers.push(layer); return layer; } };
    w.matchMedia = () => ({ matches: reduced });
    w.NamelessI18n = { getLanguage: () => lang };
    w.supabase = { async rpc(name) {
        calls.rpc.push(name);
        assert.equal(name, 'read_map_regions', 'The region reader may not mutate remote state');
        return { data: clone(remoteRows), error: remoteError };
    } };
    w.fetch = async (url, options) => { calls.fetches.push({ url, options }); if (wait) await wait.promise; return { ok: !fetchError, status: fetchError ? 404 : 200, json: async () => clone(documentSeed) }; };
    if (stored) w.localStorage.setItem('nameless.map-regions.v1', JSON.stringify(stored));
    const bridge = { root: w.document.querySelector('main'), catalog: fixtureCatalog, map, signal: controller.signal, canEditRegions: () => canEdit, getRegionRevision: () => regionRevision,
        getFloor: () => floor, getData: () => dataFloor == null ? null : ({ floor: dataFloor, entities }), getOverridesStatus: () => status,
        getLatLng(value) { const [[south, west], [north, east]] = fixtureCatalog.floors.find(item => item.id === floor).bounds; return [north - value.v * (north - south), west + value.u * (east - west)]; },
        getRelative(value) { const [[south, west], [north, east]] = fixtureCatalog.floors.find(item => item.id === floor).bounds; return { u: (value.lng - west) / (east - west), v: (north - value.lat) / (north - south) }; },
        async selectEntity(key) { calls.selections.push(key); emit('selection', entities[key]); return true; },
        setRegionEditorMode(value) { calls.editor.push(value); },
        on(name, fn) { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name).add(fn); return () => handlers.get(name).delete(fn); } };
    const emit = (name, value) => { for (const fn of [...(handlers.get(name) || [])]) fn(value); };
    w.eval(source);
    const button = action => w.document.querySelector('[data-region-action="' + action + '"]');
    return { w, dom, bridge, calls, map, entities, emit, button, controller,
        init: () => w.NamelessMapRegions.init(bridge), api: () => w.NamelessMapRegions.active,
        beginFloor(id) { emit('floor-pending', { floor: id }); floor = id; dataFloor = null; },
        completeFloor() { dataFloor = floor; emit('floor', { floor }); },
        mismatchedFloor(id) { floor = id; dataFloor = id; },
        async floor(id) { this.beginFloor(id); this.completeFloor(); await tick(); },
        status(value) { status = value; emit('markers'); },
        language(value) { lang = value; w.document.dispatchEvent(new w.CustomEvent('nameless:languagechange')); },
        click(value) { const coord = bridge.getLatLng(value); map.fire('click', { latlng: { lat: coord[0], lng: coord[1] } }); },
        cleanup() { w.NamelessMapRegions.destroy(); dom.window.close(); } };
}
let passed = 0;
async function test(name, run) { await run(); passed++; console.log('PASS ' + name); }
await test('validated geometry rejects crossings, zero area, repeated points, boundaries and excessive vertices', () => {
    const p = page(), api = p.w.NamelessMapRegions;
    assert.deepEqual(clone(api.validateVertices(square)), square);
    for (const points of [square.slice(0, 2), [{ u: .1, v: .1 }, { u: .3, v: .3 }, { u: .3, v: .1 }, { u: .1, v: .3 }],
        [{ u: .1, v: .1 }, { u: .2, v: .2 }, { u: .3, v: .3 }], [...square, square[0]],
        [{ u: NaN, v: .1 }, ...square.slice(1)], [{ u: -.1, v: .1 }, ...square.slice(1)], Array.from({ length: 97 }, (_, i) => ({ u: i / 100, v: .1 }))]) assert.throws(() => api.validateVertices(points));
    assert.throws(() => api.validateVertices([{ u: .1, v: .1 }, { u: .4, v: .1 }, { u: .2, v: .1 }, { u: .4, v: .4 }, { u: .1, v: .4 }]));
    p.cleanup();
});
await test('schema is bound to original atlas identity and known floor zone keys', () => {
    const p = page(), validate = value => p.w.NamelessMapRegions.validateDocument(value, catalog);
    assert.deepEqual(clone(validate(seed)), seed);
    for (const mutation of [value => value.floors[0].imageId = '/assets/preview.webp', value => value.floors[0].regions[0].entityKey = 'location:2:gamma',
        value => value.floors[0].regions[0].status = 'unknown', value => value.floors[0].regions[0].wikiUrl = 'https://malicious.example/',
        value => value.floors.push(clone(value.floors[0])), value => value.floors[0].regions.push(clone(region))]) {
        const invalid = clone(seed); mutation(invalid); assert.throws(() => validate(invalid));
    }
    assert.throws(() => validate(JSON.parse('{"schemaVersion":1,"coordinateSystem":"image-relative-top-left","floors":[],"__proto__":{"polluted":true}}')));
    assert.equal({}.polluted, undefined); p.cleanup();
});
await test('schema preserves indicative, verified and draft states without accepting arbitrary publication labels', () => {
    const p = page();
    for (const status of ['indicative', 'verified', 'draft']) {
        const document = clone(seed); document.floors[0].regions[0].status = status;
        assert.equal(p.w.NamelessMapRegions.validateDocument(document, catalog).floors[0].regions[0].status, status);
    }
    p.cleanup();
});
await test('draft revision metadata accepts integer snapshots and rejects malformed conflict identifiers', () => {
    const p = page();
    for (const baseRevision of [0, 7]) {
        const document = clone(seed); document.floors[0].regions[0].baseRevision = baseRevision;
        assert.equal(p.w.NamelessMapRegions.validateDocument(document, catalog).floors[0].regions[0].baseRevision, baseRevision);
    }
    for (const baseRevision of [-1, 1.5, '7', NaN, Infinity]) {
        const document = clone(seed); document.floors[0].regions[0].baseRevision = baseRevision;
        assert.throws(() => p.w.NamelessMapRegions.validateDocument(document, catalog), /invalid_document/);
    }
    p.cleanup();
});
await test('public access cannot open, load or persist an editor, even with a forged editor button or local drafts', async () => {
    const stored = clone(seed); stored.floors[0].regions[0].title = 'Private administrator draft'; stored.floors[0].regions[0].vertices[0].u = .14;
    stored.floors[0].regions.push({ ...clone(region), id: 'private-unlinked-zone', entityKey: null, title: 'Private extra zone' });
    const p = page({ stored }); await p.init();
    const storageBefore = p.w.localStorage.getItem(p.w.NamelessMapRegions.STORAGE_KEY);
    assert.equal(p.api().getRegions().length, 1, 'Stored administrator drafts never create public polygons');
    assert.equal(p.api().getRegions()[0].title, region.title); assert.deepEqual(clone(p.api().getRegions()[0].vertices), square);
    assert.equal(p.api().editor.open('zone-alpha'), false); assert.equal(p.api().editor.load(region), false);
    p.w.document.getElementById('map-regions-tools').click(); p.click({ u: .6, v: .6 });
    assert.equal(p.w.document.getElementById('map-regions-editor').hidden, true);
    assert.equal(p.w.document.querySelectorAll('.map-region-vertex').length, 0); assert.equal(p.api().editor.getDraft(), null);
    assert.equal(p.api().editor.save(), false); assert.equal(p.api().editor.importDocument(stored), false);
    assert.equal(p.w.localStorage.getItem(p.w.NamelessMapRegions.STORAGE_KEY), storageBefore);
    assert.deepEqual(p.calls.editor, []); assert.deepEqual(p.calls.rpc, ['read_map_regions']); p.cleanup();
});
await test('editor permission requires an explicit boolean grant rather than a role label or missing bridge method', async () => {
    for (const canEdit of [false, 'admin', 1]) {
        const p = page({ canEdit }); await p.init(); assert.equal(p.api().editor.open(), false); p.cleanup();
    }
    const p = page(); delete p.bridge.canEditRegions; await p.init(); assert.equal(p.api().editor.open(), false); p.cleanup();
});
await test('published region rows replace matching seeded entities and carry their verified geometry into selection', async () => {
    const vertices = square.map(point => ({ u: point.u + .04, v: point.v + .02 }));
    const row = { floor: 1, image_id: '/assets/carte.webp', region_id: 'published-alpha', entity_key: region.entityKey, status: 'verified', visible: true, vertices };
    const p = page({ remoteRows: [row] }); await p.init();
    const records = p.api().getRegions(); assert.equal(records.length, 1); assert.equal(records[0].id, row.region_id);
    assert.equal(records[0].published, true); assert.equal(records[0].status, 'verified'); assert.deepEqual(clone(records[0].vertices), vertices);
    assert.match(p.w.document.querySelector('.map-region-choice').textContent, /Vérifié/);
    assert.equal(await p.api().select('zone-alpha'), false, 'The replaced seed no longer remains selectable under its old identifier');
    assert.equal(await p.api().select('published-alpha'), true); assert.deepEqual(clone(p.calls.fits.at(-1).bounds), vertices.map(point => p.bridge.getLatLng(point)));
    assert.deepEqual(p.calls.rpc, ['read_map_regions']); assert.deepEqual(region.vertices, square); assert.equal(p.w.localStorage.length, 0); p.cleanup();
});
await test('shared tombstones and unpublished rows suppress matching seed outlines while missing service retains proposals', async () => {
    for (const row of [
        { floor: 1, region_id: 'removed-alpha', entity_key: region.entityKey, visible: false, status: 'verified' },
        { floor: 1, region_id: 'draft-alpha', entity_key: region.entityKey, visible: true, status: 'draft' }
    ]) {
        const p = page({ remoteRows: [row] }); await p.init();
        assert.equal(p.api().getRegions().length, 0); assert.equal(p.w.document.querySelectorAll('.map-region-choice,.map-region-outline').length, 0);
        assert.equal(await p.api().select('zone-alpha'), false); p.cleanup();
    }
    const p = page({ remoteError: { code: 'PGRST202', message: 'Function missing' } }); await p.init();
    assert.equal(p.api().getRegions().length, 1); assert.equal(p.api().getRegions()[0].status, 'indicative');
    assert.equal(p.api().editor.open(), false); assert.equal(p.w.localStorage.length, 0); p.cleanup();
});
await test('a failed published-region service hides seed polygons despite healthy markers and explains the outage', async () => {
    const p = page({ remoteError: { status: 500, code: 'XX000', message: 'Region reader unavailable' } }); await p.init();
    assert.equal(p.bridge.getOverridesStatus(), 'ready', 'Marker health cannot validate unavailable published-region state');
    assert.equal(p.api().getRegions().length, 0); assert.equal(p.w.document.querySelectorAll('.map-region-choice,.map-region-outline').length, 0);
    assert.equal(await p.api().select('zone-alpha'), false, 'A hidden or deleted published outline must not reappear as a seed fallback');
    assert.match(p.w.document.getElementById('map-region-status').textContent, /limites publiées.*pas disponibles/i);
    p.w.document.getElementById('map-regions-toggle').click(); p.w.document.getElementById('map-regions-toggle').click();
    p.emit('markers'); p.language('en');
    assert.equal(p.w.document.querySelectorAll('.map-region-outline').length, 0);
    assert.match(p.w.document.getElementById('map-region-status').textContent, /published boundaries.*unavailable/i);
    assert.equal(p.w.localStorage.length, 0); p.cleanup();
});
await test('an absent region RPC preserves all twelve labelled original-atlas proposals without exposing the editor', async () => {
    const actualCatalog = JSON.parse(fs.readFileSync(new URL('../assets/map/catalog.json', import.meta.url), 'utf8'));
    const actualSource = JSON.parse(fs.readFileSync(new URL('../data/map-regions.json', import.meta.url), 'utf8'));
    const p = page({ documentSeed: actualSource, nativeCatalog: actualCatalog, remoteError: { code: 'PGRST202', message: 'Function missing' } }); await p.init();
    assert.equal(p.api().getRegions().length, 12); assert.equal(p.w.document.querySelectorAll('.map-region-outline').length, 12);
    assert.equal(p.w.document.querySelectorAll('.map-region-choice').length, 12);
    assert.ok(p.api().getRegions().every(record => record.status === 'indicative' && record.local === false && !record.published));
    assert.equal(p.api().editor.open(), false); assert.equal(p.w.localStorage.length, 0); p.cleanup();
});
await test('all twelve actual proposals use real zone keys and valid original-atlas geometry', () => {
    const p = page(), actualCatalog = JSON.parse(fs.readFileSync(new URL('../assets/map/catalog.json', import.meta.url), 'utf8'));
    const actualSource = JSON.parse(fs.readFileSync(new URL('../data/map-regions.json', import.meta.url), 'utf8'));
    const actualFloor = JSON.parse(fs.readFileSync(new URL('../assets/map/floor-1.json', import.meta.url), 'utf8'));
    const validated = p.w.NamelessMapRegions.validateDocument(actualSource, actualCatalog);
    assert.equal(validated.floors.find(floor => floor.floor === 1).regions.length, 12);
    assert.equal(validated.floors.find(floor => floor.floor === 2).regions.length, 0);
    assert.equal(validated.floors.find(floor => floor.floor === 3).regions.length, 0);
    assert.ok(validated.floors[0].regions.every(region => region.status === 'indicative' && region.entityKey));
    for (const proposal of validated.floors[0].regions) {
        const anchor = actualFloor.entities[proposal.entityKey]?.position;
        assert.ok(anchor, 'the real anchor exists: ' + proposal.entityKey);
        assert.equal(p.w.NamelessMapRegions.containsPoint(proposal.vertices, anchor), true, 'the proposal contains its actual anchor: ' + proposal.entityKey);
    }
    p.cleanup();
});
await test('accent-free region filtering matches the actual Vallée proposal without changing its source identity', async () => {
    const actualCatalog = JSON.parse(fs.readFileSync(new URL('../assets/map/catalog.json', import.meta.url), 'utf8'));
    const actualSeed = JSON.parse(fs.readFileSync(new URL('../data/map-regions.json', import.meta.url), 'utf8'));
    const valley = actualSeed.floors[0].regions.find(region => region.entityKey === 'location:1:vallee-loups');
    assert.ok(valley); const immutable = JSON.stringify(valley);
    const p = page({ documentSeed: actualSeed, nativeCatalog: actualCatalog }); await p.init();
    p.api().filter('vallee');
    let choices = p.w.document.querySelectorAll('.map-region-choice'), paths = p.w.document.querySelectorAll('.map-region-outline');
    assert.equal(choices.length, 1); assert.equal(paths.length, 1);
    assert.equal(choices[0].dataset.regionId, valley.id); assert.equal(paths[0].dataset.regionId, valley.id); assert.match(choices[0].textContent, /Vallée/);
    p.api().filter('VALLÉE'); assert.equal(p.w.document.querySelector('.map-region-choice').dataset.regionId, valley.id);
    p.language('en'); p.api().filter('wolf valley');
    choices = p.w.document.querySelectorAll('.map-region-choice'); assert.equal(choices.length, 1); assert.equal(choices[0].dataset.regionId, valley.id); assert.match(choices[0].textContent, /Wolf Valley/);
    const unchanged = p.api().getRegions().find(region => region.id === valley.id);
    assert.equal(unchanged.entityKey, valley.entityKey); assert.deepEqual(clone(unchanged.vertices), valley.vertices);
    assert.equal(unchanged.title, valley.title); assert.equal(unchanged.status, 'indicative'); assert.equal(JSON.stringify(valley), immutable);
    assert.equal(p.w.localStorage.length, 0); p.cleanup();
});
function cameraFixture({ canEdit = false } = {}) {
    const cameraCatalog = clone(catalog), cameraSeed = clone(seed);
    cameraCatalog.index.push({ key: 'location:1:charlie', kind: 'location', markerType: 'zone', floor: 1, title: 'Charlie' });
    const beta = { ...clone(region), id: 'zone-beta', entityKey: 'location:1:beta', title: 'Zone Beta', vertices: square.map(point => ({ u: point.u + .3, v: point.v })) };
    const charlie = { ...clone(region), id: 'zone-charlie', entityKey: 'location:1:charlie', title: 'Zone Charlie', vertices: square.map(point => ({ u: point.u + .6, v: point.v })) };
    cameraSeed.floors[0].regions.push(beta, charlie);
    return { p: page({ documentSeed: cameraSeed, nativeCatalog: cameraCatalog, canEdit }), beta, charlie };
}
await test('selections during an active zoom queue only the newest region camera until zoomend', async () => {
    const { p, charlie } = cameraFixture(); await p.init(); await p.api().select('zone-alpha');
    const previousFits = p.calls.fits.length; p.map.fire('zoomstart');
    await p.api().select('zone-beta'); await p.api().select('zone-charlie');
    assert.equal(p.calls.fits.length, previousFits, 'an active CSS zoom must finish before a new camera fit');
    assert.equal(p.calls.selections.at(-1), 'location:1:charlie');
    assert.equal(p.w.document.querySelector('.map-region-choice.is-selected').dataset.regionId, charlie.id);
    p.map.fire('zoomend'); assert.equal(p.calls.fits.length, previousFits + 1);
    assert.deepEqual(clone(p.calls.fits.at(-1).bounds), charlie.vertices.map(point => p.bridge.getLatLng(point)));
    assert.equal(p.calls.fits.at(-1).options.animate, true, 'ordinary public selection keeps its animation');
    p.map.fire('zoomend'); assert.equal(p.calls.fits.length, previousFits + 1, 'a finished queue is not replayed'); p.cleanup();
});
await test('stale selection, floor changes, editor opening and abort cancel queued region cameras', async () => {
    const { p } = cameraFixture({ canEdit: true }); await p.init(); await p.api().select('zone-alpha');
    let fitCount = p.calls.fits.length;
    p.map.fire('zoomstart'); await p.api().select('zone-beta'); p.emit('selection', p.entities['location:1:alpha']); p.map.fire('zoomend');
    assert.equal(p.calls.fits.length, fitCount, 'a native selection supersedes the old queued region');
    p.map.fire('zoomstart'); await p.api().select('zone-beta'); p.beginFloor(2); p.map.fire('zoomend');
    assert.equal(p.calls.fits.length, fitCount, 'a queued camera cannot cross atlas floors');
    p.completeFloor(); await p.floor(1);
    p.map.fire('zoomstart'); await p.api().select('zone-beta'); p.api().editor.open('zone-alpha'); fitCount = p.calls.fits.length; p.map.fire('zoomend');
    assert.equal(p.calls.fits.length, fitCount, 'opening the local editor discards a previously queued public camera');
    p.api().editor.close(); p.map.fire('zoomstart'); await p.api().select('zone-charlie'); fitCount = p.calls.fits.length; p.controller.abort(); p.map.fire('zoomend');
    assert.equal(p.calls.fits.length, fitCount, 'an aborted lifecycle cannot move the old map');
    assert.equal(p.map.handlers.get('zoomstart')?.size || 0, 0); assert.equal(p.map.handlers.get('zoomend')?.size || 0, 0); p.cleanup();
});
await test('a queued region becoming pending, failed, hidden or deleted never fits after zoomend', async () => {
    const { p } = cameraFixture(); await p.init(); await p.api().select('zone-alpha'); const fitCount = p.calls.fits.length;
    for (const status of ['pending', 'error']) {
        p.map.fire('zoomstart'); await p.api().select('zone-beta'); p.status(status); p.map.fire('zoomend');
        assert.equal(p.calls.fits.length, fitCount, 'pending camera cannot reveal a region during overrides status ' + status); p.status('ready');
    }
    for (const unavailable of ['hidden', 'deleted']) {
        p.map.fire('zoomstart'); await p.api().select('zone-beta'); p.entities['location:1:beta'].overrideState = unavailable; p.emit('markers'); p.map.fire('zoomend');
        assert.equal(p.calls.fits.length, fitCount, 'pending camera cannot reveal a region whose override is ' + unavailable);
        delete p.entities['location:1:beta'].overrideState; p.emit('markers');
    }
    p.cleanup();
});
await test('exact shared views replace queued region fits and are cancelled by URL, floor or selection changes', async () => {
    const { p } = cameraFixture(); await p.init(); await p.api().select('zone-alpha'); const fitCount = p.calls.fits.length;
    const center = [4200, 1230], zoom = -.75;
    p.map.fire('zoomstart'); await p.api().select('zone-beta'); p.api().cancelCamera(); p.api().restoreView(center, zoom);
    assert.equal(p.calls.views.length, 0, 'the exact shared view waits for the current zoom to finish');
    p.map.fire('zoomend'); assert.equal(p.calls.views.length, 1); assert.deepEqual(p.calls.views[0].center, center); assert.equal(p.calls.views[0].zoom, zoom);
    assert.equal(p.calls.fits.length, fitCount, 'the old region fit cannot overwrite the exact shared coordinates');
    p.map.fire('zoomend'); assert.equal(p.calls.views.length, 1, 'the exact view is applied once');
    p.map.fire('zoomstart'); p.api().cancelCamera(); p.api().restoreView(center, zoom); p.w.history.pushState(null, '', '/carte?floor=1&u=.5&v=.5'); p.map.fire('zoomend');
    assert.equal(p.calls.views.length, 1, 'a changed URL supersedes the queued shared view');
    p.map.fire('zoomstart'); p.api().cancelCamera(); p.api().restoreView(center, zoom); p.emit('selection', p.entities['location:1:charlie']); p.map.fire('zoomend');
    assert.equal(p.calls.views.length, 1, 'a new entity selection supersedes the queued shared view');
    p.map.fire('zoomstart'); p.api().cancelCamera(); p.api().restoreView(center, zoom); p.beginFloor(2); p.map.fire('zoomend');
    assert.equal(p.calls.views.length, 1, 'a shared view cannot cross a changed atlas floor');
    assert.equal(p.calls.fits.length, fitCount); p.cleanup();
});
await test('coordinate conversion preserves original atlas bounds and overlay selection fits geometry', async () => {
    const p = page({ reduced: true }), boundsBefore = JSON.stringify(p.bridge.catalog.floors); await p.init();
    assert.equal(p.w.document.querySelectorAll('.map-region-outline').length, 1, 'Refreshing published data leaves one active outline');
    const currentPolygon = p.calls.polygons.at(-1); assert.equal(currentPolygon.options.pane, 'nameless-regions');
    assert.deepEqual(currentPolygon.coord[0], [4540.9, 580.1]);
    assert.equal(p.map.getPane('nameless-regions').style.zIndex, '450');
    await p.api().select('zone-alpha');
    assert.deepEqual(p.calls.selections, ['location:1:alpha']); assert.equal(p.calls.fits.at(-1).options.animate, false);
    assert.equal(p.w.document.querySelector('[data-region-id="zone-alpha"]').getAttribute('aria-pressed'), 'true');
    assert.equal(JSON.stringify(p.bridge.catalog.floors), boundsBefore);
    assert.deepEqual(p.calls.fetches.map(value => value.url), ['/assets/map/regions.json']); p.cleanup();
});
await test('hidden, deleted, unavailable and pending entities never become public polygons', async () => {
    const p = page(); await p.init();
    for (const status of ['pending', 'error']) { p.status(status); assert.equal(p.w.document.querySelectorAll('.map-region-choice').length, 0); assert.equal(await p.api().select('zone-alpha'), false); }
    p.status('ready');
    for (const state of ['hidden', 'deleted', 'unavailable']) { p.entities['location:1:alpha'].overrideState = state; p.emit('markers'); assert.equal(p.w.document.querySelectorAll('.map-region-choice').length, 0); }
    delete p.entities['location:1:alpha'].overrideState; p.emit('markers'); assert.equal(p.w.document.querySelectorAll('.map-region-choice').length, 1); p.cleanup();
});
await test('the native checkbox stays synchronized across marker refreshes, language and floor changes', async () => {
    const p = page(); await p.init(); const toggle = p.w.document.getElementById('map-regions-toggle');
    assert.equal(toggle.checked, true); assert.equal(toggle.hasAttribute('aria-pressed'), false);
    toggle.click(); assert.equal(toggle.checked, false); assert.equal(p.w.document.querySelectorAll('.map-region-outline').length, 0);
    p.emit('markers'); p.language('en'); await p.floor(2); await p.floor(1);
    assert.equal(toggle.checked, false); assert.equal(p.w.document.querySelectorAll('.map-region-outline').length, 0);
    toggle.click(); assert.equal(toggle.checked, true); assert.equal(p.w.document.querySelectorAll('.map-region-outline').length, 1); p.cleanup();
});
await test('delayed or failed floor changes cannot reopen or save a previous-atlas draft', async () => {
    const p = page({ canEdit: true }); await p.init(); p.api().editor.open(); p.api().editor.save();
    const stored = p.w.localStorage.getItem(p.w.NamelessMapRegions.STORAGE_KEY);
    p.beginFloor(2);
    assert.equal(p.api().editor.open('zone-alpha'), false); assert.equal(p.api().editor.save(), false);
    assert.equal(await p.api().select('zone-alpha'), false); assert.equal(p.api().getRegions().length, 0);
    assert.equal(p.w.document.getElementById('map-regions-tools').disabled, true);
    assert.equal(p.w.document.querySelectorAll('.map-region-outline,.map-region-vertex').length, 0);
    p.emit('markers'); p.language('en'); p.emit('floor', { floor: 1 }); await tick();
    assert.equal(p.api().editor.open(), false, 'failed or stale floor readiness does not release the pending guard');
    assert.equal(p.api().editor.save(), false); assert.equal(p.w.localStorage.getItem(p.w.NamelessMapRegions.STORAGE_KEY), stored);
    p.completeFloor(); assert.equal(p.api().editor.open(), true); assert.equal(p.api().editor.getDraft().vertices.length, 0);
    assert.equal(p.api().editor.save(), false, 'the new floor has no draft geometry copied from the old atlas');
    await p.floor(1); assert.equal(p.api().getRegions()[0].local, true); p.cleanup();
});
await test('an unexpected bridge floor mismatch independently blocks contour save and export', async () => {
    const p = page({ canEdit: true }); await p.init(); p.api().editor.open(); const before = clone(p.api().editor.getDraft());
    p.mismatchedFloor(2); assert.equal(p.api().editor.save(), false); assert.equal(p.api().editor.open(), false);
    assert.equal(p.api().editor.importDocument(seed), false); assert.throws(() => p.api().editor.exportDocument(), /atlas_identity/);
    assert.equal(p.api().editor.undo(), false); assert.deepEqual(clone(p.api().editor.getDraft()), before);
    assert.equal(p.w.localStorage.length, 0); p.cleanup();
});
await test('drawing, geometric error reporting, undo, redo and three-vertex deletion work through real controls', async () => {
    const p = page({ canEdit: true }); await p.init(); p.api().editor.open('zone-alpha'); p.button('clear').click();
    for (const point of [{ u: .1, v: .1 }, { u: .3, v: .3 }, { u: .3, v: .1 }, { u: .1, v: .3 }]) p.click(point);
    p.button('finish').click(); assert.match(p.w.document.querySelector('.map-region-message').textContent, /se croise/);
    p.button('clear').click(); square.forEach(point => p.click(point)); p.button('finish').click();
    assert.equal(p.w.document.getElementById('map-regions-editor').dataset.mode, 'edit');
    const handle = p.w.document.querySelectorAll('.map-region-vertex')[0]; handle.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    assert.equal(p.api().editor.getDraft().vertices[0].u, .101);
    p.button('undo').click(); assert.equal(p.api().editor.getDraft().vertices[0].u, .1);
    p.button('redo').click(); assert.equal(p.api().editor.getDraft().vertices[0].u, .101);
    p.button('add-vertex').click(); assert.equal(p.api().editor.getDraft().vertices.length, 5);
    p.button('delete-vertex').click(); p.button('delete-vertex').click(); assert.equal(p.api().editor.getDraft().vertices.length, 3);
    assert.equal(p.button('delete-vertex').disabled, true);
    p.w.document.querySelector('.map-region-vertex').dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    assert.equal(p.api().editor.getDraft().vertices.length, 3); p.cleanup();
});
await test('outline tools progress from choosing a zone to drawing, closing and adjusting without active irrelevant actions', async () => {
    const p = page({ canEdit: true }); await p.init(); p.api().editor.open('zone-alpha');
    assert.equal(p.button('finish').hidden, true); assert.equal(p.button('finish').disabled, true);
    assert.equal(p.w.document.querySelector('.map-region-identity').open, false);
    const advanced = p.w.document.querySelector('.map-region-advanced'); assert.equal(advanced.open, false);
    for (const action of ['import', 'export', 'reset', 'clear']) assert.equal(p.button(action).closest('details'), advanced);
    assert.equal(p.w.document.querySelector('.map-region-vertex-actions').hidden, true);
    p.button('new').click(); assert.equal(p.w.document.querySelector('.map-region-identity').open, true);
    assert.equal(p.button('finish').hidden, false); assert.equal(p.button('finish').disabled, true);
    assert.equal(p.button('edit').disabled, true); assert.equal(p.button('save').disabled, true);
    square.slice(0, 2).forEach(point => p.click(point)); assert.equal(p.button('finish').disabled, true);
    p.click(square[2]); assert.equal(p.button('finish').disabled, false); assert.equal(p.button('save').disabled, true);
    p.button('finish').click(); assert.equal(p.button('finish').hidden, true); assert.equal(p.button('save').disabled, false);
    p.button('undo').click(); assert.equal(p.button('finish').hidden, false); assert.equal(p.button('edit').disabled, true);
    p.button('redo').click(); p.button('finish').click();
    p.calls.markers.at(-3).fire('click'); assert.equal(p.w.document.querySelector('.map-region-vertex-actions').hidden, false);
    assert.equal(p.button('add-vertex').disabled, false); assert.equal(p.button('delete-vertex').disabled, true);
    p.cleanup();
});
await test('drawing mode does not allow adjustment shortcuts to mutate points until the outline is closed', async () => {
    const p = page({ canEdit: true }); await p.init(); p.api().editor.open('zone-alpha'); p.button('draw').click();
    const before = clone(p.api().editor.getDraft());
    const handle = p.w.document.querySelector('.map-region-vertex');
    handle.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    handle.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    assert.deepEqual(clone(p.api().editor.getDraft()), before);
    p.button('finish').click();
    p.w.document.querySelector('.map-region-vertex').dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    assert.equal(p.api().editor.getDraft().vertices[0].u, .101); p.cleanup();
});
await test('opening a contour fits above the mobile sheet without moving the map on vertex edits', async () => {
    const p = page({ reduced: true, canEdit: true }); await p.init();
    Object.defineProperty(p.w, 'innerWidth', { value: 390, configurable: true });
    p.w.document.getElementById('map-regions-editor').getBoundingClientRect = () => ({ height: 330 });
    p.api().editor.open('zone-alpha');
    assert.deepEqual(clone(p.calls.fits.at(-1).options.paddingTopLeft), [20, 20]);
    assert.deepEqual(clone(p.calls.fits.at(-1).options.paddingBottomRight), [20, 350]);
    assert.equal(p.calls.fits.at(-1).options.maxZoom, 0); assert.equal(p.calls.fits.at(-1).options.animate, false);
    const fitCount = p.calls.fits.length;
    p.w.document.querySelector('.map-region-vertex').dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    assert.equal(p.calls.fits.length, fitCount, 'vertex editing does not recenter the canvas');
    p.api().editor.close(); Object.defineProperty(p.w, 'innerWidth', { value: 1920, configurable: true }); p.api().editor.open('zone-alpha');
    assert.deepEqual(clone(p.calls.fits.at(-1).options.paddingBottomRight), [20, 20]); p.cleanup();
});
await test('save is explicit, browser-only, restores on reload and resets to the original proposal', async () => {
    const p = page({ canEdit: true }); await p.init(); p.api().editor.open('zone-alpha');
    p.w.document.querySelector('.map-region-vertex').dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    assert.equal(p.w.localStorage.getItem(p.w.NamelessMapRegions.STORAGE_KEY), null);
    assert.equal(p.api().editor.save(), true);
    const stored = JSON.parse(p.w.localStorage.getItem(p.w.NamelessMapRegions.STORAGE_KEY));
    assert.equal(stored.floors[0].regions[0].vertices[0].u, .101);
    assert.equal(p.api().getRegions()[0].local, true); assert.match(p.w.document.querySelector('.map-region-message').textContent, /ce navigateur uniquement/);
    const exported = clone(p.api().editor.exportDocument()); assert.equal(exported.floors[0].regions[0].local, undefined); assert.equal(exported.floors[0].regions[0].status, 'indicative');
    p.cleanup(); const restored = page({ stored, canEdit: true }); await restored.init();
    assert.equal(restored.api().getRegions()[0].vertices[0].u, .101); restored.api().editor.open('zone-alpha'); assert.equal(restored.api().editor.reset(), true);
    assert.equal(restored.api().getRegions()[0].vertices[0].u, .1); assert.equal(restored.api().getRegions()[0].local, false); restored.cleanup();
});
await test('administrator saves retain the publication revision through local storage, export and restored drafts', async () => {
    const p = page({ canEdit: true, regionRevision: 7 }); await p.init(); assert.equal(p.api().editor.open('zone-alpha'), true);
    p.w.document.querySelector('.map-region-vertex').dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    assert.equal(p.api().editor.save(), true);
    const stored = JSON.parse(p.w.localStorage.getItem(p.w.NamelessMapRegions.STORAGE_KEY));
    assert.equal(stored.floors[0].regions[0].baseRevision, 7);
    assert.equal(p.api().editor.exportDocument().floors[0].regions[0].baseRevision, 7);
    p.cleanup();
    const restored = page({ canEdit: true, stored }); await restored.init();
    assert.equal(restored.api().getRegions()[0].baseRevision, 7); assert.equal(restored.api().getRegions()[0].vertices[0].u, .101);
    assert.equal(restored.api().editor.open('zone-alpha'), true); assert.equal(restored.api().editor.getDraft().baseRevision, 7);
    restored.cleanup();
});
await test('imports are staged, safe text remains literal, invalid input is atomic and replacing entity does not duplicate', async () => {
    const p = page({ canEdit: true }); await p.init(); p.api().editor.open(); const imported = clone(seed);
    imported.floors[0].regions[0].id = 'custom-alias'; imported.floors[0].regions[0].title = '<img src=x onerror=alert(1)>'; imported.floors[0].regions[0].vertices[0].u = .09;
    assert.equal(p.api().editor.importDocument(imported), true); assert.equal(p.w.localStorage.length, 0);
    assert.equal(p.w.document.querySelector('#map-regions-editor img'), null); assert.equal(p.w.document.querySelector('.map-region-name').value, '<img src=x onerror=alert(1)>');
    const before = clone(p.api().editor.getDraft()), invalid = clone(imported); invalid.floors[0].regions[0].vertices[0].u = 3;
    assert.equal(p.api().editor.importDocument(invalid), false); assert.deepEqual(clone(p.api().editor.getDraft()), before);
    assert.equal(p.api().editor.save(), true); assert.equal(p.api().getRegions().length, 1); assert.equal(p.api().getRegions()[0].id, 'zone-alpha');
    p.cleanup();
});
await test('floor changes cancel handles and pending imports while keeping saved local contours', async () => {
    const p = page({ canEdit: true }); await p.init(); p.api().editor.open(); p.api().editor.save();
    const pending = deferred(), input = p.w.document.querySelector('.map-region-file');
    Object.defineProperty(input, 'files', { value: [{ size: 20, text: () => pending.promise }] }); input.dispatchEvent(new p.w.Event('change'));
    await p.floor(2); assert.equal(p.w.document.querySelectorAll('.map-region-vertex').length, 0); assert.equal(p.w.document.getElementById('map-regions-editor').hidden, true);
    pending.resolve(JSON.stringify(seed)); await tick(); assert.equal(p.w.document.getElementById('map-regions-editor').hidden, true);
    await p.floor(1); assert.equal(p.api().getRegions()[0].local, true); assert.equal(p.calls.editor.at(-1), false); p.cleanup();
});
await test('reopening and language changes do not stack controls, and Escape restores opener focus', async () => {
    const p = page({ canEdit: true }); await p.init(); const open = p.w.document.getElementById('map-regions-tools'); open.focus(); open.click();
    p.button('close').click(); assert.equal(p.w.document.activeElement, open); open.click(); p.language('en');
    assert.equal(p.w.document.querySelector('.map-region-name').value, 'Zone Alpha'); assert.equal(p.button('save').textContent, 'Save draft');
    p.button('clear').click(); square.forEach(point => p.click(point)); const before = p.api().editor.getDraft().vertices.length;
    p.button('undo').click(); assert.equal(p.api().editor.getDraft().vertices.length, before - 1, 'one click performs exactly one undo');
    p.w.document.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(p.w.document.getElementById('map-regions-editor').hidden, true); assert.equal(p.w.document.activeElement, open); p.cleanup();
});
await test('legend and modal dialog shortcuts preserve the underlying unsaved editor draft', async () => {
    const p = page({ canEdit: true }); await p.init(); p.api().editor.open(); p.button('clear').click(); square.forEach(point => p.click(point));
    const before = clone(p.api().editor.getDraft()), legend = p.w.document.createElement('dialog');
    legend.id = 'map-legend'; legend.setAttribute('open', ''); const close = p.w.document.createElement('button'); close.textContent = 'Fermer'; legend.append(close); p.w.document.body.append(legend); close.focus();
    close.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(p.w.document.getElementById('map-regions-editor').hidden, false);
    close.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
    assert.deepEqual(clone(p.api().editor.getDraft()), before, 'legend shortcuts cannot edit the underlying contour history');
    legend.remove(); const modal = p.w.document.createElement('div'); modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.append(close); p.w.document.body.append(modal); close.focus();
    close.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(p.w.document.getElementById('map-regions-editor').hidden, false); modal.remove(); p.w.document.querySelector('.map-region-name').focus();
    const handled = new p.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); handled.preventDefault(); p.w.document.dispatchEvent(handled);
    assert.equal(p.w.document.getElementById('map-regions-editor').hidden, false, 'a handled shortcut belongs to the previous listener');
    assert.deepEqual(clone(p.api().editor.getDraft()), before); assert.equal(p.w.localStorage.length, 0);
    p.w.document.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(p.w.document.getElementById('map-regions-editor').hidden, true); p.cleanup();
});
await test('stale fetch and aborted bridge cannot leave overlays or listeners behind', async () => {
    const wait = deferred(), p = page({ wait }), ready = p.init(); p.controller.abort(); wait.resolve(); await ready;
    assert.equal(p.api(), null); assert.equal(p.calls.polygons.length, 0); assert.equal(p.map.handlers.get('click')?.size || 0, 0);
    assert.equal(p.map.layers.size, 0); p.cleanup();
    const unavailable = page({ fetchError: true, canEdit: true }); await unavailable.init(); assert.equal(unavailable.api().editor.open(), true); assert.equal(unavailable.api().getRegions().length, 0); unavailable.cleanup();
});
await test('undo histories isolate snapshots and discard redo after a new edit', () => {
    const p = page(), initial = { vertices: square }, history = p.w.NamelessMapRegions.createHistory(initial); initial.vertices[0].u = .9;
    assert.equal(history.undo().vertices[0].u, .1); history.push({ vertices: [{ u: .4, v: .4 }] }); history.undo(); assert.equal(history.canRedo, true);
    history.push({ vertices: [{ u: .5, v: .5 }] }); assert.equal(history.canRedo, false); p.cleanup();
});
console.log(passed + ' map region validation, public access, administrator draft and lifecycle regressions passed.');
